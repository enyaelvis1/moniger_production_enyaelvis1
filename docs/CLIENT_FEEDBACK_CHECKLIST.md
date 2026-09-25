# Client Feedback Fix Checklist

Tracking checklist for the issues/questions raised by the client (May 2026). Each item includes a concrete test plan to run after the fix.

Branching rules (required): `feature/*` or `fix/*` branches start from `develop` and merge back into `develop` first (see `docs/BRANCHING_STRATEGY.md`).

Current implementation branch: `develop`

## Status key

- [ ] Not started
- [ ] In progress
- [ ] Blocked (add note)
- [ ] Done

---

## 1) Admin login looks good

- [x] Confirm admin routes and role gating are correct (no change requested).
- **Test**
  - Sign in as an admin user.
  - Visit `/admin/*` pages: Users, Payments, Businesses, Settings.
  - Confirm non-admin users cannot access `/admin/*` (redirect or 403).
- [x] Allow a Super Admin to revoke another admin's console access without deleting the user's account or workspace.
- [x] Protect the current Super Admin account and prevent removal or downgrade of the last Super Admin.
- **Test admin access removal**
  - Sign in as a Super Admin and open Admin -> Settings -> Admin Users.
  - Choose another admin and click `Revoke access`, then confirm the action.
  - Confirm the admin can no longer open `/admin/*` while their account and workspace remain unchanged.

---

## 2) Auto sign-out after 20 minutes inactivity (no permanent sessions)

- [x] Define “inactivity” (mouse/keyboard/touch/scroll) and confirm 20 minutes requirement.
- [x] Implement idle timer + warning prompt (recommended: warning at 9 min).
- [x] Sign out locally (`supabase.auth.signOut({ scope: "local" })`) and redirect to `/login` with a reason banner.
- [x] Add a Security settings control to adjust inactivity duration for testing and future admin tuning.
- [x] Ensure the timer pauses during critical flows (e.g. payment confirmation) if needed.
- **Test**
  - Sign in to a subscriber or admin account.
  - Open Settings -> Security and set inactivity duration to `1` minute for quick validation.
  - Stop interacting with the app completely.
  - Confirm a warning appears before timeout.
  - Confirm the app signs out after the selected duration and redirects to `/login`.
  - Repeat with `20` minutes and confirm the same behavior still applies.
  - Confirm the app signs out and redirects to `/login`.
  - Confirm you cannot navigate back to protected routes without signing in again.
  - (If warning modal added) wait to warning time, click “Stay signed in”, confirm session remains active.

---

## 3) Deleting a customer while transactions are processing

- [x] Define “processing” dependencies (e.g. pending invoices, pending payments, scheduled payments).
- [x] Implement server-side protection (preferred: block delete or soft delete with constraints).
- [x] Add UI messaging when delete is blocked (“Customer has X pending items…”).
- [x] Confirm behavior is race-safe (two tabs deleting/editing doesn’t corrupt data).
- **Test**
  - Create a customer.
  - Create an invoice/payment/scheduled payment in a “processing/pending” state linked to that customer.
  - Attempt to delete the customer.
  - Confirm the app blocks deletion with a clear message about processing/scheduled transactions.
  - Create a customer with historical invoices but no processing payments and confirm deletion is still blocked with an invoice-history message.
  - Create a customer with no linked invoices and confirm deletion succeeds.
  - Confirm no orphaned records and the UI remains consistent after refresh.

---

## 4) Customer “Business name” field (separate from customer name)

- [x] Add `business_name` to customers data model (migration).
- [x] Update create/edit customer UI to include “Business name”.
- [x] Update customer list/detail to display it (where appropriate).
- [x] Update search/filter behavior to include business name (if applicable).
- **Test**
  - Add a new customer with:
    - Name: “Ada Okafor”
    - Business name: “Ada Ventures Ltd”
  - Confirm both fields save and display correctly.
  - Edit the business name and confirm update persists after refresh.

---

## 5) Split address into Street Address + City/State

- [x] Decide schema (`street_address`, `city`, `state` recommended).
- [x] Migrate existing address data (if any) into the new structure.
- [x] Update all customer forms and displays to use new fields.
- **Test**
  - Create a customer and enter:
    - Street: “12 Marina Rd”
    - City/State: “Lagos, LA”
  - Save and confirm it displays correctly in list/detail views.
  - Edit the fields, refresh, confirm persistence.

---

## 6) Customer form should not clear when user opens another tab and comes back

- [x] Identify the “Add customer” UI state owner (page/modal/drawer).
- [x] Persist draft state (recommended: `sessionStorage` keyed by route + user id).
- [x] Restore draft on return; clear draft on successful save/cancel.
- **Test**
  - Go to Customers → Add customer.
  - Fill half the form (name, email, address).
  - Open a new tab (any page), then return to the original tab.
  - Confirm the form is still populated.
  - Submit successfully and confirm the draft no longer reappears.

