import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';

// Foundations
import { CryptoModule } from './common/crypto/crypto.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaModule } from './database/prisma.module';
import { PrismaService } from './database/prisma.service';

// Intake & Relationships
import { PatientsModule } from './modules/patients/patients.module';
import { CrmModule } from './modules/crm/crm.module';
import { FamilyModule } from './modules/family/family.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { DocumentsModule } from './modules/documents/documents.module';

// Clinical & Care
import { ClinicalModule } from './modules/clinical/clinical.module';
import { DetoxModule } from './modules/detox/detox.module';
import { CounsellingModule } from './modules/counselling/counselling.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { RoomsModule } from './modules/rooms/rooms.module';

// Finance & Operations
import { BillingModule } from './modules/billing/billing.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StaffModule } from './modules/staff/staff.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MovementModule } from './modules/movement/movement.module';
import { IncidentsModule } from './modules/incidents/incidents.module';

// Transitions & Communications
import { DischargeModule } from './modules/discharge/discharge.module';
import { AftercareModule } from './modules/aftercare/aftercare.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AutomationModule } from './modules/automation/automation.module';

// Intelligence & Governance
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SystemAdminModule } from './modules/system-admin/system-admin.module';
import * as path from 'path';
import { AiExtensionModule } from './modules/ai-extension/ai-extension.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Production secrets must be injected by the deployment environment only.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../../../.env'),
      ],
    }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    SecurityModule,

    // Phase 1
    PatientsModule,
    CrmModule,
    FamilyModule,
    ReferralsModule,
    DocumentsModule,

    // Phase 2
    ClinicalModule,
    DetoxModule,
    CounsellingModule,
    AppointmentsModule,
    PharmacyModule,
    RoomsModule,

    // Phase 3
    BillingModule,
    InventoryModule,
    StaffModule,
    TasksModule,
    MovementModule,
    IncidentsModule,

    // Phase 4
    DischargeModule,
    AftercareModule,
    CommunicationModule,
    FeedbackModule,
    IntegrationsModule,
    AutomationModule,

    // Phase 5
    DashboardModule,
    ReportsModule,
    SystemAdminModule,
    AiExtensionModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
