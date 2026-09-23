# moniger.net

Moniger is a Supabase-backed finance operations platform for Nigerian businesses. It combines a public marketing site, an authenticated finance workspace, secure invoice payment collection, recurring workspace billing, and an internal admin console in one codebase.

## Platform Overview

The platform is built to replace spreadsheet-heavy finance operations with a shared workspace for accounts receivable, accounts payable, reporting, team controls, and operational visibility.

Today the project includes:

- a public website with landing, pricing, feature, support, security, changelog, and legal pages
- an authenticated business workspace for invoices, bills, vendors, customers, payments, reports, team management, audit trail, and settings
- secure public invoice payment links with Paystack-powered checkout and confirmation flows
- workspace subscription billing with free and paid plans
- an admin console for platform operators to manage businesses, users, subscriptions, payments, support, announcements, health, and settings
- Supabase migrations and edge functions for backend workflows, email delivery, billing, and admin operations

## Branch Workflow

This repository now follows a `feature -> develop -> main` workflow.

- `main`: production-ready branch
- `develop`: active integration branch for upcoming work
- `feature/*`: short-lived branches for new work
- `hotfix/*`: urgent production fixes branched from `main`

See [docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md) for the full process.

## Local Development

### Prerequisites

- Node.js 18+ recommended
- npm
- Supabase project access and environment variables

### Install and run

```bash
npm install
npm run dev
```

### Quality checks

```bash
npm run lint
npm run test
npm run build
```

### Optional workflows

```bash
npm run test:e2e
npm run perf:bundles
npm run perf:lighthouse
npm run create:test-user
npm run create:admin-test-users
```

## Environment Variables

For isolated local development and payment callbacks, follow [docs/LOCAL_ENVIRONMENT_SETUP.md](./docs/LOCAL_ENVIRONMENT_SETUP.md). Do not use production Supabase values in `.env.local` when testing Paystack locally.

### Required for app startup

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Required for some local scripts

- `VITE_SUPABASE_PROJECT_ID`

### Recommended app configuration

- `VITE_SUPABASE_EMAIL_REDIRECT_TO`
- `VITE_PUBLIC_APP_URL`
- `VITE_APP_BASE_URL`
- `VITE_AMPLITUDE_API_KEY`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`

### E2E and QA helpers

- `PLAYWRIGHT_E2E_EMAIL`
- `PLAYWRIGHT_E2E_PASSWORD`
- `PLAYWRIGHT_PAYMENT_PATH`
- `PLAYWRIGHT_ADMIN_EMAIL`
- `PLAYWRIGHT_ADMIN_PASSWORD`
- `PLAYWRIGHT_NON_ADMIN_EMAIL`
- `PLAYWRIGHT_NON_ADMIN_PASSWORD`
- `PLAYWRIGHT_ADMIN_BUSINESS_NAME`
- `PLAYWRIGHT_NON_ADMIN_BUSINESS_NAME`
- `LIGHTHOUSE_PORT`
- `LIGHTHOUSE_TARGET_PATH`

### Edge Function secrets for customer communications

- `CONTACT_RECIPIENT_EMAILS` — comma-separated recipients for Contact Us messages; defaults to `admin@moniger.net,foxyrule@gmail.com` when omitted. `CONTACT_RECIPIENT_EMAIL` remains supported for backward compatibility.
- `SIGNUP_ALERT_RECIPIENTS` — comma-separated signup-alert recipients; defaults to `foxyrule@gmail.com,admin@moniger.net`.
- `APP_ENVIRONMENT` — environment label included in signup alerts, for example `production`, `staging`, or `qa`.
- QA accounts created with `ALLOW_TEST_DATA=true APP_ENVIRONMENT=qa npm run create:test-user` or `ALLOW_TEST_DATA=true APP_ENVIRONMENT=qa npm run create:admin-test-users` receive explicit test metadata and appear under the Admin Users test-user filter. These scripts refuse to run without both an explicit opt-in and a non-production environment label.

These are Supabase Edge Function secrets, not frontend `.env` values. They must be configured alongside the existing `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` secrets before deploying `contact-message` and `signup-alert`.

## Paystack Webhook

Set the Paystack webhook URL to:

```text
https://qfhjlqskucabzxepqbpl.supabase.co/functions/v1/paystack-webhook
```

After setting it in Paystack test mode, you can run a routed sandbox proof plus webhook check with:

```bash
npm run verify:webhook:routed
```

To make the command fail when Paystack does not deliver a webhook event, use:

```bash
npm run verify:webhook:routed -- --require-webhook
```

To verify the production app shell and payment-route rewrites on `moniger.net`, run:

```bash
npm run verify:production:routes
```

To block a release when the linked Supabase project is missing `APP_BASE_URL`, run:

```bash
npm run verify:release:security
```

To verify production-domain Paystack checkout initialization safely without completing any charge, run:

```bash
npm run verify:production:live-init
```

If Paystack is intentionally still in `TEST` mode on production and you want to complete the test checkouts end-to-end without charging real money, run:

```bash
npm run verify:production:live-init -- --complete-test-mode
```

## Supabase Backend Surface

Current edge functions in this repo:

- `account-security-recovery`
- `admin-console`
- `auth-email`
- `paystack-payments`
- `paystack-webhook`
- `workspace-digest-automation`
- `workspace-email-delivery`
- `workspace-subscriptions`

## Current Delivery Status

The codebase is already beyond the prototype stage. Based on the current implementation and project trackers, the platform has working finance CRUD, authentication, settings, team management, localization foundations, public invoice payment collection, workspace billing, marketplace routing, and a substantial admin console. The main remaining work is concentrated around live billing rollout verification, observability setup, and final hosted end-to-end verification before full release.
