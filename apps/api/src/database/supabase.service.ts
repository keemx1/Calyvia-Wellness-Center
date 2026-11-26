import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Table name mappings
const MODEL_TABLE_MAP: Record<string, string> = {
  user: 'users',
  staffProfile: 'staff_profiles',
  staffSchedule: 'staff_schedules',
  staffCredential: 'staff_credentials',
  auditLog: 'audit_logs',
  patient: 'patients',
  emergencyContact: 'emergency_contacts',
  patientConsent: 'patient_consents',
  referralPartner: 'referral_partners',
  lead: 'leads',
  admission: 'admissions',
  room: 'rooms',
  bed: 'beds',
  bedAllocation: 'bed_allocations',
  clinicalNote: 'clinical_notes',
  detoxEpisode: 'detox_episodes',
  withdrawalAssessment: 'withdrawal_assessments',
  vitalsLog: 'vitals_logs',
  counsellingSession: 'counselling_sessions',
  appointment: 'appointments',
  medication: 'medications',
  pharmacyStockBatch: 'pharmacy_stock_batches',
  prescription: 'prescriptions',
  prescriptionItem: 'prescription_items',
  medicationAdministration: 'medication_administrations',
  invoice: 'invoices',
  invoiceItem: 'invoice_items',
  payment: 'payments',
  mpesaTransaction: 'mpesa_transactions',
  movementRecord: 'movement_records',
  visitorLog: 'visitor_logs',
  incidentReport: 'incident_reports',
  staffTask: 'staff_tasks',
  inventoryItem: 'inventory_items',
  dischargeRecord: 'discharge_records',
  aftercarePlan: 'aftercare_plans',
  aftercareCheckin: 'aftercare_checkins',
  communicationLog: 'communication_logs',
  feedbackSurvey: 'feedback_surveys',
  systemSetting: 'system_settings',
};

// Key transformation utilities. `table` is supplied where a generic name means
// different things (e.g. invoice_items.quantity vs inventory.current_stock).
function toSnake(str: string, table?: string): string {
  // Common entity mappings
  if (str === 'registrationNumber') return 'upi';
  if (str === 'resource') return 'entity_name';
  if (str === 'resourceId') return 'entity_id';

  // Patients
  if (str === 'residentialAddress') return 'address';
  if (str === 'knownAllergiesEnc' || str === 'allergiesEncrypted') return 'allergies_encrypted';
  if (str === 'substanceHistoryEnc' || str === 'substanceHistoryEncrypted') return 'substance_history_encrypted';

  // Family / Emergency Contacts
  if (str === 'hasConsentToUpdate' || str === 'consentToContact') return 'consent_to_contact';

  // Billing & Invoices
  if (str === 'totalAmountKES' || str === 'totalAmount') return 'total_amount';
  if (str === 'paidAmountKES' || str === 'paidAmount') return 'paid_amount';
  if (str === 'balanceKES' || str === 'balanceDue') return 'balance_due';
  if (str === 'unitPriceKES' || str === 'unitPrice') return 'unit_price';
  if (str === 'amountKES' || str === 'amountPaid') return 'amount_paid';
  if (str === 'transactionRef') return 'payment_reference';

  // Counselling
  if (str === 'sessionNotesEnc' || str === 'notesEncrypted') return 'notes_encrypted';
  if (str === 'durationMins' || str === 'durationMinutes') return 'duration_minutes';
  if (str === 'scheduledAt' || str === 'sessionDate') return 'session_date';
  if (str === 'goalsAddressed') return 'goals_progress_encrypted';

  // Clinical Notes
  if (str === 'subjectiveEnc' || str === 'subjective') return 'subjective_narrative_encrypted';
  if (str === 'objectiveEnc' || str === 'objective') return 'objective_narrative_encrypted';
  if (str === 'assessmentEnc' || str === 'assessment') return 'assessment_narrative_encrypted';
  if (str === 'planEnc' || str === 'plan') return 'plan_narrative_encrypted';
  if (str === 'icd10Diagnosis') return 'icd10_codes';

  // CRM / Leads
  if (str === 'enquiryNumber') return 'enquiry_number';
  if (str === 'channel') return 'source';
  if (str === 'substancesUsed') return 'substances_used';
  if (str === 'urgencyLevel') return 'urgency_level';
  if (str === 'pipelineStatus') return 'status';

  // Detox & Assessments & Vitals
  if (str === 'parametersJson') return 'breakdown';
  if (str === 'evaluatedBy' || str === 'assessedBy') return 'assessor_id';
  if (str === 'medicalOfficer') return 'supervising_doctor_id';
  if (str === 'spO2Percentage') return 'oxygen_saturation';
  if (str === 'temperatureC') return 'temperature_c';
  if (str === 'recordedBy') return 'recorded_by';

  // Appointments
  if (str === 'staffMemberName') return 'staff_member_name';

  // Billing line items keep their real `quantity` column; inventory uses `current_stock`.
  if (table === 'invoice_items' && str === 'quantity') return 'quantity';

  // Inventory
  if (str === 'name') return 'item_name';
  if (str === 'unit') return 'unit_of_measure';
  if (str === 'quantity') return 'current_stock';
  if (str === 'minAlertQty') return 'minimum_reorder_level';
  if (str === 'unitCostKES') return 'unit_cost';

  // Incidents
  if (str === 'category') return 'incident_type';
  if (str === 'immediateAction') return 'immediate_action_taken';
  if (str === 'reportedBy') return 'reported_by';

  return str.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase());
}

