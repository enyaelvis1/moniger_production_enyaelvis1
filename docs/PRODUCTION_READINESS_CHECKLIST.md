# Moniger Production Readiness Checklist

Last reviewed: 2026-11-11

This checklist is based on the current repository, the implementation source of truth, the security/UAT checklists, and the latest recorded production deployment. It separates verified implementation/deployment work from live-money, access, operational, and hosted-test gates that still need evidence.

## Current production snapshot

- [x] Frontend deployed to Vercel production and aliased to `https://www.moniger.net` on 2026-10-08 (deployment `dpl_9hjQTdGkNoyxhXAW7an2LhQAR4Gx`).
- [x] `develop` and `main` were aligned and pushed for that release (`develop` `e52faa9`, `main` `0468799`).
- [x] Linked Supabase project migration history matches all 75 local migrations through `20261002173000` (checked 2026-11-10).
- [x] Deployed `paystack-webhook` v21 and `workspace-wallet-funding` v8 on 2026-11-10; downloaded source matches the repository for each changed entrypoint and helper.
- [x] Deployed `workspace-email-delivery` source matches the repository, including invoice subtotal and tax breakdown.
- [ ] Reconcile the bank directory before live payouts: 11 legacy rows still have no provider match; vendor and workspace payout selectors disable rows without verified codes.
- [x] Apply and verify `20261111120000_seed_paystack_nigerian_banks.sql` on the linked Supabase project (2026-11-11): 303 active directory rows, including all 292 current Paystack Nigerian NGN bank codes. The five additional provider names that share codes remain searchable as aliases; 11 legacy entries without provider codes are disabled for payout selection.
- [x] Add a tracked dry-run-first backfill script and runbook; it proposes only unique literal, provider-declared alias, or normalized-name matches and skips fuzzy candidates.
- [x] Add searchable bank selectors with logo imagery for vendor bank details, customer bank records, and workspace payout routing. Logo URLs are pinned to an MIT-licensed jsDelivr-hosted logo repository revision, with a generic logo fallback.
- [x] Run the read-only bank-code preview (2026-11-11): 29 initial unique matches, then exact Access Bank and provider-declared OPay alias matches; 11 rows remain without a supported match.
- [x] Apply 31 reviewed exact/declared-alias matches after typed confirmation; a fresh preview confirms exactly 11 unmatched rows remain.
- [ ] Resolve the 11 skipped rows with authoritative provider/bank information before considering the directory complete.
- [ ] Retire remote-only `admin-backfill-bank-codes` after the tracked backfill is complete. No app caller was found; its deployed source is not in the repo and it accepts its sync token in the query string.
- [ ] Do not treat the app as cleared for public live-money use yet: the implementation tracker and UAT guide still report Paystack production TEST mode and no completed low-value live charge evidence.
- [ ] Reconfirm all deployment, migration, and function states against the linked production project before launch; repository checkboxes alone are not proof of current remote state.

## Go / no-go decision

Public launch with live payments is **NO-GO** until every P0 gate below has an owner, dated evidence, and a passing result. A limited public launch that does not accept live money still requires security, support, privacy, recovery, and incident-response gates to pass. Record the final decision, approver, launch date, and any accepted risks in the release notes.

### Release owner sign-off

- [ ] Name one release owner and one backup who can stop or roll back the launch.
- [ ] Record the exact Git commit, Vercel deployment, Supabase project, deployed Edge Function versions, and applied migration version for the release.
- [ ] Confirm the public product copy, plan names/prices/limits, fees, cancellation terms, privacy notice, terms, and support contact are accurate and approved.
- [ ] Confirm the public launch geography, supported currencies, customer eligibility, and provider restrictions.
- [ ] Record unresolved risks with severity, mitigation, owner, and review date; no unowned critical/high issue remains.

## Release decision

- [ ] Do not call the platform fully production-ready until the live Paystack cutover and live invoice/subscription verification are recorded in `docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md`.
- [x] Resolve the current lint errors before merging a release branch; non-blocking Fast Refresh and hook-dependency warnings remain for follow-up cleanup.
- [x] Allow the configured Amplitude endpoints and regional Sentry ingest hosts in the production CSP; browser delivery still requires hosted verification with production environment variables.
- [ ] Run hosted authenticated Playwright journeys with production-like QA accounts and record the results.
- [ ] Confirm support/contact delivery, signup alerts, data-retention procedures, and test-data cleanup before inviting customers. The implementation is present in this branch; hosted delivery and retention verification remain pending.

