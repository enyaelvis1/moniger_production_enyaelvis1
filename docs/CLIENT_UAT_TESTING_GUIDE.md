# Client UAT Testing Guide

Last updated: 2026-05-21

## Purpose

Use this guide to test what has already been implemented in Moniger so far.

This is a client-facing user acceptance testing guide for the current release candidate:

- Release: `v0.1.0-rc.4`
- Focus: implemented product improvements, admin tools, payment flow hardening, and security-related UX fixes

## Before You Start

Please test with these account types where possible:

- `Platform admin`
- `Workspace owner` or `subscriber`
- `Non-admin user` for access-control checks

Recommended test order:

1. Authentication and session behavior
2. Customer and vendor data management
3. Bills and payments
4. Admin tools and controls
5. Subscription and payment confirmation flows

## Important Notes

- Production is still using Paystack `TEST` mode, not live money mode yet.
- Do not treat the current release as the final live billing cutover.
- `Mark as Paid` for bills currently marks the bill paid immediately inside Moniger and creates the related payment record. It does **not** yet send an automated vendor bank transfer.
- Real live-money Paystack verification will happen later, after Paystack approval and live-key switch.

## 1. Authentication And Session Behavior

### 1.1 Login and admin access

Test steps:

1. Sign in as a platform admin.
2. Open `/admin`.
3. Visit `Users`, `Payments`, `Businesses`, and `Settings`.
4. Sign out.
5. Sign in as a normal non-admin user.
6. Try to open `/admin`.

Expected result:

- Admin users can access admin pages.
- Non-admin users are blocked from admin pages.

### 1.2 Auto sign-out after inactivity

Test steps:

1. Sign in as a workspace user or admin.
2. Open `Settings -> Security`.
3. Set inactivity timeout to `1 minute` for quick testing.
4. Stop all interaction with the app.
5. Wait for the warning prompt.
6. Let the timeout finish once.
7. Sign in again and repeat, but this time click `Stay signed in` at the warning.

Expected result:

- A warning appears before timeout.
- If no action is taken, the app signs out and redirects to `/login`.
- If `Stay signed in` is used, the session continues.

### 1.3 Forgot password flow

Test steps:

1. Open `/login`.
2. Click `Forgot password?`.
3. Confirm it opens `/forgot-password`.
4. Submit a real user email.
5. Open the reset email.
6. Open the reset link and observe the browser URL after the page loads.
7. Set a new password and complete the flow.

Expected result:

- The link goes to the correct forgot-password page.
- The email is sent successfully.
- The email content is personalized when the user name is available.
- The browser URL is cleaned after the reset session is prepared.
- The password can be updated successfully.

### 1.4 Session persistence security check

Test steps:

1. Sign in on one browser tab.
2. Refresh the same tab.
3. Confirm the session still works there.
4. Close the tab completely.
5. Open a fresh tab and return to the app.

Expected result:

- Refreshing the same tab keeps the session.
- Closing the tab/browser requires sign-in again.
- A new tab should not inherit the session as broadly as before.

## 2. Customer And Vendor Data Management

### 2.1 Customer business name

Test steps:

1. Open `Customers`.
2. Add a customer with:
   - Customer name: `Ada Okafor`
   - Business name: `Ada Ventures Ltd`
3. Save the customer.
4. Reopen the customer and edit the business name.

Expected result:

- Customer name and business name are saved separately.
- Both values persist after refresh.

### 2.2 Split address fields

Test steps:

1. Add or edit a customer.
2. Enter:
   - Street address: `12 Marina Rd`
   - City/State: `Lagos, LA`
3. Save and refresh.

Expected result:

- The split address fields save correctly.
- They display correctly after refresh.

### 2.3 Customer form draft persistence

Test steps:

1. Open `Customers -> Add customer`.
2. Fill part of the form only.
3. Open another browser tab.
4. Return to the original customer form tab.
5. Save the customer successfully.

Expected result:

- Draft values remain when returning to the tab.
- After successful save, the old draft does not reappear.

### 2.4 Phone format guidance

Test steps:

1. Open a customer or vendor create form.
2. Look at the phone-number field.
3. Enter a valid number in the suggested format.
4. Save it.
5. Repeat with an invalid number.

Expected result:

- The input shows format guidance in the placeholder.
- Valid numbers save correctly.
- Invalid numbers are blocked with a clear error.

### 2.5 Customer deletion protection

Test steps:

1. Create or find a customer linked to an open invoice, pending payment, or scheduled transaction.
2. Try to delete that customer.
3. Then test another customer with no linked records.

Expected result:

- Customers with linked active or historical finance records should not delete in a way that breaks data.
- The app should show a clear reason when deletion is blocked.
- A safe customer with no linked history should delete normally.

### 2.6 Vendor bank list and Lotus Bank

Test steps:

1. As admin, open bank management.
2. Confirm `Lotus Bank` exists.
3. As a workspace user, open `Vendors -> Add vendor`.
4. Open the bank dropdown.

Expected result:

- `Lotus Bank` appears in the vendor bank list.
- The list is admin-managed, not hardcoded only.

## 3. Bills And Payments

### 3.1 Naira symbol in bill amount

Test steps:

1. Open `Bills -> Add bill`.
2. Look at the amount field.
3. Enter an amount and save.

Expected result:

- The amount input shows `₦` or `NGN`.
- Amount saving and calculations still work correctly.

### 3.2 Admin-managed bill categories

Test steps:

1. As admin, add a category such as `Office Snacks`.
2. As a workspace user, create a bill and choose that category.
3. As admin, disable or archive the category.
4. Return to the bill form.

Expected result:

