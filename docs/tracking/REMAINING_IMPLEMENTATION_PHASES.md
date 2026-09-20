# Remaining Implementation Phases - moniger.net

Last reviewed: 2026-04-14
Primary basis: current repo state plus `docs/IMPLEMENTATION_ROADMAP.md`, `docs/IMPLEMENTATION_GAP_ANALYSIS.md`, `docs/PHASE_1_REMAINING_CHECKLIST.md`, and `docs/PHASE_2_SECURITY_CHECKLIST.md`

## Purpose

This document reflects the current state of the Moniger AP/AR platform as of April 14, 2026.

Phases 1 and 2 are fully closed. The application now has a real Supabase-backed foundation, persisted CRUD for all core finance and directory modules, full settings and security controls including MFA and session management, backend email delivery infrastructure, team management, exports, advanced filters, bulk actions, command palette search, and invoice delivery through backend email with mail-app fallback.

This file lists what is actually left to implement, grouped into practical phases.

---

## Current Baseline Already Shipped

These items are no longer part of the remaining implementation backlog:

- authenticated application shell and protected routes
- Supabase-backed workspace and domain foundation with migrations and generated types
- persisted customers, vendors, invoices, bills, payments, notifications, and audit activity
- React Query-powered data hooks across directory, finance, operations, settings, notifications, and team management
- advanced filtering with saved presets and filter history
- command palette and global search
- bulk row selection with bulk status change and bulk delete flows
- notification center with read, mark-as-read, and mark-all-read actions
- report, invoice, and payment export flows with print-ready document generation
- invoice delivery through backend email with mail-app fallback
- profile, business, notification-preference, and workspace-member persistence
- team management as a primary workspace page with full member lifecycle
- skeleton loading states across all entity pages and finance surfaces
- inline form validation with accessible error feedback on all core forms
- secondary empty-state coverage across notification center, audit trail, settings, and command palette
- accessibility and focus audit: dialog/sheet/menu/table semantics, keyboard navigation, icon labeling, axe smoke coverage
- long-running progress states for report export, invoice export, payment receipt export, and delivery flows
- Phase 1 QA sweep confirmed complete 2026-04-08
- session management UI in Settings Security tab with current session details and sign-out controls
- backend-backed session inventory with device details, sign-out status, and security activity log
- password management with inline validation and verification-code support
- two-factor authentication and MFA: TOTP enrollement, MFA on sign-in, factor removal, backup recovery codes
- privacy and export controls with JSON account and workspace export snapshots
- backend delivery infrastructure for invites, digests, invoice delivery, and invitation acceptance
- Phase 2 core delivery confirmed complete 2026-04-13

Because those capabilities exist today, they are not repeated in the phased plan below.

---

## Remaining Work By Phase

---

## Phase 3: Internationalization and Formatting

### Goal

Introduce a real localization architecture instead of scattered hard-coded formatting and copy.

### Status

In progress. Foundation slice shipped on 2026-04-14.

### Why this phase comes next

The platform currently has formatting logic scattered across components with repeated direct `Intl.NumberFormat("en-NG", ...)` calls and hard-coded English copy. As Moniger grows beyond a single locale, this becomes a maintenance and scaling problem. Centralizing formatting now prevents it from sprawling further into a codebase that is otherwise well-structured.

### Scope

- translation infrastructure
- locale-aware formatting
- centralized currency, number, and date utilities
- user-facing language and formatting preferences

### Feature status

| Feature | Status | Scope | Notes |
| --- | --- | --- | --- |
| i18n infrastructure | Done | Shared localization provider, translation lookup, browser fallback, and tests | The app now resolves effective language and locale from browser defaults plus persisted profile and workspace settings |
| Translation files | Done | `en` and `fr` resources | Initial translation coverage now includes the authenticated shell, dashboard summary, search surfaces, settings tabs, and locale controls |
| Language switcher | Done | Profile and workspace settings | Users can now choose personal language/locale overrides or inherit workspace defaults, and workspace owners can define business defaults |
| Centralized formatting | Done | Shared currency, number, date, and datetime helpers | Dashboard, reports, payments, invite acceptance, and accessibility labels now use shared formatting utilities |
| Locale preference persistence | Done | `profiles` and `businesses` | Language and locale preferences are now persisted in Supabase and drive the runtime localization layer |
| Broader string extraction | In progress | Remaining entity pages and marketing surfaces | Auth and onboarding copy, notification center messaging, backend-generated emails, and export footer metadata now use the localization layer, but the remaining entity pages and public marketing surfaces still need to move onto translation keys |