## P0 — required before a customer-facing launch

### Payments, billing, and money movement

- [ ] Replace Paystack test credentials with approved live credentials for invoice payments, webhooks, and workspace subscriptions.
- [ ] Confirm production Vercel variables and Supabase secrets belong to the intended production project and contain no test/staging values; verify values by name and environment without copying secret values into logs or tickets.
- [x] Confirm the deployed `workspace-email-delivery` function contains the invoice subtotal/tax email change by comparing its downloaded deployed source with the repository (2026-11-10).
- [ ] Perform and record one low-value live invoice payment: public link → Paystack checkout → callback → webhook → completed payment → paid invoice → receipt.
- [ ] Perform and record one low-value live Growth checkout and one Business checkout: pricing → Paystack recurring checkout → callback → webhook → active subscription.
- [ ] Verify live webhook delivery, signature validation, idempotency, retries, and failure alerting.
- [ ] Verify wallet funding and outgoing payout provider settlement in the live environment, including failed, reversed, scheduled, cancelled, and retried states.
- [ ] Confirm Paystack recipient, transfer, balance, compliance, and operational limits with the account owner.
- [ ] Confirm outgoing vendor payout capability is enabled and approved on the live Paystack account; verify recipient creation, transfer limits, fees, prefunding, reversals, and reconciliation with Paystack support/account owner.
- [ ] Confirm the public invoice payment flow is correctly configured for the intended payment type (including any marketplace subaccount/split rules), amount/currency, fee calculation, and settlement destination.
- [ ] Run duplicate callback/webhook and out-of-order event tests in staging; verify no duplicate invoice payment, wallet credit, payout, or subscription entitlement is created.
- [ ] Verify customer-visible handling for abandoned, declined, pending, timed-out, reversed, and disputed payments.
- [ ] Confirm subscription access gates match the plan catalogue and define the grace period for failed renewals.
- [ ] Add automated coverage for marketplace subaccounts, split initialization, failed onboarding, and settlement reconciliation.
- [ ] Confirm subscription renewal, 14-day and 48-hour reminders, failed renewal recovery, cancellation, expiry lock, and Super Admin re-enable behavior in staging with delivered emails and audit entries.

### Security, access, and data protection

- [ ] Confirm `APP_BASE_URL`, frontend public URL, Paystack secrets, Resend secrets, Sentry, and analytics values are correct per environment.
- [x] Compare linked production migration history with the repository: all 75 migrations match through `20261002173000`; no pending migration was reported (2026-11-10).
- [ ] Deploy every changed Edge Function and record its deployed version, especially payment, webhook, subscription, payout, routing, email, and admin functions.
- [ ] Run `npm run verify:release:security` and the relevant production route/webhook/checkout checks against a safe staging or disposable fixture; never run scripts that create financial side effects casually against production.
- [ ] Complete the remaining two-workspace RLS/storage authorization, public-function abuse, and provider replay tests from `docs/SECURITY_REMEDIATION_CHECKLIST_2026-10-02.md` in staging.
- [ ] Verify MFA enrollment, recovery, session timeout, password reset, invitation, and sign-out flows on production.
- [ ] Verify non-admin users cannot access `/admin/*`; verify support and super-admin permissions separately.
- [ ] Review RLS policies and service-role Edge Functions after the next migration or payout change.
- [ ] Define retention and recovery rules for deleted users, payments, payouts, invoices, audit logs, and webhook records.
- [ ] Never expose secret keys, service-role credentials, or provider tokens in browser logs or client bundles.
- [ ] Confirm production admin and Super Admin accounts are individually assigned, MFA-protected, auditable, and recoverable; remove shared/default credentials and unused privileges.
- [ ] Confirm data collection, bank-account handling, financial record retention/deletion, user export, and incident/breach notification procedures have an accountable owner and legal review where required.
- [ ] Verify backups cover Supabase database and private storage objects, retention is configured, and a restore has been rehearsed without overwriting production.