---

## 7) Phone number format + placeholder guidance (customers/vendors/etc.)

- [x] Decide storage format (recommended: E.164, e.g. `+2348012345678`).
- [x] Add placeholder formatting in inputs (grey example).
- [x] Add validation + normalization on save.
- [x] Ensure consistent behavior across customer/vendor/team forms.
- **Test**
  - Enter a phone number in the suggested format and save.
  - Confirm it persists and displays consistently.
  - Enter an invalid number (too short/no country code) and confirm the UI blocks save with a clear error.

---

## 8) Vendor banks: add Lotus Bank + allow admin to add/remove banks

- [x] Add missing “Lotus Bank” immediately (short-term).
- [x] Replace hardcoded bank list with DB-backed list.
- [x] Create admin UI to add/disable banks.
- [x] Update vendor form to read from the new bank list.
- [x] Show mapped bank logos from the CDN with a fallback for unmapped/custom banks.
- [x] Allow super admins to remove a bank through an audited, reference-safe action.
- **Test**
  - As admin, open banks management screen.
  - Add “Lotus Bank” (if not already present) and ensure it appears as active.
  - As subscriber, go to Vendors → Add vendor.
  - Confirm “Lotus Bank” appears in the bank dropdown.
  - Disable a bank as admin; confirm it no longer appears for subscribers.
  - Confirm mapped banks show logos and unmapped/custom banks show the fallback icon.
  - Remove a bank as super admin; confirm existing references are unassigned and the removal appears in Audit Log.

---

## 9) Bills: show Naira symbol (₦ / NGN) in Amount input

- [x] Add currency prefix UI to amount field without affecting numeric value storage. (Implemented in `src/pages/Bills.tsx`)
- [x] Confirm formatting doesn’t break validation or calculations. (Validated via typecheck and build)
- **Test**
  - Bills → Add bill.
  - Confirm the amount input shows `₦` (or `NGN`) prefix visually.
  - Enter `5000` and save; confirm stored value is numeric and totals are correct.

---

## 10) Bills categories: admin can update categories (and where)

- [x] Identify current category source (hardcoded/seeded).
- [x] Implement DB-backed categories with admin management UI.
- [x] Ensure old categories can be archived without breaking historical bills.
- **Test**
  - As admin, add a new bill category “Office Snacks”.
  - As subscriber, create a bill and select “Office Snacks”.
  - Archive/disable the category as admin.
  - Confirm existing bills still show the category label, but new bills cannot select it.

---

## 11) Scheduled payment: option to mark paid immediately

- [x] Define requirements: “Pay now” triggers immediate provider initiation vs schedule.
- [x] Add UI toggle and required-field validation changes.
- [x] Implement backend support for immediate execution path.
- [x] Confirm status transitions and audit logs.
- Note: the current implementation is a manual immediate-payment path inside Moniger. The UI now says `Mark as Paid`; it records the bill paid immediately and creates the linked payable payment record. It does not yet trigger an automated vendor bank transfer.
- **Test**
  - Create a scheduled payment for a future date; confirm it remains scheduled.
  - Create a bill with `Mark as Paid`; confirm it is marked paid immediately and a completed payable payment record appears in Payments.

---

## 12) Testing with real accounts for scheduling/immediate payments

- [ ] Clarify meaning: “real app accounts” vs “real money”.
- [ ] Document test plan for Paystack test mode vs live mode.
- [ ] Provide staging checklist and rollback plan.
- **Test**
  - In test mode, complete:
    - Pay now flow
    - Schedule flow (including confirmation and webhook)
  - In live mode (only after approval), run a small-value transaction and confirm reconciliation.

---

## 13) Admin Payments: why past due dates still show Pending

- [x] Identify state machine rules and what “pending” means.
- [x] Add reconciliation logic (scheduled job / admin action) to sync provider state and mark stale payments.
- [x] Update UI labels for stale pending items and show last checked time.
- Note: this first fix uses a safe admin-side reconcile action. It auto-resolves only clear cases from the linked invoice or bill. If the underlying document is still open but overdue, the payment remains `Pending` and is now explained as a stale/open item instead of silently looking wrong.
- **Test**
  - Create (or locate) a payment that is past due and still pending.
  - Run reconciliation from `Admin -> Payments`.
  - Confirm one of these happens after refresh:
    - if the linked invoice or bill is already paid, the payment becomes `Completed`
    - if the linked invoice was cancelled, the payment becomes `Failed`
    - if the linked invoice or bill is still overdue/open, the payment stays `Pending` but now shows a stale/open explanation plus `Last checked`

---

## 14) Admin → Settings → Danger Zone: clarify purpose + safeguards

