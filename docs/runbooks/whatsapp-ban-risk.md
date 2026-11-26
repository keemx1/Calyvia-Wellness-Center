# Runbook — WhatsApp (Baileys) Ban Risk & Go-Live

> **Status:** Operational risk accepted by the business.
> **Scope:** `WHATSAPP_PROVIDER=baileys` in `apps/api/src/modules/communication/`.
> **Last reviewed:** 2026-11-19

## 1. What we are doing and why it is risky

Calyvia sends outbound WhatsApp messages (appointment reminders, aftercare check-ins,
family broadcasts) using **Baileys** — an unofficial client that speaks the WhatsApp Web
multi-device protocol.

This is **not** the official WhatsApp Business Cloud API. It is a reverse-engineered
client, and using it for **automated or bulk messaging violates WhatsApp's Terms of
Service**. Baileys' own README states:

> "The maintainers of Baileys do not in any way condone the use of this application in
> practices that violate the Terms of Service of WhatsApp... We discourage any stalkerware,
> bulk or automated messaging usage."

Meta actively detects and bans numbers running unofficial automation.

### Consequences if we are caught

| Risk | Impact |
|---|---|
| **Number ban** | The linked phone number loses WhatsApp. For a clinical facility this is a patient-facing contact channel. |
| **No recourse** | No SLA, no support, no delivery guarantees. Appeals are rarely successful. |
| **Session revocation** | WhatsApp can log the session out at any time; messages silently stop until re-paired. |
| **Data exposure** | Chat history syncs to the server running Baileys. See §5. |

## 2. Accepted mitigation (business decision — 2026-11-19)

The business has decided to run Baileys on the **main clinic number**.

> ⚠️ This is the highest-risk option. If that number is banned, the clinic loses its
> primary WhatsApp line permanently. The recommendation was to use a dedicated
> secondary number and keep SMS as the channel of record for critical messaging.

Compensating controls that **must** stay in place:

1. **SMS is the channel of record.** Anything clinically or operationally critical
   (appointment times, medication alarms, discharge instructions) must be dispatched
   via SMS (`SMS_PROVIDER`), never WhatsApp alone.
2. **Message volume stays low and human.** Reminder cadence only — no marketing blasts,
   no cold outreach, no bulk imports. High volume is the primary ban trigger.
3. **Rate limiting.** Keep outbound well under ~20 messages/minute and space batch sends.
   Do not send to numbers that have never messaged us without a prior relationship.
4. **Monitor the connection.** `GET /api/v1/communication/whatsapp/status` must be
   checked as part of routine ops. A `closed` state means the session was logged out.
5. **Have a fallback.** If the number is banned, patients must still be reachable by SMS
   and phone. Do not let WhatsApp become a single point of failure.

## 3. Going live

```bash
# .env
WHATSAPP_PROVIDER=baileys
BAILEYS_AUTH_DIR=.baileys-auth     # must persist across deploys
```

Start the API, then pair the number once:

```bash
# Option A - scan the QR
curl -H "Authorization: Bearer $TOKEN" \
  https://api.calyviawellness.co.ke/api/v1/communication/whatsapp/status
# -> { "status": "awaiting_qr", "qr": "2@..." }   (scan on the phone)

# Option B - headless pairing code
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.calyviawellness.co.ke/api/v1/communication/whatsapp/pair?phone=2547XXXXXXXX"
# -> { "pairingCode": "ABCD-EFGH" }   (enter on the phone: Linked devices > Link with phone number)
```

Session state is written to `BAILEYS_AUTH_DIR`. **Back this directory up and treat it as a
secret** — it is the identity of the linked account (see §5).

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `status: "disconnected"` then reconnects | Transient network drop | Expected; auto-reconnects with backoff (5s → 10s → … → 5min) |
| `status: "closed"` + "logged out" | WhatsApp revoked the session (ban or manual unlink) | Clear `BAILEYS_AUTH_DIR`, re-pair. If it repeats → likely a ban. |
| Sends return `FAILED` with "not connected" | Socket not open | Check `/whatsapp/status`; pair if needed |
| `Cannot find module '@whiskeysockets/baileys'` | Package not installed | `npm i @whiskeysockets/baileys@^6.7.24` |
| QR never appears | Server started with a stale auth dir | Delete `BAILEYS_AUTH_DIR` contents and restart |
| `lastDisconnect: { statusCode: 428, message: "Connection Terminated" }` in `/whatsapp/status` | The WebSocket was closed before a QR was issued. Baileys reports 428 for *any* raw socket close. Check `GET /communication/whatsapp/diagnostics`: `dns`, `https` and `websocket` are probed against **`web.whatsapp.com`** (Baileys dials `wss://web.whatsapp.com/ws/chat`; `web.whatsapp.net` does not resolve and was an earlier diagnostic bug). If `websocket.error`/`closeCode` fails while `dns`/`https` pass, a proxy/firewall is blocking the upgrade. `authFiles` shows whether a stale session is present. |
| A stale session keeps closing with 428 | Credentials left by a failed pairing | In the admin UI use **Diagnostics**, then **Reset session** (SUPER_ADMIN only) — equivalent to `POST /communication/whatsapp/reset`. It clears `BAILEYS_AUTH_DIR` and starts a fresh QR handshake. |
| Pair returns "did not reach pairing state" | Socket closed before a QR was issued | The error now includes the real close code/message. Fix that cause first — pairing codes cannot be requested on a dead socket. |
| 428 with good DNS/HTTPS/WebSocket diagnostics | Application-side handshake bug | Fixed in code: Baileys needs `version` **omitted** (not `undefined`) to use its bundled revision, and `logger.child()` must return a logger with `trace()`. A local probe now produces a QR reliably. |

## 5. Security & privacy

- **`BAILEYS_AUTH_DIR` is a credential.** Anyone with those files can impersonate the
  clinic's WhatsApp account. Restrict filesystem permissions, exclude from git
  (`.gitignore`d), encrypt at rest, and never commit it.
- **Patient data in transit.** Message bodies contain patient information and are subject
  to the facility's data-protection obligations. Baileys has no BAA/DPA with Meta — this
  is an additional compliance exposure beyond the ban risk.
- **Logs.** The mock and Baileys drivers log message bodies at `debug`/`log` level.
  Ensure production log levels do not retain patient identifiers.

## 6. Alternative worth pursuing

ByteWave Networks resells a **"WhatsApp API"** product (visible on the registration
wizard at `portal.bytewavenetworks.com`). If that is the official WhatsApp Business
Cloud API or a sanctioned BSP, it removes the ban risk entirely and should replace
Baileys. **Action:** ask ByteWave whether their WhatsApp API is officially sanctioned.

The official path is WhatsApp Business Cloud API via Meta, which requires:

- A verified Meta Business account
- A dedicated business phone number
- **Pre-approved message templates** for outbound (appointment reminders) — Meta review
  takes days
- Free tier: ~1,000 service conversations/month, then paid

## 7. Related

- `apps/api/src/modules/communication/providers/baileys-whatsapp.provider.ts`
- `apps/api/src/modules/communication/providers/whatsapp-provider.ts`
- `docs/architecture.md` §ADR (provider abstraction decision)
- `.env.example` → "Communication Gateways" section