### Reliability and operations

- [ ] Configure production Sentry and confirm a deliberate test error is visible.
- [ ] Configure consent-aware analytics and confirm events are not sent when consent is unavailable.
- [ ] Verify health, database capacity, scheduled jobs/cron, Edge Function errors, email delivery, webhook delivery, wallet balance reconciliation, and payout backlog are observable with alerts.
- [ ] Verify health checks, webhook failure visibility, email delivery logs, payout reconciliation, and admin audit logs.
- [ ] Add alert ownership and escalation paths for payment failures, webhook failures, payout failures, email failures, and service downtime.
- [ ] Create a rollback procedure for frontend, Edge Functions, database migrations, and Paystack configuration.
- [ ] Back up production data and test a restore or recovery procedure.
- [ ] Define incident severity, on-call contact, provider escalation contacts, customer status communication, and who can pause checkout/payouts.
- [ ] Define a launch-day monitoring window and daily reconciliation owner for the first week; document stop conditions and rollback triggers.

### Public-use acceptance and customer support

- [ ] Complete hosted end-to-end UAT for Starter signup, paid Growth/Business signup, invoice creation/email/payment, bill creation/attachment/payout, customer/vendor imports, team permissions, MFA, and mobile layouts using production-like accounts.
- [ ] Verify support/contact forms deliver to monitored mailboxes and test a customer reply path; verify signup and subscription emails reach inboxes and handle bounces.
- [ ] Verify public pricing and in-app limits match the billing catalog and server-side enforcement for each plan.
- [ ] Verify all public routes, payment links, legal pages, email links, and redirects use the canonical production domain and HTTPS.
- [ ] Complete accessibility, contrast, keyboard, screen-reader, and mobile network/performance review for public signup/payment and core workspace journeys.
- [ ] Publish support hours, response expectations, billing/cancellation instructions, and a customer-facing service-status/contact route.

## Requested product work

### 5. Customer signup for Starter, Growth, and Business

Current state: **Implemented in this branch; deployment still pending.** The public pricing page shows Starter, Growth, and Business. Starter activates without paid checkout; Growth and Business use Paystack recurring checkout. Registration now records the selected plan in auth metadata and calls a server-side signup alert flow.

- [x] Preserve the selected plan from pricing through registration and email confirmation.
- [x] Show a clear plan summary on the registration page: Starter/free trial, Growth, or Business.
- [x] Let customers choose Starter, Growth, or Business directly on the first registration step, with paid-plan pricing and Paystack checkout guidance visible before they continue; collect business and full-name details on the following step.
- [x] Add regression coverage for direct and pricing-generated Starter, Growth, and Business registration links.
- [x] Define current acquisition behavior: Starter activates free; Growth and Business require successful Paystack recurring checkout; no paid-plan trial is currently advertised.
- [x] Define cancellation behavior: customer cancellation stops Paystack renewal, preserves the current subscription status and access through the recorded renewal date, and records `cancel_at_period_end` plus an audit event; hosted webhook verification remains pending.
- [x] Define current failed-payment behavior: Paystack renewal failures map to `past_due`; paid-plan access is suspended immediately, the workspace is directed to update billing, and owners/admins/accountants receive an in-app notification linking to Settings. Provider retry timing and customer email notifications still require hosted verification and product approval.
- [x] Surface current subscription status, billing cycle, renewal date, and cancellation-at-period-end state in workspace Settings.
- [x] Create a server-side signup event or durable registration record so alerts are not lost if the browser closes.
- [x] Send a branded alert to `foxyrule@gmail.com` and `admin@moniger.net` for each new Starter/free-trial, Growth, and Business signup.
- [x] Include name, email, business name, selected plan, signup time, signup status, and environment in the alert.
- [x] Deliver alerts through the existing email provider from a verified Moniger sender; do not send directly from the browser.
- [x] Add deduplication/idempotency so email confirmation, webhook retries, or browser refreshes do not create duplicate alerts.
- [x] Log delivery outcome and provide an admin failure view under Admin → Signup Alerts.
- [x] Add unit coverage for Starter, Growth, Business, email-confirmed, email-unconfirmed, duplicate, and failed-delivery decision paths.

