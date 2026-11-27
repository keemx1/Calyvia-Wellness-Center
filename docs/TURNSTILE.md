# Cloudflare Turnstile — Admin Login

Turnstile protects the admin portal login. The browser loads the public site key from the API, renders the widget, and submits the generated token with the credentials. The API verifies that token with Cloudflare **before** checking the password or minting JWTs.

## Keys

Set both values only in the API environment (Coolify):

- `TURNSTILE_SITE_KEY` — public widget key. Served by `GET /api/v1/auth/turnstile/site-key`.
- `TURNSTILE_SECRET_KEY` — Siteverify secret. Server-only; never sent to the browser, repo, or logs.

`TURNSTILE_SECRET_KEY` is required. Login fails closed with HTTP 503 if it is missing.

## Setup

1. In Cloudflare, create a Turnstile widget for `https://portal.calyviawellness.co.ke`.
2. Copy the site key and secret key.
3. Add the two variables to the API service in Coolify and restart the API.
4. Log in to the portal; the **Security Verification** checkbox appears above the Sign In button.

## Flow

1. `SignInPage` fetches `GET /auth/turnstile/site-key`.
2. It loads `https://challenges.cloudflare.com/turnstile/v0/api.js` and renders a widget explicitly.
3. The widget callback stores a short-lived token in component state.
4. `POST /auth/login` sends `{ email, password, turnstileToken }`.
5. The controller calls `TurnstileService.verify(token, clientIp)` first.
6. Only after Siteverify returns `success: true` does `SecurityService.login()` validate credentials and create the session.

Expired tokens and failed attempts reset the widget, requiring a fresh challenge. A misconfigured secret or an unreachable Cloudflare API returns HTTP 503 and never bypasses verification.

## Verification checklist

- [ ] `GET /api/v1/auth/turnstile/site-key` returns the public site key.
- [ ] Login without a token returns 400/401 and does not validate credentials.
- [ ] Login with an invalid/expired token fails before reaching credential lookup.
- [ ] Valid challenge + valid credentials returns JWTs.
- [ ] Failed login resets the widget.
- [ ] `TURNSTILE_SECRET_KEY` does not appear in browser bundles, API logs, or the repo.
