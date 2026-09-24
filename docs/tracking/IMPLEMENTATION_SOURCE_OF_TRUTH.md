# Moniger Implementation Source Of Truth

Last reviewed: 2026-05-21

## Purpose

Use this file as the single source of truth for remaining implementation work.

If this file conflicts with older phase or status docs, trust this file and update the older doc later.

## Review Basis

This review was based on the current repo state, especially:

- `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
- `docs/tracking/PHASE_5_PAYMENT_CHECKLIST.md`
- `docs/tracking/REMAINING_IMPLEMENTATION_PHASES.md`
- `docs/tracking/REMAINING_WORK_2026-04-19.md`
- `docs/IMPLEMENTATION_STATUS_SUMMARY.md`
- `supabase/functions/workspace-subscriptions/index.ts`
- `supabase/functions/_shared/paystack-subscriptions.ts`
- `supabase/functions/paystack-payments/index.ts`
- `supabase/functions/paystack-webhook/index.ts`
- `src/hooks/use-finance-data.ts`
- `src/hooks/use-operations-data.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Vendors.tsx`
- `src/admin/pages/AdminBanksPage.tsx`
- `supabase/migrations/20260420103000_add_business_subscriptions.sql`
- `supabase/migrations/20260422113000_add_workspace_subscription_checkout.sql`
- `supabase/migrations/20260514165000_add_banks_table.sql`
- `supabase/migrations/20260514203000_add_vendor_bank_id.sql`

## Current Snapshot

- [x] Workspace subscription billing is implemented with Paystack recurring checkout, callback verification, and webhook sync.
- [x] Public invoice payment collection is implemented with Paystack initialize, callback verification, webhook settlement, and receipt delivery.
- [x] Dashboard, reports, and payments already read confirmed payment data and refresh on a short live interval.
- [x] Vendor bank data foundation exists in the schema and UI.
- [x] Initial marketplace-routing schema foundation now exists for payout accounts and Paystack split configuration.
- [x] Marketplace routing of customer payments directly to workspace subscriber bank accounts is now implemented in sandbox-tested form with Paystack subaccounts and split configuration.
- [ ] Workspace subscription state is recorded and synced, but the app does not yet enforce paid-plan access gates in the workspace shell.
- [ ] Live production rollout and full end-to-end verification are not fully closed in the repo docs yet.
- [x] Paid-to-paid workspace subscription switching rules are now defined and implemented for Paystack-managed checkouts.
- [ ] Translation follow-through and production observability rollout are still incomplete.

## Important Paystack Update

Paystack has now confirmed that Moniger can support the marketplace routing model with:

- Subaccounts API
- Transaction Split API

Paystack also confirmed that no special enablement is required before integration.

That changes the implementation priority:

- [x] We now have a confirmed provider path for routing payments to workspace subscribers while retaining a Moniger service fee.
- [x] That path is now implemented in Moniger and verified in Paystack sandbox mode.
- [ ] Old backlog items that treated payout routing as only later Flutterwave research should no longer be treated as the main path for this use case.

## What The Review Confirmed In Code

### Billing and subscriptions

- [x] `business_subscriptions` exists and is populated by platform billing flows.
- [x] `subscription_checkout_sessions` exists for Paystack checkout reconciliation.
- [x] Paid workspace plans initialize real Paystack checkout.
- [x] `/pricing/confirmed` verifies the returned Paystack reference and syncs the canonical subscription record.
- [ ] Most workspace routes still only require sign-in and MFA, but premium pages like `/reports` and `/audit-trail` now have subscription-aware entitlement gates.
- [x] Public pricing cards now read from an admin-editable `billing_catalog` value published through a public site config endpoint.
- [x] The workspace shell now shows a subscription status banner, and `/reports` plus `/audit-trail` now show an in-app workspace upgrade page with direct checkout and a highlighted current-plan summary when the plan is not active.
- [x] Multi-workspace users can switch workspaces from the sidebar; the selected workspace is persisted per user and settings/subscription queries are scoped to the selected business.
- [x] The workspace profile upgrade action now opens a plan comparison dialog first, so users can review the available plans before starting checkout.
- [x] Self-service cancellation stops Paystack renewal, preserves access through the recorded renewal date, and records `cancel_at_period_end` with an audit event.
- [x] Paystack `invoice.payment_failed` events set the workspace subscription to `past_due` and notify active workspace finance users with a Settings recovery link; hosted retry and email-delivery verification remain release gates.

### Customer payment collection

- [x] Public invoice payment links exist.
- [x] The `paystack-payments` Edge Function initializes and verifies hosted checkout.
- [x] The `paystack-webhook` Edge Function validates signatures and settles payments idempotently.
- [x] Receipt PDF generation and email delivery are implemented.

### Reporting and payment freshness

- [x] Payments queries use live refresh behavior.
- [x] Operations queries use live refresh behavior.
- [x] Dashboard and reports include confirmed receivable and Paystack settlement metrics.

### Banking foundation

- [x] The platform has a `banks` table.
- [x] Vendors now support `bank_id`.
- [x] Admins can manage the shared bank list.
- [x] There is now schema support for payout accounts, Paystack subaccount codes, and split configuration metadata.
- [x] Workspace wallet schema now exists and the dedicated Wallet page surfaces the wallet balance card.
- [x] The workspace now has a dedicated Wallet page in the sidebar for balance visibility and funding entry.
- [x] The dashboard now surfaces the workspace wallet balance as a summary metric.
- [x] The main workspace header surfaces a compact wallet chip that links to the dedicated Wallet page.
- [x] The main sidebar now includes dedicated Wallet and Marketplace Routing pages.
- [x] The wallet migration has been applied to the linked Supabase project `qfhjlqskucabzxepqbpl`.
- [x] Wallet funding session schema and confirmation/verification code now exist in the repository.
- [x] Wallet funding top-up flow now exists in code, with callback verification, webhook settlement, and funding history.
- [x] The wallet funding Edge Functions have been deployed from a Supabase-authenticated CLI session.
- [x] Live top-up verification has been confirmed end to end in the workspace wallet flow.
- [x] Only workspace owners and admins can fund the workspace wallet.
- [x] Bank-code support now exists for the bank directory so vendor payout destinations can be routed through Paystack.
- [x] Workspace payout reservation schema now exists, and the payout-execution Edge Function has been deployed.
- [x] `Pay now` is wired to the payout-execution path so outgoing bill payouts now create a real payout request through the workspace wallet.
- [x] Workspace payout history now appears on the Wallet page so payout requests can be reviewed alongside wallet funding history.
- [x] The Bills page, workspace Settings, and vendor/bank setup screens now reflect the live wallet and payout flow.
- [x] Payout initiation is now rate-limited to reduce accidental double-submits and payout spam.
- [x] Wallet and payout tables now enforce least-privilege RLS, signed-in workspace authorization, idempotency keys, and anti-double-spend balance reservation protections.
- [x] Paystack transfer and transfer-recipient requirements have been reviewed for the outgoing payout flow; valid recipient bank details and sufficient provider balance are required, with any final compliance sign-off handled as an operational release gate.
- [x] Wallet payout history now covers the core payout lifecycle statuses and supports CSV export for workspace review.
- [x] Admin payout reporting now has a dedicated reporting view and export flow.
- [x] Admin business controls now include a payout freeze toggle that blocks new payout requests and pauses scheduled payouts while the hold is active.
- [x] Approval thresholds, maker-checker approval, and role-based payout permissions now protect higher-risk outgoing payouts.
- [x] Workspace-level payout limits now exist for per-transaction, daily, and weekly control.
- [x] Scheduled payout support now exists in the repository, including `scheduled_for` storage, wallet reservation at schedule time, and a 5-minute cron runner.
- [x] Scheduled payout cancellation and rescheduling now exist, and the Wallet page exposes those controls for reserved scheduled payouts.
- [x] Temporary scheduled payout failures now stay reserved and retry automatically with exponential backoff.
- [x] Outgoing payout status changes now emit finance notifications and settle via the Paystack transfer webhook for completed, failed, and reversed transfers.
- [x] Outgoing bill and payment records now reconcile from payout settlement outcomes instead of relying only on the client-side request state.
- [x] Wallet payout history now distinguishes bookkeeping state from provider transfer state, and payout errors use friendlier user-facing copy.
- [x] Successful payouts now surface a wallet confirmation card with copyable receipt-style details.
- [x] Product copy now reflects real wallet funding and provider-backed payout behavior instead of interim tracking-only wording.
- [x] A dedicated outgoing payouts smoke-test runbook now exists for repeatable verification after each implementation.
- [x] Payout lifecycle actions now write audit log entries for creation, scheduling, submission, cancellation, retry, completion, failure, and reversal.
- [x] Support lookup screens now expose payout records and payout audit history for support visibility.
- [x] There is now a backend provider flow for payout-account save and Paystack subaccount sync.
- [x] There is now a backend flow for Paystack split configuration in addition to payout-account sync.
- [x] Payment settlement now preserves payout-routing reconciliation metadata for later audit.

## Remaining Implementation Checklist

### 1. Production Rollout And Verification

- [x] Deploy the latest frontend build to the production domain.
- [x] Confirm SPA rewrites are live for `/pay/:paymentToken` and `/pay/:paymentToken/confirmed`.
- [x] Set `VITE_PUBLIC_APP_URL` in the frontend environment.
- [x] Confirm `APP_BASE_URL` in Supabase Edge Function secrets matches production behavior.
- [ ] Confirm live Paystack secrets are present for `paystack-payments`, `paystack-webhook`, and `workspace-subscriptions`.
- [x] Confirm receipt email secrets are present if live receipt delivery is required.
- [ ] Run a full live invoice-payment test from copied link to webhook-confirmed settlement.
- [ ] Run a full live workspace-subscription test from pricing page to verified subscription sync.

Live cutover checklist after Paystack approval:

- [ ] Replace the production `PAYSTACK_SECRET_KEY` with the live key for `paystack-payments`, `paystack-webhook`, and `workspace-subscriptions`.
- [ ] Confirm the Paystack dashboard webhook for the live environment still points to `https://qfhjlqskucabzxepqbpl.supabase.co/functions/v1/paystack-webhook`.
- [ ] Re-run `npm run verify:production:routes` after the live-key swap to confirm the production domain still serves the expected callback routes.
- [ ] Run one intentional low-value live invoice payment on `moniger.net` and confirm callback success, webhook capture, `payments.status = completed`, and `invoices.status = paid`.
- [ ] Run one intentional low-value live workspace subscription checkout on `moniger.net` and confirm callback success, `subscription_checkout_sessions.status = completed`, and `business_subscriptions.status = active`.
- [ ] Confirm the live invoice-payment receipt flow still succeeds if production receipt delivery is enabled.
- [ ] Record the exact live references and outcomes here once both live checks pass.

