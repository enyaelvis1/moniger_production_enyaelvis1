# Client Feedback Fix Checklist

Tracking checklist for the issues/questions raised by the client (May 2026). Each item includes a concrete test plan to run after the fix.

Branching rules (required): `feature/*` or `fix/*` branches start from `dev` and merge back into `dev` first (see `docs/BRANCHING_STRATEGY.md`).

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

---

## 2) Auto sign-out after 10 minutes inactivity (no permanent sessions)

- [x] Define “inactivity” (mouse/keyboard/touch/scroll) and confirm 10 minutes requirement.
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
  - Repeat with `10` minutes and confirm the same behavior still applies.
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