### 6. Delete payment and payout test data in Admin

Current state: **Implemented in this branch; migration and function deployment still pending.** Admin Settings now previews and deletes explicitly marked test payments plus safe-to-delete test payouts. Active/settled payouts remain blocked.

- [x] Define what qualifies as test data: an explicit `is_test_data`/`metadata.test_data` marker plus a `test`/`sandbox` environment or provider mode for Paystack records; generic markers never override provider-state safety checks.
- [x] Prefer an isolated QA/sandbox workspace for routine cleanup and document the destructive fallback runbook; reversible archive/soft-delete remains a future enhancement for retained financial history.
- [x] Add separate, super-admin-only actions for test payments and test payouts with counts shown before confirmation.
- [x] Block deletion of live-provider settlements, completed live payouts, ledger entries, audit records, and any payment linked to an invoice or bill; linked records remain available for reconciliation.
- [x] Add a typed confirmation requiring the exact phrase and a count-specific second confirmation for bulk deletion.
- [x] Require a reason, write an immutable admin audit event, and preserve a deletion manifest.
- [x] Handle related records safely by excluding linked payments and unsafe provider states from deletion; manifests and audit records preserve the cleanup decision for review.
- [x] Add a dry-run preview, a 500-record batch limit, post-delete reconciliation, and block unsafe payout statuses.
- [x] Add policy tests proving live/active payout statuses cannot be selected and only explicit test markers qualify.
- [x] Add policy coverage proving support and non-admin roles cannot manage test-data cleanup.
- [ ] Add an authenticated integration test proving support admins cannot delete in the deployed environment.

### 7. Add second admin — `admin@moniger.net`

Current state: **Admin UI and backend support exist.** A super-admin can add an existing Moniger account or invite a new email from Admin → Settings → Admin Users. The repository does not prove that `admin@moniger.net` currently exists or has been granted access in production.

- [x] Add or invite an admin email from Admin → Settings → Admin Users; new accounts receive a Supabase invitation and existing accounts are granted access directly.
- [ ] Create or verify the `admin@moniger.net` Moniger account and grant it the intended role (`support` by default; `super_admin` only if explicitly approved).
- [ ] Require MFA enrollment before granting production admin access.
- [ ] Sign in as the new admin and verify only the intended routes/actions are available.
- [ ] Record the grant in the admin audit log and document the owner/reviewer for this account.
- [ ] Test access revocation and recovery before launch.

### 8. Delete test users under Admin → Settings → Admin Users

Current state: **Implemented with restrictions.** Admin Users has a delete action and confirmation. Only super-admins can delete; the current admin cannot delete itself; users who own workspaces must be transferred/removed first.

- [x] Add destructive confirmation before deletion.
- [x] Prevent self-deletion from the admin console.
- [x] Prevent deletion while the user still owns workspaces.
- [x] Add an explicit “test user” marker, filter, and label so production users are not mistaken for test users.
- [ ] Add a reversible deactivate/archive option for ordinary cleanup.
- [ ] Define the cascade policy for profiles, memberships, invitations, notifications, recovery records, audit references, and financial records.
- [x] Add a production-safe test-user cleanup runbook with user lookup, workspace ownership check, export, delete, and verification steps (`docs/admin-console/TEST_DATA_CLEANUP_RUNBOOK.md`).
- [ ] Confirm deleted test accounts cannot authenticate and that their financial/audit history remains compliant with retention rules.

## Answers to the current review questions

### 1. Business missing on phone pricing

- [x] Business is present in the current deployed `/pricing` page and in the pricing source.
- [ ] Re-test the phone using a hard refresh/incognito session and confirm the same deployment/version is loaded.
- [ ] Check mobile viewport layout, browser cache, service-worker state, and any stale CDN asset before treating this as a pricing-data bug.
- [x] Add a responsive Playwright assertion that Starter, Growth, and Business are visible at mobile and desktop widths (`tests/e2e/pricing-responsive.spec.ts`).

### 2. Where Contact Us messages go