### 2. Workspace Subscription Hardening

- [x] Define paid-to-paid switching behavior for `growth` to `business`, `business` to `growth`, and renewal timing.
- [x] Decide how existing Paystack subscriptions should be cancelled, replaced, or migrated during plan changes.
- [ ] Document the QA convention for test emails accepted by Paystack so `.test` and similar domains are avoided.
- [ ] Run a production-like renewal and cancellation webhook test set and record the result here.

### 3. Marketplace Routing Via Paystack Subaccounts And Transaction Splits

- [ ] Finalize the product rules for who counts as a workspace subscriber, who owns the payout destination, and how Moniger fees are calculated.
- [ ] Decide whether split logic is percentage-based, flat-fee-based, or plan-based.
- [x] Add database tables and types for subscriber payout accounts, provider subaccount codes, split metadata, verification state, and audit fields.
- [x] Add a secure backend flow to create and update Paystack subaccounts from subscriber bank details.
- [x] Add a secure backend flow to create or resolve the required Paystack split configuration.
- [x] Add workspace UI for collecting and updating subscriber payout bank details.
- [x] Add validation and support handling for incomplete or invalid bank-account onboarding.
- [x] Update payment initialization flows so eligible marketplace transactions include the correct Paystack subaccount and split configuration.
- [x] Extend webhook handling and payment metadata so split-related settlements can be reconciled and audited.
- [x] Expose split and payout-routing visibility in admin and support tools.
- [ ] Add automated tests for subaccount creation, split initialization, failed onboarding, and webhook reconciliation.
- [x] Run an end-to-end Paystack sandbox test proving that Moniger retains its fee while the subscriber portion routes correctly.
- [x] Verify webhook delivery independently in sandbox conditions so routed payments do not rely only on the browser confirmation callback for fast settlement visibility.