### Remaining deliverables

- expand translation coverage across the remaining entity and marketing surfaces
- continue removing remaining direct hard-coded locale formatters where shared utilities are more appropriate
- run multi-locale layout QA once more screens are translated

### Detailed checklist

Use [PHASE_3_LOCALIZATION_CHECKLIST.md](./PHASE_3_LOCALIZATION_CHECKLIST.md) as the execution list for this phase.

### Exit criteria

- the app can support at least one additional locale cleanly without touching individual page components
- currency and date formatting are centrally controlled through a single shared utility layer
- language and locale changes are applied globally from a single preference setting
- no scattered hard-coded `Intl.NumberFormat` calls remain in component files

### Estimated effort

1 to 2 weeks of focused development.

---

## Phase 4: Performance Architecture

### Goal

Reduce the cost of the current feature-rich single-page bundle and improve perceived performance on slower networks and devices common among Nigerian business users.

### Status

Complete. Closed on 2026-04-14.

### Why this phase matters now

The current build already emits a large chunk warning. Routes are still imported eagerly in `src/App.tsx` with no code splitting strategy in place. Adding more features including payment integration on top of an unoptimised bundle increases load time for every user on every page load. This phase must be completed before payment integration is added so the performance baseline is clean.

### Scope

- route and chunk optimization
- asset optimization
- React Query cache and stale-time tuning
- performance measurement and targets

### Feature status

| Feature | Status | Scope | Notes |
| --- | --- | --- | --- |
| Route lazy loading | Done | Public and authenticated routes | Routes now load through `React.lazy()` and no longer all ship in the first route bundle |
| Shared Suspense fallback | Done | Route-level loading state | A shared route loading screen now covers lazy route transitions |
| Chunk splitting strategy | Done | Route and vendor bundle boundaries | The build now separates route code from shared React, Supabase, query, Radix UI, charting, form, motion, icon, and date utility bundles |
| Public shell split | Done | Public routes versus authenticated workspace shell | Public landing and marketing routes now load through a lighter outer router, while the authenticated workspace app and its providers sit behind a later lazy `PlatformApp` boundary |
| Bundle-size reduction | Done | Initial app payload | Route eager-loading cost is reduced substantially, query and cache behavior is tuned, the residual bundle review split calendar code away from charting, shared style helpers moved into a dedicated `style-vendor` chunk, the landing page defers below-the-fold sections into their own chunks, and the public shell split keeps the workspace runtime off the landing path until needed |
| Asset optimization | Done | Static imagery and non-critical assets | The current shipped images now use explicit loading priority, async decoding, and lazy-loading behavior for non-critical surfaces instead of a blanket eager strategy, the landing page no longer renders all secondary sections on first paint, and the public route now uses a lightweight local SVG mark for the critical navbar asset |
| Query/cache tuning | Done | Shared React Query defaults and targeted profiles | `src/App.tsx` now uses a tuned `QueryClient` baseline and the data layer applies shared query profiles for finance, directory, dashboard, notifications, security, team, session inventory, and search flows |
| Lighthouse workflow | Done | Performance measurement and targets | The repo now includes `npm run perf:lighthouse`, `npm run perf:bundles`, and the documented workflow in `docs/LIGHTHOUSE_WORKFLOW.md` for repeatable public-route performance checks, and the current production-build workflow passes the configured threshold |

### Outcome

Phase 4 is complete because the current tracked public-route baseline now meets the threshold:

- Performance: `82`
- Accessibility: `93`
- Best Practices: `96`

### Current evidence for this phase

- routes now lazy load from `src/App.tsx`
- the public route and authenticated workspace app now load through separate lazy shells
- the build now uses manual vendor chunks in `vite.config.ts`
- React Query defaults and targeted cache profiles are now centralized in `src/lib/query.ts`
- the repo now includes a checked-in Lighthouse and bundle-summary workflow
- the tracked local Lighthouse baseline for `/` improved from 47 to 68 after the landing deferral work and public-shell split, and then to 82 after the performance close-out pass that separated shared style helpers from charting and removed the eager footer motion dependency

### Detailed checklist