- [x] Add explanation text for each action in Danger Zone.
- [x] Ensure super-admin-only access.
- [x] Add confirmations (typed confirmation + audit logging).
- **Test**
  - As non-admin/subscriber, attempt to access Danger Zone; confirm blocked.
  - As admin, open Danger Zone; confirm descriptions are clear.
  - Trigger a safe/non-destructive action (if available) and confirm audit log entry exists.

---

## 15) Operations → Announcements / Support lookup: clarify purpose + access controls

- [x] Add “What is this?” explanations on these pages.
- [x] Confirm access control (admin-only) and audit logs for support lookup actions.
- [x] Document intended use cases (internal runbook). See `docs/admin-console/OPERATIONS_RUNBOOK.md`.
- **Test**
  - As subscriber, attempt to access Operations pages; confirm blocked.
  - As admin, open Announcements; create/update an announcement; confirm it appears where intended.
  - As admin, use Support lookup; confirm any data access is logged and results match expected scope.

---

## 16) Admin Management: delete eligible payments or payouts

**Status: [x] Done — ready for browser acceptance testing**

### Current state

- Admin cleanup already exists under `Admin → Settings → Danger Zone`.
- It is intentionally restricted to marked test data, requires a cleanup reason and typed confirmation, and writes an audit record.
- Payout deletion is limited to safe terminal states (`failed`, `reversed`, or `cancelled`). Completed provider-backed financial records must not be hard-deleted casually.

### Fix checklist

- [ ] Confirm whether the request is for test-data cleanup only or for live-record deletion/voiding.
- [x] Expose deletion controls from `Admin → Management → Payments` and `Admin → Management → Payouts` for eligible records.
- [x] Add row selection, select-all-visible, and bulk deletion actions to Payments and Payouts.
- [x] Add row selection, select-all-visible, and bulk deletion actions to Receivables; delete only invoices linked exclusively to test payments.
- [x] Show eligibility through test-data badges/actions and backend rejection messages.
- [x] Preserve typed confirmation, cleanup reason, audit logging, and post-delete reconciliation.
- [x] Keep completed live payments and provider-settled payouts protected.
- [x] Add backend record targeting so one eligible test record can be deleted without bulk cleanup.
- [x] Make the Danger Zone cleanup flow show a clear scope, preview summary, blocked-record count, and exact linked-record confirmation count.
- [x] Keep a separate staging/QA Supabase project as the recommended option for full test-database resets.
- [x] Add safe cleanup for explicitly marked supporting test data: customers, vendors, invoices, bills, non-completed checkout sessions, managed content, announcements, and test/sandbox signup alerts.
- [x] Add Super Admin-only subscription selection and bulk deletion for marked manual test subscriptions; provider-linked and live subscriptions remain protected.
- [x] Mark legacy QA workspaces from narrowly scoped Playwright/Debug/test identity signals so existing fixtures can be reviewed and cleaned before production cutover.

### Test after completion

1. Sign in as a platform admin and open `Admin → Management → Payments`.
2. Select a marked test payment and confirm the UI identifies it as deletable.
3. Attempt deletion without the required reason or typed confirmation; confirm it is blocked.
4. Delete it with a valid reason and confirmation; refresh and confirm it is gone.
5. Repeat with a failed/cancelled test payout from `Admin → Management → Payouts`.
6. Try a completed live/provider-backed payment or payout; confirm deletion is blocked and the reason is clear.
7. Open the Audit Log and confirm the deletion event includes the actor, counts, reason, and manifest/result.
8. Open `Admin → Settings → Danger Zone`, choose `All marked test data`, refresh the preview, and confirm the bulk confirmation count includes linked payment, receivable, and supporting test records.
9. On `Admin → Management → Receivables`, select one or more eligible test receivables, type the exact bulk confirmation, and confirm deletion succeeds and is audit logged.
10. Confirm live users, subscriptions, wallet ledger entries, webhook events, and audit logs are never included in the cleanup preview.
11. On `Admin → Management → Subscriptions`, select marked test subscriptions and confirm bulk deletion requires a reason and exact typed confirmation, creates an audit event, and does not allow provider-linked/live rows to be selected.

---

## 17) Contact Us: limit message to 300 characters

**Status: [x] Done — ready for browser acceptance testing**

### Fix checklist

- [x] Add `maxLength={300}` and a visible character counter to the public Contact Us message field.
- [x] Enforce the same 300-character limit in `supabase/functions/contact-message`.
- [x] Return a clear validation error for messages over 300 characters.
- [x] Verify a direct 301-character request is rejected.

### Test after completion

