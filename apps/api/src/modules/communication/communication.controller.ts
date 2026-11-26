import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommunicationService, SendMessageDto } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('20. Communication (SMS & WhatsApp Hub)')
@Controller('communication')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Post('send')
  @AuditLog({ action: 'DISPATCH_COMMUNICATION', resource: 'COMMUNICATION' })
  @ApiOperation({ summary: 'Send transactional SMS, WhatsApp, or Email to patient/family' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.communicationService.sendMessage(dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'View recent communication outbound logs and delivery receipts' })
  async getLogs() {
    return this.communicationService.getRecentLogs();
  }

  @Get('sms-templates')
  @ApiOperation({
    summary: 'List all SMS message formats (welcome, billing, discharge, reminders, …)',
    description:
      'Operator edits are stored in system_settings and merged over the built-in defaults. ' +
      'Each template exposes its {{placeholders}} so the UI can render a preview.',
  })
  getSmsTemplates() {
    return this.communicationService.getSmsTemplates();
  }

  @Post('sms-templates/preview')
  @ApiOperation({ summary: 'Render an SMS template with sample/real variable values' })
  async previewSmsTemplate(@Body() body: { key?: string; variables?: Record<string, unknown> }) {
    return this.communicationService.previewSmsTemplate(body?.key || '', body?.variables || {});
  }

  @Post('sms-templates')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog({ action: 'UPDATE_SMS_TEMPLATES', resource: 'SYSTEM_SETTING' })
  @ApiOperation({
    summary: 'Save SMS message formats',
    description: 'Only SUPER_ADMIN may edit message formats. Changes apply to the next dispatch.',
  })
  saveSmsTemplates(@Body() body: { templates?: unknown; entries?: unknown }) {
    return this.communicationService.updateSmsTemplates(body?.templates ?? body?.entries ?? body);
  }

  @Post('sms-templates/reset')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog({ action: 'RESET_SMS_TEMPLATES', resource: 'SYSTEM_SETTING' })
  @ApiOperation({ summary: 'Restore all built-in SMS message formats' })
  resetSmsTemplates() {
    return this.communicationService.resetSmsTemplates();
  }

  @Get('whatsapp/status')
  @ApiOperation({
    summary: 'WhatsApp (Baileys) session status, QR and pairing code',
    description:
      'Returns the live connection state of the unofficial WhatsApp session. When status is ' +
      '"awaiting_qr", scan `qr` from WhatsApp > Linked devices, or use the pairing endpoint.',
  })
  getWhatsAppStatus() {
    return this.communicationService.getWhatsAppStatus();
  }

  @Get('whatsapp/diagnostics')
  @ApiOperation({
    summary: 'Probe DNS, HTTPS and WebSocket access to WhatsApp from the API container',
    description:
      'Use when the session closes with 428 before a QR appears. No credentials are returned ' +
      'and no WhatsApp session is created.',
  })
  getWhatsAppDiagnostics() {
    return this.communicationService.getWhatsAppDiagnostics();
  }

  @Post('whatsapp/reset')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog({ action: 'RESET_WHATSAPP_SESSION', resource: 'SYSTEM_SETTING' })
  @ApiOperation({
    summary: 'Clear a stale Baileys session and request a fresh QR/pairing handshake',
    description: 'SUPER_ADMIN only. Deletes the contents of BAILEYS_AUTH_DIR.',
  })
  async resetWhatsApp() {
    return this.communicationService.resetWhatsAppSession();
  }

  @Post('whatsapp/pair')
  @ApiOperation({
    summary: 'Request a WhatsApp pairing code for a phone number (no QR scan needed)',
  })
  @ApiQuery({ name: 'phone', required: false, description: 'Phone to pair, e.g. 0712345678' })
  async pairWhatsApp(@Query('phone') phone?: string, @Body() body?: { phone?: string }) {
    const target = body?.phone || phone;
    if (!target) {
      return { error: 'Provide a phone number via ?phone= or the request body.' };
    }
    return this.communicationService.requestWhatsAppPairing(target);
  }
}
