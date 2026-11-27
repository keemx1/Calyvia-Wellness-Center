import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CmsPostStatus, CmsPostType } from '@calyvia/shared';
import { PrismaService } from '../../database/prisma.service';
import { CreateCmsPostDto, UpdateCmsPostDto } from './dto/cms-post.dto';

type BlockType = 'heading' | 'paragraph' | 'list' | 'quote';
export interface CmsBlock {
  type: BlockType;
  text?: string;
  items?: string[];
}

const ALLOWED_BLOCK_TYPES: BlockType[] = ['heading', 'paragraph', 'list', 'quote'];

/** Strip markup and control characters. The site renders these values as text. */
function asPlainText(value: string, max = 4000): string {
  const withoutMarkup = value.replace(/<[^>]*>/g, '');
  const withoutControlChars = Array.from(withoutMarkup)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  return withoutControlChars.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeContent(blocks: unknown): CmsBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((raw: any) => {
    if (!raw || !ALLOWED_BLOCK_TYPES.includes(raw.type)) {
      throw new BadRequestException(
        'Unsupported content block. Use heading, paragraph, list or quote.',
      );
    }
    if (raw.type === 'list') {
      if (!Array.isArray(raw.items) || raw.items.length === 0) {
        throw new BadRequestException('A list block requires at least one item.');
      }
      return {
        type: 'list',
        items: raw.items.map((item: unknown) => {
          if (typeof item !== 'string') {
            throw new BadRequestException('List items must be text.');
          }
          return asPlainText(item, 500);
        }),
      };
    }
    if (typeof raw.text !== 'string' || !raw.text.trim()) {
      throw new BadRequestException(`A ${raw.type} block requires text.`);
    }
    return { type: raw.type, text: asPlainText(raw.text) };
  });
}

/**
 * Accepts normal YouTube/Vimeo links and returns a privacy-friendly embed URL.
 * Anything else is rejected so the public site never renders an arbitrary iframe.
 */
export function normalizeEmbedUrl(input: string): string {
  const value = input.trim();
  let match = value.match(
    /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{6,})/i,
  );
  if (match) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}`;
  }
  match = value.match(
    /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d{6,})/i,
  );
  if (match) {
    return `https://player.vimeo.com/video/${match[1]}`;
  }
  throw new BadRequestException(
    'Video link must be a valid YouTube or Vimeo URL.',
  );
}

export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'post'
  );
}

