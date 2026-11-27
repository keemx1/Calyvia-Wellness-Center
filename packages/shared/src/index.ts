/**
 * Calyvia Wellness Center - Shared Types, Enums & Utilities
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FACILITY_ADMIN = 'FACILITY_ADMIN',
  MEDICAL_DIRECTOR = 'MEDICAL_DIRECTOR',
  DOCTOR_PSYCHIATRIST = 'DOCTOR_PSYCHIATRIST',
  NURSE = 'NURSE',
  COUNSELLOR = 'COUNSELLOR',
  PHARMACIST = 'PHARMACIST',
  ADMISSIONS_FRONT_DESK = 'ADMISSIONS_FRONT_DESK',
  FINANCE_BILLING = 'FINANCE_BILLING',
  INVENTORY_STORE = 'INVENTORY_STORE',
  MANAGEMENT_EXECUTIVE = 'MANAGEMENT_EXECUTIVE',
}

export enum PatientStatus {
  ENQUIRY = 'ENQUIRY',
  TRIAGE = 'TRIAGE',
  ADMITTED_DETOX = 'ADMITTED_DETOX',
  ADMITTED_REHAB = 'ADMITTED_REHAB',
  ON_LEAVE = 'ON_LEAVE',
  DISCHARGED = 'DISCHARGED',
  AFTERCARE = 'AFTERCARE',
  DECEASED = 'DECEASED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum AdmissionType {
  VOLUNTARY = 'VOLUNTARY',
  FAMILY_ESCORTED = 'FAMILY_ESCORTED',
  MEDICAL_TRANSFER = 'MEDICAL_TRANSFER',
  COURT_ORDERED = 'COURT_ORDERED',
}

export enum ProgramType {
  DETOX_ONLY = 'DETOX_ONLY',
  REHAB_30_DAYS = 'REHAB_30_DAYS',
  REHAB_60_DAYS = 'REHAB_60_DAYS',
  REHAB_90_DAYS = 'REHAB_90_DAYS',
  OUTPATIENT = 'OUTPATIENT',
  AFTERCARE_ONLY = 'AFTERCARE_ONLY',
}

export enum ClinicalNoteType {
  PSYCHIATRIC_EVALUATION = 'PSYCHIATRIC_EVALUATION',
  DOCTOR_CLINICAL_NOTE = 'DOCTOR_CLINICAL_NOTE',
  NURSING_SHIFT_NOTE = 'NURSING_SHIFT_NOTE',
  MDT_REVIEW = 'MDT_REVIEW',
  COUNSELLING_PROGRESS = 'COUNSELLING_PROGRESS',
}

export enum DetoxProtocolType {
  ALCOHOL_CIWA = 'ALCOHOL_CIWA',
  OPIOID_COWS = 'OPIOID_COWS',
  SEDATIVE_TAPER = 'SEDATIVE_TAPER',
  POLY_SUBSTANCE = 'POLY_SUBSTANCE',
}

export enum WithdrawalScoreType {
  CIWA_AR = 'CIWA_AR',
  COWS = 'COWS',
}
export { WithdrawalScoreType as ScoreType };

export enum AssessmentSeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}

export enum RoomType {
  DETOX_WARD = 'DETOX_WARD',
  INPATIENT_MALE = 'INPATIENT_MALE',
  INPATIENT_FEMALE = 'INPATIENT_FEMALE',
  VIP_PRIVATE = 'VIP_PRIVATE',
  HIGH_DEPENDENCY_UNIT = 'HIGH_DEPENDENCY_UNIT',
}

export enum BedStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  FULLY_PAID = 'FULLY_PAID',
  VOID = 'VOID',
}

export enum PaymentMethod {
  MPESA_STK = 'MPESA_STK',
  MPESA_C2B = 'MPESA_C2B',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  INSURANCE_COPAY = 'INSURANCE_COPAY',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum CommunicationChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
}

export enum LeadStatus {
  NEW_INQUIRY = 'NEW_INQUIRY',
  CONTACTED = 'CONTACTED',
  ASSESSMENT_BOOKED = 'ASSESSMENT_BOOKED',
  ADMISSION_SCHEDULED = 'ADMISSION_SCHEDULED',
  ADMITTED = 'ADMITTED',
  LOST = 'LOST',
}

// Kenya Normalization and Formatting Utilities
export class KenyaUtils {
  /**
   * Normalizes Kenyan phone numbers to E.164 (+2547XXXXXXXX or +2541XXXXXXXX)
   */
  static normalizePhoneNumber(rawPhone: string): string {
    if (!rawPhone) return '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('1') && cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }
    if (!cleaned.startsWith('+')) {
      return '+' + cleaned;
    }
    return cleaned;
  }

  /**
   * Formats numbers to KES currency
   */
  static formatKES(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Masks sensitive identifier (e.g. Kenya National ID 12345678 -> 12****78)
   */
  static maskIdentifier(id: string): string {
    if (!id || id.length < 4) return '****';
    const firstTwo = id.substring(0, 2);
    const lastTwo = id.substring(id.length - 2);
    return `${firstTwo}${'*'.repeat(Math.max(id.length - 4, 3))}${lastTwo}`;
  }
}

