import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../../database/prisma.service';
import { CrmModule } from '../crm/crm.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [CrmModule, BillingModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, PrismaService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
