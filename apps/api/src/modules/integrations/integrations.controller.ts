import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { MpesaService } from '../billing/mpesa.service';

@ApiTags('26. Integrations (Daraja M-Pesa & Webhooks)')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly mpesaService: MpesaService,
  ) {}

  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Safaricom Daraja Lipa Na M-Pesa Online async callback handler' })
  @ApiResponse({ status: 200, description: 'Callback received and transaction recorded' })
  async mpesaCallback(@Req() request: any, @Body() payload: any) {
    this.mpesaService.assertCallbackIpAllowed(request);
    return this.integrationsService.handleMpesaCallback(payload);
  }

  @Post('webhook/website-lead')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public webhook receiving enquiries from calyviawellness.co.ke' })
  async websiteLeadWebhook(@Body() leadPayload: any) {
    return this.integrationsService.handleWebsiteEnquiry(leadPayload);
  }
}