// ==============================================================================
// Fine-Grained Permissions Model & Institutional Role-Based Access Control
// ==============================================================================

export enum Permission {
  // Executive & Oversight
  DASHBOARD_VIEW = 'dashboard.view',
  REPORTS_FINANCIAL_VIEW = 'reports.financial.view',
  REPORTS_CLINICAL_VIEW = 'reports.clinical.view',
  REPORTS_EXECUTIVE_VIEW = 'reports.executive.view',

  // Patient Intake & Demographics
  PATIENTS_VIEW = 'patients.view',
  PATIENTS_CREATE = 'patients.create',
  PATIENTS_UPDATE = 'patients.update',
  PATIENTS_ARCHIVE = 'patients.archive',
  CRM_LEADS_MANAGE = 'crm.leads.manage',
  DOCUMENTS_MANAGE = 'documents.manage',
  FAMILY_MANAGE = 'family.manage',
  REFERRALS_MANAGE = 'referrals.manage',

  // Clinical & Inpatient Care
  CLINICAL_RECORDS_VIEW = 'clinical_records.view',
  CLINICAL_RECORDS_CREATE = 'clinical_records.create',
  CLINICAL_RECORDS_UPDATE = 'clinical_records.update',
  DETOX_MANAGE = 'detox.manage',
  COUNSELLING_MANAGE = 'counselling.manage',
  APPOINTMENTS_VIEW = 'appointments.view',
  APPOINTMENTS_MANAGE = 'appointments.manage',
  PHARMACY_VIEW = 'pharmacy.view',
  PHARMACY_DISPENSE = 'pharmacy.dispense',
  ROOMS_BEDS_MANAGE = 'rooms_beds.manage',

  // Financial & Billing (Cashier scope)
  BILLING_VIEW = 'billing.view',
  BILLING_PAYMENT_CREATE = 'billing.payment.create',
  BILLING_INVOICE_CREATE = 'billing.invoice.create',
  BILLING_REFUND_APPROVE = 'billing.refund.approve',

  // Operations, Governance & Security
  MOVEMENT_LOG_MANAGE = 'movement.log.manage',
  INCIDENTS_MANAGE = 'incidents.manage',
  STAFF_VIEW = 'staff.view',
  STAFF_MANAGE = 'staff.manage',
  TASKS_MANAGE = 'tasks.manage',
  INVENTORY_MANAGE = 'inventory.manage',
  DISCHARGE_MANAGE = 'discharge.manage',
  AFTERCARE_MANAGE = 'aftercare.manage',
  COMMUNICATION_MANAGE = 'communication.manage',
  FEEDBACK_MANAGE = 'feedback.manage',
  SECURITY_AUDIT_VIEW = 'security.audit.view',
  SYSTEM_SETTINGS_MANAGE = 'system_settings.manage',
  INTEGRATIONS_MANAGE = 'integrations.manage',
}

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'System Administrator',
  [UserRole.FACILITY_ADMIN]: 'Facility Administrator',
  [UserRole.MEDICAL_DIRECTOR]: 'Medical Director',
  [UserRole.DOCTOR_PSYCHIATRIST]: 'Consultant Psychiatrist / Doctor',
  [UserRole.NURSE]: 'Nursing Officer',
  [UserRole.COUNSELLOR]: 'Addiction Counsellor & Therapist',
  [UserRole.PHARMACIST]: 'Clinical Pharmacist',
  [UserRole.ADMISSIONS_FRONT_DESK]: 'Reception & Admissions Officer',
  [UserRole.FINANCE_BILLING]: 'Cashier & Billing Officer',
  [UserRole.INVENTORY_STORE]: 'Stores & Inventory Officer',
  [UserRole.MANAGEMENT_EXECUTIVE]: 'Management Executive',
};

