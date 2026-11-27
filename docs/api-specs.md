# Calyvia Wellness Center — REST API Specifications

**Base URL:** `http://localhost:4000/api/v1`  
**Swagger UI:** `http://localhost:4000/api/docs`  
**Authentication:** Bearer JWT (`Authorization: Bearer <accessToken>`)

---

## 1. Authentication & Security (Module 24)

### `GET /auth/turnstile/site-key`
Public endpoint used by the admin login page to load the Cloudflare Turnstile site key. Returns `{ "siteKey": "..." }` or `{ "siteKey": null }` when Turnstile is not configured. The secret key is never returned.

### `POST /auth/login`
Staff login endpoint. The Turnstile token is verified with Cloudflare before credentials are checked or JWTs are minted. Returns access token (15m expiry) and refresh token (7d expiry).
```json
// Request
{
  "email": "admin@calyviawellness.co.ke",
  "password": "Calyvia#2026",
  "turnstileToken": "0x4AAAAAAA..."
}

// Response (200 OK)
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "admin@calyviawellness.co.ke",
    "fullName": "Dr. Gackstone Baraka",
    "role": "SUPER_ADMIN"
  },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

### `GET /auth/me`
Returns current authenticated user and granted roles.

---

## 2. Patients & Master Patient Index (Module 01)

### `POST /patients`
Registers new patient into MPI with field-level encryption for sensitive clinical notes.
```json
// Request
{
  "firstName": "James",
  "lastName": "Mwangi",
  "preferredName": "Jimmy",
  "nationalIdNumber": "28471930",
  "dateOfBirth": "1990-05-14",
  "gender": "MALE",
  "phone": "+254712345678",
  "email": "j.mwangi@example.ke",
  "county": "Kiambu",
  "residentialAddress": "Ruiru Kimbo, near Spur Mall",
  "bloodGroup": "O+",
  "knownAllergies": "Penicillin, Aspirin",
  "substanceHistory": "Alcohol (12 units daily, 8 years)"
}
```

### `GET /patients`
List patients with optional search and status filter (`?status=ADMITTED_DETOX`).

---

## 3. CRM & Admissions (Module 02)

### `POST /crm/leads`
Logs lead enquiry from phone, walk-in, or web referral.

### `POST /crm/admissions`
Formalizes admission into detox or rehabilitation programs.
```json
// Request
{
  "patientId": "uuid-patient-id",
  "admissionType": "VOLUNTARY",
  "programType": "REHAB_30_DAYS",
  "admittingDoctorName": "Dr. Kevin Kiprotich",
  "primaryCounsellorName": "Counsellor Samuel Kioko"
}
```

---

## 4. Clinical & Detoxification (Modules 03 & 04)

### `POST /clinical/notes`
Appends encrypted, versioned SOAP clinical or psychiatric note.

### `POST /detox/assessments`
Records withdrawal assessment score:
- **CIWA-Ar** (Alcohol): Nausea, tremors, sweats, anxiety, agitation, headache, orientation.
- **COWS** (Opioids): Resting pulse, sweating, restlessness, pupil size, bone aches, runny nose, tremors.

### `POST /detox/vitals`
Logs patient vitals: Systolic BP, Diastolic BP, Pulse, Temperature (°C), Respiratory Rate, SpO2 (%).

---

## 5. Billing & Safaricom Daraja M-Pesa (Module 07 & 26)

### `POST /billing/mpesa/stk-push`
Triggers Lipa Na M-Pesa Online STK Push directly to subscriber phone.
```json
// Request
{
  "invoiceId": "uuid-invoice-id",
  "phoneNumber": "254712345678",
  "amountKES": 45000
}

// Response (200 OK)
{
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "MerchantRequestID": "CALYVIA-STK-REQ",
  "CheckoutRequestID": "ws_CO_17123456789_12345",
  "CustomerMessage": "Success. STK Push prompt initiated to +254712345678. Please enter your M-Pesa PIN to complete payment of KES 45000.",
  "status": "PENDING_PIN_PROMPT"
}
```

### `POST /integrations/mpesa/callback`
Asynchronous webhook receiver for Safaricom Daraja STK Push callbacks.
```json
// Sample Daraja Payload (Success ResultCode 0)
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "CALYVIA-STK-REQ",
      "CheckoutRequestID": "ws_CO_17123456789_12345",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 45000.0 },
          { "Name": "MpesaReceiptNumber", "Value": "SHB94819KL" },
          { "Name": "TransactionDate", "Value": 20261009143000 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

---

## 6. Public Webhook (Module 26)

### `POST /integrations/webhook/website-lead`
Public endpoint receiving lead submissions directly from `https://calyviawellness.co.ke/`.
```json
// Request
{
  "fullName": "Faith Nduta",
  "phone": "+254700123987",
  "email": "faith.nduta@example.ke",
  "substancesUsed": "Alcohol",
  "message": "Seeking inpatient detox admission for my brother."
}
```
