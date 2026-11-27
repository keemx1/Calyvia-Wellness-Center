# Calyvia Management System — Client-Ready Functional & Safety Audit

**Date:** 27 November 2026  
**Scope:** Production portal `https://portal.calyviawellness.co.ke`, production API `https://api.calyviawellness.co.ke/api/v1`, API source, admin source, deployment templates, and the full automated test suite.

> No production M-Pesa STK push, SMS, WhatsApp dispatch, or mutating request was triggered during the read-only production audit. No secret values are reproduced in this report.

---

## 1. Executive summary

The system is **fundamentally functional** for the core clinical, admissions, billing, communication, and administration workflows. The main production integrations are real: ByteWave SMS, Baileys WhatsApp, Supabase PostgreSQL, and Safaricom M-Pesa Paybill STK Push.

The client-facing picture is now honest:

- **Working:** authentication, patient registry, admissions intake, billing/invoices with the official letterhead, M-Pesa confirmation flow, ByteWave SMS, WhatsApp invoice PDFs, templates, reports, audit logs, facility config, and role-based navigation.
- **Empty by design:** several modules returned empty arrays from production because no records have been entered yet. Empty is not the same as broken.
- **Stubbed / not implemented:** automation scheduling, CIWA/COWS capture, clinical-outcome tracking, forced password-change enforcement, deep dependency health checks, and header alert feed are explicitly reported as unavailable rather than shown as successful.
- **Dev/test only:** mock SMS and mock WhatsApp drivers remain in the codebase for tests but are blocked in production. Synthetic seed SQL is explicitly UAT/dev only.
- **Unsafe/blocked:** M-Pesa credential rotation still needs confirmation and public write endpoints still need abuse controls before open launch. Production test/mock records have been deleted.

All local validation passes: **20 test suites / 161 tests**, API build clean, admin TypeScript clean, admin production build clean, admin lint **0 errors**, API lint **0 errors**.

**Current code is not yet deployed.** The latest fixes are committed locally but not pushed or redeployed. Do not hand over the new build until credential rotation and endpoint-abuse decisions below are closed.

---

## 2. Verified working

| Area | What was verified | Evidence / notes |
| :--- | :--- | :--- |
| Authentication | Login `200`, `/auth/me` `200`, JWT access/refresh secrets required in production | Hardcoded bootstrap-admin bypass, fake Supabase identity, and dev JWT fallbacks removed. |
| RBAC | Navigation and API access role-scoped | `RolesGuard` now fails closed; every guarded route has an explicit `@Roles()` policy. |
| Patient registry | Registration, guardian/SMS phone/WhatsApp number/email capture, safe archive deletion | Guardian stored as `emergency_contacts` relationship `GUARDIAN`; active admissions block deletion; records preserved via `is_archived`. |
| Patient dashboard | Details, guardian, billing, medication, optional Supabase photos | Medications join `prescriptions → admissions → prescription_items → medications`; no invented `patient_id` column. |
| Billing | Manual/auto invoices, official Calyvia letterhead PDF, separate SMS phone and WhatsApp fields, delete actions, failed deliveries in red | Invoice metadata encoded in `invoices.notes` (`Bill to`, `Phone`, `WhatsApp`, `Source`); no DB migration required. Deletion removes payments/line items first. |
| M-Pesa | Production Paybill STK Push, persistent modal until confirmation, green-tick success, idempotent callbacks, ledger as `MPESA_STK` | Callback URL tested: exact JSON returned `HTTP/1.1 200 OK` and `{"ResultCode":1,"ResultDesc":"Rejected. Missing callback identifiers"}`. Real request IDs; payment messaging failures never trigger Safaricom retries. |
| Payment receipts | Paid invoice PDF via WhatsApp and SMS receipt via ByteWave | Independent `Promise.allSettled` dispatch with documented recipient priorities. |
| SMS | Real ByteWave delivery to test recipient `0703377395` | `status=success`, `Delivered`, cost `0.25`, sender `BytewaveSMS`. Production `SMS_PROVIDER=mock` is forcibly resolved to `bytewave`. |
| WhatsApp | Baileys session live; invoice PDFs and document refs sent | Production status `status=open`, `connected=true`, no QR. Production mock provider is blocked and resolves to `baileys`. |
| Gateway credentials | Only ByteWave + WhatsApp settings; OAuth client ID/secret hidden | Secrets are encrypted/never echoed. ByteWave balance UI showed `KES 47.10`, estimate `≈188`, top-up portal link; API `remaining_balance=Ksh47.10`. |
| Templates | 21 grouped templates, previews, save/reset | Server-side save/reset restricted to `SUPER_ADMIN`; non-super-admin UI is now read-only. |
| Reports | Financial and clinical-outcome endpoints live; CSV export downloads real data | Fabricated `+14.2%` and `0.0%` placeholders removed; untracked outcomes return `null`. |
| Audit log | UI wired to `/audit-logs`; fabricated localhost session row removed | Read from real API. |
| Facility config | UI wired to `/system-admin/facility-config`; hardcoded partner-hospital/database claims removed | Legal compliance flags now `null` / `NOT_VERIFIED`. |
| Documents | Sidebar submenu maps documents/discharge/aftercare to matching tab | `initialTab` wiring completed; fabricated doctor default removed. |
| Appointments | Real booking errors surfaced; clinician select uses loaded staff | Static `Dr. Evelyn Wanjiku` default removed from booking UI. |
| CRM / Clinical / Pharmacy | New Lead, Admit Patient, Append Clinical Note, and Issue Prescription now write through real APIs | Previously alert-only actions replaced with validated forms and real error handling. |
| Production walk-through | All sidebar modules opened without auth or API failures | 87 browser network requests, 64 API requests, `0` failed/4xx/5xx, `0` console errors. |

