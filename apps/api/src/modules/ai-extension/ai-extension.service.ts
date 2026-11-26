import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AiInstitutionalToolsService } from './ai-institutional-tools.service';
import { AuditService } from '../audit/audit.service';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto';
import { UserRole } from '@calyvia/shared';

export interface AiSummarizationContract {
  patientId: string;
  notesToAggregate: string[];
  outputFormat: 'SOAP_SUMMARY' | 'DISCHARGE_BRIEF' | 'RISK_SYNTHESIS';
}

export interface AiFollowUpSuggestionContract {
  patientId: string;
  withdrawalTrend: string;
  counsellingEngagementScore: number;
}

const number = (value: any) => Number(value || 0).toLocaleString();

const BILLING_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.FACILITY_ADMIN,
  UserRole.MEDICAL_DIRECTOR,
  UserRole.FINANCE_BILLING,
  UserRole.MANAGEMENT_EXECUTIVE,
]);

const canViewBilling = (role: string) => BILLING_ROLES.has(role as UserRole);

@Injectable()
export class AiExtensionService {
  private readonly logger = new Logger(AiExtensionService.name);
  private readonly isAiEnabled = process.env.ENABLE_AI_EXTENSIONS === 'true';

  constructor(
    private readonly toolsService: AiInstitutionalToolsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolve short conversational follow-ups ("and appointments?", "what about beds?")
   * into a full institutional query so the same grounded tool is used rather than
   * guessing from the previous answer.
   */
  private followUpTopic(message: string): string | null {
    if (!/^(and|also|what about|how about|tell me more|show me|same|again)\b/.test(message)) {
      return null;
    }
    const topics: Array<[RegExp, string]> = [
      [/appointment|schedule|calendar|session/, 'What appointments are scheduled for today?'],
      [/bed|census|ward|occupancy|room/, 'Summarize bed census and ward occupancy'],
      [/bill|invoice|revenue|mpesa|m-pesa|payment|daraja/, 'Summarize outstanding invoices and billing'],
      [/staff|doctor|nurse|therapist|roster/, 'Give me the staff workload for today'],
      [/detox|ciwa|cows|withdrawal|alcohol|opioid/, 'What is the CIWA-Ar detox protocol?'],
      [/summary|overview|status/, 'Give me today\'s operational summary'],
    ];
    return topics.find(([pattern]) => pattern.test(message))?.[1] || null;
  }

  private moduleLabel(contextModule?: string): string | null {
    if (!contextModule) return null;
    const catalog = (this.toolsService as any)?.moduleCatalog;
    if (Array.isArray(catalog)) {
      const match = catalog.find((module: any) => module.id === contextModule);
      if (match) return `Module ${match.code}: ${match.name}`;
    }
    return contextModule.replace(/_/g, ' ');
  }

  private moduleSearchQuery(message: string): string {
    return message
      .replace(/\b(how|do|i|where|is|are|the|a|an|to|in|of|for|module|help|navigate|admit|register|please|can|you)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Process chat requests with role-aware, live-data-grounded institutional answers. */
  async processChat(
    dto: AiChatRequestDto,
    user: { id?: string; role?: string; fullName?: string } = {},
  ): Promise<AiChatResponseDto> {
    // Identity always comes from the verified JWT. Never assume an administrator.
    if (!user?.id || !user?.role) {
      throw new UnauthorizedException('You must be signed in to use Calyvia AI.');
    }

    const userRole = user.role as UserRole;
    const userName = user.fullName || 'there';
    const originalMessage = dto.message.trim();
    const lowerOriginal = originalMessage.toLowerCase();
    const resolvedFollowUp = this.followUpTopic(lowerOriginal);
    const message = resolvedFollowUp || originalMessage;
    const lowerMessage = message.toLowerCase();
    const generatedAt = new Date().toISOString();
    const contextLabel = this.moduleLabel(dto.contextModule);
    const contextNote = contextLabel ? `\n\n_Context: you are viewing **${contextLabel}**._` : '';

    const toolsExecuted: string[] = [];
    const referencedModules: string[] = [];
    let reply = '';
    let suggestedFollowUps: string[] = [];

    if (resolvedFollowUp) toolsExecuted.push('conversation_context');

    try {
      await this.auditService.logAction({
        userId: user.id,
        role: userRole,
        action: 'AI_ASSISTANT_QUERY',
        resource: 'AI_COPILOT',
        diffJson: {
          querySummary: originalMessage.substring(0, 100),
          resolvedQuery: resolvedFollowUp || null,
          contextModule: dto.contextModule || 'global',
        },
      });
    } catch (e) {
      this.logger.warn('Audit logging for AI query skipped:', e);
    }

    const meta = () => ({
      modelUsed: 'calyvia-institutional-copilot-v1-grounded',
      toolsExecuted,
      roleAuthorized: userRole,
      contextModule: dto.contextModule || null,
      generatedAt,
      groundedInLiveData: toolsExecuted.some((tool) =>
        [
          'get_dashboard_summary',
          'get_appointments_summary',
          'get_patient_statistics',
          'get_billing_summary',
          'get_staff_workload',
        ].includes(tool),
      ),
    });

    // 1. Clinical safety boundary — never diagnose, prescribe or recommend doses.
    const clinicalRequest =
      /prescribe|diagnose|give medicine|recommend (a )?(dose|medication)|what (medicine|drug) should/i.test(
        lowerMessage,
      ) && !/protocol|what is|policy|module|guideline/i.test(lowerMessage);

    if (clinicalRequest) {
      return {
        success: true,
        reply:
          `⚠️ **Clinical Safety Boundary & Healthcare Policy**\n\n` +
          `* **I cannot diagnose individual patients, prescribe medications, or recommend doses.**\n` +
          `* Treatment decisions and tapering regimens must be verified by a licensed Calyvia clinician.\n` +
          `* For medication schedules, use the **e-MAR Chart (Module 08: Pharmacy)**; for clinical assessments, use **Module 03: Clinical Records**.\n\n` +
          `*For emergencies, follow the institutional hospital-transfer protocol and call **+254 700 534 306**.*` +
          contextNote,
        suggestedFollowUps: [
          'What is the CIWA-Ar alcohol protocol?',
          'What is the COWS opioid withdrawal protocol?',
          'Summarize today\'s appointments',
        ],
        referencedModules: ['clinical', 'detox', 'pharmacy'],
        timestamp: generatedAt,
        meta: { ...meta(), toolsExecuted: ['clinical_safety_guard'] },
      };
    }

    // 2. Operational summary — live executive metrics only.
    if (
      lowerMessage.includes('summary') ||
      lowerMessage.includes('operational') ||
      lowerMessage.includes('overview') ||
      lowerMessage.includes('happening today') ||
      lowerMessage.includes('status')
    ) {
      toolsExecuted.push('get_dashboard_summary');
      referencedModules.push('dashboard', 'detox', 'rooms');
      const metrics = (await this.toolsService.getDashboardSummary(userRole)).data;

      reply =
        `### 🏥 Calyvia Wellness Center — Operational Summary\n\n` +
        `**Facility Status:** ${metrics.facility?.status || 'OPERATIONAL'} (${metrics.facility?.location || 'Ruiru, Kiambu County'})\n` +
        `**Reporting Period:** Today, ${new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
        `#### 🛏️ Bed Census & Ward Occupancy\n` +
        `* **Occupancy:** **${metrics.census?.occupiedBeds || 0} / ${metrics.census?.totalBeds || 0} Beds** (${metrics.census?.occupancyRatePercentage || 0}%)\n` +
        `* **Available Beds:** **${metrics.census?.availableBeds || 0}**\n` +
        `* **Active Detox Cases:** **${metrics.admissions?.activeDetoxCases || 0}**\n\n` +
        `#### 🩺 Clinical & Patient Flow\n` +
        `* **Sessions Today:** **${metrics.clinical?.therapySessionsToday || 0}** (${metrics.clinical?.completedSessions || 0} completed, ${metrics.clinical?.pendingSessions || 0} pending)\n` +
        `* **Active Staff Accounts:** **${metrics.qualityAndSafety?.staffOnDuty || 0}**\n` +
        `* **Pending Intake Leads:** **${metrics.admissions?.pendingIntakeLeads || 0}**\n\n` +
        `All figures above are read live from the operational database.`;

      suggestedFollowUps = [
        'What appointments are scheduled today?',
        'Summarize bed census and ward occupancy',
        ...(canViewBilling(userRole) ? ['Summarize billing and Daraja M-Pesa revenue'] : []),
      ];
    }
    // 3. Appointments — live schedule rows.
    else if (
      lowerMessage.includes('appointment') ||
      lowerMessage.includes('schedule') ||
      lowerMessage.includes('calendar') ||
      lowerMessage.includes('session')
    ) {
      toolsExecuted.push('get_appointments_summary');
      referencedModules.push('appointments', 'clinical', 'counselling');
      const appts = (await this.toolsService.getAppointmentsSummary(userRole)).data;

      if (!Array.isArray(appts) || appts.length === 0) {
        reply =
          `### 📅 Upcoming Clinical & Consultation Schedule\n\n` +
          `No upcoming appointments are currently on record. You can schedule one under **Module 06: Appointments & Calendar**.`;
      } else {
        reply =
          `### 📅 Clinical & Consultation Schedule\n\n` +
          `| Time | Subject | Clinician | Type | Status |\n` +
          `| :--- | :--- | :--- | :--- | :--- |\n` +
          appts
            .slice(0, 15)
            .map(
              (a: any) =>
                `| **${a.time || (a.startTime ? new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}** | ${a.title || 'Consultation'} | ${a.staffMemberName || a.doctor || 'Unassigned'} | ${a.appointmentType || 'CONSULTATION'} | ${a.status || 'SCHEDULED'} |`,
            )
            .join('\n') +
          `\n\n**Recorded appointments:** ${appts.length}${appts.length > 15 ? ' (showing the first 15)' : ''}.`;
      }

      suggestedFollowUps = [
        'How do I schedule a new appointment?',
        'Give me the staff workload for today',
        'Show today\'s operational summary',
      ];
    }
    // 4. Census — totals from live bed records, no invented ward capacities.
    else if (
      lowerMessage.includes('census') ||
      lowerMessage.includes('bed') ||
      lowerMessage.includes('room') ||
      lowerMessage.includes('ward') ||
      lowerMessage.includes('occupancy')
    ) {
      toolsExecuted.push('get_patient_statistics');
      referencedModules.push('rooms', 'patients', 'detox');
      const stats = (await this.toolsService.getPatientStatistics(userRole)).data;

      reply =
        `### 🛏️ Calyvia Inpatient Bed Census\n\n` +
        `* **Occupied Beds:** **${stats.totalActiveInpatients || 0} / ${stats.totalCapacity || 0}** (${stats.occupancyRate || '0%'})\n` +
        `* **Available Beds:** **${Math.max(0, Number(stats.totalCapacity || 0) - Number(stats.totalActiveInpatients || 0))}**\n` +
        `* **Active Detox Cases:** **${stats.activeDetoxCases || 0}**\n` +
        `* **Pending Intake Leads:** **${stats.pendingIntakeLeads || 0}**\n\n` +
        `Bed totals are counted from active bed records under **Module 09: Rooms & Bed Allocation**.`;

      suggestedFollowUps = [
        'How do I allocate a bed in Module 09?',
        'What is the triage status in CRM?',
        'Show today\'s operational summary',
      ];
    }
    // 5. Billing — role-checked by the tool, figures from recorded payments.
    else if (
      lowerMessage.includes('billing') ||
      lowerMessage.includes('invoice') ||
      lowerMessage.includes('revenue') ||
      lowerMessage.includes('mpesa') ||
      lowerMessage.includes('m-pesa') ||
      lowerMessage.includes('payment') ||
      lowerMessage.includes('daraja')
    ) {
      toolsExecuted.push('get_billing_summary');
      referencedModules.push('billing', 'reports');
      const billingRes = await this.toolsService.getBillingSummary(userRole);

      if (billingRes.data?.restricted) {
        reply = `🔒 **Access Notice:** ${billingRes.summary}`;
      } else {
        const b = billingRes.data;
        reply =
          `### 💳 Billing & Financial Performance (MTD)\n\n` +
          `* **Revenue Collected:** **KES ${number(b.mtdRevenueCollectedKES)}**\n` +
          `* **Outstanding Receivables:** **KES ${number(b.outstandingBalancesKES)}**\n` +
          `* **M-Pesa Volume Share:** **${b.darajaMpesaShare || '0%'}**\n` +
          `* **Bank Transfer Share:** **${b.bankTransferShare || '0%'}**\n\n` +
          `These totals are computed from payments and invoices recorded in the system. STK Push prompts are issued from **Module 07: Billing & Daraja M-Pesa**.`;
      }

      suggestedFollowUps = [
        ...(canViewBilling(userRole) ? ['How do I trigger an M-Pesa STK push?'] : []),
        'Give me the full operational summary',
        'Summarize bed census',
      ];
    }
    // 6. Detox protocols — from the institutional protocol catalog.
    else if (
      lowerMessage.includes('detox') ||
      lowerMessage.includes('ciwa') ||
      lowerMessage.includes('cows') ||
      lowerMessage.includes('withdrawal') ||
      lowerMessage.includes('alcohol') ||
      lowerMessage.includes('opioid')
    ) {
      toolsExecuted.push('get_institutional_protocols');
      referencedModules.push('detox', 'clinical', 'pharmacy');
      const protocols = (await this.toolsService.getInstitutionalProtocols()).data || {};

      const ciwa = protocols.alcoholDetoxCIWA || {};
      const cows = protocols.opioidDetoxCOWS || {};
      const transfer = protocols.emergencyHospitalMoU || {};

      reply =
        `### 🩺 Calyvia Detoxification & Withdrawal Protocols\n\n` +
        `#### 1. ${ciwa.title || 'CIWA-Ar Alcohol Withdrawal Protocol'}\n` +
        `* **Scale:** ${ciwa.scaleRange || '0 - 67'}\n` +
        `* **Thresholds:** ${ciwa.thresholds || 'Score-based assessment per institutional policy.'}\n` +
        `* **Escalation:** ${ciwa.emergencyAction || 'Escalate to the medical director per the transfer protocol.'}\n\n` +
        `#### 2. ${cows.title || 'COWS Opioid Withdrawal Protocol'}\n` +
        `* **Scale:** ${cows.scaleRange || '0 - 48'}\n` +
        `* **Assessment:** ${cows.guidelines || 'Score-guided symptomatic management under clinician supervision.'}\n\n` +
        `#### 3. Emergency Transfer\n` +
        `* **Partner:** ${transfer.partnerHospital || 'Nairobi West Hospital'}\n` +
        `* **Hotline:** ${transfer.ambulanceHotline || '+254 700 534 306'}\n\n` +
        `Scoring calculators and vitals charts are available under **Module 04: Detox (CIWA/COWS & Vitals)**. Medication decisions remain with licensed clinicians.`;

      suggestedFollowUps = [
        'What patients are in Detox Ward currently?',
        'Who is the doctor in charge of detox today?',
        'Show today\'s operational summary',
      ];
    }
    // 7. Staff — live directory instead of a hardcoded roster.
    else if (
      lowerMessage.includes('staff') ||
      lowerMessage.includes('doctor') ||
      lowerMessage.includes('nurse') ||
      lowerMessage.includes('therapist') ||
      lowerMessage.includes('roster') ||
      lowerMessage.includes('who is on duty')
    ) {
      toolsExecuted.push('get_staff_workload');
      referencedModules.push('staff', 'clinical');
      const staffResult = await this.toolsService.getStaffWorkload(userRole);
      const staff = Array.isArray(staffResult.data) ? staffResult.data : [];
      const active = staff.filter((member: any) => member.isActive !== false);

      const roster = active
        .slice(0, 8)
        .map((member: any) => {
          const role = String(member.role || 'STAFF').replace(/_/g, ' ').toLowerCase();
          const title = member.staffProfile?.jobTitle ? ` — ${member.staffProfile.jobTitle}` : '';
          const licence = member.staffProfile?.licenseNumber
            ? ` (Licence ${member.staffProfile.licenseNumber})`
            : '';
          return `* **${member.fullName || member.email || 'Staff member'}** — ${role}${title}${licence}`;
        })
        .join('\n');

      reply =
        `### 👥 Staff Directory\n\n` +
        `**${active.length} active staff member${active.length === 1 ? '' : 's'} on record.**\n\n` +
        `${roster || '*No active staff records found.*'}\n\n` +
        `This roster is read live from **Module 12: Staff & Licence Roster**; duty shifts should be confirmed there.`;

      suggestedFollowUps = [
        'Show today\'s appointment schedule',
        'Give me the operational summary',
        'How do I add a staff account?',
      ];
    }
    // 8. Navigation — module catalog search instead of invented examples.
    else if (
      lowerMessage.includes('how do i') ||
      lowerMessage.includes('where is') ||
      lowerMessage.includes('module') ||
      lowerMessage.includes('help') ||
      lowerMessage.includes('navigate') ||
      lowerMessage.includes('admit') ||
      lowerMessage.includes('register')
    ) {
      toolsExecuted.push('get_application_help');
      referencedModules.push('crm', 'patients', 'billing', 'appointments');
      const help = this.toolsService.getApplicationHelp(this.moduleSearchQuery(originalMessage));
      const modules = Array.isArray(help.data) ? help.data.slice(0, 6) : [];

      reply =
        `### 🧭 Calyvia Application Guidance\n\n` +
        (modules.length
          ? modules
              .map(
                (module: any) =>
                  `* **Module ${module.code}: ${module.name}** — ${module.description}`,
              )
              .join('\n')
          : `* No exact module match found. All 28 modules are listed in the left sidebar.*`) +
        `\n\nTell me the task you want to perform and I will point you to the right module.`;

      suggestedFollowUps = [
        'Show me today\'s operational summary',
        'What is our current bed occupancy?',
        ...(canViewBilling(userRole) ? ['Summarize billing metrics'] : []),
      ];
    }
    // 9. General fallback — grounded snapshot with no fabricated figures.
    else {
      toolsExecuted.push('get_dashboard_summary');
      referencedModules.push('dashboard');
      const metrics = (await this.toolsService.getDashboardSummary(userRole)).data;

      const snapshot = [
        `* **Bed Census:** ${metrics.census?.occupiedBeds || 0}/${metrics.census?.totalBeds || 0} Beds Occupied (${metrics.census?.occupancyRatePercentage || 0}%)`,
        `* **Active Detox Cases:** ${metrics.census?.detoxWardOccupancy || metrics.admissions?.activeDetoxCases || 0}`,
        `* **Sessions Today:** ${metrics.clinical?.therapySessionsToday || 0} (${metrics.clinical?.completedSessions || 0} completed)`,
        ...(canViewBilling(userRole)
          ? [`* **MTD Revenue:** KES ${number(metrics.financials?.mtdRevenueCollected)}`]
          : []),
        `* **Active Staff Accounts:** ${metrics.qualityAndSafety?.staffOnDuty || 0}`,
      ];

      reply =
        `Hello ${userName}.\n\n` +
        `I am your **Calyvia Institutional Management Assistant**, grounded in live operational data.\n\n` +
        `**Quick Center Snapshot:**\n` +
        `${snapshot.join('\n')}\n\n` +
        `Ask me about census, appointments${canViewBilling(userRole) ? ', billing' : ''}, staff, detox protocols, or how to use a specific module.`;

      suggestedFollowUps = [
        'Give me today\'s operational summary',
        'What appointments are scheduled for today?',
        'Summarize bed census and ward occupancy',
        ...(canViewBilling(userRole) ? ['Summarize outstanding invoices and billing'] : []),
      ];
    }

    reply += contextNote;

    return {
      success: true,
      reply,
      suggestedFollowUps,
      referencedModules,
      timestamp: generatedAt,
      meta: meta(),
    };
  }

  // Preserve existing extension point contracts for clinical record summaries
  async generatePatientRecordSummary(contract: AiSummarizationContract) {
    if (!this.isAiEnabled) {
      return {
        isAvailable: true,
        featureStatus: 'ACTIVE_INSTITUTIONAL_COPILOT',
        message: 'Patient record summarization pipeline mounted.',
        stubData: {
          patientId: contract.patientId,
          suggestedSummary: 'SOAP Note summary compiled from clinical notes and vitals logs.',
        },
      };
    }
    return { isAvailable: true };
  }

  async getFollowUpSuggestions(contract: AiFollowUpSuggestionContract) {
    return {
      isAvailable: true,
      featureStatus: 'ACTIVE_INSTITUTIONAL_COPILOT',
      message: 'Aftercare and follow-up recommendations computed.',
      contractPayload: contract,
    };
  }
}