1. Open the public website and choose `Contact Us`.
2. Enter exactly 300 characters; confirm the form accepts the text and the counter shows `300/300`.
3. Try to enter a 301st character; confirm the field prevents it or shows a clear validation error.
4. Submit the 300-character message and confirm it is delivered successfully.
5. Send a direct test request with more than 300 characters; confirm the Edge Function rejects it with a validation error and no message is delivered.

---

## 18) Contact Us: replace the public email address

**Status: [x] Done — ready for browser acceptance testing**

### Fix checklist

- [x] Replace `hello@moniger.net` with `admin@moniger.net` in the Contact Us page display and `mailto:` link.
- [x] Update the Contact Us error/fallback copy to use `admin@moniger.net`.
- [x] Confirm the contact-message default recipient configuration uses `admin@moniger.net`.
- [x] Search the public source for the old customer-facing address.

### Test after completion

1. Open the public Contact Us page.
2. Confirm the visible email is `admin@moniger.net`.
3. Click the email and confirm the link opens `mailto:admin@moniger.net`.
4. Force or simulate a contact-form delivery error and confirm the fallback message also shows `admin@moniger.net`.
5. Search the deployed public site for `hello@moniger.net`; confirm no unintended public reference remains.

---

## 19) Admin Management: add a Receivable page

**Status: [x] Done — ready for browser acceptance testing**

### Fix checklist

- [x] Define the scope as receivable invoices with incoming payment and settlement fields.
- [x] Add a dedicated Admin Management navigation item and route for Receivables.
- [x] Show business, customer, invoice, amount, status, due date, and payment reference/status fields.
- [x] Add status and test/live data filters.
- [x] Preserve admin-only access through the existing admin route and Edge Function authorization.
- [x] Add CSV export with an audit event.

### Test after completion

1. Sign in as a platform admin and confirm `Management → Receivables` is visible.
2. Confirm the page loads receivable records from at least two businesses.
3. Filter for open, overdue, completed, failed, and test records; confirm the results and totals change correctly.
4. Open a receivable detail and confirm the invoice, customer, amount, status, and provider reference are consistent with the source record.
5. Sign in as a non-admin and confirm the page is inaccessible.
6. Refresh the page and confirm the selected filters and displayed data remain correct.

---

## 20) Real customer and real-money testing in live mode

**Status: [ ] Blocked pending live-key rollout and approval**

### Current answer

Production-domain Paystack checkout has been tested in Paystack `TEST` mode. A real customer and real-money test can begin only after the live Paystack keys and webhook configuration are intentionally enabled, the live test amount/account are approved, and the release checks pass. The current repository status does not yet confirm that live-money cutover is complete.

This item should cover public invoice collection and workspace subscription billing separately. Do not use the outgoing payable flow as proof of live vendor disbursement unless the provider-backed payout capability and release documentation explicitly confirm it.

### Fix/release checklist

- [ ] Confirm Paystack live account approval, business/KYC requirements, and allowed live test amount.
- [ ] Confirm live `PAYSTACK_SECRET_KEY` is configured for `paystack-payments`, `paystack-webhook`, and `workspace-subscriptions`.
- [ ] Confirm the live Paystack webhook points to the documented Supabase webhook URL.
- [ ] Confirm `APP_BASE_URL` and production callback URLs use the production domain.
- [ ] Create one real customer/invoice with a low-value approved amount.
- [ ] Run one intentional live invoice payment and record the Paystack reference, callback result, webhook result, payment status, invoice status, and receipt delivery.
- [ ] Run one intentional live workspace subscription checkout separately and record the checkout reference and subscription-sync result.
- [ ] Verify refunds, failed-payment handling, reconciliation, and support/audit visibility before declaring live mode complete.
- [ ] Update the source-of-truth and UAT docs with the exact date, references, and outcomes.

### Test after completion

1. Use an approved real customer and a low-value invoice on the production domain.
2. Open the public invoice payment link in a fresh browser session and complete payment with an approved live payment method.
3. Confirm the browser returns to the confirmation route, the webhook is captured, `payments.status` becomes `completed`, and the invoice becomes `paid`.
4. Confirm the customer receipt is delivered and the payment is visible in workspace and admin reporting.
5. Separately run a live workspace subscription checkout and confirm `/pricing/confirmed`, `subscription_checkout_sessions`, and `business_subscriptions` reconcile correctly.
6. Record the exact references and stop the test if any status, amount, recipient, or webhook result is unexpected.

---

## 21) Starter, Growth, and Business acceptance milestone

**Status: [ ] In progress — paid signup checkout, dashboard return, subscription visibility, workspace switching, 20-minute timeout, local Admin → Subscriptions verification, and the local three-tier route/gate matrix confirmed; live/provider release acceptance remains pending**

### A. Fix workspace upgrade and status display