---

## 3. Empty, but valid

These production API responses were empty arrays. They are **not failures**:

- `/crm/admissions`
- `/tasks`
- `/inventory/items`
- `/appointments`
- `/pharmacy/medications`

The patient registry, invoices, payments, M-Pesa ledger, and communication logs are also empty after the test-data cleanup.

Clinical notes are empty until a patient is selected on the Patients registry, then load from `/clinical/notes/patient/:id`.

---

## 4. Stubbed or not implemented

These features are now explicitly reported as unavailable rather than disguised as working:

| Feature | Current honest state |
| :--- | :--- |
| Automation jobs | Manual evaluation endpoints report `NOT_CONFIGURED`, zero dispatches, `NOT SCHEDULED`, `Queue: not configured`. No fake patient names or completed jobs. |
| CIWA-Ar / COWS assessment | Reference display only. Scores are not captured or persisted to patient records; use the paper protocol and record observations through clinical notes. |
| Header clinical alerts | `not tracked`. Automated vitals alerting is not implemented. |
| Ward-level male/female/VIP occupancy and critical vitals | `NOT TRACKED`; the API returns `null` instead of a fabricated zero. |
| Facility operational status | `null` / `NOT_REPORTED`; the API does not assert a live status it cannot verify. |
| Reports clinical outcomes | `null` where the underlying outcome is not tracked. |
| KDPA registration / compliance | `NOT_VERIFIED`. Legal compliance is not certified by this application. |
| Forced password change | `mustChangePassword` flag is recorded, but no forced password-change screen is enforced after login. |
| Health endpoint | Liveness only (`status: live`, `dependencyChecks: not_performed`). No DB/provider readiness check. |
| Duty roster / KMPDC / NCK licence verification | Not implemented; active staff accounts only. |

---

## 5. Mock / dev-only

| Item | Production position |
| :--- | :--- |
| SMS mock driver | Blocked. Stale `SMS_PROVIDER=mock` resolves to `bytewave`; mock is dev/test only. |
| WhatsApp mock driver | Blocked. Stale `WHATSAPP_PROVIDER=mock` resolves to `baileys`; mock is dev/test only. |
| Synthetic seed SQL (`supabase/sql/08_seed_synthetic_data.sql`) | Explicitly marked `STRICTLY SYNTHETIC`; dev/UAT only. |
| Production test/mock records | **Deleted.** Removed the test patient and guardian, 3 test invoices and their line items, 4 M-Pesa test payments, 5 M-Pesa callback rows, and all 11 test-related communication logs (including `MOCK-SMS-1795681871308-41440`). |
| Development-only admin accounts | **Deleted.** Removed the two never-used `...Dev` SUPER_ADMIN accounts; `approved_by` on the director account was cleared so the FK reference would not block deletion. |
| Production communication logs | Now empty. All prior logs were tied to the test invoices/payments and were removed. |

