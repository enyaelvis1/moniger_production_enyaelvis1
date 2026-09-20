# OWASP Security Review Checklist

Tracking checklist for the current Moniger app security review using OWASP-style priorities. This is focused on the concrete findings from the app scan on 2026-05-21.

Current branch at review time: `main`

## Status key

- [ ] Not started
- [x] Done

---

## Critical / High

### 1) Stop trusting `Origin` for security-sensitive app links

- [x] Remove `request.headers.get("origin")` fallback from reset, invite, and billing-link helpers.
- [x] Fail closed when `APP_BASE_URL` is missing instead of generating links from request headers.
- [x] Use one canonical app URL source across:
  - `supabase/functions/auth-email/index.ts`
  - `supabase/functions/admin-console/index.ts`
  - `supabase/functions/workspace-email-delivery/index.ts`
  - `supabase/functions/_shared/paystack-subscriptions.ts`
- [x] Add a deployment check that blocks release if `APP_BASE_URL` is unset.
- [x] Add a repo script for the check: `npm run verify:release:security`.
- **Risk**
  - Password reset, invite, or billing links could be poisoned if environment config is missing and a hostile `Origin` is supplied.
- **Test**
  - Temporarily unset `APP_BASE_URL` in a safe local/test environment.
  - Trigger password reset and invite flows.
  - Confirm the function fails with a configuration error instead of generating a link from request headers.

---

## Medium

### 2) Reduce session-token exposure from `localStorage`

- [x] Review whether Supabase session persistence can move away from `localStorage`.
- [x] Move Supabase session persistence to per-tab `sessionStorage`.
- [x] If immediate migration is not feasible, document the accepted risk and compensating controls.
- [x] Add browser hardening headers before next production release:
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Frame-Options` or `frame-ancestors`
- [x] Add these headers through Vercel config or app hosting config.
- Note: Supabase auth sessions now persist in per-tab `sessionStorage` instead of `localStorage`, which reduces token lifetime across browser restarts and removes cross-tab persistence. Browser-accessible tokens still exist while a tab is open, so the response headers, reduced public confirmation exposure, reset-token scrubbing, neutral reset responses, and rate limiting remain important compensating controls.
- **Risk**
  - Any future XSS could read bearer tokens directly from browser storage.
- **Test**
  - Confirm auth still works after header changes.
  - Confirm production responses include the new security headers.

### 3) Lock down public subscription confirmation flow

- [x] Review `public.confirmation-status` so it does not perform privileged state changes from a public request alone.
- [x] Minimize the response payload so it does not expose workspace identifiers or names unnecessarily.
- [x] Bind public confirmation to a stronger secret than the Paystack reference alone, or make it read-only.
- [x] Confirm replaying the same public confirmation URL cannot keep mutating internal state.
- Note: the public confirmation path now returns a minimal read-only checkout status. Full Paystack verification and workspace subscription syncing now stay behind the signed-in `self.verify-checkout` flow.
- **Risk**
  - Anyone with the checkout reference can hit a public endpoint that verifies and syncs subscription state and returns workspace subscription details.
- **Test**
  - Call the public confirmation endpoint with a real test reference from a signed-out session.
  - Confirm it returns only minimal safe status data.
  - Confirm it cannot write subscription state unless the request is properly authorized by the intended design.

### 4) Clear reset tokens from the browser URL after session setup

- [x] After `exchangeCodeForSession` or `setSession`, replace the URL so `code`, `access_token`, and `refresh_token` are removed.
- [x] Confirm refresh and browser history no longer preserve sensitive reset tokens.
- **Risk**
  - Reset tokens can leak through browser history, screenshots, copy/paste, or shared-device use.
- **Test**
  - Open a real reset link.
  - Confirm the reset page loads successfully.
  - Confirm the URL is rewritten immediately to a clean `/reset-password` path with no auth secrets visible.

---

## Good Signals Already Seen

### 5) Keep and verify current positive controls

- [x] Login `next` redirect is normalized to internal paths only.
- [x] Paystack webhook signature verification exists.
- [x] Password reset endpoint rate limiting exists.
- [x] Unknown-email handling on password reset is neutralized.
- [ ] Add broader automated regression coverage for the remaining security fixes above once implemented.
- [x] Add regression coverage for session-storage auth persistence.
- [x] Add regression coverage for reset-token URL scrubbing.
- [x] Add regression coverage for the signed-out public subscription confirmation path.

---

## Recommended Order

1. Fix unsafe `Origin` fallback.
2. Clear reset tokens from the URL.
3. Lock down public subscription confirmation behavior.
4. Add browser security headers and revisit session storage strategy.
5. Add regression tests for all remediations.
