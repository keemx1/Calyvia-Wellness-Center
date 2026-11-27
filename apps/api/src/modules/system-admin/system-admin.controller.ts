import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemAdminService } from './system-admin.service';
import { SystemSettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('25. System Administration')
@Controller('system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SystemAdminController {
  constructor(
    private readonly systemAdminService: SystemAdminService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  @Get('facility-config')
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'Get Calyvia facility master configuration and service tracks' })
  async getFacilityConfig() {
    return this.systemAdminService.getFacilityConfig();
  }

  @Get('gateway-settings')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List SMS/WhatsApp gateway settings',
    description:
      'Returns each setting with its effective value and where it came from (env or database). ' +
      'Secret values are never returned in plaintext.',
  })
  async listGatewaySettings() {
    return this.settingsService.listGatewaySettings();
  }

  @Post('gateway-settings')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog({ action: 'UPDATE_GATEWAY_SETTINGS', resource: 'SYSTEM_SETTING' })
  @ApiOperation({
    summary: 'Save SMS/WhatsApp gateway settings',
    description:
      'Values are stored in system_settings, encrypted for secrets. An environment variable, ' +
      'when set, always takes precedence and the write is reported as not stored.',
  })
  async saveGatewaySettings(
    @Body() body: { entries: Array<{ key: string; value: string }>; clearSecrets?: boolean },
  ) {
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    return this.settingsService.saveGatewaySettings(entries, {
      clearSecrets: !!body?.clearSecrets,
    });
  }

  @Post('settings')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog({ action: 'UPDATE_SYSTEM_SETTING', resource: 'SYSTEM_SETTING' })
  @ApiOperation({ summary: 'Update facility system setting or operational parameter' })
  async updateSetting(@Body() body: { key: string; value: string; category: string; isEncrypted?: boolean }) {
    return this.systemAdminService.updateSetting(
      body.key,
      body.value,
      body.category,
      !!body.isEncrypted,
    );
  }

  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Read a single system setting by key' })
  async getSetting(@Query('key') key: string) {
    return this.systemAdminService.getSetting(key);
  }
}
