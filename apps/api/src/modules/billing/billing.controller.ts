import { Controller, Get, Post, Delete, Body, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  BillingService,
  CreateInvoiceDto,
  RecordPaymentDto,
  TriggerMpesaStkDto,
} from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

const BILLING_ROLES = [UserRole.SUPER_ADMIN, UserRole.FINANCE_BILLING, UserRole.FACILITY_ADMIN];

@ApiTags('07. Billing, Invoicing & Payments')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @Roles(...BILLING_ROLES)
  @AuditLog({ action: 'CREATE_INVOICE', resource: 'INVOICE' })
  @ApiOperation({ summary: 'Create a manual invoice with line items' })
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Post('invoices/auto')
  @Roles(...BILLING_ROLES)
  @AuditLog({ action: 'AUTO_GENERATE_INVOICES', resource: 'INVOICE' })
  @ApiOperation({ summary: 'Generate invoices for all active admissions (idempotent per day)' })
  async generateAutomaticInvoices() {
    return this.billingService.generateAutomaticInvoices();
  }

  @Get('invoices/:id/pdf')
  @Roles(...BILLING_ROLES)
  @AuditLog({ action: 'DOWNLOAD_INVOICE_PDF', resource: 'INVOICE' })
  @ApiOperation({ summary: 'Download an invoice PDF on the Calyvia letterhead' })
  async downloadInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const { bytes, fileName } = await this.billingService.generateInvoicePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(bytes.byteLength),
    });
    res.send(Buffer.from(bytes));
  }

  @Post('invoices/:id/send-whatsapp')
  @Roles(...BILLING_ROLES)
  @AuditLog({ action: 'SEND_INVOICE_WHATSAPP', resource: 'INVOICE' })
  @ApiOperation({ summary: 'Send the invoice PDF as a real WhatsApp attachment' })
  async sendInvoiceOnWhatsApp(
    @Param('id') id: string,
    @Body() body?: { recipient?: string },
  ) {
    return this.billingService.sendInvoiceViaWhatsApp(id, body?.recipient);
  }

  @Delete('invoices/:id')
  @Roles(...BILLING_ROLES)
  @AuditLog({ action: 'DELETE_INVOICE', resource: 'INVOICE' })
  @ApiOperation({ summary: 'Delete an invoice and its line items/payments' })
  async deleteInvoice(@Param('id') id: string) {
    return this.billingService.deleteInvoice(id);
  }

  @Post('payments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_BILLING, UserRole.ADMISSIONS_FRONT_DESK)
  @AuditLog({ action: 'RECORD_PAYMENT', resource: 'PAYMENT' })
  @ApiOperation({ summary: 'Record manual or bank payment against invoice' })
  async recordPayment(@Body() dto: RecordPaymentDto) {
    return this.billingService.recordPayment(dto);
  }

  @Post('mpesa/stk-push')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_BILLING, UserRole.ADMISSIONS_FRONT_DESK)
  @AuditLog({ action: 'TRIGGER_MPESA_STK_PUSH', resource: 'PAYMENT' })
  @ApiOperation({ summary: 'Trigger Safaricom Lipa Na M-Pesa Online STK Push directly to phone' })
  async triggerMpesaStk(@Body() dto: TriggerMpesaStkDto) {
    return this.billingService.triggerDarajaStk(dto);
  }

  @Get('invoices')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'List invoices with manual bill-to details' })
  async getInvoices() {
    return this.billingService.getInvoices();
  }

  @Get('payments')
  @Roles(...BILLING_ROLES)
  @ApiOperation({ summary: 'List payments recorded' })
  async getPayments() {
    return this.billingService.getPayments();
  }
}