- [ ] Reproduce a signed-in workspace upgrade from `Starter` to `Growth` using Paystack test mode.
- [ ] Capture the checkout reference, callback URL, verification response, and webhook result.
- [ ] Confirm the selected workspace—not another workspace owned by the same user—is updated.
- [ ] Confirm `business_subscriptions.plan` changes to `growth` only after successful provider verification.
- [ ] Confirm the workspace status card changes from `Starter` to `Growth` after callback, webhook sync, and a full page refresh.
- [ ] Confirm the upgrade page does not remain visible after the plan becomes active.
- [x] Invalidate the cached workspace subscription query before redirecting after successful verification.
- [x] Route paid registrations directly into Paystack checkout after the account and workspace are created.
- [x] Allow active workspace members to read their own subscription so the plan status and premium feature gates render correctly after checkout.
- [x] Prevent a fresh `null` subscription placeholder from suppressing the first real subscription fetch while workspace settings load.
- [x] Keep the post-registration Paystack redirect alive when subscription checkout toggles its loading state.
- [x] Send a newly registered paid-plan user directly into Paystack checkout after the account and workspace are created, without an intermediate pricing-page handoff.
- [x] Confirm a delayed provider response leaves the checkout retryable and does not create a false failure. (Local regression test covers retryable provider responses.)
- [x] Repeat the same checks for `Business`.
- [x] Confirm signed-in users return to their workspace dashboard after successful confirmation.
- [x] Confirm signed-out confirmation remains read-only and does not expose private workspace details.

### Test A — upgrade status

1. Sign in to the intended test workspace while it is on `Starter`.
2. Open pricing, choose `Growth`, and complete a Paystack test checkout.
3. Record the Paystack reference and confirm the browser returns to `/pricing/confirmed`.
4. Confirm the page redirects to the workspace dashboard after successful verification.
5. Open workspace settings and confirm the current plan is `Growth`.
6. Refresh, sign out and back in, and confirm the plan remains `Growth`.
7. Repeat with a separate workspace and the `Business` plan.
8. Confirm `/admin/subscriptions` shows the correct workspace, plan, provider reference, amount, and renewal state.
9. Start a fresh paid registration and confirm the account flow opens the Paystack checkout directly instead of stopping on the pricing page.

### B. Create the retained test businesses and vendors

- [ ] Create exactly these test workspaces:
  - `Moniger Starter Limited` — Starter
  - `Moniger Growth Limited` — Growth
  - `Moniger Business Limited` — Business
- [ ] Mark each workspace explicitly as test data.
- [ ] Add exactly two vendors to each workspace:
  - `Moniger Starter Vendor Ent1`
  - `Moniger Starter Vendor Ent2`
  - `Moniger Growth Vendor Ent1`
  - `Moniger Growth Vendor Ent2`
  - `Moniger Business Vendor Ent1`
  - `Moniger Business Vendor Ent2`
- [ ] Use clearly fake/test contact details and test bank details only.
- [ ] Confirm each vendor belongs to the correct workspace and has the expected bank/logo mapping.
- [ ] Record the business IDs and vendor IDs in the UAT results before cleanup.

### Test B — fixtures

1. Sign in to each workspace and confirm its displayed plan.
2. Open Vendors and confirm both expected vendors appear.
3. Edit one vendor in each workspace, refresh, and confirm the change persists.
4. Confirm a vendor from one workspace is never visible in another workspace.
5. Confirm the admin Vendors page shows all six vendors with the correct workspace names.

### C. Test the three plan tiers

For every workspace, execute the applicable feature matrix and record Pass/Fail, evidence, and any plan-gating mismatch.

- [x] Starter baseline: dashboard, workspace settings, and premium-feature gating verified in fresh local Starter UAT; remaining workflow matrix checks are still pending.
- [ ] Growth: all Starter checks plus reports, audit trail, enhanced exports, and the Growth-only limits/entitlements shown in the pricing catalog.
- [ ] Business: all Growth checks plus Business-only limits/entitlements shown in the pricing catalog and any admin-configured controls.
- [x] Confirm unavailable premium features show a useful upgrade message rather than a broken page.
- [ ] Confirm an upgrade changes access without requiring a second account or browser session.
- [ ] Confirm cancellation, failed payment, and expired access states display the correct status and do not grant paid features incorrectly.
- [ ] Confirm invoice collection, receipt delivery, notifications, search, filters, and CSV exports for each applicable tier.
- [ ] Confirm admin views show the correct business, subscription, payment, receivable, payout, and vendor data.
- [ ] Confirm the current product limitation: outgoing payable/vendor disbursement must not be reported as real bank movement unless the approved provider-backed payout release is explicitly enabled and documented.

### Test C — tier acceptance

