import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CmsPostStatus, CmsPostType, UserRole } from '@calyvia/shared';
import { CmsService } from './cms.service';
import { NetlifyPublishService } from './netlify-publish.service';
import { CreateCmsPostDto, UpdateCmsPostDto } from './dto/cms-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

const CONTENT_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.FACILITY_ADMIN,
  UserRole.MANAGEMENT_EXECUTIVE,
];

@ApiTags('28. Website Content (CMS)')
@Controller('cms')
export class CmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly publisher: NetlifyPublishService,
  ) {}

  /**
   * Public build-time read path. It only sees rows from the
   * `published_cms_posts` view, which hard-filters to PUBLISHED content.
   */
  @Get('published')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'List published website posts (public, no drafts)',
  })
  async getPublished() {
    const posts = await this.cmsService.getPublishedPosts();
    return { posts, count: posts.length };
  }

  @Get('posts')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all CMS posts including drafts (staff only)' })
  async listPosts(
    @Query('type') type?: CmsPostType,
    @Query('status') status?: CmsPostStatus,
  ) {
    return this.cmsService.listPosts(type, status);
  }

  @Get('posts/:id')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a CMS post by id (staff only)' })
  async getPost(@Param('id') id: string) {
    return this.cmsService.getPost(id);
  }

  @Post('posts')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @AuditLog({ action: 'CREATE_CMS_POST', resource: 'CMS_POST' })
  @ApiOperation({ summary: 'Create a career, vlog or announcement draft' })
  async createPost(@Body() dto: CreateCmsPostDto, @Req() req: any) {
    const post = await this.cmsService.createPost(dto, req?.user?.id);
    const rebuild = post.status === CmsPostStatus.PUBLISHED
      ? await this.publisher.trigger(`cms-post-created:${post.slug}`)
      : { triggered: false };
    return { ...post, rebuild };
  }

  @Patch('posts/:id')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @AuditLog({ action: 'UPDATE_CMS_POST', resource: 'CMS_POST' })
  @ApiOperation({ summary: 'Update a CMS post (triggers rebuild when live)' })
  async updatePost(@Param('id') id: string, @Body() dto: UpdateCmsPostDto) {
    const post = await this.cmsService.updatePost(id, dto);
    const rebuild = post.status === CmsPostStatus.PUBLISHED
      ? await this.publisher.trigger(`cms-post-updated:${post.slug}`)
      : { triggered: false };
    return { ...post, rebuild };
  }

  @Post('posts/:id/publish')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @AuditLog({ action: 'PUBLISH_CMS_POST', resource: 'CMS_POST' })
  @ApiOperation({
    summary: 'Publish a post and trigger an automatic Netlify website rebuild',
  })
  async publishPost(@Param('id') id: string) {
    const post = await this.cmsService.setStatus(id, CmsPostStatus.PUBLISHED);
    const rebuild = await this.publisher.trigger(`cms-post-published:${post.slug}`);
    return { ...post, rebuild };
  }

  @Post('posts/:id/unpublish')
  @Roles(...CONTENT_EDITORS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @AuditLog({ action: 'UNPUBLISH_CMS_POST', resource: 'CMS_POST' })
  @ApiOperation({ summary: 'Remove a post from the public website and rebuild' })
  async unpublishPost(@Param('id') id: string) {
    const post = await this.cmsService.setStatus(id, CmsPostStatus.DRAFT);
    const rebuild = await this.publisher.trigger(`cms-post-unpublished:${post.slug}`);
    return { ...post, rebuild };
  }
}
