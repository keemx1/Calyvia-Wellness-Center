import { Module } from '@nestjs/common';
import { AiExtensionController } from './ai-extension.controller';
import { AiExtensionService } from './ai-extension.service';
import { AiInstitutionalToolsService } from './ai-institutional-tools.service';
import { AiIntentService } from './ai-intent.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PatientsModule } from '../patients/patients.module';
import { BillingModule } from '../billing/billing.module';
import { StaffModule } from '../staff/staff.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [
    DashboardModule,
    AppointmentsModule,
    PatientsModule,
    BillingModule,
    StaffModule,
  ],
  controllers: [AiExtensionController],
  providers: [
    AiExtensionService,
    AiInstitutionalToolsService,
    AiIntentService,
    PrismaService,
  ],
  exports: [AiExtensionService, AiInstitutionalToolsService],
})
export class AiExtensionModule {}