1. Run the same core workflow in all three workspaces: create a customer, vendor, invoice, bill, and test payment record.
2. Test each plan-specific feature from a clean browser session.
3. Capture screenshots or IDs for successful flows and error messages for blocked flows.
4. Confirm data isolation between the three workspaces.
5. Log every failure as a separate fix before cleanup begins.

### D. Clean up test data while retaining the three fixtures

- [ ] Export a backup/snapshot and save the cleanup manifest before deletion.
- [ ] Confirm the retained businesses are explicitly marked test data and listed by ID.
- [ ] Delete all other marked test businesses, users, vendors, customers, invoices, bills, payments, receivables, payouts, content, alerts, and non-completed checkout sessions.
- [ ] Retain only the three named businesses and their six named vendors, plus the minimum linked records needed for their acceptance evidence.
- [ ] Do not delete admin users, audit logs, live/provider-settled financial records, active subscriptions, wallet ledgers, webhook events, or unmarked data.
- [ ] Preview the cleanup and resolve every blocked dependency before confirming deletion.
- [ ] Run cleanup in the admin console with a reason of at least 10 characters and the exact typed confirmation requested by the UI.
- [ ] Refresh all admin pages and confirm no unrelated records were removed.

### Test D — cleanup safety

1. Open `Admin → Settings → Danger Zone` and select `All marked test data`.
2. Confirm the preview lists the retained fixture records separately from deletable records.
3. Confirm live, unmarked, admin, subscription, audit, ledger, and webhook records are blocked.
4. Execute cleanup only after reviewing the manifest and counts.
5. Confirm the three retained businesses and six retained vendors still load and remain associated correctly.
6. Confirm the audit log contains the cleanup reason, actor, scope, counts, and outcome.

### E. Test accounts and real-customer readiness

- [ ] Complete the full workflow in Paystack `TEST` mode using test customers and test payment methods first.
- [ ] Confirm local testing uses the local Supabase URL and localhost callback; never use production callbacks from local development.
- [ ] Confirm production-domain test-mode checkout works independently from local testing.
- [ ] Obtain Paystack live approval, business/KYC approval, live-key configuration, webhook confirmation, and an approved low-value test amount before using real money.
- [ ] Treat real bank-account testing as a controlled live-money release activity, not as ordinary unit/UAT testing.
- [ ] Run public invoice collection and workspace subscription billing as separate live tests.
- [ ] Do not describe payable/vendor flows as real bank transfers unless the provider-backed payout engine is enabled and release-approved.

### Test E — live-mode gate

1. Verify live keys and webhook configuration with the platform owner.
2. Use one approved real customer and one approved low-value invoice.
3. Record the Paystack reference, callback result, webhook result, payment status, invoice status, and receipt delivery.
4. Separately run one workspace subscription checkout and confirm subscription synchronization.
5. Stop immediately if the amount, recipient, status, callback, or webhook result is unexpected.
6. Update this checklist, the UAT guide, and the source-of-truth document with the dated evidence before declaring live testing complete.

---

## 22) Latest client feedback: input validation, plan isolation, and test-account cleanup

**Status: [ ] In progress — local implementation, admin subscription verification, full local tier matrix, and responsive UI review completed; production/live-money acceptance remains blocked**

### Local implementation evidence

