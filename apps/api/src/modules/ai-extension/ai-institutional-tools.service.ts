import { Injectable, Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard/dashboard.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { BillingService } from '../billing/billing.service';
import { StaffService } from '../staff/staff.service';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@calyvia/shared';

export interface ToolResult {
  toolName: string;
  data: any;
  summary: string;
}

@Injectable()
export class AiInstitutionalToolsService {
  private readonly logger = new Logger(AiInstitutionalToolsService.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly appointmentsService: AppointmentsService,
    private readonly billingService: BillingService,
    private readonly staffService: StaffService,
    private readonly patientsService: PatientsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verified catalog of Calyvia Wellness Center's 28 operational modules
   */
  readonly moduleCatalog = [
    { id: 'patients', code: '01', name: 'Patient Registry', category: 'Intake', path: '/api/v1/patients', description: 'Central patient master index, KDPA consent tracking, and bio-data.' },
    { id: 'crm', code: '02', name: 'CRM & Admissions Pipeline', category: 'Intake', path: '/api/v1/crm', description: 'Tracks leads from enquiry through triage and admission scheduling.' },
    { id: 'clinical', code: '03', name: 'Clinical Records & MDT', category: 'Clinical', path: '/api/v1/clinical', description: 'Psychiatric evaluations, clinical notes, and multidisciplinary reviews.' },
    { id: 'detox', code: '04', name: 'Detox (CIWA/COWS & Vitals)', category: 'Clinical', path: '/api/v1/detox', description: 'High-acuity medical withdrawal monitoring, CIWA-Ar for alcohol, COWS for opioids.' },
    { id: 'counselling', code: '05', name: 'Counselling & Therapy', category: 'Clinical', path: '/api/v1/counselling', description: 'Individual therapy, CBT sessions, group psychoeducation notes.' },
    { id: 'appointments', code: '06', name: 'Appointments & Calendar', category: 'Clinical', path: '/api/v1/appointments', description: 'Scheduling and tracking of patient consultations and doctor appointments.' },
    { id: 'billing', code: '07', name: 'Billing & Daraja M-Pesa', category: 'Finance', path: '/api/v1/billing', description: 'Invoices, receipts, deposits, and Safaricom Daraja STK Push integrations.' },
    { id: 'pharmacy', code: '08', name: 'Pharmacy & e-MAR Chart', category: 'Clinical', path: '/api/v1/pharmacy', description: 'Medication dispensation, drug inventory batches, and electronic MAR schedules.' },
    { id: 'rooms', code: '09', name: 'Rooms & Bed Allocation', category: 'Clinical', path: '/api/v1/rooms', description: 'Ward census, bed assignment, male/female/VIP ward allocations.' },
    { id: 'movement', code: '10', name: 'Movement & Visitors', category: 'Operations', path: '/api/v1/movement', description: 'Patient movement tracking, gate passes, and visitor security logs.' },
    { id: 'incidents', code: '11', name: 'Incidents & Risk Matrix', category: 'Operations', path: '/api/v1/incidents', description: 'Clinical and facility incident logs with risk severity classification.' },
    { id: 'staff', code: '12', name: 'Staff & Licence Roster', category: 'Operations', path: '/api/v1/staff', description: 'Staff directory, duty shifts, KMPDC/NCK medical licensing tracking.' },
    { id: 'tasks', code: '13', name: 'Task Management', category: 'Operations', path: '/api/v1/tasks', description: 'Shift-based task assignment and operational follow-ups.' },
    { id: 'inventory', code: '14', name: 'Stores & Inventory', category: 'Operations', path: '/api/v1/inventory', description: 'Medical equipment, non-pharmaceutical supplies, and stores re-orders.' },
    { id: 'documents', code: '15', name: 'Digital Forms & Consents', category: 'Intake', path: '/api/v1/documents', description: 'Admission contracts, financial undertakings, voluntary rehab consent.' },
    { id: 'discharge', code: '16', name: 'Discharge Management', category: 'Transitions', path: '/api/v1/discharge', description: 'Discharge summaries, clearance checklists, take-home medication.' },
    { id: 'aftercare', code: '17', name: 'Aftercare & Recovery', category: 'Transitions', path: '/api/v1/aftercare', description: 'Relapse prevention follow-up, 12-step support group connections.' },
    { id: 'family', code: '18', name: 'Family Management', category: 'Intake', path: '/api/v1/family', description: 'Family conferences, visitation scheduling, co-dependency counseling.' },
    { id: 'referrals', code: '19', name: 'Referral Partners', category: 'Intake', path: '/api/v1/referrals', description: 'Tracking medical transfers, hospital MoUs (e.g. Nairobi West Hospital).' },
    { id: 'communication', code: '20', name: 'SMS & WhatsApp Hub', category: 'Transitions', path: '/api/v1/communication', description: 'Automated appointment reminders and family broadcast messaging.' },
    { id: 'feedback', code: '21', name: 'Feedback & Complaints', category: 'Transitions', path: '/api/v1/feedback', description: 'Patient and family satisfaction surveys, grievance escalation.' },
    { id: 'dashboard', code: '22', name: 'Management Dashboard', category: 'Governance', path: '/api/v1/dashboard', description: 'Executive metrics: census, occupancy, revenue, safety indicators.' },
    { id: 'reports', code: '23', name: 'Reports & Analytics', category: 'Governance', path: '/api/v1/reports', description: 'KDPA audit logs, Ministry of Health (MoH) statistical aggregates.' },
    { id: 'security', code: '24', name: 'Security & Audit Trail', category: 'Governance', path: '/api/v1/security', description: 'Immutable audit logs, cryptographic record hashing, user access.' },
    { id: 'system_admin', code: '25', name: 'System Administration', category: 'Governance', path: '/api/v1/system-admin', description: 'Facility configuration, currency, timezone, and operational policies.' },
    { id: 'integrations', code: '26', name: 'Integrations & Webhooks', category: 'Governance', path: '/api/v1/integrations', description: 'Safaricom Daraja, Africa\'s Talking, Supabase pooler connections.' },
    { id: 'automation', code: '27', name: 'BullMQ Automation', category: 'Governance', path: '/api/v1/automation', description: 'Scheduled jobs, recurring billing reminders, vitals alert dispatches.' },
    { id: 'ai_extension', code: '28', name: 'AI Extension Boundary', category: 'Governance', path: '/api/v1/ai-extension', description: 'Institutional copilot, clinical note synthesis, operational intelligence.' },
  ];

  /**
   * Tool: Retrieve live executive metrics and bed census
   */
  async getDashboardSummary(_userRole: string = UserRole.SUPER_ADMIN): Promise<ToolResult> {
    const metrics = await this.dashboardService.getExecutiveMetrics();
    return {
      toolName: 'get_dashboard_summary',
      data: metrics,
      summary: `Facility: ${metrics.facility.name} (${metrics.facility.status}). Bed Census: ${metrics.census.occupiedBeds}/${metrics.census.totalBeds} beds occupied (${metrics.census.occupancyRatePercentage}% occupancy). Active Detox: ${metrics.admissions.activeDetoxCases}. Therapy sessions today: ${metrics.clinical.therapySessionsToday} (${metrics.clinical.completedSessions} completed, ${metrics.clinical.pendingSessions} pending). MTD Revenue: KES ${metrics.financials.mtdRevenueCollected.toLocaleString()}. Active staff accounts: ${metrics.qualityAndSafety.staffOnDuty}.`,
    };
  }

  /**
   * Tool: Retrieve upcoming appointments & consultations schedule
   */
  async getAppointmentsSummary(_userRole: string = UserRole.SUPER_ADMIN): Promise<ToolResult> {
    const appointments = await this.appointmentsService.getUpcomingAppointments();
    const count = appointments.length;
    return {
      toolName: 'get_appointments_summary',
      data: appointments,
      summary: count === 0
        ? 'No clinical appointments scheduled for today.'
        : `Currently ${count} appointment${count === 1 ? '' : 's'} on record.`,
    };
  }

  /**
   * Tool: Retrieve aggregated, privacy-preserving patient census statistics
   */
  async getPatientStatistics(_userRole: string = UserRole.SUPER_ADMIN): Promise<ToolResult> {
    const dash = await this.dashboardService.getExecutiveMetrics();
    const stats = {
      totalActiveInpatients: dash.census.occupiedBeds,
      totalCapacity: dash.census.totalBeds,
      occupancyRate: `${dash.census.occupancyRatePercentage}%`,
      activeDetoxCases: dash.admissions.activeDetoxCases,
      pendingIntakeLeads: dash.admissions.pendingIntakeLeads,
      note: 'Ward-level capacities are not separately configured; totals are counted from active bed records.',
    };

    return {
      toolName: 'get_patient_statistics',
      data: stats,
      summary: `Inpatient census is ${dash.census.occupiedBeds}/${dash.census.totalBeds} (${dash.census.occupancyRatePercentage}%). Active detox cases: ${dash.admissions.activeDetoxCases}.`,
    };
  }

  /**
   * Tool: Retrieve staff on duty and clinical roster
   */
  async getStaffWorkload(_userRole: string = UserRole.SUPER_ADMIN): Promise<ToolResult> {
    const staff = await this.staffService.getStaffDirectory();
    const count = staff.length;
    return {
      toolName: 'get_staff_workload',
      data: staff,
      summary: `${count} staff member${count === 1 ? '' : 's'} on record.`,
    };
  }

  /**
   * Tool: Retrieve financial and billing metrics
   */
  async getBillingSummary(userRole: string = UserRole.SUPER_ADMIN): Promise<ToolResult> {
    const authorizedRoles = [UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.MEDICAL_DIRECTOR, UserRole.FINANCE_BILLING, UserRole.MANAGEMENT_EXECUTIVE];
    if (!authorizedRoles.includes(userRole as UserRole)) {
      return {
        toolName: 'get_billing_summary',
        data: { restricted: true },
        summary: 'Access restricted: Billing and financial data requires administrative or finance privileges under KDPA 2019.',
      };
    }

    const dash = await this.dashboardService.getExecutiveMetrics();
    const billingData = {
      mtdRevenueCollectedKES: dash.financials.mtdRevenueCollected,
      outstandingBalancesKES: dash.financials.outstandingBalances,
      darajaMpesaShare: `${dash.financials.mpesaVolumePercentage}%`,
      bankTransferShare: `${dash.financials.bankTransferPercentage}%`,
    };

    return {
      toolName: 'get_billing_summary',
      data: billingData,
      summary: `MTD Revenue Collected: KES ${dash.financials.mtdRevenueCollected.toLocaleString()}. Outstanding Receivables: KES ${dash.financials.outstandingBalances.toLocaleString()}.`,
    };
  }

  /**
   * Tool: Search verified application features and module navigation
   */
  getApplicationHelp(query?: string): ToolResult {
    let filtered = this.moduleCatalog;
    if (query?.trim()) {
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.replace(/[^a-z0-9]/g, ''))
        .filter((term) => term.length > 1);

      if (terms.length > 0) {
        filtered = this.moduleCatalog
          .map((module) => {
            const haystack = [
              module.code,
              module.id,
              module.name,
              module.category,
              module.description,
            ]
              .join(' ')
              .toLowerCase();
            const score = terms.reduce(
              (total, term) => total + (haystack.includes(term) ? 1 : 0),
              0,
            );
            return { module, score };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ module }) => module);
      }
    }
    return {
      toolName: 'get_application_help',
      data: filtered,
      summary: `Found ${filtered.length} matching modules in the Calyvia Wellness Center platform.`,
    };
  }

  /**
   * Tool: Retrieve institutional protocols (Detox CIWA/COWS, Emergency Transfers, KDPA)
   */
  getInstitutionalProtocols(_protocolType?: string): ToolResult {
    const protocols = {
      alcoholDetoxCIWA: {
        title: 'CIWA-Ar Alcohol Withdrawal Protocol',
        scaleRange: '0 - 67',
        thresholds: 'Score < 10: Mild (supportive care, monitor Q4H); 10 - 18: Moderate (Diazepam/Lorazepam protocol, monitor Q2H); > 18: Severe (High Acuity, continuous vitals, physician review Q1H).',
        emergencyAction: 'If delirium tremens, seizures, or SpO2 < 92%, alert Medical Director immediately and initiate emergency transfer to Nairobi West Hospital.',
      },
      opioidDetoxCOWS: {
        title: 'COWS Clinical Opiate Withdrawal Protocol',
        scaleRange: '0 - 48',
        thresholds: 'Score 5-12: Mild; 13-24: Moderate; 25-36: Moderately Severe; >36: Severe withdrawal.',
        guidelines: 'Symptomatic management (Clonidine, anti-emetics), monitor pulse and pupil size, hydration.',
      },
      emergencyHospitalMoU: {
        partnerHospital: 'The Nairobi West Hospital & Kiambu Level 5',
        transferLead: 'Dr. Evelyn Wanjiku (Medical Director) / Shift Lead Nurse',
        ambulanceHotline: '+254 700 534 306',
        protocol: 'Medical stabilization, escort nurse with patient chart and transfer summary, notification of next-of-kin.',
      },
      kdpaCompliance: {
        act: 'Kenya Data Protection Act 2019 (KDPA)',
        rules: 'All patient bio-data and health records encrypted at rest. PII masked in UI. Explicit patient/family consent required for all disclosures. No raw patient records exported without audit logging.',
      },
    };

    return {
      toolName: 'get_institutional_protocols',
      data: protocols,
      summary: 'Institutional protocols verified: CIWA-Ar Alcohol protocol, COWS Opioid protocol, Emergency Hospital Transfer MoU, and KDPA 2019 data privacy boundaries.',
    };
  }
}
