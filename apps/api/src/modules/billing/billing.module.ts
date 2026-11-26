import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { MpesaService } from './mpesa.service';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  controllers: [BillingController],
  providers: [BillingService, InvoicePdfService, MpesaService, PrismaService],
  exports: [BillingService, InvoicePdfService, MpesaService],
})
export class BillingModule {}