- [x] Shared phone parsing now rejects alphabetic characters, unsupported symbols, misplaced/repeated `+`, and invalid digit lengths instead of silently stripping them.
- [x] Business settings now includes a validated Business Phone field; Vendor phone inputs use telephone input behavior and the same shared validator.
- [x] Supabase requests have a bounded 15-second timeout so Dashboard, Payments, Reports, and Audit Trail can reach an error/retry state instead of spinning indefinitely.
- [x] Complete the mandatory responsive UI review at 1440×900, 768×1024, and 390×844; fix Settings tab clipping, add mobile workspace switching, and remove tablet header overflow. Evidence: `docs/CLIENT_FEEDBACK_UI_OBSERVATIONS_2026-09-24.md`.
- [x] Review mobile finance tables and add a visible horizontal-scroll affordance for the Payments table. Evidence: UI-004 in `docs/CLIENT_FEEDBACK_UI_OBSERVATIONS_2026-09-24.md`.
- [x] Re-run the public Contact Us contrast audit and correct secondary text contrast. Evidence: UI-005 in `docs/CLIENT_FEEDBACK_UI_OBSERVATIONS_2026-09-24.md`.
- [x] Subscription-gated pages now distinguish subscription loading, subscription errors, and a genuine missing subscription; a failed subscription read no longer appears as Starter forever.
- [x] Lazy-route and protected-route full-page loading now share one authoritative `RouteLoadingScreen`, avoiding inconsistent loader handoffs during navigation.
- [x] Multi-workspace users now have a user-scoped sidebar selector with persisted selection and settings/subscription query scoping; local Business ↔ Growth switching survived refresh and re-login.
- [x] Paid Growth signup was completed through local Paystack TEST checkout on the configured `localhost:8080` origin and returned directly to the new workspace dashboard; detailed evidence is in `docs/CLIENT_FEEDBACK_LOCAL_UAT_2026-09-23.md`.
- [x] Local-only database migrations add Business/Vendor phone enforcement and cross-workspace link validation for invoices, bills, payments, and payouts.
- [x] Checkout verification resolves the workspace from the persisted checkout session and validates provider amount, currency, and plan before synchronization.
- [x] Checkout verification fails closed when provider currency or expected plan evidence is missing; canonical subscription evidence may prove a missing transaction plan.
- [x] Client subscription error translation preserves structured retryable provider responses and status codes.
- [x] Structured provider-pending responses keep delayed verification retryable and prevent premature dashboard navigation.
- [x] Composite workspace relationship constraints were applied locally after a zero-mismatch read-only preflight; parent moves and concurrent child links are protected atomically.
- [x] The workspace preflight reports orphan and mismatch details across all eight protected relationships, including payout bill/vendor and ledger wallet links.
- [x] Wallet ledger history is protected from cascade deletion with a workspace-aware `RESTRICT` foreign key.
- [x] Mutation timeout handling distinguishes unknown server outcomes and preserves caller abort behavior.
- [x] Production migrations and deployment are intentionally not performed in this task.
- [ ] Release security verification remains blocked until the linked Supabase CLI identity has `edge_functions_secrets_read`.
- [x] Authenticated two-company isolation and multi-workspace selector acceptance were tested locally; see `docs/CLIENT_FEEDBACK_LOCAL_UAT_2026-09-23.md`.
- [x] A disposable local-only Super Admin verified Admin → Subscriptions against Starter, Growth, and Business matrix fixtures; no production credentials were used.
- [x] The local Starter/Growth/Business entitlement matrix was executed through the real UI, including direct Reports/Audit Trail route checks and authenticated cross-workspace subscription-read checks.
- [x] The two local Supabase schema-lint findings were reviewed and classified as pre-existing category-B follow-up defects, outside this PR; they were not silenced or changed here.

### A. Restrict Vendor and Business phone fields to numbers

- [x] Confirm every Vendor phone and Business phone input accepts digits only, with the agreed international format support (for example, `+2348012345678`).
- [x] Prevent alphabetic characters and unsupported symbols in the UI.
- [x] Enforce the same validation and normalization server-side so requests cannot bypass the browser.
- [x] Apply the rule consistently to create and edit forms.

### Test A

1. Open Vendor and Business create/edit forms.
2. Enter letters into the phone field; confirm they are rejected or removed.
3. Enter a valid Nigerian number and confirm it saves and displays correctly.
4. Submit an invalid phone value through a direct request; confirm the server rejects it.

### B. Correct Growth and Business subscription display

- [ ] Reproduce the `foxyrule@yahoo.com` Growth account issue in a safe test environment without exposing credentials in source control or logs.
- [x] Confirm Profile → Personal Information displays `Growth` after local subscription synchronization. (Disposable local matrix account.)
- [x] Confirm the workspace subscription record, selected workspace, Admin → Subscriptions row, and UI plan status all agree. (Starter, Growth, and Business matrix fixtures.)
- [x] Repeat the same flow for a Business subscription and confirm it displays `Business`. (Disposable local matrix account.)
- [x] Confirm Starter accounts continue to display `Starter` and are not upgraded accidentally. (Fresh local Starter UAT, refresh, and re-login.)

### Test B

1. Sign in to the Growth test account and record the selected workspace ID and subscription reference.
2. Open Profile → Personal Information and confirm the plan is `Growth`.
3. Refresh, sign out, and sign back in; confirm it remains `Growth`.
4. Repeat for Business and confirm it shows `Business`.
5. Confirm Admin → Subscriptions shows the same plan for the same workspace.

### C. Verify company data isolation

- [x] Review workspace/business scoping in all customer, vendor, invoice, bill, payment, receivable, payout, subscription, and dashboard queries.
- [ ] Confirm every create, read, update, delete, export, and realtime query is scoped to the active business/workspace.
- [ ] Confirm server-side authorization prevents a user from reading or mutating another company’s records by changing an ID in a request.
- [ ] Check admin views separately: platform admins may see cross-business data only through explicitly authorized admin endpoints.
- [x] Add or update automated isolation tests for at least two companies. (Existing isolation coverage plus workspace-selection regression tests.)

### Test C

1. Create Company A and Company B with distinct customers, vendors, invoices, and payments.
2. Sign in as a member of Company A and confirm no Company B records appear in lists, search, exports, dashboards, or detail routes.
3. Attempt direct requests using Company B record IDs; confirm reads and mutations are rejected.
4. Repeat from Company B and confirm the inverse isolation.
5. Confirm admin reporting labels every record with the correct company.

