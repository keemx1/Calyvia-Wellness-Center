# Calyvia Wellness Center — Comprehensive Backend Audit for Supabase Migration

**Document Version:** 2.0.0  
**Audit Date:** 2026-10-09  
**Auditor:** Principal Full-Stack Software Engineer (Developer 2), Quantum Code Technologies  
**Target Platform:** Supabase Hosted Infrastructure (PostgreSQL 16, Supabase Auth, Storage, Edge Functions, Realtime)  
**Compliance Context:** Kenya Data Protection Act, 2019 (KDPA Sections 44–47)  

---

## 1. Executive Summary

Calyvia Wellness Center is a psychiatric rehabilitation and addiction recovery center in Ruiru, Kiambu County, Kenya ([https://calyviawellness.co.ke/](https://calyviawellness.co.ke/)). The platform automates and safeguards the full clinical journey:
$$\text{Enquiry} \longrightarrow \text{Triage} \longrightarrow \text{Admission} \longrightarrow \text{Detoxification} \longrightarrow \text{Therapy} \longrightarrow \text{Discharge} \longrightarrow \text{90-Day Aftercare}$$

This audit establishes the baseline of all 28 modules, data models, encryption schemes, authentication boundaries, and integration endpoints to prepare a risk-managed migration to hosted Supabase.

---

## 2. Monorepo & Backend Architecture Topology

The application codebase is structured as a TypeScript monorepo:
- **`apps/api`:** NestJS 10.3.8 modular monolith hosting all 28 clinical, operational, and financial domains.
  - Global prefix: `/api/v1`
  - Swagger documentation: `/api/docs`
  - Global Exception Filter: `GlobalHttpExceptionFilter` (RFC 7807 compliant error format).
  - Global Audit Interceptor: `AuditLogInterceptor` logging all mutations and data access events.
  - Global Validation: `ValidationPipe` with whitelist and forbidden non-whitelisted payload checks.
- **`apps/admin`:** Next.js 14+ (App Router) clinical management portal for authorized staff (`portal.calyviawellness.co.ke`).
- **`packages/shared`:** Shared TypeScript domain types, enums, DTOs, and utility constants.
- **`prisma/schema.prisma`:** Central PostgreSQL schema containing 41 relational models and 15 domain enums.

---

## 3. Detailed Audit of the 28 Functional Modules

| # | Domain Module | Primary Models | Endpoints & Verbs | Current Implementation State | Supabase Migration Path |
|:--|:--|:--|:--|:--|:--|
| **01** | **Patient Management** | `Patient`, `EmergencyContact`, `PatientConsent` | `POST /patients`, `GET /patients`, `GET /patients/:id`, `PATCH /patients/:id` | Implemented & Verified. AES-256 encrypted substance history & allergies; E.164 phone normalization. | Direct PostgreSQL tables + RLS policies enforcing staff role access. |
| **02** | **CRM & Admissions** | `Lead`, `Admission` | `POST /crm/leads`, `GET /crm/leads`, `PATCH /crm/leads/:id/status`, `POST /crm/admissions` | Implemented & Verified. Webhook ingestion, lead triage pipeline, formal admissions. | Direct tables + Edge Function for public website lead webhook. |
| **03** | **Clinical Records** | `ClinicalNote` | `POST /clinical/notes`, `GET /clinical/notes/patient/:id` | Implemented & Verified. SOAP note versioning, encrypted psychiatric narratives, ICD-10 codes. | Direct table + RLS restricting notes to medical/nursing staff. |
| **04** | **Detox Management** | `DetoxEpisode`, `WithdrawalAssessment`, `VitalsLog` | `POST /detox/episodes`, `POST /detox/assessments`, `POST /detox/vitals`, `GET /detox/episodes/:id` | Implemented & Verified. Automated CIWA-Ar and COWS scoring calculation, vitals alerts. | Direct tables + Realtime channel for high-acuity vitals alarms. |
| **05** | **Counselling & Therapy** | `CounsellingSession` | `POST /counselling/sessions`, `GET /counselling/patient/:id/sessions` | Implemented & Verified. Individual, group, and family therapy notes; encrypted goals. | Direct table + RLS restricted to Counsellors & Psychologists. |
| **06** | **Appointments** | `Appointment` | `POST /appointments`, `GET /appointments/upcoming` | Implemented & Verified. MDT reviews, psychiatric consultations, calendar sync. | Direct table + Realtime updates for front-desk schedule changes. |
| **07** | **Billing & Payments** | `Invoice`, `InvoiceItem`, `Payment`, `MpesaTransaction` | `POST /billing/invoices`, `POST /billing/payments`, `POST /billing/mpesa/stk-push` | Implemented & Verified. Safaricom Daraja STK Push trigger, fee tracking in KES. | Direct tables + Edge Function for Daraja callback verification. |
| **08** | **Pharmacy** | `Medication`, `PharmacyStockBatch`, `Prescription`, `PrescriptionItem`, `MedicationAdministration` | `GET /pharmacy/medications`, `POST /pharmacy/prescriptions`, `POST /pharmacy/mar/administer` | Implemented & Verified. e-Prescriptions, batch tracking, e-MAR dosing records. | Direct tables + RLS allowing MAR administration to Nurses/Doctors only. |
| **09** | **Rooms & Beds** | `Room`, `Bed`, `BedAllocation` | `GET /rooms`, `POST /rooms/allocations`, `POST /rooms/transfers` | Implemented & Verified. Ward hierarchy (Detox, Male, Female, VIP), bed census board. | Direct tables + trigger to auto-sync bed occupancy status. |
| **10** | **Movement & Visitors** | `MovementRecord`, `VisitorLog` | `POST /movement/passes`, `POST /movement/visitors`, `GET /movement/visitors` | Implemented & Verified. Escort passes, luggage screening, visitor logs. | Direct tables + Front-desk / Security RLS policies. |
| **11** | **Incidents & Risk** | `IncidentReport` | `POST /incidents`, `GET /incidents` | Implemented & Verified. Critical incident logging (absconding, contraband, emergency). | Direct table + RLS restricting critical reports to Leadership. |
| **12** | **Staff Management** | `User`, `StaffProfile`, `StaffSchedule`, `StaffCredential` | `GET /staff`, `GET /staff/licences/expiring` | Implemented & Verified. Professional license tracking (KMPDC, NCK) with 90-day expiry alarms. | Direct tables + sync with Supabase `auth.users`. |
| **13** | **Tasks & Rounds** | `StaffTask` | `POST /tasks`, `GET /tasks` | Implemented & Verified. Nursing shift rounds, clinical deadlines, shift handovers. | Direct table + Realtime task notifications. |
| **14** | **Inventory** | `InventoryItem` | `POST /inventory/items`, `GET /inventory/items` | Implemented & Verified. Consumable inventory, kitchen supplies, reorder alarms. | Direct table + Storekeeper RLS policies. |
| **15** | **Documents & Forms** | `PatientConsent` | `POST /documents/consents`, `GET /documents/patient/:id/consents` | Implemented & Verified. Digital consent agreements, e-signature data. | Direct table + Supabase Storage private buckets for PDF files. |
| **16** | **Discharge** | `DischargeRecord` | `POST /discharge/process`, `GET /discharge/records` | Implemented & Verified. Multi-department clearance, take-home medication instructions. | Direct table + trigger initiating 90-day aftercare cadence. |
| **17** | **Aftercare & Recovery** | `AftercarePlan`, `AftercareCheckin` | `POST /aftercare/checkins`, `GET /aftercare/plans` | Implemented & Verified. Structured 7, 14, 30, 60, 90-day milestone follow-up cadence. | Direct tables + `pg_cron` / Edge Function for cadence scheduling. |
| **18** | **Family Management** | `EmergencyContact` | `POST /family/contacts`, `GET /family/patient/:id` | Implemented & Verified. Primary guarantor designation, family therapy consent. | Direct table linked to `patients`. |
| **19** | **Referrals** | `ReferralPartner` | `POST /referrals/partners`, `GET /referrals/partners` | Implemented & Verified. Hospital & psychiatrist partner tracking, attribution. | Direct table + Front Desk / Management access. |
| **20** | **Communication** | `CommunicationLog` | `POST /communication/send`, `GET /communication/logs` | Implemented & Verified. ByteWave SMS and Baileys WhatsApp delivery logs, editable SMS templates. | Direct table + Edge Function for dispatch hooks. |
| **21** | **Feedback** | `FeedbackSurvey` | `POST /feedback/surveys`, `GET /feedback/summary` | Implemented & Verified. Patient NPS and family care surveys. | Direct table + anonymous insertion RLS policy. |
| **22** | **Dashboard** | N/A (Aggregated) | `GET /dashboard/metrics` | Implemented & Verified. Live bed census, active detox count, MTD revenue in KES. | Direct database views / RPC functions. |
| **23** | **Reports & Analytics** | N/A (Aggregated) | `GET /reports/financial`, `GET /reports/clinical-outcomes` | Implemented & Verified. Financial ledger exports, clinical recovery summaries. | Database views / server-side reporting queries. |
| **24** | **Security & Access** | `User`, `AuditLog` | `POST /auth/login`, `GET /audit-logs` | Implemented & Verified. Argon2id, JWT tokens, 11-role least privilege RBAC. | Supabase Auth (`auth.users`) + RLS policies on all tables. |
| **25** | **System Admin** | `SystemSetting` | `GET /system-admin/facility-config`, `POST /system-admin/settings` | Implemented & Verified. Master facility configuration, parameter overrides. | Direct table with `SUPER_ADMIN` write protection. |
| **26** | **Integrations** | `MpesaTransaction`, `Lead` | `POST /integrations/mpesa/callback`, `POST /integrations/webhook/website-lead` | Implemented & Verified. Safaricom Daraja STK webhook receiver, website lead hook. | Supabase Edge Functions with service-role database access. |
| **27** | **Automation** | N/A | `POST /automation/jobs/vitals-monitor`, `POST /automation/jobs/aftercare-cadence` | Implemented & Verified. Scheduled maintenance and alert dispatch triggers. | Supabase `pg_cron` + scheduled database procedures. |
| **28** | **Future AI Features** | N/A | None | Removed at client request; no AI endpoints or UI remain. | Not applicable. |

---

## 4. Database Schema & Data Models Audit

- **Total Relational Models:** 41 models defined in `prisma/schema.prisma`.
- **Primary Keys:** UUID v4 across all tables via `@id @default(uuid())` (mapping directly to `gen_random_uuid()` in Postgres 16).
- **Foreign Keys:** Explicit relational integrity with cascading deletes on child relations (e.g., `Patient` $\rightarrow$ `EmergencyContact`, `Admission` $\rightarrow$ `BedAllocation`).
- **Audit Trails:** Append-only `audit_logs` model capturing `userId`, `action`, `entityName`, `entityId`, `ipAddress`, and `timestamp`.
- **Timezone Standard:** All timestamp columns stored in UTC and displayed in `Africa/Nairobi` (EAT / UTC+3).

---

## 5. Security & Sensitive Data Controls Audit

### A. Field-Level Encryption
Under the Kenya Data Protection Act, 2019 (Sections 44–47), health and psychiatric records require heightened technical safeguards. In Calyvia:
- Sensitive clinical narratives (`substanceHistoryEncrypted`, `allergiesEncrypted`, `subjectiveNarrativeEncrypted`, `objectiveNarrativeEncrypted`, `assessmentNarrativeEncrypted`, `planNarrativeEncrypted`, `nationalIdEncrypted`) are encrypted with **AES-256-GCM**.
- In the Hybrid architecture, this encryption remains securely executed inside the backend Node.js layer using the master key from environment variables.
- In Supabase SQL migrations, encrypted columns are typed as `TEXT` to hold the serialized ciphertext + initialization vector + auth tag payload without loss of fidelity.

### B. Access Control & RBAC
The system defines 11 distinct staff roles:
1. `SUPER_ADMIN` — Full system administration and audit inspection.
2. `FACILITY_ADMIN` — Operations, staff scheduling, bed configuration.
3. `MEDICAL_DIRECTOR` — Clinical governance, case reviews, medical oversight.
4. `DOCTOR_PSYCHIATRIST` — Clinical SOAP notes, psychiatric assessments, prescriptions.
5. `NURSE` — Vital signs, detox CIWA/COWS monitoring, e-MAR dosing, shift notes.
6. `COUNSELLOR` — Psychotherapy notes, family sessions, progress goals.
7. `PHARMACIST` — Formulary management, prescription dispensing, stock batches.
8. `ADMISSIONS_FRONT_DESK` — Patient registration, triage intake, visitor logs, room allocation.
9. `FINANCE_BILLING` — Invoicing, payment receipting, M-Pesa STK trigger, financial reports.
10. `INVENTORY_STORE` — Consumables, kitchen supplies, reorder thresholds.
11. `MANAGEMENT_EXECUTIVE` — Read-only access to dashboards, bed census, and revenue analytics.

---

## 6. Integrations & External Services Audit

1. **Safaricom Daraja M-Pesa (Lipa Na M-Pesa Online):**
   - Endpoints: `POST /billing/mpesa/stk-push` (initiates STK push) and `POST /integrations/mpesa/callback` (idempotent receipt processing).
   - Data stored: `checkoutRequestId`, `merchantRequestId`, `mpesaReceiptNumber`, `amount`, `phoneNumber`, `resultCode`, `resultDesc`.
   - Security requirement: Callback must be verified, idempotent, and protected against replay attacks.
2. **Public Website Lead Ingestion:**
   - Ingests enquiries from `https://calyviawellness.co.ke/` into the CRM pipeline.
   - Endpoint: `POST /integrations/webhook/website-lead`.
   - Payload: Name, phone, email, substance/concern, relationship to patient.
3. **Communication Gateway (SMS & WhatsApp):**
   - Supports ByteWave SMS and Baileys WhatsApp for appointment reminders and family updates.

---

## 7. Migration Readiness & Risk Assessment

| Migration Area | Current Complexity | Risk Level | Mitigation Strategy |
|:--|:--|:--|:--|
| **Schema DDL** | 41 models with explicit relationships | **Low** | Clean SQL DDL executed sequentially in Supabase SQL Editor (`01` through `04`). |
| **Row Level Security (RLS)** | Currently enforced in NestJS guards only | **Medium** | Enable RLS on 100% of tables in `05_rls_policies.sql`. Provide `service_role` bypass for NestJS backend while supporting staff role evaluation. |
| **Database Connections** | Single local Postgres connection | **Low** | Use Supabase Transaction Pooler (Supavisor on port 6543 with `pgbouncer=true`) for application queries and direct port 5432 for migrations. |
| **Object Storage** | Local disk / mock metadata | **Low** | Create dedicated private buckets (`patient-documents`, `medical-records`, `prescriptions`) in `07_storage_buckets.sql`. |
| **M-Pesa Callbacks** | NestJS HTTP controller | **Medium** | Keep NestJS callback endpoint active, or bridge with a Supabase Edge Function that updates the `mpesa_transactions` table. |

---

## 8. Conclusion & Sign-Off

The Calyvia backend is completely structured and ready for Supabase hosting. The recommended target architecture is **Option A: Hybrid** (detailed in [`ADR-001-supabase-architecture.md`](file:///c:/xampp/htdocs/Calyvia/docs/adr/ADR-001-supabase-architecture.md)), ensuring zero regression to the 28 validated domain modules while gaining the managed reliability, automated backups, and security of Supabase.