---

## 6. Unsafe / blocked before client handover

1. **M-Pesa credential rotation — outstanding.** The consumer key, consumer secret, and passkey were previously exposed. Confirm they were rotated in Daraja and that only the new values exist in Coolify. The tracked `coolify.env` template has been sanitized; no secret values are committed.
2. **JWT/encryption secrets in the old deployment template — sanitized, rotation recommended.** The tracked template previously contained real-looking JWT and encryption secrets. It now contains placeholders only. If any of those values were ever used in production, rotate them in Coolify.
3. **Public write endpoints need abuse controls.** `/feedback/surveys` and `/integrations/webhook/website-lead` accept anonymous writes with no rate limiting or CAPTCHA. Add controls before public promotion.
4. **Admin API URL fallback.** Client code still defaults to `http://localhost:4000/api/v1` when `NEXT_PUBLIC_API_URL` is missing. Production builds must set this variable; otherwise requests will misroute.
5. **Baileys risk.** WhatsApp automation uses an unofficial WhatsApp Web client and can result in number bans. This is a business risk, not a code defect.
6. **Silent DB fallbacks remain.** Several services still return `[]` on database errors; outages can appear as “no records”. This needs a systematic error-surfacing pass.
7. **API payload duplication.** Several responses duplicate fields in camelCase and snake_case. Cosmetic/cleanup item.
8. **WhatsApp session hygiene.** Production status is connected, but `lastDisconnect` is present and `baileysVersion=null`. Monitor after deploys and re-pair if needed.

---

## 7. Changes in this final pass

- `RolesGuard` changed from fail-open to **fail closed**; explicit roles added to every previously undecorated guarded route.
- AI assistant and AI backend module removed at client request; no AI UI, endpoints, role permissions, or feature flag remain.
- SMS template UI made read-only for non-`SUPER_ADMIN`; server restriction was already present.
- Wired real API writes for leads, admissions, clinical notes, prescriptions, document tabs, appointment clinician selection, reports, audit logs, and facility config.
- Removed fake appointment fallback, static report percentages, fabricated audit row, hardcoded partner/database claims, and false compliance labels.
- Header notification center now reports the real tracked state instead of “all vitals normal”.
- Dashboard returns `null` for untracked ward/vitals/outcome metrics and filters M-Pesa revenue to the current month.
- Health endpoint downgraded to honest liveness.
- `coolify.env`, `docker-compose.yml`, `.env.example`, and production env loading sanitized: no committed secrets, required compose secrets, production ignores local `.env`, ByteWave sender `BytewaveSMS`, `MPESA_ENVIRONMENT=production`, callback IP allowlist empty.
- Temporary audit login file deleted.
- Production test/mock data deleted: test patients/guardian, invoices, line items, M-Pesa payments/callbacks, all test-related communication logs, and two unused developer super-admin accounts.

---

## 8. Validation

| Check | Result |
| :--- | :--- |
| `npx tsc --noEmit -p apps/admin/tsconfig.json` | Pass |
| `npm run build --workspace=@calyvia/api` | Pass |
| `npm test --workspace=@calyvia/api -- --runInBand` | **20 suites / 161 tests passed** |
| `npm run lint --workspace=@calyvia/admin` | **0 errors**, 6 warnings |
| `npm run build --workspace=@calyvia/admin` | Pass |
| API ESLint | **0 errors**, 474 warnings |
| `git diff --check` | No whitespace errors (line-ending notices only) |

---

## 9. Deployment checklist

Before marking the new build client-ready:

1. Obtain written confirmation that M-Pesa credentials were rotated in Daraja and updated only in Coolify.
2. Confirm whether old JWT/encryption secrets also need rotation.
3. Decide whether public feedback/website-lead endpoints need rate limiting before launch.
4. Commit and push the working tree.
5. Redeploy API and admin only after the above.
6. Re-run the read-only production smoke test after deployment: login, `/auth/me`, dashboard, patients, billing, communication, reports, and audit.

**Current pushed baseline:** `3be3331`.  
**Current state:** newer fixes and test-data cleanup are committed locally; not pushed or redeployed.
