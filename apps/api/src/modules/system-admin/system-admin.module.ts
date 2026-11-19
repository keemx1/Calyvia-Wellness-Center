import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { SystemSettingsService } from './settings.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [SystemAdminController],
  providers: [SystemAdminService, SystemSettingsService, PrismaService],
  exports: [SystemAdminService, SystemSettingsService],
})
export class SystemAdminModule {}