function toCamel(str: string): string {
  if (str === 'upi') return 'registrationNumber';
  if (str === 'entity_name') return 'resource';
  if (str === 'entity_id') return 'resourceId';
  if (str === 'address') return 'residentialAddress';
  if (str === 'total_amount') return 'totalAmountKES';
  if (str === 'paid_amount') return 'paidAmountKES';
  if (str === 'balance_due') return 'balanceKES';
  if (str === 'unit_price') return 'unitPriceKES';
  if (str === 'amount_paid') return 'amountKES';
  if (str === 'payment_reference') return 'transactionRef';
  if (str === 'allergies_encrypted') return 'knownAllergiesEnc';
  if (str === 'substance_history_encrypted') return 'substanceHistoryEnc';
  if (str === 'consent_to_contact') return 'consentToContact';
  if (str === 'notes_encrypted') return 'sessionNotesEnc';
  if (str === 'duration_minutes') return 'durationMins';
  if (str === 'session_date') return 'scheduledAt';
  if (str === 'subjective_narrative_encrypted') return 'subjectiveEnc';
  if (str === 'objective_narrative_encrypted') return 'objectiveEnc';
  if (str === 'assessment_narrative_encrypted') return 'assessmentEnc';
  if (str === 'plan_narrative_encrypted') return 'planEnc';
  if (str === 'breakdown') return 'parametersJson';
  if (str === 'assessor_id') return 'evaluatedBy';
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row: any): any {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = toCamel(k);
    out[camel] = v;
    out[k] = v; // keep raw snake_case as well for uniform access
    if (k === 'upi') {
      out.upi = v;
      out.registrationNumber = v;
    }
  }
  return out;
}

export class ModelRepository {
  constructor(
    private tableName: string,
    private queryFn: (sql: string, params?: any[]) => Promise<any>,
  ) {}