### D. Keep Starter, Growth, and Business entitlements separate

- [x] Compare the pricing catalog, feature gates, server-side entitlement checks, navigation visibility, limits, and applicable exports for all three plans. (Matrix evidence recorded in the local UAT report.)
- [x] Confirm plan checks use the selected workspace’s current subscription, not a user-wide or cached plan value. (Selected-workspace UI and direct API isolation checks passed.)
- [x] Confirm Starter cannot access Growth/Business-only features without an active upgrade. (Reports showed the upgrade gate in fresh local UAT.)
- [x] Confirm Growth receives the implemented Growth/paid feature set; no unsupported Business-only route gate was found in the current catalog implementation.
- [x] Confirm Business receives the implemented Business/paid feature set.
- [x] Confirm failed, cancelled, and pending/inactive supported subscription states do not grant paid entitlements. Expired is not a supported `business_subscriptions.status` and is recorded as N/A.

### Test D

1. Test the same user/workflow in separate Starter, Growth, and Business workspaces.
2. Record visible menus, feature gates, limits, and server responses for each plan.
3. Refresh and sign out/in between checks to rule out stale client cache.
4. Confirm changing one workspace’s plan does not change another workspace’s menus or permissions.

### E. Investigate dashboard, Payments, Reports, and Audit Trail loading

- [x] Reproduce the persistent spinner for Starter, Growth, and Business accounts.
- [x] Capture browser console errors, failed network requests, response status codes, and the affected workspace ID.
- [x] Verify loading states always resolve on success, empty results, authorization errors, and API errors.
- [x] Confirm each page uses the correct workspace scope and does not wait indefinitely for unrelated data.
- [ ] Add targeted tests for success, empty, and error states for Dashboard, Payments, Reports, and Audit Trail.

### Test E

1. Sign in to each approved test account using credentials supplied securely outside the repository.
2. Open Dashboard, Payments, Reports, and Audit Trail.
3. Confirm each page either renders data, shows an empty state, or shows a useful error within a reasonable time.
4. Check the browser console and Network tab for failed requests or HTML returned where JSON is expected.
5. Repeat after a hard refresh and after signing out/in.

### F. Remove the three temporary business accounts

**Destructive action — requires explicit confirmation immediately before execution.**

- [ ] Confirm the exact business IDs and owner accounts for:
  - `Moniger Starter Limited`
  - `Moniger Growth Limited`
  - `Moniger Business Limited`
- [ ] Export a backup/manifest and record linked vendors, customers, invoices, bills, payments, subscriptions, and users.
- [ ] Confirm these are marked test accounts and are not live customer or financial records.
- [ ] Resolve or document dependencies that prevent safe deletion.
- [ ] Delete only the three named test businesses and their eligible linked test data.
- [ ] Confirm the owner accounts can be reused or are handled according to the auth-account deletion policy.
- [ ] Verify no unrelated businesses, users, subscriptions, financial records, audit logs, or live data were removed.

### Test F

1. Preview the cleanup in `Admin → Settings → Danger Zone`.
2. Verify the preview contains exactly the three named businesses and approved linked test records.
3. Confirm the typed confirmation, cleanup reason, audit entry, and deletion manifest are required.
4. Execute the cleanup only after the business IDs and counts are reviewed.
5. Search for the three business names and confirm they no longer appear.
6. Confirm unrelated production data and audit history remain intact.

## 23) Paid subscription access and renewal reminders

**Status: [ ] In progress — local implementation added; local migration and email-provider acceptance remain pending**

- [x] Keep Starter workspaces available without paid checkout.
- [x] Lock Growth and Business workspace operations until the subscription is active; retain Dashboard and Workspace Settings for renewal.
- [x] Add an explicit `expired` subscription state after an unpaid renewal date passes.
- [x] Add idempotent owner reminders approximately 14 days and 48 hours before renewal.
- [x] Add an expiry email and audit-friendly delivery records.
- [ ] Configure the production cron secret and Resend secrets.
- [ ] Run local/provider email acceptance for reminder, retry, and expiry paths.
- [ ] Apply the migration and deploy the function only after release approval.

### Test 23

1. Use a local paid test workspace with a renewal date inside the 14-day window; invoke the automation twice and confirm only one 14-day message is sent.
2. Repeat inside the 48-hour window and confirm only one 48-hour message is sent.
3. Set a paid subscription renewal date in the past; invoke the automation and confirm the subscription becomes `expired`, the expiry notice is recorded, and paid workspace routes show the renewal screen.
4. Confirm Dashboard and Workspace Settings remain available so the owner can renew.
5. Confirm a Starter workspace remains usable and receives no paid-renewal reminder.