### 4. Product And Platform Follow-Through

- [ ] Finish the remaining translation coverage across entity pages and public marketing pages.
- [ ] Run a multi-locale layout QA sweep after the remaining strings are moved.
- [ ] Configure production Sentry environment values.
- [ ] Configure production analytics keys and validate consent-aware behavior.
- [ ] Supply hosted Playwright credentials and payment-path secrets for live E2E runs.
- [ ] Run the existing Playwright finance and payment journeys against a deployed environment.

## Stale-Doc Notes From This Review

- [ ] Update older docs that still describe dashboard and reporting payment visibility as missing, because the current code already includes those metrics and live refresh behavior.
- [ ] Update older docs that still describe payout routing mainly as Flutterwave research, because Paystack is now the confirmed path for the workspace-subscriber routing model.
- [ ] Keep `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md` focused on subscription-specific work and use this file for cross-platform implementation status.

## Recent Update

### 2026-05-21

- [x] Added `supabase/migrations/20260521101500_add_paystack_marketplace_routing_foundation.sql`.
- [x] Added `business_payout_accounts` for per-workspace payout bank details and Paystack subaccount metadata.
- [x] Added `business_payment_split_configs` for per-workspace fee-model and Paystack split metadata.
- [x] Added indexes, update triggers, and RLS policies for both tables.
- [x] Added `supabase/functions/workspace-payout-routing/index.ts` for authenticated payout-account retrieval and Paystack subaccount sync.
- [x] Added `supabase/functions/_shared/paystack-marketplace.ts` for Paystack bank lookup, account resolution, and subaccount create/update calls.
- [x] Extended `workspace-payout-routing` with split-config save and Paystack split sync for percentage mode.
- [x] Added flat-fee config support that is stored as a provider-ready `transaction_charge` strategy for later payment initialization.
- [x] Applied the migration to the linked Supabase project `qfhjlqskucabzxepqbpl`.
- [x] Deployed `workspace-payout-routing` to the linked Supabase project.
- [x] Redeployed `workspace-payout-routing` after adding split-config sync support.
- [x] Confirmed the deployed function rejects unauthenticated requests with `401 Missing authorization header`.
- [x] Wired `paystack-payments` so ready marketplace-routing configs now inject `split_code` or `subaccount` plus `transaction_charge` during Paystack checkout initialization.
- [x] Preserved `marketplace_routing` metadata through payment settlement so routing context remains available for audit and reconciliation.
- [x] Extended `admin-console` payments responses to include marketplace-routing settlement summaries for completed payments.
- [x] Added admin payment-details UI so platform admins can inspect routing mode, provider codes, settled amount, and provider fees per payment.
- [x] Added workspace settings UI for payout-account management only.
- [x] Restricted Moniger fee-rule access to platform admins only.
- [x] Removed the Moniger fee-rule section from workspace settings entirely so only platform admins can access it.
- [x] Added onboarding guardrails for invalid country/currency codes, unsupported live-sync countries, and stale fee-rule re-sync requirements after payout-account changes.
- [x] Added Vitest coverage for payout-routing validation guards used by workspace payout setup and admin fee-rule entry.
- [x] Added Playwright coverage for workspace payout-routing UI gating and admin fee-rule validation, and verified the focused spec against configured QA accounts.
- [x] Added Vitest coverage for marketplace-routing checkout decisions and settlement metadata enrichment.
- [x] Ran a routed Paystack sandbox payment proof against a real test subaccount and split config.
- [x] Confirmed checkout initialization stored `marketplace_routing` metadata with `provider_split_code` and `provider_subaccount_code` on the pending payment row.
- [x] Confirmed the deployed confirmation route on `https://www.moniger.net/pay/:paymentToken/confirmed` auto-completed a routed sandbox payment when the page remained open long enough for `verify-payment` to finish.
- [x] Confirmed completed payment metadata now includes `marketplace_routing.settlement` showing Moniger's 15% share and the workspace subaccount's 85% share.
- [x] Added `scripts/verify-routed-paystack-webhook.mjs` plus `npm run verify:webhook:routed` to repeat the routed sandbox proof and check whether `platform_webhook_events` captured Paystack delivery.
- [x] Confirmed `platform_webhook_events` now captures Paystack `charge.success` webhook deliveries for routed sandbox payments, including processed timestamps and the matching reference.
- [x] Added `scripts/verify-production-routes.mjs` plus `npm run verify:production:routes` to check the production app shell and payment-route rewrites on `moniger.net`.
- [x] Confirmed `https://www.moniger.net/pay/:paymentToken` and `https://www.moniger.net/pay/:paymentToken/confirmed` both return the SPA shell in production.
- [x] Confirmed the deployed payment confirmation page renders correctly on `moniger.net` for an invalid demo token and shows the expected `Payment confirmation` invalid-link state.
- [x] Linked the repo to the Vercel project `enyasystems-projects/moniger` and confirmed `VITE_PUBLIC_APP_URL` exists in the Production environment.
- [x] Deployed the latest `develop` frontend build to `https://www.moniger.net` via Vercel production deployment `dpl_GU7Nf2PuSTKH82MXgQ2MoGfF5XmQ`.
- [x] Confirmed the linked Supabase project `qfhjlqskucabzxepqbpl` has the expected production secret names for `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, and `APP_BASE_URL`.
- [x] Ran hosted Playwright production smoke checks for workspace finance surfaces, workspace payout-routing settings visibility, and platform-admin payout fee-rule management after the fresh frontend deploy.
- [x] Confirmed the public invoice payment page still renders the expected hosted shell on production, although the current `PLAYWRIGHT_PAYMENT_PATH` fixture still points to a placeholder token rather than a real live invoice.
- [x] Added `scripts/verify-production-live-checkout-init.mjs` plus `npm run verify:production:live-init` to create a production QA invoice, initialize a production-domain invoice checkout, and initialize a production-domain workspace subscription checkout without completing a charge.
- [x] Confirmed production-domain invoice checkout initialization loads a real Paystack Checkout page and returns to `https://www.moniger.net/pay/:paymentToken/confirmed` when completed in Paystack `TEST` mode.
- [x] Confirmed production-domain workspace subscription checkout initialization loads a real Paystack Checkout page and returns to `https://www.moniger.net/pricing/confirmed` when completed in Paystack `TEST` mode.
- [x] Confirmed production-domain `TEST` mode checkouts still settle invoice payments, subscription checkout sessions, and workspace subscription records correctly without charging real money.
- [x] Fixed the signed-out `/pricing/confirmed` experience so completed Paystack subscription references now show a real success state instead of forcing the user to sign in again before seeing the activated result.
- [x] Defined and implemented paid-plan switching rules so a new paid checkout can replace an existing active Paystack subscription, then disable the older recurring record after the replacement subscription is verified.
- [x] Added `20260521174500_add_subscription_switch_metadata.sql` so `subscription_checkout_sessions` now remembers which recurring Paystack subscription a replacement checkout is meant to retire safely.
- [x] Redeployed `workspace-subscriptions` and `paystack-webhook` after adding paid-plan replacement handling for browser-confirmation and webhook-confirmation flows.
- [x] Added focused Vitest coverage for paid-plan switch classification covering first paid checkout, no-op reselects, upgrades, downgrades, and billing-cycle changes.
- [x] Added focused Vitest coverage for Paystack subscription reconciliation helpers covering webhook subscription-code extraction, canonical status mapping, renewal-date fallbacks, and provider metadata fallback behavior.
- [x] Added a dedicated Playwright spec for the public invoice confirmation placeholder route so production-safe invalid-reference behavior is covered separately from the live payment-path fixture.
- [x] Added focused helper coverage for public invoice payment-link builders and a dedicated Playwright spec for the pricing confirmation page when no Paystack reference is present.
- [ ] Production is still using a Paystack `TEST`-mode secret, so the true live-money cutover and live charge verification remain pending even though the production domain flow is working.
- [ ] Broader automated coverage still needs more work before release to `main`, but provider-level subscription reconciliation helpers and public payment confirmation placeholder coverage are now in place.

