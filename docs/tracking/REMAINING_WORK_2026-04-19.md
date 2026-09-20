# Remaining Work - 2026-04-19

## Current status after today's Phase 5 close-out work

The codebase now includes:

- dashboard and reports polish for confirmed Paystack-backed payment visibility
- canonical payment-link generation support through `VITE_PUBLIC_APP_URL` / `VITE_APP_BASE_URL`
- Apache SPA rewrite support through `public/.htaccess` so `/pay/:paymentToken` routes can resolve after deployment
- production observability scaffolding for Sentry, Amplitude, and web-vitals
- consent-aware analytics bridging tied to workspace privacy preferences
- expanded automated coverage for observability utilities and scaffolded Playwright finance journeys

## What is still remaining

### Phase 5

- deploy the latest build so the new payment-link routing and canonical URL logic are live
- set `VITE_PUBLIC_APP_URL` in the frontend environment to the production app URL
- confirm `APP_BASE_URL` in Supabase Edge Function secrets matches the production app URL
- re-test the live payment-link flow end to end on the production domain:
  - open a copied payment link in a fresh browser session
  - open the same link from WhatsApp share
  - complete a Paystack payment and confirm the callback lands on `/pay/:paymentToken/confirmed`
  - confirm dashboard, reports, invoices, and payments reflect the settlement
- complete Flutterwave vendor payout research and scope

### Phase 3

- expand translation coverage across remaining entity pages
- localize remaining public marketing surfaces
- remove remaining hard-coded locale formatters and strings where shared localization should be used
- run a multi-locale layout QA sweep

### Phase 6

- set `VITE_SENTRY_DSN` in the frontend environment for production error monitoring
- set `VITE_SENTRY_ENVIRONMENT` and optionally `VITE_SENTRY_TRACES_SAMPLE_RATE`
- set `VITE_AMPLITUDE_API_KEY` if product analytics should be enabled
- verify privacy-controlled analytics opt-in behavior in a live workspace
- provide Playwright runtime secrets for hosted E2E coverage:
  - `PLAYWRIGHT_E2E_EMAIL`
  - `PLAYWRIGHT_E2E_PASSWORD`
  - `PLAYWRIGHT_PAYMENT_PATH`
- run the new Playwright finance and payment specs against a deployed environment

## Validation note from today

On April 19, 2026, the current live domain check showed:

- `https://moniger.com/` returned `200`
- `https://moniger.com/pay/test-token` returned `404`
- `https://www.moniger.com/pay/test-token` returned `404`

Inference:
The production host is not yet serving SPA rewrites for payment-link routes, so deployment is still required before Phase 5 can be called fully closed.