Current state: **Implemented in this branch; deployment and provider delivery verification are pending.** The page now calls the `contact-message` Edge Function, which validates and rate-limits requests, applies honeypot protection, stores a minimal delivery record, and sends via Resend.

- [x] Configure Contact Us delivery for multiple recipients with `CONTACT_RECIPIENT_EMAILS`, currently defaulting to `admin@moniger.net,foxyrule@gmail.com`.
- [x] Add a server-side contact-message endpoint/Edge Function using Resend or the approved email provider.
- [x] Add validation, rate limiting, honeypot protection, confirmation feedback, and failure guidance.
- [x] Store a minimal support ticket/delivery log without storing unnecessary sensitive content.
- [ ] Test delivery to the configured recipient and verify reply-to points to the visitor's email.

### 3. What About Us → Changelog is for

The Changelog is a public release-history page showing product versions, dates, and feature/fix summaries. It is now backend-managed in this branch, with a static fallback until the migration and Edge Functions are deployed and content is published.

- [x] Decide whether public release notes are manually deployed or managed by admins: Admin-managed.
- [x] If admin-managed, add CRUD, draft/publish, ordering, visibility, author, and audit controls.
- [x] Link each published entry to optional related Help Centre article slugs, with public deep links into the article reader.

### 4. Can Help Centre questions and answers be added at backend?

Current state: **Core backend management is implemented in this branch; deployment and richer discovery features remain pending.** The public page reads published articles with a static fallback, and Admin → Public Content provides article CRUD and draft/publish controls.

- [x] Add backend-managed Help Centre articles/FAQs with category, slug, title, body, sort order, published state, locale, and timestamps.
- [x] Add Admin → Public Content management with draft/publish, delete, ordering, and audit logging.
- [x] Add public search, category filters, empty states, and a support path for Help Centre content.
- [x] Add related-article links and an inline published-article reader.
- [ ] Add authoring safeguards: sanitized rich text/Markdown, link validation, image policy, and revision history.

### 5. Customer onboarding and connected clients/bank accounts

Current state: **The data foundations exist, but a guided onboarding journey is still needed.** Workspaces support customers, vendors, bank data, invoices, bills, wallet funding, payout routing, and team roles. The next product step is to turn these capabilities into a role-based setup flow.

- [x] Define an initial onboarding path for business profile, customers, vendors, invoice, bill, and payout-destination review; bank connections and approvals remain explicit follow-up stages.
- [x] Add derived progress tracking with resumable dashboard links; persistent completion analytics remains a follow-up.
- [ ] Add import templates for customers, vendors, opening balances, and bank accounts with validation and preview.
- [x] Provide downloadable starter CSV templates for customers, vendors, opening balances, and bank accounts with example values; validated preview/import execution remains open.
- [x] Add client-side CSV preview and required-field validation with a five-row preview; database import execution remains open.
- [x] Execute validated customer and vendor imports through the existing authenticated mutations, and save one validated payout destination as a draft; opening-balance files remain preview-only because no posting ledger exists.
- [x] Map accounts receivable and accounts payable responsibilities to the existing Accountant role, with Owner/Admin and Viewer guidance in onboarding.
- [x] Add bank connection/import requirements explicitly: payout-destination CSV setup does not connect transaction syncing, and opening-balance posting remains unavailable.
- [x] Gate sample-user setup behind `ALLOW_TEST_DATA=true` plus a non-production `APP_ENVIRONMENT` label, and mark created QA users explicitly as test users; isolated workspace verification remains an operational follow-up.

### 6. Backend dashboard management by admin

Current state: **Substantially implemented.** The admin console includes dashboard/metrics, businesses, users, subscriptions, payments, payouts, support, audit, health, banks, announcements, and settings.

- [ ] Verify every admin action against production RLS/service-role boundaries.
- [ ] Add the missing controlled cleanup flows described above.
- [ ] Add search/filter/export parity and clear empty/error/loading states to every admin table.
- [ ] Add operational alerts and ownership for health, webhook, email, subscription, and payout failures.

### 7. Cleaning out test data

- [ ] Use a dedicated QA workspace/environment and deterministic test markers.
- [ ] Add the safe cleanup tooling above for users, payments, payouts, invoices, bills, notifications, and provider test references.
- [ ] Keep audit evidence of what was removed and why.
- [ ] Never clean production by matching only on a name or email substring.