export const ROLE_MODULE_ACCESS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: [
    'dashboard', 'reports', 'patients', 'crm', 'family', 'referrals', 'documents',
    'clinical', 'detox', 'counselling', 'appointments', 'pharmacy', 'rooms',
    'billing', 'movement', 'incidents', 'staff', 'tasks', 'inventory',
    'discharge', 'aftercare', 'communication', 'feedback',
    'security', 'system_admin', 'integrations', 'automation'
  ],
  [UserRole.FACILITY_ADMIN]: [
    'dashboard', 'reports', 'patients', 'crm', 'family', 'referrals', 'documents',
    'billing', 'movement', 'incidents', 'staff', 'tasks', 'inventory',
    'discharge', 'aftercare', 'communication', 'feedback',
    'security', 'system_admin', 'integrations', 'automation'
  ],
  [UserRole.MEDICAL_DIRECTOR]: [
    'dashboard', 'reports', 'patients', 'clinical', 'detox', 'counselling',
    'appointments', 'pharmacy', 'rooms', 'incidents', 'staff', 'discharge',
    'aftercare', 'security'
  ],
  [UserRole.DOCTOR_PSYCHIATRIST]: [
    'dashboard', 'patients', 'clinical', 'detox', 'counselling',
    'appointments', 'pharmacy', 'rooms', 'discharge', 'aftercare',
    'incidents'
  ],
  [UserRole.NURSE]: [
    'dashboard', 'patients', 'clinical', 'detox', 'pharmacy',
    'appointments', 'rooms', 'movement', 'incidents', 'tasks'
  ],
  [UserRole.COUNSELLOR]: [
    'dashboard', 'patients', 'counselling', 'appointments',
    'discharge', 'aftercare', 'feedback', 'tasks'
  ],
  [UserRole.PHARMACIST]: [
    'dashboard', 'pharmacy', 'inventory', 'patients', 'tasks'
  ],
  [UserRole.ADMISSIONS_FRONT_DESK]: [
    'dashboard', 'patients', 'crm', 'appointments', 'rooms',
    'movement', 'documents', 'feedback', 'tasks'
  ],
  // Cashier / Billing Officer: STRICTLY finance, billing, authorized reports, and tasks.
  // Clinical records, detox, notes, and admin are strictly prohibited.
  [UserRole.FINANCE_BILLING]: [
    'billing', 'reports', 'tasks'
  ],
  [UserRole.INVENTORY_STORE]: [
    'inventory', 'pharmacy', 'tasks'
  ],
  [UserRole.MANAGEMENT_EXECUTIVE]: [
    'dashboard', 'reports', 'crm', 'billing', 'feedback', 'incidents'
  ],
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.FACILITY_ADMIN]: [
    Permission.DASHBOARD_VIEW, Permission.REPORTS_EXECUTIVE_VIEW, Permission.REPORTS_FINANCIAL_VIEW,
    Permission.PATIENTS_VIEW, Permission.PATIENTS_CREATE, Permission.PATIENTS_UPDATE,
    Permission.CRM_LEADS_MANAGE, Permission.DOCUMENTS_MANAGE, Permission.FAMILY_MANAGE, Permission.REFERRALS_MANAGE,
    Permission.BILLING_VIEW, Permission.BILLING_PAYMENT_CREATE, Permission.BILLING_INVOICE_CREATE, Permission.BILLING_REFUND_APPROVE,
    Permission.MOVEMENT_LOG_MANAGE, Permission.INCIDENTS_MANAGE, Permission.STAFF_VIEW, Permission.STAFF_MANAGE,
    Permission.TASKS_MANAGE, Permission.INVENTORY_MANAGE, Permission.DISCHARGE_MANAGE, Permission.AFTERCARE_MANAGE,
    Permission.COMMUNICATION_MANAGE, Permission.FEEDBACK_MANAGE, Permission.SECURITY_AUDIT_VIEW,
    Permission.SYSTEM_SETTINGS_MANAGE, Permission.INTEGRATIONS_MANAGE,
  ],
  [UserRole.MEDICAL_DIRECTOR]: [
    Permission.DASHBOARD_VIEW, Permission.REPORTS_CLINICAL_VIEW, Permission.REPORTS_EXECUTIVE_VIEW,
    Permission.PATIENTS_VIEW, Permission.CLINICAL_RECORDS_VIEW, Permission.CLINICAL_RECORDS_CREATE, Permission.CLINICAL_RECORDS_UPDATE,
    Permission.DETOX_MANAGE, Permission.COUNSELLING_MANAGE, Permission.APPOINTMENTS_VIEW, Permission.APPOINTMENTS_MANAGE,
    Permission.PHARMACY_VIEW, Permission.ROOMS_BEDS_MANAGE, Permission.INCIDENTS_MANAGE, Permission.STAFF_VIEW,
    Permission.DISCHARGE_MANAGE, Permission.AFTERCARE_MANAGE, Permission.SECURITY_AUDIT_VIEW,
  ],
  [UserRole.DOCTOR_PSYCHIATRIST]: [
    Permission.DASHBOARD_VIEW, Permission.PATIENTS_VIEW, Permission.PATIENTS_UPDATE,
    Permission.CLINICAL_RECORDS_VIEW, Permission.CLINICAL_RECORDS_CREATE, Permission.CLINICAL_RECORDS_UPDATE,
    Permission.DETOX_MANAGE, Permission.APPOINTMENTS_VIEW, Permission.APPOINTMENTS_MANAGE,
    Permission.PHARMACY_VIEW, Permission.ROOMS_BEDS_MANAGE, Permission.DISCHARGE_MANAGE,
    Permission.AFTERCARE_MANAGE, Permission.INCIDENTS_MANAGE,
  ],
  [UserRole.NURSE]: [
    Permission.DASHBOARD_VIEW, Permission.PATIENTS_VIEW,
    Permission.CLINICAL_RECORDS_VIEW, Permission.CLINICAL_RECORDS_CREATE,
    Permission.DETOX_MANAGE, Permission.PHARMACY_VIEW, Permission.PHARMACY_DISPENSE,
    Permission.APPOINTMENTS_VIEW, Permission.ROOMS_BEDS_MANAGE, Permission.MOVEMENT_LOG_MANAGE,
    Permission.INCIDENTS_MANAGE, Permission.TASKS_MANAGE,
  ],
  [UserRole.COUNSELLOR]: [
    Permission.DASHBOARD_VIEW, Permission.PATIENTS_VIEW, Permission.COUNSELLING_MANAGE,
    Permission.APPOINTMENTS_VIEW, Permission.DISCHARGE_MANAGE, Permission.AFTERCARE_MANAGE,
    Permission.FEEDBACK_MANAGE, Permission.TASKS_MANAGE,
  ],
  [UserRole.PHARMACIST]: [
    Permission.DASHBOARD_VIEW, Permission.PATIENTS_VIEW, Permission.PHARMACY_VIEW,
    Permission.PHARMACY_DISPENSE, Permission.INVENTORY_MANAGE, Permission.TASKS_MANAGE,
  ],
  [UserRole.ADMISSIONS_FRONT_DESK]: [
    Permission.DASHBOARD_VIEW, Permission.PATIENTS_VIEW, Permission.PATIENTS_CREATE, Permission.PATIENTS_UPDATE,
    Permission.CRM_LEADS_MANAGE, Permission.APPOINTMENTS_VIEW, Permission.APPOINTMENTS_MANAGE,
    Permission.ROOMS_BEDS_MANAGE, Permission.MOVEMENT_LOG_MANAGE, Permission.DOCUMENTS_MANAGE,
    Permission.FEEDBACK_MANAGE, Permission.TASKS_MANAGE,
  ],
  [UserRole.FINANCE_BILLING]: [
    Permission.BILLING_VIEW, Permission.BILLING_PAYMENT_CREATE, Permission.BILLING_INVOICE_CREATE,
    Permission.REPORTS_FINANCIAL_VIEW, Permission.TASKS_MANAGE,
  ],
  [UserRole.INVENTORY_STORE]: [
    Permission.INVENTORY_MANAGE, Permission.PHARMACY_VIEW, Permission.TASKS_MANAGE,
  ],
  [UserRole.MANAGEMENT_EXECUTIVE]: [
    Permission.DASHBOARD_VIEW, Permission.REPORTS_EXECUTIVE_VIEW, Permission.REPORTS_FINANCIAL_VIEW,
    Permission.REPORTS_CLINICAL_VIEW, Permission.CRM_LEADS_MANAGE, Permission.BILLING_VIEW,
    Permission.FEEDBACK_MANAGE, Permission.INCIDENTS_MANAGE,
  ],
};

export function canAccessModule(role: UserRole | string | undefined, moduleId: string): boolean {
  if (!role) return false;
  const allowed = ROLE_MODULE_ACCESS[role as UserRole];
  if (!allowed) return false;
  return allowed.includes(moduleId);
}

export function hasPermission(role: UserRole | string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getDefaultModuleForRole(role: UserRole | string | undefined): string {
  if (role === UserRole.FINANCE_BILLING) return 'billing';
  if (role === UserRole.ADMISSIONS_FRONT_DESK) return 'patients';
  if (role === UserRole.PHARMACIST) return 'pharmacy';
  if (role === UserRole.INVENTORY_STORE) return 'inventory';
  return 'dashboard';
}

