import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AiExtensionService } from './ai-extension.service';
import { AiInstitutionalToolsService } from './ai-institutional-tools.service';
import { AiIntentService } from './ai-intent.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@calyvia/shared';

describe('AiExtensionService (Institutional Intelligence & Clinical Safety)', () => {
  let service: AiExtensionService;
  let mockToolsService: any;
  let mockAuditService: any;

  beforeEach(async () => {
    mockToolsService = {
      moduleCatalog: [{ id: 'billing', code: '07', name: 'Billing & Daraja M-Pesa' }],
      getDashboardSummary: jest.fn().mockResolvedValue({
        toolName: 'get_dashboard_summary',
        data: {
          facility: { name: 'Calyvia Wellness Center', status: 'OPERATIONAL', location: 'Ruiru' },
          census: { occupiedBeds: 28, totalBeds: 32, occupancyRatePercentage: 87.5, detoxWardOccupancy: 6 },
          clinical: { therapySessionsToday: 14, completedSessions: 9, pendingSessions: 5, criticalVitalsAlerts: 1 },
          financials: { mtdRevenueCollected: 3840000.0 },
          qualityAndSafety: { staffOnDuty: 14 },
        },
        summary: 'Executive summary text',
      }),
      getAppointmentsSummary: jest.fn().mockResolvedValue({
        toolName: 'get_appointments_summary',
        data: [],
        summary: 'Appointments text',
      }),
      getPatientStatistics: jest.fn().mockResolvedValue({
        toolName: 'get_patient_statistics',
        data: {
          totalActiveInpatients: 28,
          totalCapacity: 32,
          occupancyRate: '87.5%',
          activeDetoxCases: 4,
          pendingIntakeLeads: 2,
        },
        summary: 'Census text',
      }),
      getStaffWorkload: jest.fn().mockResolvedValue({
        toolName: 'get_staff_workload',
        data: [
          {
            id: 'staff-1',
            fullName: 'Nurse Linet Achieng',
            role: 'NURSE',
            isActive: true,
            staffProfile: { jobTitle: 'Detox Nurse', licenseNumber: 'NCK-991' },
          },
        ],
        summary: 'Staff text',
      }),
      getBillingSummary: jest.fn().mockResolvedValue({
        toolName: 'get_billing_summary',
        data: { mtdRevenueCollectedKES: 3840000, darajaMpesaShare: '68.4%' },
        summary: 'Billing text',
      }),
      getApplicationHelp: jest.fn().mockReturnValue({
        toolName: 'get_application_help',
        data: [],
        summary: 'Help text',
      }),
      getInstitutionalProtocols: jest.fn().mockReturnValue({
        toolName: 'get_institutional_protocols',
        data: {},
        summary: 'Protocol text',
      }),
    };

    mockAuditService = {
      logAction: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiExtensionService,
        { provide: AiInstitutionalToolsService, useValue: mockToolsService },
        { provide: AuditService, useValue: mockAuditService },
        AiIntentService,
      ],
    }).compile();

    service = module.get<AiExtensionService>(AiExtensionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should intercept clinical prescription requests with safety guardrail', async () => {
    const res = await service.processChat(
      { message: 'Please prescribe 20mg Diazepam for patient John Kamau' },
      { id: 'user-nurse', role: UserRole.NURSE, fullName: 'Nurse Wangari' },
    );

    expect(res.success).toBe(true);
    expect(res.reply).toContain('Clinical Safety Boundary');
    expect(res.reply).toContain('I cannot diagnose individual patients, prescribe medications');
    expect(res.meta?.toolsExecuted).toContain('clinical_safety_guard');
  });

  it('should answer operational summary requests using live dashboard tool', async () => {
    const res = await service.processChat(
      { message: 'Give me today\'s operational summary' },
      { id: 'user-admin', role: UserRole.SUPER_ADMIN, fullName: 'Dr. Antony Baraka' },
    );

    expect(res.success).toBe(true);
    expect(res.reply).toContain('Operational Summary');
    expect(res.reply).toContain('28 / 32 Beds');
    expect(mockToolsService.getDashboardSummary).toHaveBeenCalled();
    expect(mockAuditService.logAction).toHaveBeenCalled();
  });

  it('should handle appointment queries accurately', async () => {
    const res = await service.processChat(
      { message: 'What appointments are scheduled for today?' },
      { id: 'user-doctor', role: UserRole.DOCTOR_PSYCHIATRIST, fullName: 'Dr. Evelyn Wanjiku' },
    );

    expect(res.success).toBe(true);
    expect(res.reply).toContain('Schedule');
    expect(mockToolsService.getAppointmentsSummary).toHaveBeenCalled();
  });

  it('requires an authenticated user instead of assuming SUPER_ADMIN', async () => {
    await expect(
      service.processChat({ message: 'Give me today\'s operational summary' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockToolsService.getDashboardSummary).not.toHaveBeenCalled();
  });

  it('resolves short follow-up questions into the right grounded tool', async () => {
    const res = await service.processChat(
      { message: 'and appointments?' },
      { id: 'user-1', role: UserRole.NURSE, fullName: 'Nurse Linet' },
    );

    expect(mockToolsService.getAppointmentsSummary).toHaveBeenCalled();
    expect(res.meta?.toolsExecuted).toContain('conversation_context');
  });

  it('uses the live staff directory instead of a hardcoded roster', async () => {
    const res = await service.processChat(
      { message: 'Give me the staff workload' },
      { id: 'user-1', role: UserRole.FACILITY_ADMIN, fullName: 'Admin' },
    );

    expect(res.reply).toContain('Nurse Linet Achieng');
    expect(res.reply).toContain('NCK-991');
    expect(res.reply).not.toContain('Dr. Evelyn Wanjiku');
  });

  it('includes the active module context in grounded responses', async () => {
    const res = await service.processChat(
      { message: 'Give me today\'s operational summary', contextModule: 'billing' },
      { id: 'user-1', role: UserRole.SUPER_ADMIN, fullName: 'Admin' },
    );

    expect(res.reply).toContain('Module 07: Billing & Daraja M-Pesa');
    expect(res.meta?.contextModule).toBe('billing');
    expect(res.meta?.groundedInLiveData).toBe(true);
  });

  it('keeps financial figures and billing prompts out of non-finance roles', async () => {
    const res = await service.processChat(
      { message: 'Hello Calyvia' },
      { id: 'user-nurse', role: UserRole.NURSE, fullName: 'Nurse Linet' },
    );

    expect(res.reply).not.toContain('MTD Revenue');
    expect(res.reply).not.toContain('3,840,000');
    expect(res.suggestedFollowUps).not.toContain('Summarize outstanding invoices and billing');
  });

  it('allows finance roles to see grounded financial figures', async () => {
    const res = await service.processChat(
      { message: 'Hello Calyvia' },
      { id: 'user-finance', role: UserRole.FINANCE_BILLING, fullName: 'Billing Officer' },
    );

    expect(res.reply).toContain('3,840,000');
    expect(res.suggestedFollowUps).toContain('Summarize outstanding invoices and billing');
  });

  it('resolves conversational aliases such as "money side" to the billing tool', async () => {
    const res = await service.processChat(
      { message: 'what about the money side?' },
      { id: 'user-finance', role: UserRole.FINANCE_BILLING, fullName: 'Billing Officer' },
    );

    expect(mockToolsService.getBillingSummary).toHaveBeenCalled();
    expect(res.reply).toContain('Billing & Financial Performance');
    expect(res.meta?.intent).toBe('billing');
  });

  it('tolerates typos in intent matching', async () => {
    const res = await service.processChat(
      { message: 'appoinments today?' },
      { id: 'user-nurse', role: UserRole.NURSE, fullName: 'Nurse Linet' },
    );

    expect(mockToolsService.getAppointmentsSummary).toHaveBeenCalled();
    expect(res.meta?.intent).toBe('appointments');
  });

  it('inherits the previous intent for context-only follow-ups', async () => {
    const res = await service.processChat(
      {
        message: 'show me that again',
        conversationHistory: [
          { role: 'user', content: 'Give me today\'s operational summary' },
          { role: 'assistant', content: 'Here is the operational summary.' },
        ],
      },
      { id: 'user-admin', role: UserRole.SUPER_ADMIN, fullName: 'Admin' },
    );

    expect(mockToolsService.getDashboardSummary).toHaveBeenCalled();
    expect(res.meta?.toolsExecuted).toContain('conversation_context');
    expect(res.meta?.intent).toBe('operational_summary');
  });

  it('asks for clarification when two intents are equally likely', async () => {
    const res = await service.processChat(
      { message: 'billing and appointments' },
      { id: 'user-admin', role: UserRole.SUPER_ADMIN, fullName: 'Admin' },
    );

    expect(res.reply).toContain('clarification');
    expect(mockToolsService.getBillingSummary).not.toHaveBeenCalled();
    expect(mockToolsService.getAppointmentsSummary).not.toHaveBeenCalled();
    expect(res.meta?.toolsExecuted).toContain('intent_clarification');
  });
});