function mapCmsPost(row: any): any {
  if (!row) return null;
  let content: CmsBlock[] = [];
  if (typeof row.content === 'string') {
    try {
      content = JSON.parse(row.content);
    } catch {
      content = [];
    }
  } else if (Array.isArray(row.content)) {
    content = row.content;
  }
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: row.summary || '',
    content,
    coverImageUrl: row.cover_image_url || null,
    embedUrl: row.embed_url || null,
    location: row.location || null,
    employmentType: row.employment_type || null,
    applicationEmail: row.application_email || null,
    applicationUrl: row.application_url || null,
    expiresAt: row.expires_at || null,
    publishedAt: row.published_at || null,
    authorId: row.author_id || null,
    authorName: row.author_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPosts(type?: CmsPostType, status?: CmsPostStatus): Promise<any[]> {
    const clauses: string[] = [];
    const values: any[] = [];
    if (type) {
      values.push(type);
      clauses.push(`p.type::text = $${values.length}`);
    }
    if (status) {
      values.push(status);
      clauses.push(`p.status::text = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.prisma.query(
      `SELECT p.*, u.full_name AS author_name
         FROM public.cms_posts p
         LEFT JOIN public.users u ON u.id = p.author_id
         ${where}
        ORDER BY p.created_at DESC`,
      values,
    );
    return result.rows.map(mapCmsPost);
  }

  async getPost(id: string): Promise<any> {
    const result = await this.prisma.query(
      `SELECT p.*, u.full_name AS author_name
         FROM public.cms_posts p
         LEFT JOIN public.users u ON u.id = p.author_id
        WHERE p.id = $1`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('CMS post not found');
    return mapCmsPost(result.rows[0]);
  }

  /** Public, unauthenticated read path used by the website build. */
  async getPublishedPosts(): Promise<any[]> {
    const result = await this.prisma.query(
      `SELECT id, slug, type, title, summary, content,
              cover_image_url, embed_url, location, employment_type,
              application_email, application_url, published_at, updated_at
         FROM public.published_cms_posts
        ORDER BY published_at DESC`,
    );
    return result.rows.map(mapCmsPost);
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const params: any[] = [candidate];
      const exclude = excludeId ? `AND id <> $2` : '';
      if (excludeId) params.push(excludeId);
      const result = await this.prisma.query(
        `SELECT id FROM public.cms_posts WHERE slug = $1 ${exclude} LIMIT 1`,
        params,
      );
      if (result.rows.length === 0) return candidate;
    }
    throw new BadRequestException('Could not generate a unique slug');
  }

  async createPost(dto: CreateCmsPostDto, authorId?: string): Promise<any> {
    const status = dto.status || CmsPostStatus.DRAFT;
    const slug = await this.uniqueSlug(dto.slug ? slugify(dto.slug) : slugify(dto.title));
    const data: Record<string, any> = {
      slug,
      type: dto.type,
      status,
      title: dto.title.trim(),
      summary: (dto.summary || '').trim(),
      content: JSON.stringify(sanitizeContent(dto.content || [])),
      cover_image_url: dto.coverImageUrl || null,
      embed_url: dto.embedUrl ? normalizeEmbedUrl(dto.embedUrl) : null,
      location: dto.location?.trim() || null,
      employment_type: dto.employmentType?.trim() || null,
      application_email: dto.applicationEmail || null,
      application_url: dto.applicationUrl || null,
      expires_at: dto.expiresAt || null,
      published_at: status === CmsPostStatus.PUBLISHED ? new Date().toISOString() : null,
      author_id: authorId || null,
    };
    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const casts: Record<string, string> = {
      type: '"CmsPostType"',
      status: '"CmsPostStatus"',
    };
    const values = keys.map((key) =>
      casts[key] ? `${placeholders[keys.indexOf(key)]}::${casts[key]}` : placeholders[keys.indexOf(key)],
    );
    const result = await this.prisma.query(
      `INSERT INTO public.cms_posts (${keys.map((k) => `"${k}"`).join(', ')})
       VALUES (${values.join(', ')})
       RETURNING id`,
      Object.values(data),
    );
    return this.getPost(result.rows[0].id);
  }

  async updatePost(id: string, dto: UpdateCmsPostDto): Promise<any> {
    const existing = await this.getPost(id);
    const updates: Record<string, any> = {};

    if (dto.title !== undefined) updates.title = dto.title.trim();
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.summary !== undefined) updates.summary = dto.summary.trim();
    if (dto.content !== undefined) updates.content = JSON.stringify(sanitizeContent(dto.content));
    if (dto.coverImageUrl !== undefined) updates.cover_image_url = dto.coverImageUrl || null;
    if (dto.embedUrl !== undefined) {
      updates.embed_url = dto.embedUrl ? normalizeEmbedUrl(dto.embedUrl) : null;
    }
    if (dto.location !== undefined) updates.location = dto.location?.trim() || null;
    if (dto.employmentType !== undefined) updates.employment_type = dto.employmentType?.trim() || null;
    if (dto.applicationEmail !== undefined) updates.application_email = dto.applicationEmail || null;
    if (dto.applicationUrl !== undefined) updates.application_url = dto.applicationUrl || null;
    if (dto.expiresAt !== undefined) updates.expires_at = dto.expiresAt || null;
    if (dto.slug !== undefined) {
      updates.slug = await this.uniqueSlug(slugify(dto.slug), id);
    }
    if (dto.status !== undefined) {
      updates.status = dto.status;
      updates.published_at =
        dto.status === CmsPostStatus.PUBLISHED
          ? existing.publishedAt || new Date().toISOString()
          : null;
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) return existing;

    const values = Object.values(updates);
    const casts: Record<string, string> = {
      type: '"CmsPostType"',
      status: '"CmsPostStatus"',
    };
    const setClauses = keys.map((key, i) => {
      const cast = casts[key] ? `::${casts[key]}` : '';
      return `"${key}" = $${i + 1}${cast}`;
    });
    await this.prisma.query(
      `UPDATE public.cms_posts SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1}`,
      [...values, id],
    );
    return this.getPost(id);
  }

  async setStatus(id: string, status: CmsPostStatus): Promise<any> {
    const existing = await this.getPost(id);
    const publishedAt =
      status === CmsPostStatus.PUBLISHED
        ? existing.publishedAt || new Date().toISOString()
        : null;
    await this.prisma.query(
      `UPDATE public.cms_posts
          SET status = $1::"CmsPostStatus", published_at = $2
        WHERE id = $3`,
      [status, publishedAt, id],
    );
    return this.getPost(id);
  }
}