## UI, UX, accessibility, and responsive-quality checklist

### Public website

- [x] Fix the Contact Us form so submit has a real outcome and a visible success/error state; browser coverage is in `tests/e2e/contact-form.spec.ts`.
- [x] Verify the phone layout shows all three pricing cards without horizontal clipping or hidden Business content in the local Moniger build at 390x844; repeat this check against the deployed host after the next release.
- [x] Add explicit mobile and desktop tests for pricing cards, signup CTA, payment confirmation, Contact, Help Centre, Changelog, Terms, Privacy, and Security (`tests/e2e/public-routes-smoke.spec.ts`). Navigation/menu interaction remains follow-up coverage.
- [x] Replace the placeholder footer phone number with the configured Moniger support number.
- [x] Replace unsupported public metrics such as “500+ businesses”, “99.9% uptime”, and ₦2.4B invoiced with verifiable product facts; keep live provider claims conservative until rollout evidence exists.
- [x] Add shared public skip navigation, main landmarks, labeled primary navigation, accessible form labels/focus states, and async status announcements; page-specific accessibility parity remains follow-up work.
- [ ] Check color contrast in both light and dark themes and across disabled/error/success states.
- [x] Run an axe contrast audit on public Pricing and Contact at desktop width; both pass after the Contact link color correction (`tests/e2e/public-contrast-audit.spec.ts`).
- [ ] Optimize the large vendor chunks and confirm acceptable LCP/INP/CLS on a mid-range mobile device and Nigerian mobile network profile.
- [x] Reduce landing-page deferred-section preload distance from 500px to 200px so below-the-fold animation/chart dependencies do not compete as early with first paint; Lighthouse retest remains required for the final threshold.
- [ ] Add cookie/analytics consent behavior and verify CSP-compatible analytics configuration.

### UI audit checklist

Use this checklist for each public, authenticated, and admin surface. Record the route, viewport, browser, issue severity, screenshot, and owner for every finding.

- [ ] Visual hierarchy: one clear page goal, consistent heading scale, readable line length, and an obvious primary action.
- [ ] Layout consistency: shared spacing, card radius, borders, shadows, button sizing, and light/dark theme behavior.
- [ ] Responsive behavior: no horizontal overflow; test 320px, 390px, 768px, 1024px, and 1440px widths.
- [x] Navigation: mobile drawer open/close, desktop dropdown state, focus return, keyboard operation, Escape-to-close, and route persistence are covered (`tests/e2e/landing-navigation.spec.ts`).
- [x] Contact form: explicit labels, browser required-field/email validation, visible focus states, loading state, duplicate-submit protection, success state, and recovery guidance are covered by `tests/e2e/contact-form.spec.ts`; authenticated form parity remains follow-up work.
- [x] Shared `DataPage` now provides mobile cards plus pagination, search reset, filters, loading, empty state, and keyboard row actions; per-page error, export, and authenticated visual coverage remain follow-up work.
- [ ] Accessibility: semantic landmarks, heading order, visible focus, contrast, touch targets, screen-reader names, and status announcements.
- [ ] Content quality: no placeholder data, unsupported metrics, contradictory plan/payment language, dead links, or unexplained jargon.
- [x] Correct public navigation copy that overstated Stripe/QuickBooks/Xero support, duplicated a mobile feature entry, and labeled Growth as coming soon; verified public legal-page contrast links with the axe audit.
- [ ] Operational states: loading, offline, timeout, provider failure, permission denial, expired session, and destructive-action confirmation.
- [ ] Performance: LCP, INP, CLS, image sizing, bundle size, route loading, and behavior on a mid-range Nigerian mobile network.
- [ ] Evidence: attach Playwright result or screenshot, classify P0/P1/P2/P3, and create a tracked fix before sign-off.

### Hero section audit checklist

