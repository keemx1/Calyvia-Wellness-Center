import { Injectable } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { MpesaService } from '../billing/mpesa.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private crmService: CrmService,
    private mpesaService: MpesaService,
  ) {}

  async handleMpesaCallback(payload: any) {
    return this.mpesaService.handleCallback(payload);
  }

  async handleWebsiteEnquiry(leadPayload: {
    fullName: string;
    phone: string;
    email?: string;
    substancesUsed?: string;
    message?: string;
  }) {
    return this.crmService.createLead({
      fullName: leadPayload.fullName,
      phone: leadPayload.phone,
      email: leadPayload.email,
      channel: 'WEBSITE_FORM_WEBHOOK',
      substancesUsed: leadPayload.substancesUsed,
      notes: leadPayload.message,
    });
  }
}
