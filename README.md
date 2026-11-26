# Calyvia Wellness Center Management System (HMIS / EMR)

[![CI Pipeline](https://github.com/calyvia/calyvia-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/calyvia/calyvia-management-system/actions)
[![License](https://img.shields.io/badge/License-Proprietary-forest.svg)](https://calyviawellness.co.ke/)
[![Compliance](https://img.shields.io/badge/KDPA%202019-Compliant-emerald.svg)](https://www.odpc.go.ke/)
[![Location](https://img.shields.io/badge/Facility-Ruiru%2C%20Kenya-amber.svg)](https://calyviawellness.co.ke/)

Production-grade, enterprise Hospital Information Management System (HMIS) & Electronic Medical Records (EMR) platform purpose-built for **Calyvia Wellness Center**, an addiction treatment and psychiatric rehabilitation facility located in Mugutha, Ruiru, Kiambu County, Kenya ([https://calyviawellness.co.ke/](https://calyviawellness.co.ke/)).

Digitises the complete clinical recovery journey:
$$\text{Enquiry} \longrightarrow \text{Triage \& Assessment} \longrightarrow \text{Admission} \longrightarrow \text{Detoxification} \longrightarrow \text{Therapy} \longrightarrow \text{Discharge} \longrightarrow \text{90-Day Aftercare}$$

---

## 🏥 Facility Profile & Clinical Scope
- **Physical Facility:** Mugutha, Behind Full Gospel Church, Ruiru, Kiambu County, Kenya.
- **Helpline / Admissions Desk:** `+254 700 534 306`
- **Clinical Programs:** Medically Guided Detox, Inpatient Rehabilitation (30 / 60 / 90 Days), Outpatient Rehabilitation, Individual & Group Therapy, Family Support, and Relapse Prevention Aftercare.
- **Regulatory Framework:** Compliant with Kenya Medical Practitioners and Dentists Council (KMPDC), Pharmacy and Poisons Board (PPB), Nursing Council of Kenya (NCK), and the **Kenya Data Protection Act, 2019 (Sections 44–47)**.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies & Frameworks | Description |
| :--- | :--- | :--- |
| **Backend REST API** | Node.js 22+, TypeScript, NestJS 10+ | Modular monolith with 28 isolated domain modules, RFC 7807 error format, OpenAPI 3.0. |
| **Admin & Clinical UI** | Next.js 14+ (App Router), React 18, Tailwind CSS | Brand-coherent clinical interface matching `docs/design-system.md` (WCAG 2.1 AA compliant). |
| **Database & ORM** | PostgreSQL 16 Enterprise, Prisma ORM 5+ | UUID v4 primary keys, UTC storage with Africa/Nairobi projection, immutable audit tables. |
| **Security & Privacy** | AES-256-GCM, Argon2id, Passport JWT | Field-level encryption for substance history, diagnoses, and national IDs; least-privilege RBAC. |
| **M-Pesa Integration** | Safaricom Daraja API | Lipa Na M-Pesa Online STK Push and idempotent C2B webhook callback processing. |
| **Cache & Automation** | Redis 7.2, BullMQ | Asynchronous detox vitals reminders, e-MAR dosing alerts, and aftercare follow-up cadences. |
| **DevOps & Containers**| Docker, Docker Compose, GitHub Actions | Multi-stage Docker builds, automated linting, typechecking, and test pipelines. |

---

## 📦 Scope: 28 Modular Domains Implemented

1. **Patient Management:** Master Patient Index (MPI), E.164 phone normalization (`+254 7XX...`), demographic profiling, encrypted allergies and substance history.
2. **CRM & Admissions:** Website lead ingestion webhook (`calyviawellness.co.ke`), triage pipeline, pre-admission assessments, waitlist.
3. **Medical & Clinical Records:** SOAP psychiatric evaluations, physician notes, nursing shift logs, versioned immutable notes with ICD-10 coding.
4. **Detox Management:** Clinical Institute Withdrawal Assessment for Alcohol (CIWA-Ar) and Clinical Opiate Withdrawal Scale (COWS) engines, vital signs charting.
5. **Counselling & Therapy:** Individual, group, family, and adolescent psychotherapy session recording, treatment goal progression.
6. **Appointments & Calendar:** Multidisciplinary team (MDT) reviews, doctor consultations, family sessions, staff calendar.
7. **Billing & Payments:** Invoicing, fee structures, payment receipting, automated Safaricom Daraja M-Pesa STK Push.
8. **Pharmacy & Medication:** Formulary, stock batches, e-prescriptions, electronic Medication Administration Record (e-MAR), controlled substances.
9. **Rooms & Beds:** Ward hierarchy (Detox Ward, Horizon Male Wing, Serenity Female Wing, VIP Suite), visual occupancy board, transfer transactions.
10. **Patient Movement & Visitors:** Medical escort passes, court appearance permits, contraband luggage screening, visitor logs.
11. **Incident & Risk Management:** Incident reports (absconding, medical emergencies, contraband), risk assessments, corrective action tracking.
12. **Staff Management:** Profiles, shift rosters, medical licensing tracking (KMPDC, NCK) with 90-day expiry alarms.
13. **Task Management:** Role-based nursing rounds, clinical deadlines, shift handovers.
14. **Inventory & Supplies:** Kitchen supplies, cleaning consumables, medical disposables, minimum stock alerts.
15. **Documents & Forms:** Admission agreements, data release authorisations, digital signature capture.
16. **Discharge Management:** Multidisciplinary discharge checklists, medical summaries, take-home medication instructions, financial clearance.
17. **Aftercare & Recovery:** Structured 7, 14, 30, 60, and 90-day milestone follow-up cadence, relapse risk tracking.
18. **Family Management:** Next-of-kin profiles, family counselling records, communication consent, primary billing guarantors.
19. **Referral Management:** Referring partner tracking (hospitals, psychiatrists, recovery fellowships), conversion analytics.
20. **Communication:** ByteWave SMS and Baileys WhatsApp delivery hub with editable SMS templates, gateway credentials, and delivery logs.
21. **Feedback & Complaints:** Patient satisfaction surveys, family NPS ratings, complaint resolution workflows.
22. **Management Dashboard:** Real-time facility metrics, bed census, detox cases, therapy volumes, MTD revenue in KES.
23. **Reports & Analytics:** Financial performance summaries, clinical detox outcomes, exportable to CSV/PDF.
24. **Security & User Access:** Argon2id auth, JWT access/refresh tokens, 11-role least-privilege RBAC matrix, immutable audit log.
25. **System Administration:** Facility master profile, service catalog, room definitions, system configuration.
26. **Integrations:** Public website enquiry form webhook receiver, Safaricom Daraja M-Pesa adapter.
27. **Automation:** BullMQ schedulers for vitals check alerts, e-MAR dosing notifications, aftercare follow-up dispatch.
28. **Future AI Features:** Extensible boundary contracts and feature flags for future automated clinical summaries and insights.

---

## 🎨 Brand Design Tokens & UI/UX

Derived directly from the official live brand assets (`https://calyviawellness.co.ke/`):
- **Primary Forest Green:** `#2C4A3E` (Dark: `#1A2F26`, Hover: `#3D6656`)
- **Secondary Sage Green:** `#7BA888` (Light: `#9DC3A9`, Background: `#F4F6F4`)
- **Accent Terracotta Clay:** `#C17B5F` (Background: `#FFF5F0`)
- **Warm Sand & Linen Canvas:** `#FDFBF7` (Cards: `#FFFFFF`, Borders: `#E8DCC8`)
- **Typography:** `Crimson Pro` (Serif display & headers), `Outfit` (Clean clinical body font), `ui-monospace` (M-Pesa transaction codes, patient identifiers).

Detailed specifications available in [`docs/design-system.md`](file:///c:/xampp/htdocs/Calyvia/docs/design-system.md).

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v20.x or v22.x LTS
- **npm:** v10+ or v11+
- **Docker & Docker Compose:** Optional for containerized deployment

### 2. Environment Setup
```bash
# Clone the repository
cd Calyvia

# Copy configuration
cp .env.example .env
```

### 3. Install Dependencies & Build
```bash
# Install root monorepo dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Build shared package, API, and Admin dashboard
npm run build
```

### 4. Run Tests
```bash
# Execute Jest unit and security tests
npm test
```

### 5. Running the Application Locally

Run both the API and Admin dashboard simultaneously with a single root command:

```bash
# Unified command (runs API on :4000 and Admin on :3000 concurrently)
npm run dev
```

Or run each service individually in separate terminals:

```bash
# Terminal 1: Start NestJS REST API (Port 4000 with hot-reload watch mode)
npm run dev:api

# Terminal 2: Start Next.js Admin Dashboard (Port 3000)
npm run dev:admin
```

#### Service URLs & Ports

| Service | Port | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Admin & Clinical Dashboard** | `3000` | [http://localhost:3000](http://localhost:3000) | Next.js 14 management portal |
| **REST API Base** | `4000` | [http://localhost:4000/api/v1](http://localhost:4000/api/v1) | NestJS modular REST API |
| **Health Check Endpoint** | `4000` | [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health) | Lightweight health & uptime verification |
| **OpenAPI / Swagger Docs** | `4000` | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) | Interactive API documentation |

#### Required Environment Variables (see `.env.example`)

Before running in production or connecting to external services, create `.env` from `.env.example`:

- `PORT`: REST API listening port (default `4000`).
- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5432/calyvia_db?schema=public`). *Note: In local development, an in-memory resilient fallback activates if the database is deferred.*
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Secure cryptographic strings for JWT token generation.
- `ENCRYPTION_MASTER_KEY`: 64-character hexadecimal key for AES-256-GCM field-level encryption of sensitive health data.

### 6. Troubleshooting: `MODULE_NOT_FOUND apps/api/dist/main`

If you encounter:
```
Found 0 errors. Watching for file changes.
Error: Cannot find module '...\apps\api\dist\main' (MODULE_NOT_FOUND)
```

- **Root Cause:** Occurs when TypeScript's incremental build cache (`.tsbuildinfo`) survives outside `dist/` while `dist/` is cleaned or removed by `deleteOutDir`. Because the source files appear unchanged to `tsc`, the watch compiler emits no new JavaScript files, leading Node to fail when looking for `dist/main.js`.
- **Permanent Fix in Codebase:**
  1. `incremental: false` is explicitly set in `apps/api/tsconfig.build.json` and `packages/shared/tsconfig.json` so cleans always trigger a full emit.
  2. `entryFile: "main"` is explicitly configured in `apps/api/nest-cli.json`.
  3. A dedicated health check endpoint is provided at `GET /api/v1/health`.
- **Recovery Steps (if cache becomes corrupted):**
  ```cmd
  REM Clean build directories and any stray tsbuildinfo files
  rmdir /s /q apps\api\dist
  del /s /q *.tsbuildinfo
  
  REM Rebuild shared packages and launch dev
  npm run build --workspace=@calyvia/shared
  npm run dev
  ```

### 7. Running with Docker Compose
```bash
docker compose up -d --build
```
This starts PostgreSQL 16, Redis 7.2, MinIO object storage, the NestJS API, and the Next.js Admin portal with automated health checks.

---

## 🔒 Security & KDPA 2019 Compliance

1. **Field-Level Encryption:** Sensitive patient narratives (substance history, psychiatric diagnoses, national IDs) are encrypted at rest with AES-256-GCM using keys stored in environment secrets (`ENCRYPTION_MASTER_KEY`).
2. **Immutable Audit Trail:** All access, exports, and updates to clinical charts and financial ledgers are captured via `AuditLogInterceptor` with user role, IP address, user-agent, and timestamp.
3. **Strict Least-Privilege RBAC:** 11 discrete roles enforced via `RolesGuard` and `@Roles()` decorators.

---

## 📄 License & Confidentiality
Property of **Calyvia Wellness Center**, Ruiru, Kiambu County, Kenya. All rights reserved.