## Recommended Next Build Focus

1. Close production rollout verification for the already-implemented Paystack invoice and subscription flows.
2. Close production rollout details for marketplace routing, especially live secrets, webhook visibility, and deployment settings.
3. Resolve paid-plan switching rules before additional billing complexity is added.

### 2026-09-23 — Client feedback hardening in local validation

- [x] Added shared Vendor and Business phone validation that rejects alphabetic and unsupported characters in the browser and database trigger paths.
- [x] Added same-workspace relationship checks for invoices, bills, payments, and payout records in the local migration set.
- [x] Added a bounded Supabase request timeout so Dashboard, Payments, Reports, and Audit Trail requests resolve to an error state instead of spinning indefinitely.
- [x] Separated unresolved subscription status from the `Starter` display fallback and added retry/error handling for subscription-gated pages.
- [x] Consolidated lazy-route and protected-route full-page loading into the shared `RouteLoadingScreen`; removed the invalid landing-page image priority prop that produced a React console warning.
- [x] Authenticated multi-company isolation and Starter/Growth/Business page rendering now have local UAT evidence; full entitlement coverage and multi-workspace switching remain open.
- [ ] A visible workspace selector is still required before multi-membership workspace-switch acceptance can be completed.
- [ ] The new migrations are applied to the local Supabase instance only; remote migration and production deployment remain intentionally pending approval.

### 2026-09-24 — Signup confirmation and payment continuation

- [x] Production Auth requires email confirmation before a new signup receives an authenticated session.
- [x] The branded confirmation email redirects to `/dashboard?email_confirmed=1` after the verification link is used.
- [x] Paid-plan signup carries the selected plan through the confirmation redirect and shows a dashboard payment prompt after the email is confirmed.
- [x] The dashboard payment prompt starts the authenticated Paystack checkout; successful verification at `/pricing/confirmed` returns the user directly to `/dashboard`.
- [ ] Confirm the final production signup behavior with one disposable Starter account and one disposable paid-plan account.