- [x] Establish one clear value proposition and one primary conversion action.
- [x] Remove competing hero cards and unsupported performance/adoption claims.
- [x] Keep the product preview as the visual focal point with one supporting metric card.
- [x] Verify the hero at 320px, 390px, 768px, 1024px, and 1440px without horizontal clipping; vertical-scroll review remains a visual follow-up.
- [x] Confirm heading contrast, line wrapping, focus states, and readable text over the background.
- [x] Confirm the email CTA has a visible focus state, browser-level valid-email behavior, and a clear route to signup.
- [x] Confirm the product screenshot has meaningful alt text and does not dominate the first viewport on mobile.
- [x] Check reduced-motion behavior for hero entrance effects and floating visual elements.
- [ ] Measure hero LCP and confirm the primary dashboard image remains optimized and non-blocking.
- [ ] Capture before/after screenshots and record remaining P1/P2 visual issues with owners.

### Authenticated workspace

- [ ] Test onboarding, dashboard, invoices, bills, vendors, customers, payments, wallet, marketplace routing, reports, audit trail, settings, team invites, MFA, and sign-out at mobile widths.
- [ ] Verify every form has inline validation, clear save state, duplicate-submit protection, and recoverable errors.
- [ ] Verify tables have mobile card layouts, pagination, search reset, empty states, and export feedback.
- [ ] Verify payment/payout statuses clearly distinguish internal bookkeeping, provider state, pending, failed, reversed, and completed.
- [ ] Add contextual help and first-run empty states for customers, vendors, banks, invoices, bills, and wallet funding.

### Admin console

- [ ] Test sidebar collapse/mobile drawer, dense tables, sticky actions, long email/business names, and small-screen dialogs.
- [ ] Add confirmation and success/error feedback consistently to role changes, access revocation, business actions, subscription edits, exports, reconciliations, and cleanup.
- [ ] Make dangerous actions visually distinct and require reason/typed confirmation.
- [x] Add a visible admin environment indicator derived from `VITE_SENTRY_ENVIRONMENT` (with the build mode as fallback) so operators can distinguish production, staging, QA, and local sessions.
- [x] Add test/live/all data-mode filters to admin Payments and Payouts; plan, status, date, and workspace filters remain follow-up parity work.

## Verification record

The following checks were run during this review:

- [x] `npm test` — 28 test files passed, 107 tests passed.
- [x] `npm run build` — passed.
- [x] `npm run lint` — passed with 0 errors; 27 non-blocking hook/Fast Refresh warnings remain for follow-up cleanup.
- [x] `npm run perf:bundles` — recorded the current vendor payloads; the largest is the charts vendor at approximately 416 kB.
- [ ] `LIGHTHOUSE_PORT=4174 npm run perf:lighthouse` — accessibility 0.96 and best-practices 0.96 passed; performance 0.57 remained below the 0.75 threshold, with local LCP at approximately 6.2s.
- [x] Production route smoke review — `/`, `/pricing`, `/contact`, `/about`, and `/help-centre` were requested with Playwright.
- [ ] Authenticated production Playwright journeys — require configured QA credentials and payment-path fixtures.
- [ ] Live Paystack invoice and subscription charges — intentionally not performed during this review.

Observed production browser-console issue:

- [x] Update the production CSP `connect-src` for Amplitude remote config (`sr-client-cfg.amplitude.com` and the EU host); deployed delivery verification remains pending.
- [x] Keep the Sentry ingest rule scoped to `*.ingest.sentry.io`; verify it against the deployed DSN before enabling production monitoring.

Local UI smoke note: the Moniger pricing page was checked with the Playwright CLI at 390x844 and 1440x900; Starter, Growth, and Business were visible at both widths with zero console errors. Port 4173 was occupied by an unrelated local app, so the Moniger dev server was checked on port 4174.

## Recommended implementation order

1. Deploy and verify Contact Us delivery and signup alerts.
2. Verify/create `admin@moniger.net`, enforce MFA, and document admin ownership.
3. Add safe, test-marked cleanup tooling for users, payments, and payouts.
4. Close live Paystack, webhook, receipt, payout, observability, and rollback gates.
5. Deploy and seed backend-managed Help Centre/FAQ and Changelog publishing, then add discovery and authoring safeguards.
6. Build the guided customer onboarding journey and imports.
7. Complete mobile, accessibility, performance, and hosted E2E regression sweeps.