  async create(args: {
    data: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<any> {
    const keys: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];

    let idx = 1;
    for (const [k, v] of Object.entries(args.data)) {
      if (v === undefined) continue;
      const col = toSnake(k, this.tableName);
      keys.push(`"${col}"`);
      values.push(v);
      placeholders.push(`$${idx++}`);
    }

    const sql = `INSERT INTO public."${this.tableName}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const res = await this.queryFn(sql, values);
    return mapRow(res.rows[0]);
  }

  async findMany(args?: {
    where?: Record<string, any>;
    take?: number;
    skip?: number;
    orderBy?: any;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<any[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (args?.where) {
      for (const [k, v] of Object.entries(args.where)) {
        if (v === undefined) continue;
        const col = toSnake(k, this.tableName);
        if (v === null) {
          conditions.push(`"${col}" IS NULL`);
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)) {
          if (v.contains !== undefined) {
            conditions.push(`"${col}" ILIKE $${idx++}`);
            values.push(`%${v.contains}%`);
          } else if (v.in !== undefined && Array.isArray(v.in)) {
            conditions.push(`"${col}" = ANY($${idx++})`);
            values.push(v.in);
          } else if (v.not !== undefined) {
            conditions.push(`"${col}" != $${idx++}`);
            values.push(v.not);
          }
        } else {
          conditions.push(`"${col}" = $${idx++}`);
          values.push(v);
        }
      }
    }

    let sql = `SELECT * FROM public."${this.tableName}"`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (args?.orderBy) {
      if (typeof args.orderBy === 'object' && !Array.isArray(args.orderBy)) {
        const orderClauses = Object.entries(args.orderBy).map(
          ([col, dir]) => `"${toSnake(col, this.tableName)}" ${String(dir).toUpperCase()}`,
        );
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }
    } else {
      sql += ` ORDER BY id ASC`;
    }

    if (args?.take) {
      sql += ` LIMIT ${parseInt(args.take as any, 10)}`;
    }
    if (args?.skip) {
      sql += ` OFFSET ${parseInt(args.skip as any, 10)}`;
    }

    const res = await this.queryFn(sql, values);
    const rows = res.rows.map(mapRow);

    // Hydrate relations if requested
    if (args?.include && rows.length > 0) {
      if (this.tableName === 'rooms' && args.include.beds) {
        for (const room of rows) {
          const bedRes = await this.queryFn(
            `SELECT * FROM public."beds" WHERE room_id = $1 ORDER BY bed_number ASC`,
            [room.id],
          );
          room.beds = bedRes.rows.map(mapRow);
        }
      }
      if (this.tableName === 'users' && args.include.staffProfile) {
        for (const user of rows) {
          const pRes = await this.queryFn(
            `SELECT * FROM public."staff_profiles" WHERE user_id = $1 LIMIT 1`,
            [user.id],
          );
          user.staffProfile = pRes.rows[0] ? mapRow(pRes.rows[0]) : null;
        }
      }
      if (this.tableName === 'emergency_contacts' && args.include.patient) {
        for (const contact of rows) {
          const patRes = await this.queryFn(
            `SELECT id, upi, first_name, last_name, status, phone FROM public."patients" WHERE id = $1 LIMIT 1`,
            [contact.patientId],
          );
          contact.patient = patRes.rows[0] ? mapRow(patRes.rows[0]) : null;
        }
      }
    }

    return rows;
  }

  async findUnique(args: {
    where: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<any> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(args.where)) {
      if (v === undefined) continue;
      const col = toSnake(k, this.tableName);
      conditions.push(`"${col}" = $${idx++}`);
      values.push(v);
    }

    const sql = `SELECT * FROM public."${this.tableName}" WHERE ${conditions.join(' AND ')} LIMIT 1`;
    const res = await this.queryFn(sql, values);
    const row = res.rows[0] ? mapRow(res.rows[0]) : null;

    if (row && args.include) {
      if (this.tableName === 'users' && args.include.staffProfile) {
        const pRes = await this.queryFn(
          `SELECT * FROM public."staff_profiles" WHERE user_id = $1 LIMIT 1`,
          [row.id],
        );
        row.staffProfile = pRes.rows[0] ? mapRow(pRes.rows[0]) : null;
      }
      if (this.tableName === 'patients' && args.include.emergencyContacts) {
        const cRes = await this.queryFn(
          `SELECT * FROM public."emergency_contacts" WHERE patient_id = $1`,
          [row.id],
        );
        row.emergencyContacts = cRes.rows.map(mapRow);
      }
      if (this.tableName === 'emergency_contacts' && args.include.patient) {
        const patRes = await this.queryFn(
          `SELECT id, upi, first_name, last_name, status, phone FROM public."patients" WHERE id = $1 LIMIT 1`,
          [row.patientId],
        );
        row.patient = patRes.rows[0] ? mapRow(patRes.rows[0]) : null;
      }
    }

    return row;
  }

  async update(args: {
    where: Record<string, any>;
    data: Record<string, any>;
    include?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<any> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(args.data)) {
      if (v === undefined) continue;
      const col = toSnake(k, this.tableName);
      setClauses.push(`"${col}" = $${idx++}`);
      values.push(v);
    }

    const whereClauses: string[] = [];
    for (const [k, v] of Object.entries(args.where)) {
      if (v === undefined) continue;
      const col = toSnake(k, this.tableName);
      whereClauses.push(`"${col}" = $${idx++}`);
      values.push(v);
    }

    const sql = `UPDATE public."${this.tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`;
    const res = await this.queryFn(sql, values);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async upsert(args: {
    where: Record<string, any>;
    update: Record<string, any>;
    create: Record<string, any>;
  }): Promise<any> {
    const existing = await this.findUnique({ where: args.where });
    if (existing) {
      return this.update({ where: args.where, data: args.update });
    }
    return this.create({ data: args.create });
  }

  async delete(args: { where: Record<string, any> }): Promise<any> {
    const whereClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(args.where)) {
      const col = toSnake(k, this.tableName);
      whereClauses.push(`"${col}" = $${idx++}`);
      values.push(v);
    }

    const sql = `DELETE FROM public."${this.tableName}" WHERE ${whereClauses.join(' AND ')} RETURNING *`;
    const res = await this.queryFn(sql, values);
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async count(args?: { where?: Record<string, any> }): Promise<number> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (args?.where) {
      for (const [k, v] of Object.entries(args.where)) {
        if (v === undefined) continue;
        const col = toSnake(k, this.tableName);
        if (v === null) {
          conditions.push(`"${col}" IS NULL`);
        } else if (typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)) {
          if (v.contains !== undefined) {
            conditions.push(`"${col}" ILIKE $${idx++}`);
            values.push(`%${v.contains}%`);
          } else if (v.in !== undefined && Array.isArray(v.in)) {
            conditions.push(`"${col}" = ANY($${idx++})`);
            values.push(v.in);
          } else if (v.not !== undefined) {
            conditions.push(`"${col}" != $${idx++}`);
            values.push(v.not);
          }
        } else {
          conditions.push(`"${col}" = $${idx++}`);
          values.push(v);
        }
      }
    }

    let sql = `SELECT COUNT(*)::int as count FROM public."${this.tableName}"`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const res = await this.queryFn(sql, values);
    return res.rows[0] ? parseInt(res.rows[0].count, 10) : 0;
  }
}

