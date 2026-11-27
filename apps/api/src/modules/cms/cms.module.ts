import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { NetlifyPublishService } from './netlify-publish.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, NetlifyPublishService, PrismaService],
  exports: [CmsService, NetlifyPublishService],
})
export class CmsModule {}