- New categories can be added by admin.
- Workspace users can select active categories.
- Archived categories remain visible on old bills but are not available for new selection.

### 3.3 Scheduled payment versus mark paid immediately

Test steps:

1. Create a bill and choose `Schedule Payment` for a future date.
2. Confirm it saves as scheduled.
3. Create another bill and choose `Mark as Paid`.

Expected result:

- Scheduled payments remain scheduled.
- `Mark as Paid` marks the bill paid immediately.
- A corresponding payment record is created.

### 3.4 Admin Payments reconciliation

Test steps:

1. As admin, open `Admin -> Payments`.
2. Find an older `Pending` item tied to an invoice or bill.
3. Use the `Reconcile` action.
4. Refresh the page.

Expected result:

- If the linked source is already paid, the payment becomes `Completed`.
- If the linked invoice was cancelled, the payment becomes `Failed`.
- If the source is still open/overdue, the payment remains `Pending` but now shows a clearer stale/open explanation and `Last checked`.

## 4. Admin Tools And Controls

### 4.1 Danger Zone

Test steps:

1. As admin, open `Admin -> Settings -> Danger Zone`.
2. Review the descriptions.
3. Confirm the typed confirmation behavior.
4. If possible, repeat with a lower-privilege user.

Expected result:

- Danger Zone actions explain their purpose clearly.
- Access is restricted appropriately.
- Destructive actions require stronger confirmation.

### 4.2 Announcements and Support Lookup

Test steps:

1. As admin, open `Admin -> Announcements`.
2. Review the page guidance.
3. Open `Admin -> Support Lookup`.
4. Run a safe lookup if you have a valid test reference.

Expected result:

- Both pages clearly explain what they are for.
- They are admin-only.
- Support lookup still works normally.

### 4.3 Bank management

Test steps:

1. As admin, open the bank management page.
2. Add or disable a test bank.
3. As a workspace user, reopen a vendor form.

Expected result:

- Admin changes to the bank list affect the vendor selection list correctly.

## 5. Workspace Subscription And Payment Confirmation Flows

### 5.1 Marketplace payout destination and Paystack subaccount creation

Test steps:

1. Sign in as a workspace owner or subscriber admin.
2. Open `Settings -> Business`.
3. Find the payout-routing or payout-destination section.
4. Choose the bank.
5. Enter the account number.
6. Enter or confirm the account name if required.
7. Click `Save & Sync Paystack`.
8. Wait for the response and refresh the page if needed.

Expected result:

- The payout account saves successfully.
- Moniger attempts to create or update the linked Paystack subaccount automatically.
- A status such as `Pending verification` or `Verified` should appear.
- A Paystack subaccount code should be visible once sync succeeds.

Important note:

- Workspace users do not create Paystack subaccounts directly inside the Paystack dashboard for this flow.
- The subaccount is created from inside Moniger when payout details are saved and synced.

### 5.2 Pricing confirmation page for signed-out users

Test steps:

1. Open a valid or testable `/pricing/confirmed?reference=...` URL while signed out.
2. Observe the page content.

Expected result:

- The page shows a safe confirmation state only.
- It does not expose private workspace details such as business name or internal identifiers.

### 5.3 Public payment confirmation route

Test steps:

1. Open a payment confirmation path such as `/pay/<token>/confirmed`.
2. Repeat with a placeholder or invalid token if you do not have a real test invoice link.

Expected result:

- The route loads correctly.
- Invalid or placeholder references show a safe confirmation/error state instead of a broken route.

### 5.4 Marketplace payout-routing admin controls

Test steps:

1. As a workspace user, open `Settings -> Business`.
2. Confirm payout destination setup is available.
3. Confirm Moniger fee-rule editing is **not** shown there.
4. As platform admin, open `Admin -> Businesses`.
5. Open a workspace and then open the `Payout` tab.

Expected result:

- Workspace users can manage payout destination details only.
- Workspace users cannot edit Moniger fee rules.
- Platform admins can manage payout fee rules from the admin side.

### 5.5 Admin fee-rule sync after payout setup

Test steps:

1. As platform admin, open `Admin -> Businesses`.
2. Open the relevant workspace.
3. Open the `Payout` tab.
4. Choose the fee mode and fee value.
5. Click `Save & Sync Paystack`.
6. If the workspace payout account was changed earlier, repeat this sync step again.

Expected result:

- The admin-side fee rule saves successfully.
- The related Paystack split configuration is created or updated.
- If payout details changed earlier, the admin sync clears the `Needs re-sync` state.

## 6. What Is Not Ready For Final Client Sign-Off Yet

Please do **not** use the following as final go-live checks yet:

- true live-money Paystack invoice testing
- true live-money Paystack subscription testing
- automated vendor bank transfer behavior from the `Mark as Paid` bill action

These remain pending because Paystack live approval and live-key cutover are still outstanding.

## 7. Recommended Client Feedback Format

When reporting a test result, please include:

1. Page or feature tested
2. Account type used
3. Exact steps taken
4. Expected result
5. Actual result
6. Screenshot or screen recording if possible

Example:

```text
Feature: Customers -> Add customer
Account: Workspace owner
Steps: Added customer with business name and split address, saved, refreshed
Expected: Both fields persist
Actual: Business name saved, but City/State did not persist
```

## 8. Summary

The current release is ready for structured client UAT around:

- login and admin access
- session timeout and password reset
- customer and vendor data improvements
- bills, categories, and reconciliation
- admin operations clarity
- subscription and payment confirmation UX
- payout-routing role separation

For billing and real-money verification, wait for the Paystack live approval step before treating those flows as final production sign-off.