@Injectable()
export class SupabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupabaseService.name);
  private static poolInstance: Pool | null = null;
  private static clientInstance: SupabaseClient | null = null;
  private static isConnected = false;

  public get client(): SupabaseClient {
    return SupabaseService.clientInstance!;
  }

  public static get staticClient(): SupabaseClient | null {
    return SupabaseService.clientInstance;
  }

  public get pool(): Pool {
    return SupabaseService.poolInstance!;
  }

  // Domain Model Repositories
  public patient!: ModelRepository;
  public user!: ModelRepository;
  public staffProfile!: ModelRepository;
  public staffSchedule!: ModelRepository;
  public staffCredential!: ModelRepository;
  public auditLog!: ModelRepository;
  public emergencyContact!: ModelRepository;
  public patientConsent!: ModelRepository;
  public referralPartner!: ModelRepository;
  public lead!: ModelRepository;
  public admission!: ModelRepository;
  public room!: ModelRepository;
  public bed!: ModelRepository;
  public bedAllocation!: ModelRepository;
  public clinicalNote!: ModelRepository;
  public detoxEpisode!: ModelRepository;
  public withdrawalAssessment!: ModelRepository;
  public vitalsLog!: ModelRepository;
  public counsellingSession!: ModelRepository;
  public appointment!: ModelRepository;
  public medication!: ModelRepository;
  public pharmacyStockBatch!: ModelRepository;
  public prescription!: ModelRepository;
  public prescriptionItem!: ModelRepository;
  public medicationAdministration!: ModelRepository;
  public invoice!: ModelRepository;
  public invoiceItem!: ModelRepository;
  public payment!: ModelRepository;
  public mpesaTransaction!: ModelRepository;
  public movementRecord!: ModelRepository;
  public visitorLog!: ModelRepository;
  public incidentReport!: ModelRepository;
  public staffTask!: ModelRepository;
  public inventoryItem!: ModelRepository;
  public dischargeRecord!: ModelRepository;
  public aftercarePlan!: ModelRepository;
  public aftercareCheckin!: ModelRepository;
  public communicationLog!: ModelRepository;
  public feedbackSurvey!: ModelRepository;
  public systemSetting!: ModelRepository;

  constructor() {
    this.initRepositories((sql, params) => this.pool.query(sql, params));
  }

  private initRepositories(queryFn: (sql: string, params?: any[]) => Promise<any>) {
    for (const [modelName, tableName] of Object.entries(MODEL_TABLE_MAP)) {
      (this as any)[modelName] = new ModelRepository(tableName, queryFn);
    }
  }

  async onModuleInit() {
    if (SupabaseService.isConnected) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
      dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
      dotenv.config({ path: path.resolve(__dirname, '../../.env') });
      dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
      dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
    }

    const rawConnectionString = process.env.DATABASE_URL || '';
    if (!rawConnectionString) {
      throw new Error('DATABASE_URL environment variable is required to connect to Supabase PostgreSQL pooler.');
    }
    const connectionString = rawConnectionString
      .replace(/([?&])sslmode=[^&]+(&|$)/, '$1')
      .replace(/[?&]$/, '');

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    }

    // Initialize Supabase JS client
    if (!SupabaseService.clientInstance) {
      SupabaseService.clientInstance = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
    }

    // Initialize PostgreSQL connection pool with SSL
    if (!SupabaseService.poolInstance) {
      SupabaseService.poolInstance = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }

    try {
      const res = await SupabaseService.poolInstance.query('SELECT 1 as connected');
      if (res.rows[0]?.connected === 1) {
        SupabaseService.isConnected = true;
        this.logger.log(
          `[Supabase] Successfully connected to hosted PostgreSQL pooler at aws-0-eu-west-1.pooler.supabase.com (Project: ylpmrplszdxtlmzzrfgz).`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `[Supabase] Database connection failure: ${err.message}`,
      );
      throw new Error(
        `[Supabase] Unable to establish connection to hosted Supabase database. Please verify network access and credentials.`,
      );
    }
  }

  async onModuleDestroy() {
    if (SupabaseService.poolInstance && SupabaseService.isConnected) {
      SupabaseService.isConnected = false;
      await SupabaseService.poolInstance.end();
      SupabaseService.poolInstance = null;
      this.logger.log('[Supabase] Connection pool closed cleanly.');
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    return this.pool.query(sql, params);
  }

  async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const txRepos: Record<string, any> = {};
      for (const [modelName, tableName] of Object.entries(MODEL_TABLE_MAP)) {
        txRepos[modelName] = new ModelRepository(
          tableName,
          (sql, params) => client.query(sql, params),
        );
      }

      const result = await fn(txRepos);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
