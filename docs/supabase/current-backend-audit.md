# Calyvia Wellness Center — Current Backend Audit for Supabase Conversion (Step A)

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-09  
**Author:** Developer 2 (Full-stack workflows / UI), Quantum Code Technologies  
**Target Platform:** Supabase (Postgres 16, Auth, Storage, Edge Functions, Realtime, pg_cron)  
**Status:** DRAFT FOR LEAD REVIEW & SCOPE LOCK  

---

## 1. Current Backend Topology & Architecture

The existing Calyvia backend is a **modular monolith** built on:
- **Framework:** NestJS 10.3.8 (TypeScript, Node.js 22+ LTS).
- **Architecture:** 28 distinct NestJS domain modules wired into `AppModule`, with global filters (`GlobalHttpExceptionFilter`), interceptors (`AuditLogInterceptor`), and guards (`JwtAuthGuard`, `RolesGuard`).
- **Data Access:** Prisma ORM 5.22.0 targeting PostgreSQL 16.
- **Security & Crypto:** Argon2id password hashing, Passport-JWT token pair generation (15m access / 7d refresh), and a custom Node.js `CryptoService` executing AES-256-GCM authenticated encryption for sensitive clinical and demographic columns.
- **Orchestration:** Monorepo (`apps/api`, `apps/admin`, `packages/shared`, `docs`, `prisma`).

---

## 2. API Surface & Route Breakdown

All backend endpoints are mounted under `/api/v1` and documented via OpenAPI/Swagger at `/api/docs`:

