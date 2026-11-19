import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommunicationService, SendMessageDto } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

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
