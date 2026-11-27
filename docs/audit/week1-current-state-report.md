# Calyvia Wellness Center — Week 1 Current-State Report & Execution Plan

**Author:** Developer 2 (Full-stack workflows / UI), Quantum Code Technologies  
**Collaborators:** Dev 1 (Technical Lead / Backend), Dev 3 (QA / Integrations / DevOps)  
**Date:** 2026-10-09  
**Gate:** Week 1 Scope Lock & Target Architecture Approval  

---

## 1. Executive Summary & Baseline State

Over Week 1 discovery and audit, the repository has been inspected, baseline builds verified, and all 28 functional areas evaluated in code and runtime:
- **Baseline Build:** `@calyvia/shared`, `@calyvia/admin`, and `@calyvia/api` compile cleanly with 0 TypeScript errors.
- **Unit & Security Tests:** Jest tests passing (7/7 tests passed: AES-256-GCM encryption/tamper rejection and RBAC `RolesGuard` least-privilege matrix).
- **Backend Architecture Audit:** Completed in [`docs/supabase/current-backend-audit.md`](file:///c:/xampp/htdocs/Calyvia/docs/supabase/current-backend-audit.md).
- **Target Architecture Decision (ADR-001):** Completed in [`docs/supabase/adr-001-target-architecture.md`](file:///c:/xampp/htdocs/Calyvia/docs/supabase/adr-001-target-architecture.md). Recommends **Option 1: Supabase-Native Architecture** (PostgreSQL + RLS + `@supabase/ssr` on Next.js 14+ App Router + Edge Functions for M-Pesa/webhooks + Storage + Realtime).
- **Design System & CMS Safety:** Completed in [`docs/design-system.md`](file:///c:/xampp/htdocs/Calyvia/docs/design-system.md), establishing brand tokens, WCAG AA guidelines, and strict anon-safe views for published CMS content.

---

## 2. Prioritised Backlog (P0 through P3)

In accordance with clinic safety, statutory compliance (KDPA 2019), and financial integrity:

### Priority 0 (Critical: Safety, Security, Financial Integrity)
1. **P0-1 Database-Enforced Row Level Security (RLS):** Apply RLS on 100% of tables with zero `anon` read access to medical data; default deny.
2. **P0-2 Idempotent Daraja M-Pesa Callback Handling:** Database transactions with unique constraints on `checkout_request_id` and `mpesa_receipt_number`.
3. **P0-3 Active Detox Withdrawal Protocols:** Reactivity and validation on CIWA-Ar and COWS calculators to prevent missed medical interventions.
4. **P0-4 Medication Administration (e-MAR) & Controlled Drug Audit:** Strict nurse sign-off on benzodiazepines and opioid agonists with batch deduction.
5. **P0-5 Critical Incident Escalation:** High/critical incident alerting with Medical Director sign-off workflow.

### Priority 1 (Core Inpatient Workflows & Acceptable MVP)
1. **P1-1 Patient Registration & MPI:** Multi-step intake modal with E.164 phone normalisation and emergency contact guarantees.
2. **P1-2 CRM Admissions Pipeline:** Direct conversion of website leads to formal admissions.
3. **P1-3 Clinical Notes UI:** Rich text SOAP documentation with versioned historical comparison.
4. **P1-4 Interactive Bed Occupancy Board:** Visual room/bed grid with transfer modal and atomic bed locking.
5. **P1-5 Billing & Invoicing Engine:** Automated inpatient day tariff calculation and receipt generation.
6. **P1-6 Discharge & 90-Day Aftercare Link:** Discharge clearance checklist automatically creating aftercare follow-up milestones (Day 7, 14, 30, 60, 90).
7. **P1-7 Staff Management & Licence Alarms:** KMPDC / NCK expiry alerts at 90, 60, and 30 days.

### Priority 2 (Operational Enhancements & Secondary Workflows)
1. **P2-1 Consumables & Stores Inventory:** Kitchen, cleaning, and general supplies reorder tracking.
2. **P2-2 Patient Movement & Visitor Screening:** Gate pass logging and contraband search checklists.
3. **P2-3 Referral Partner Analytics:** Attribution tracking for hospitals, psychiatrists, and church fellowships.
4. **P2-4 Patient & Family Satisfaction Surveys:** Digital feedback collection and NPS calculation.
5. **P2-5 CMS Content Management:** Portal editor for Careers/Vacancies, Blog articles, and Announcements with draft/publish workflows.

### Priority 3 (Future & Deferred Scope)
1. **P3-1 AI Clinical Summarisation & Insights:** Removed at client request; no abstraction contracts, endpoints, or feature flag remain.
2. **P3-2 Drag-and-Drop Form Builder:** Deferred to future phase.
3. **P3-3 External Laboratory Integration:** Stubs maintained.

---

## 3. Proposed 4-Week Scope (MVP vs. Deferred)

| Phase | Week | Target Deliverables | Owner |
|---|---|---|---|
| **Week 1** | Days 1–7 | Audit, discovery, 28-area matrix, backend audit, ADR-001, design system, backlog lock. | Dev 2 (Lead) + Dev 1 & Dev 3 Review |
| **Week 2** | Days 8–14 | Supabase baseline schema, RLS policies, Auth migration, patient intake → admission → bed allocation workflow. | Dev 2 + Dev 1 (RLS Sign-off) |
| **Week 3** | Days 15–21 | Clinical SOAP notes, Detox CIWA/COWS, e-MAR, Billing with M-Pesa STK Edge Function, Discharge & Aftercare, CMS draft/publish editor. | Dev 2 + Dev 3 (Sandbox testing) |
| **Week 4** | Days 22–28 | Full regression, Playwright E2E journey tests, staging migration dry run, production portal hardening at `portal.calyviawellness.co.ke`. | Dev 2 + Dev 1 & Dev 3 Sign-off |

---

## 4. End-to-End User Journey Test Plan (Playwright)

To be executed with synthetic data on staging prior to release:

1. **Journey 1: Public Lead Ingestion → CRM Triage**
   - Public webhook submission from `calyviawellness.co.ke` → verifies row inserted in `leads` table with status `NEW_INQUIRY` → receptionist reviews in portal CRM pipeline.
2. **Journey 2: Triage → Admission → Bed Allocation**
   - Patient registration with normalized phone (`+254 7XX...`) → formal admission created → assigned to Bed 02 in Ground Detox Ward → verifies Bed status switches to `OCCUPIED` and census increments.
3. **Journey 3: Clinical Detox & e-MAR Administration**
   - Nurse Faith logs vital signs and CIWA-Ar score (18 - Moderate) → doctor prescribes Diazepam taper → nurse administers dose on e-MAR → stock batch decrements atomically.
4. **Journey 4: Therapy & Clinical Review**
   - Counsellor Kioko logs individual CBT therapy session → verifies encrypted SOAP note cannot be viewed by billing role.
5. **Journey 5: Billing & Safaricom Daraja M-Pesa Settlement**
   - Invoice generated for 7-day detox package → M-Pesa STK Push initiated to `254712345678` → simulated/sandbox callback processed → receipt issued → balance decreases to zero.
6. **Journey 6: Discharge Clearance & Aftercare Initiation**
   - Medical Director signs clinical clearance → financial zero-balance verified → discharge record creates 90-day aftercare plan with milestone check-ins (Day 7, 14, 30, 60, 90).
7. **Journey 7: CMS Article Draft → Publish → Public Site Verification**
   - Staff drafts article "Understanding Alcohol Withdrawal" → verifies invisible to `anon` → author clicks "Publish" → verifies published post renders on public view; private drafts remain blocked.

---

## 5. External Access Blockers & Credentials Checklist

The following items are required from the Project Owner and DevOps Lead (Dev 3) before Week 2 implementation can deploy:

| # | Dependency / Blocker | Needed For | Action Required From | Status |
|---|---|---|---|---|
| **B-1** | **Supabase Organization & Projects Access** | Staging and Production Supabase projects (Project Ref, DB credentials, API keys) | Project Owner / Dev 3 | **BLOCKER** |
| **B-2** | **DNS Configuration for Subdomain** | Pointing `portal.calyviawellness.co.ke` to the Next.js portal hosting target | Project Owner / Domain Registrar | Pending Staging Setup |
| **B-3** | **Safaricom Daraja Sandbox API Credentials** | Consumer Key, Consumer Secret, Passkey, Shortcode for M-Pesa STK Push testing | Project Owner / Dev 3 | Mock active, Sandbox needed for W3 |
| **B-4** | **SMS / WhatsApp Gateway Credentials** | SMS & WhatsApp notification integration testing | Dev 3 | Mock active, Sandbox needed for W3 |
| **B-5** | **Public Website CMS Integration Boundary** | Confirmation of public site rendering architecture (API endpoint vs static export) | Project Owner / Webmaster | Documented in Design System |

---

## 6. Formal Sign-Off Request (Gate: Week 1 Approval)

As **Developer 2**, I have completed Week 1 discovery, audit, architecture design, and planning. 

In accordance with our non-negotiable rules:
> **"Do not modify code or touch any Supabase project until I approve scope and target architecture."**

I now submit this report, the **28-Area Matrix**, the **Current Backend Audit**, and **ADR-001 (Supabase-Native)** for your review and approval.