| Module | Base Path | Endpoints & Verbs | Key Operations |
|---|---|---|---|
| **Auth & Security** | `/api/v1/auth` | `POST /login`, `POST /refresh`, `GET /me` | Argon2 validation, JWT token issuance, claims extraction. |
| **Audit Trail** | `/api/v1/audit-logs` | `GET /` | Immutable compliance trail querying (`SUPER_ADMIN`, `MEDICAL_DIRECTOR`). |
| **01. Patients** | `/api/v1/patients` | `POST /`, `GET /`, `GET /:id`, `PATCH /:id` | MPI registration with AES-256 field encryption, directory search. |
| **02. CRM** | `/api/v1/crm` | `POST /leads`, `GET /leads`, `PATCH /leads/:id/status`, `POST /admissions`, `GET /admissions` | Lead pipeline ingestion, formal admission processing. |
| **03. Clinical** | `/api/v1/clinical` | `POST /notes`, `GET /notes/patient/:patientId` | Versioned SOAP notes with encrypted subjective/objective/plan narratives. |
| **04. Detox** | `/api/v1/detox` | `POST /episodes`, `POST /assessments`, `POST /vitals`, `GET /episodes/:id` | CIWA-Ar and COWS withdrawal score recording, vital signs tracking. |
| **05. Counselling** | `/api/v1/counselling` | `POST /sessions`, `GET /patient/:patientId/sessions` | Psychotherapy session recording with encrypted notes. |
| **06. Appointments** | `/api/v1/appointments` | `POST /`, `GET /upcoming` | Consultation and MDT review scheduling. |
| **07. Billing** | `/api/v1/billing` | `POST /invoices`, `POST /payments`, `POST /mpesa/stk-push` | Invoicing, payment posting, Safaricom Daraja STK Push trigger. |
| **08. Pharmacy** | `/api/v1/pharmacy` | `GET /medications`, `POST /prescriptions`, `POST /mar/administer` | Formulary, e-prescriptions, e-MAR administration logs. |
| **09. Rooms & Beds** | `/api/v1/rooms` | `GET /`, `POST /allocations`, `POST /transfers` | Bed occupancy grid, bed assignments, ward transfers. |
| **10. Movement** | `/api/v1/movement` | `POST /passes`, `POST /visitors`, `GET /visitors` | Therapeutic leave passes, contraband luggage screening, visitor logs. |
| **11. Incidents** | `/api/v1/incidents` | `POST /`, `GET /` | Critical incident reporting (absconding, contraband, self-harm). |
| **12. Staff** | `/api/v1/staff` | `GET /`, `GET /licences/expiring` | Staff directory, professional license expiry monitoring (KMPDC/NCK). |
| **13. Tasks** | `/api/v1/tasks` | `POST /`, `GET /` | Staff clinical tasks and shift rounds assignment. |
| **14. Inventory** | `/api/v1/inventory` | `POST /items`, `GET /items` | Consumable catalog (food, cleaning, medical supplies). |
| **15. Documents** | `/api/v1/documents` | `POST /consents`, `GET /patient/:patientId/consents` | Digital consent capture with e-signatures. |
| **16. Discharge** | `/api/v1/discharge` | `POST /process`, `GET /records` | Clinical & financial clearance, automated aftercare plan link. |
| **17. Aftercare** | `/api/v1/aftercare` | `POST /checkins`, `GET /plans` | Sobriety milestone tracking (Day 7, 14, 30, 60, 90). |
| **18. Family** | `/api/v1/family` | `POST /contacts`, `GET /patient/:patientId` | Guardian registration, communication consents, guarantor designation. |
| **19. Referrals** | `/api/v1/referrals` | `POST /partners`, `GET /partners` | Partner directory and lead attribution. |
| **20. Comms** | `/api/v1/communication` | `POST /send`, `GET /logs` | ByteWave SMS and Baileys WhatsApp hub with editable templates. |
| **21. Feedback** | `/api/v1/feedback` | `POST /surveys`, `GET /summary` | Patient & family satisfaction surveys, NPS calculation. |
| **22. Dashboard** | `/api/v1/dashboard` | `GET /metrics` | Executive facility KPI aggregation (census, revenue, detox). |
| **23. Reports** | `/api/v1/reports` | `GET /financial`, `GET /clinical-outcomes` | Financial and clinical outcome report generation. |
| **24. Security** | `/api/v1/auth`, `/api/v1/audit-logs` | (Covered above) | RBAC and immutable audit log inspection. |
| **25. System Admin**| `/api/v1/system-admin` | `GET /facility-config`, `POST /settings` | Facility profile and operational parameter overrides. |
| **26. Integrations** | `/api/v1/integrations` | `POST /mpesa/callback`, `POST /webhook/website-lead` | Safaricom Daraja callback handler, public lead webhook. |
| **27. Automation** | `/api/v1/automation` | `POST /jobs/vitals-monitor`, `POST /jobs/aftercare-cadence` | Trigger endpoints for scheduled background tasks. |
| **28. AI Extension** | `/api/v1/ai-extension` | `POST /summaries/patient-record`, `POST /recommendations/follow-up` | Feature-flagged abstraction contracts. |

---

## 3. Database Schema, ORM & State

- **Engine:** PostgreSQL 16.
- **ORM:** Prisma ORM with 22 models (`User`, `StaffProfile`, `StaffSchedule`, `StaffCredential`, `AuditLog`, `Patient`, `EmergencyContact`, `PatientConsent`, `ReferralPartner`, `Lead`, `Admission`, `Room`, `Bed`, `BedAllocation`, `ClinicalNote`, `DetoxEpisode`, `WithdrawalAssessment`, `VitalsLog`, `CounsellingSession`, `Appointment`, `Medication`, `PharmacyStockBatch`, `Prescription`, `PrescriptionItem`, `MedicationAdministration`, `Invoice`, `InvoiceItem`, `Payment`, `MpesaTransaction`, `MovementRecord`, `VisitorLog`, `IncidentReport`, `StaffTask`, `InventoryItem`, `DischargeRecord`, `AftercarePlan`, `AftercareCheckin`, `CommunicationLog`, `FeedbackSurvey`, `SystemSetting`).
- **Primary Keys:** UUID v4 across all relational tables.
- **Audit & Invalidation:** `AuditLog` table records append-only event traces.
- **Soft Deletes & State:** `isArchived` on `Patient`, `isActive` on `BedAllocation`, `BedStatus` enums (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `RESERVED`).

