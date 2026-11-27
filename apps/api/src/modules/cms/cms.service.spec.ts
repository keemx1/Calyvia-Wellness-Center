import { BadRequestException } from '@nestjs/common';
import { CmsPostStatus, CmsPostType } from '@calyvia/shared';
import { CmsService, normalizeEmbedUrl, sanitizeContent, slugify } from './cms.service';
import { NetlifyPublishService } from './netlify-publish.service';

const baseRow = {
  id: 'post-1',
  slug: 'nursing-jobs',
  type: 'CAREER',
  status: 'DRAFT',
  title: 'Nursing Jobs',
  summary: 'Join our team',
  content: [{ type: 'paragraph', text: 'Apply now' }],
  cover_image_url: null,
  embed_url: null,
  location: 'Ruiru',
  employment_type: 'Full time',
  application_email: 'jobs@calyviawellness.co.ke',
  application_url: null,
  expires_at: null,
  published_at: null,
  author_id: null,
  author_name: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

function makePrisma(overrides: Record<string, any> = {}) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('INSERT INTO public.cms_posts')) {
      return { rows: [{ id: 'post-1' }] };
    }
    if (sql.includes('SELECT id FROM public.cms_posts')) {
      return { rows: [] };
    }
    if (sql.includes('public.published_cms_posts')) {
      return { rows: [{ ...baseRow, status: 'PUBLISHED', published_at: new Date('2026-01-02') }] };
    }
    if (sql.includes('LEFT JOIN public.users')) {
      return { rows: [overrides.row || baseRow] };
    }
    return { rows: [] };
  });
  return { query } as any;
}

describe('CmsService', () => {
  it('sanitizes structured content and strips markup', () => {
    const result = sanitizeContent([
      { type: 'heading', text: '<b>Requirements</b>' },
      { type: 'list', items: ['<script>x</script>Registered nurse', 'Compassion'] },
    ]);
    expect(result).toEqual([
      { type: 'heading', text: 'Requirements' },
      { type: 'list', items: ['xRegistered nurse', 'Compassion'] },
    ]);
  });

  it('rejects unsupported content block types', () => {
    expect(() => sanitizeContent([{ type: 'html', text: '<iframe/>' }])).toThrow(
      BadRequestException,
    );
  });

  it('normalizes YouTube and Vimeo links but rejects arbitrary iframes', () => {
    expect(normalizeEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ_9')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ_9',
    );
    expect(normalizeEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
    expect(() => normalizeEmbedUrl('https://evil.example/embed')).toThrow(
      BadRequestException,
    );
  });

  it('generates safe slugs', () => {
    expect(slugify('Senior Nurse – Ruiru!')).toBe('senior-nurse-ruiru');
  });

  it('reads only the published view for the public website', async () => {
    const prisma = makePrisma();
    const service = new CmsService(prisma);
    const posts = await service.getPublishedPosts();
    expect(prisma.query).toHaveBeenCalledWith(expect.stringContaining('published_cms_posts'));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: 'nursing-jobs',
      coverImageUrl: null,
      publishedAt: expect.any(Date),
    });
  });

  it('creates a published post with a publish timestamp and normalized video', async () => {
    const prisma = makePrisma();
    const service = new CmsService(prisma);
    const post = await service.createPost(
      {
        title: 'Nursing Jobs',
        type: CmsPostType.CAREER,
        status: CmsPostStatus.PUBLISHED,
        content: [{ type: 'paragraph', text: '<i>Apply</i> now' }],
        embedUrl: 'https://youtu.be/abc123XYZ_9',
      } as any,
      'user-1',
    );
    const insertCall = prisma.query.mock.calls.find((call: any[]) =>
      call[0].includes('INSERT INTO public.cms_posts'),
    );
    expect(insertCall).toBeDefined();
    const values = insertCall![1];
    expect(values).toContain('user-1');
    expect(values).toContain('https://www.youtube-nocookie.com/embed/abc123XYZ_9');
    expect(values.some((value: any) => typeof value === 'string' && value.includes('T'))).toBe(true);
    expect(post.status).toBe('DRAFT'); // mock SELECT returns the stored row fixture
  });

  it('publishes and unpublishes with explicit timestamps', async () => {
    const prisma = makePrisma();
    const service = new CmsService(prisma);
    await service.setStatus('post-1', CmsPostStatus.PUBLISHED);
    const publishCall = prisma.query.mock.calls.find((call: any[]) =>
      call[0].includes('SET status = $1'),
    );
    expect(publishCall).toBeDefined();
    expect(publishCall![1][0]).toBe(CmsPostStatus.PUBLISHED);
    expect(publishCall![1][1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await service.setStatus('post-1', CmsPostStatus.DRAFT);
    const unpublishCall = prisma.query.mock.calls
      .filter((call: any[]) => call[0].includes('SET status = $1'))
      .pop();
    expect(unpublishCall![1][0]).toBe(CmsPostStatus.DRAFT);
    expect(unpublishCall![1][1]).toBeNull();
  });
});

describe('NetlifyPublishService', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.NETLIFY_CMS_BUILD_HOOK_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NETLIFY_CMS_BUILD_HOOK_URL;
    else process.env.NETLIFY_CMS_BUILD_HOOK_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('does nothing when no build hook is configured', async () => {
    delete process.env.NETLIFY_CMS_BUILD_HOOK_URL;
    const service = new NetlifyPublishService();
    await expect(service.trigger('test')).resolves.toEqual({
      triggered: false,
      reason: 'not_configured',
    });
  });

  it('rejects non-Netlify hook URLs', async () => {
    process.env.NETLIFY_CMS_BUILD_HOOK_URL = 'https://evil.example/hook';
    const service = new NetlifyPublishService();
    await expect(service.trigger('test')).resolves.toEqual({
      triggered: false,
      reason: 'invalid_hook_url',
    });
  });

  it('POSTs to a valid Netlify build hook', async () => {
    process.env.NETLIFY_CMS_BUILD_HOOK_URL = 'https://api.netlify.com/build_hooks/abc123';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;
    const service = new NetlifyPublishService();
    await expect(service.trigger('cms-post-published:test')).resolves.toEqual({
      triggered: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[0][1].body).toContain('cms-post-published:test');
  });
});