Use [PHASE_4_PERFORMANCE_CHECKLIST.md](./PHASE_4_PERFORMANCE_CHECKLIST.md) as the execution list for this phase.

### Exit criteria

- Lighthouse Performance score is above 75 on the production build
- no large chunk warnings on build output
- all routes use lazy loading with Suspense boundaries
- React Query cache configuration is documented and tuned
- the public landing route no longer pulls avoidable protected-app/runtime weight into the first navigation path

### Estimated effort

1 to 2 weeks of focused development.

---

## Phase 5: Payment Integration

### Goal

Wire in real payment processing so users can receive invoice payments from customers directly through the platform and so the platform can trigger and track vendor bill payments programmatically.

### Status

In progress. First public Paystack collection slice shipped on 2026-04-14.

### External dependency

The client must have an active Paystack account (individual or registered business) before this phase can be completed. Paystack account setup should happen in parallel with Phases 3 and 4 so there is no delay when the code is ready.

### Scope

- Paystack Collections API for receiving invoice payments
- public payment link page for customer-facing invoice payment
- webhook handling for automatic invoice status updates
- payment receipt and confirmation flow
- Flutterwave payouts research for vendor bill payments (later iteration)

### Feature status

| Feature | Status | Scope | Notes |
| --- | --- | --- | --- |
| Secure payment-link tokens | Done | Public invoice access | Invoice payment links now use random secure tokens instead of raw invoice IDs |
| Public invoice payment page | Done | `/pay/:paymentToken` and `/pay/:paymentToken/confirmed` | Customers can review an invoice, continue to Paystack, and return to a confirmation page |
| Paystack checkout initialize flow | Done | `paystack-payments` Edge Function | The backend now initializes hosted Paystack checkout with server-side references and callback URLs |
| Paystack callback verification flow | Done | `paystack-payments` verify action | The confirmation page verifies the Paystack reference server-side and marks the invoice paid immediately |
| Invoice payment-link sharing inside the app | Done | Invoice list and invoice drawer | Users can copy, open, and WhatsApp-share live payment links from the invoice workspace |
| Linked payment record upgrade | Done | Existing invoice-linked payments row | The current invoice-linked record is updated to pending/completed Paystack states rather than duplicating payments |
| Paystack webhook handling | Done | Provider-first confirmation | A dedicated `paystack-webhook` Edge Function now validates Paystack signatures, verifies the transaction with Paystack, and settles linked invoices idempotently from `charge.success` events |
| Payment receipt generation + email | Done | Receipt document + backend delivery | Confirmed Paystack settlements now generate a PDF receipt, email it automatically through Resend, and log delivery outcomes for idempotent retries |
| Dashboard/reporting updates from confirmed payments | Remaining | Metrics and reporting surfaces | Still needed once webhook confirmation is live |
| Flutterwave payout research | Remaining | Vendor payout scoping | Still a later follow-up |

### Remaining deliverables

**Paystack Collections (receiving payments):**
- integrate Paystack Collections API via a Supabase Edge Function
- wire the public invoice payment page (`/pay/:paymentToken`) to accept real payments via Paystack hosted checkout
- show a payment confirmation page at `/pay/:paymentToken/confirmed` with invoice details and payment reference

**Payment link generation (inside the app):**
- ensure payment links generated from the invoice list and send invoice flow resolve correctly on the live domain
- copy-to-clipboard and WhatsApp share buttons working on the live URL
- payment link visible and functional from the invoice detail slide-over

**Dashboard and reporting updates:**
- dashboard metric cards update in real time when a Paystack webhook confirms a payment
- reports cash flow chart reflects webhook-confirmed payments correctly

**Flutterwave payouts (research and scoping):**
- document the Flutterwave Payouts API requirements for sending money to vendor bank accounts
- identify the compliance requirements for the client's account type
- scope the implementation for a future iteration after launch

### Detailed checklist

<<<<<<<< HEAD:docs/tracking/REMAINING_IMPLEMENTATION_PHASES.md
Use [PHASE_5_PAYMENT_CHECKLIST.md](PHASE_5_PAYMENT_CHECKLIST.md) as the execution list for this phase.
========
Use [PHASE_5_PAYMENT_CHECKLIST.md](./PHASE_5_PAYMENT_CHECKLIST.md) as the execution list for this phase.
>>>>>>>> main:docs/REMAINING_IMPLEMENTATION_PHASES.md

### Exit criteria