---

## 4. Current Authentication, Sessions & RBAC

- **Authentication:** Custom JWT access token (15m expiry) and refresh token (7d expiry) signed using HMAC-SHA256. Passwords hashed using Argon2id.
- **RBAC:** 11 distinct enum roles (`SUPER_ADMIN`, `FACILITY_ADMIN`, `MEDICAL_DIRECTOR`, `DOCTOR_PSYCHIATRIST`, `NURSE`, `COUNSELLOR`, `PHARMACIST`, `ADMISSIONS_FRONT_DESK`, `FINANCE_BILLING`, `INVENTORY_STORE`, `MANAGEMENT_EXECUTIVE`).
- **Enforcement:** Enforced at controller level using `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`.
- **Gap / Vulnerability:** Database itself does not currently have Row Level Security (RLS) active. Any client with raw database credentials bypasses role restrictions.

---

## 5. File Storage, Background Jobs & Integrations

- **Storage:** No production S3/MinIO driver actively integrated; documents currently reference file metadata strings. MinIO image specified in `docker-compose.yml`.
- **Background Jobs:** BullMQ + Redis queue specified in architecture; trigger endpoints currently exist as HTTP controllers.
- **Integrations:**
  - Safaricom Daraja M-Pesa: Endpoints `/billing/mpesa/stk-push` and `/integrations/mpesa/callback` exist; sandbox credentials configurable via `.env`.
  - Website Webhook: Public webhook `/integrations/webhook/website-lead` accepts unauthenticated POST requests from `calyviawellness.co.ke`.

---

## 6. Migration Feasibility Assessment for Supabase

### What Maps Cleanly to Supabase:
1. **PostgreSQL Relational Schema:** The entire Prisma relational schema maps 1:1 to standard SQL DDL in Supabase PostgreSQL migrations (`/supabase/migrations/`).
2. **Authentication:** Supabase Auth (`auth.users`) cleanly replaces custom JWT issuance and Argon2 handling. Staff roles can be managed via custom JWT claims (`app_metadata.role`) and synced to a `staff_profiles` table.
3. **Session Handling:** `@supabase/ssr` integrates natively with Next.js App Router cookies for seamless authentication across `portal.calyviawellness.co.ke`.
4. **Storage:** Supabase Storage buckets (`patient-documents`, `consent-signatures`, `cms-media`) replace MinIO with signed URLs and RLS policies.
5. **Realtime:** Supabase Realtime pub/sub channels can broadcast bed occupancy changes and detox vitals alarms directly to the Next.js portal without polling.

### What Requires Redesign:
1. **Authorization (RBAC to RLS):** NestJS controller-level `@Roles()` guards must be complemented by native PostgreSQL Row Level Security (RLS) policies on **every table**. A security-definer helper function `auth.staff_role()` will consult staff role claims.
2. **Field-Level Encryption:** Sensitive clinical text (SOAP notes, substance use histories) is currently encrypted in Node.js via `CryptoService`. Under Supabase, encryption must either:
   - Be executed server-side inside Supabase Edge Functions or Next.js Server Actions before writing to PostgREST.
   - Or use PostgreSQL `pgcrypto` functions inside database triggers/RPCs.
3. **M-Pesa Webhook & Public Webhooks:** The Safaricom Daraja callback and website lead ingestion must become Supabase Edge Functions (Deno/TypeScript) with service-role database clients, verifying callback signatures and ensuring idempotent transactions.
4. **Scheduled Automation:** BullMQ jobs for vitals monitoring, medication alerts, and aftercare cadence must transition to `pg_cron` scheduled database functions or scheduled Edge Functions.
