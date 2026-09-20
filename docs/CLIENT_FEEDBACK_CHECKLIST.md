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
- **Test**
  - As admin, open banks management screen.
  - Add “Lotus Bank” (if not already present) and ensure it appears as active.
  - As subscriber, go to Vendors → Add vendor.
  - Confirm “Lotus Bank” appears in the bank dropdown.
  - Disable a bank as admin; confirm it no longer appears for subscribers.

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