- a test invoice can be paid end to end via Paystack on the live domain
- invoice status updates automatically to `paid` within seconds of payment confirmation via webhook
- a payment receipt is emailed to the customer automatically
- the dashboard reflects the new payment without a manual refresh
- payment links work correctly when shared via WhatsApp or copied and opened in a new browser session

### Estimated effort

3 to 5 days for Paystack Collections and webhook integration. 1 to 2 days for receipt generation and email delivery. Flutterwave payouts scoping is a separate research task.

---

## Phase 6: Observability, Analytics, and Test Coverage

### Goal

Make the app measurable, supportable, and safer to evolve before broader rollout to real users.

### Status

Not started. Runs in parallel with Phase 5 where possible and must be complete before M4 production launch.

### Scope

- production error monitoring
- product analytics
- web vitals and performance telemetry
- deeper automated test coverage
- accessibility and workflow regression coverage

### Remaining deliverables

- Sentry or equivalent error tracking configured for the production environment
- product analytics integration such as Mixpanel or Amplitude with event taxonomy for key user and workspace actions
- web vitals tracking connected to the analytics platform
- meaningful unit and integration tests around finance, settings, notifications, and search and export flows
- Playwright end-to-end coverage for core user journeys
- accessibility automation in CI where practical

### Minimum workflow coverage to add

- auth and workspace bootstrap
- customer and vendor CRUD
- invoice create, edit, send, and export
- bill create, schedule, and pay
- payment visibility and filtering
- settings update flows
- notification read and mark-all-read flows
- Paystack payment link and webhook confirmation flow

### Exit criteria

- Sentry is capturing and alerting on production errors
- analytics events are firing for invoice creation, bill payment, and user sign-in
- at least 60 percent of critical workflow paths are covered by automated tests
- Playwright covers the full invoice payment flow end to end

### Estimated effort

2 to 3 weeks running in parallel with Phase 5.

---

## Suggested Execution Order

1. **Phase 3** - Internationalization and formatting. Continue later for the deferred translation follow-through.
2. **Phase 4** - Performance architecture. Complete.
3. **Phase 5** - Payment integration. Active implementation phase. First public Paystack slice is shipped; webhook, receipts, and reporting updates remain.
4. **Phase 6** - Observability, analytics, and test coverage. Runs in parallel with Phase 5. Must be complete before production launch.

---

## Milestone Payment Triggers

| Milestone | Trigger | Phases covered | Amount |
| --- | --- | --- | --- |
| M1 | Contract signed | Kickoff | N200,000 |
| M2 | Demo approved | Phases 1 and 2 complete | N300,000 |
| M3 | Staging approved | Phases 3, 4, and 5 complete | N500,000 |
| M4 | Production launch | Phase 6 complete, live on moniger.com | N300,000 |

### M3 trigger conditions

M3 payment (N500,000) is requested when all of the following are confirmed:

- Phase 3 is complete: i18n infrastructure installed, centralized formatting in place, language switcher working
- Phase 4 is complete: lazy loading added, large chunk warning resolved, Lighthouse Performance above 75
- Phase 5 is complete: real Paystack payment accepted on the live URL, webhook updating invoice status automatically, payment receipt emailed to customer
- A screen recording is produced showing all three phases working on the live domain

### M4 trigger conditions

M4 payment (N300,000) is requested when all of the following are confirmed:

- Phase 6 is complete: Sentry active, analytics firing, core workflow test coverage in place
- Platform is live and accessible at www.moniger.com with a valid SSL certificate
- All previously tested features work correctly on the live domain
- Client has received admin credentials and handover documentation

### Recommended next build focus

If we continue straight from the current codebase, the next implementation phase is:

**Phase 5: reporting updates from confirmed Paystack payments.**

---

## What This Document Intentionally Removes From The Old Gap Analysis

The following items were listed as missing in older docs but are now fully implemented and should not be treated as remaining work:

- Supabase domain foundation and typed tables
- persisted CRUD for core business entities
- settings persistence for profile, business, and preferences
- team member management foundation
- advanced filters and saved presets
- command palette and global search
- bulk actions
- notification center foundation
- exports and print-ready document generation
- payment scheduling persistence
- invoice delivery preparation workflow
- Phase 1 QA and accessibility hardening
- MFA, TOTP, backup recovery codes
- session inventory and security controls
- backend email delivery infrastructure
- privacy and export controls
