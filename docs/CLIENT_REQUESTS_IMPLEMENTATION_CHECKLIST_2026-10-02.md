# Client Requests Implementation Checklist — 2026-10-02

## Purpose

This checklist turns the latest client requests into scoped implementation work, acceptance criteria, and release checks. It is a planning document; unchecked items are not claims that the capability already exists.

## Status key

- [ ] Not started
- [~] In progress or requires a product decision
- [x] Completed and verified

## Security and access prerequisites

### Super Admin accounts

- [ ] Confirm the target Supabase project/workspace for Moniger.
- [ ] Confirm whether `ralicare` and `medvethotels` are separate Supabase projects or separate businesses in the same project.
- [ ] Confirm the exact user emails to provision for each target:
  - Moniger: `admin@nimbustechllc.com`, `admin@emeraldtech.com`, `waleadmin@gmail.com`
  - Ralicare and MedVet Hotels: `admin@nimbustechllc.com`, `admin@emeraldtech.com`
- [ ] Create or recover the users through the approved admin provisioning process.
- [ ] Grant the `super_admin` role only after verifying the user identity and target project.
- [ ] Use the supplied password only through a secure password setup/reset flow; do not commit it to source control, seed files, logs, screenshots, or documentation.
- [ ] Require password change and MFA enrollment on first sign-in where supported.
- [ ] Verify that only Super Admins can perform global administration and re-enable disabled subscriptions.
- [ ] Record account creation/recovery in the admin audit log.

Acceptance criteria:

- Each confirmed account can sign in to the intended project.
- Super Admin-only screens and actions are visible only to those accounts.
- A support/admin user cannot re-enable a disabled workspace subscription.
- No plaintext passwords are stored in the repository or deployment configuration.

## 1. Invoice upload and breakdown summary

### Product decisions

- [x] Confirm whether “upload invoice” means uploading a vendor invoice document, creating an invoice from a file, or attaching supporting documents to an existing bill. The implemented slice attaches vendor invoice/supporting documents to an existing bill.
- [x] Confirm allowed file types and size limits, for example PDF, PNG, JPG, and XLSX. The implemented slice accepts PDF, JPG, PNG, and WEBP up to 10 MB.
- [x] Decide whether uploaded documents are private workspace files or can be shared with the payee. The implemented slice stores private workspace files and does not expose them through customer/vendor email.
- [x] Define whether the breakdown is entered manually, extracted from the upload, or both. The current breakdown is entered manually; extraction remains out of scope.

### Implementation

- [x] Add secure invoice/bill attachment storage with workspace-scoped access rules.
- [x] Add upload progress, file validation, replacement, and removal states. Growth/Business bill attachments show upload progress and support replacing an existing private file.
- [x] Add invoice/bill breakdown fields. Bills persist description, quantity, unit price line items and calculate subtotal, tax/charges, and total.
- [x] Show the breakdown in the invoice/bill review screen and printable/PDF output. Bill review includes line items and Print / Save PDF opens the existing print-ready export flow.
- [x] Include the breakdown summary and private attachment indicator in outgoing bill emails; private storage paths are never exposed.
- [ ] Update `Vendor → Pay bill` so the bill cannot be paid without a clear breakdown when the product rule requires one.
- [x] Add clear empty, upload-failed, unsupported-file, and over-limit states.
- [x] Add audit events for upload, replacement, removal, and payment actions.
- [x] Add automated authorization-contract tests covering workspace membership, paid attachment access, and bill-item workspace binding.

Implementation note: the attachment flow supports private PDF/JPG/PNG/WEBP files up to 10 MB for active Growth and Business workspaces, including visible upload progress and replacement. Starter users see an upgrade explanation and cannot upload.

Test handoff:

1. On an active Growth or Business workspace, open **Bills**, create and save a bill, then reopen it.
2. Select **Attach file** and upload a PDF or image smaller than 10 MB.
3. Confirm the file appears in the bill, can be opened through a temporary signed URL, and can be removed.
4. Try a `.txt` file and a file larger than 10 MB; confirm the upload is rejected with a clear message.
5. Repeat as Starter and confirm the attachment control is unavailable and the upgrade explanation is shown.
6. Verify a user from another workspace cannot list, open, or delete the attachment.
7. On Growth/Business, open a saved bill, add two line items, and confirm subtotal plus tax/charges produces the expected total.
8. Open the saved bill, choose **Print / Save PDF**, and confirm the print view contains vendor, line items, quantities, unit prices, subtotal, tax/charges, and total.
9. Add a vendor email, choose **Send bill email**, and confirm the email contains the breakdown in HTML and plain text plus the attachment indicator without a private storage URL.
10. Replace the attachment and confirm the audit trail contains upload and removal events for the bill attachment.

Acceptance criteria:

- A user can upload a supported vendor invoice and see it in the bill review flow.
- The recipient can understand the bill total from the breakdown without opening the uploaded file.
- The email contains the intended summary and secure access behavior.
- Payment does not expose private files to unauthorized users.
- Uploads and breakdown changes remain auditable.

## 2. Payment instructions in invoice emails

- [x] Define the first payment method as the secure public Moniger payment link; bank-transfer instructions remain a separate decision.
- [x] Add a prominent “Pay invoice securely” button/link to invoice emails.
- [x] Link only to the Moniger public invoice payment route generated from the invoice token; do not construct links from the request `Origin` header.
- [x] Include invoice number, customer name, amount due, due date, payment status, and a short payment-safety note.
- [x] Ensure the link opens the public payment page without exposing workspace-private data.
- [x] Add a fallback plain-text URL for email clients that remove buttons.
- [x] Add receipt/confirmation wording after successful payment. Successful invoice payments already trigger a branded receipt email with invoice number, amount, paid date, reference, and a PDF receipt attachment; the public confirmation page also shows the payment result.
- [x] Test HTML and plain-text bill email rendering and attachment indicators; live provider delivery remains environment-gated.
- [x] Preserve invalid/expired/already-paid/cancelled/invalid invoice-link coverage through public confirmation and payment-link tests; live-provider cases remain environment-gated.

Implementation note: sending an invoice automatically enables its existing public payment link before delivery, so the customer never receives an unusable payment URL.

Test handoff:

1. Use an active Growth or Business workspace and create a draft invoice with a customer email.
2. Send the invoice from `Invoices -> Review and send`.
3. Confirm the delivery succeeds and inspect the email. The primary button and plain-text URL should use `/pay/<token>`, not `/invoices`.
4. Confirm the email summary includes the customer name, invoice number, amount, issue/due dates, payment status, secure-payment instructions, and the payment-safety note.
5. Open the link in a signed-out/private browser window and confirm the invoice details and Paystack payment action are shown.
6. Confirm the invoice record now has its payment link enabled. Opening the link alone must not mark the invoice paid.

Acceptance criteria:

- A customer can click from the email directly to the correct invoice payment page.
- The payment page shows the correct invoice and amount before checkout.
- The webhook remains the source of truth for settlement; opening the link alone never marks an invoice paid.

## 3. Subscriber bank account information

Clarification: this refers to the workspace/subscriber payout destination used for incoming customer payments and marketplace routing, not an outgoing vendor payout wallet.

- [x] Confirm which bank details a subscriber must provide: bank, account name, account number, and verification status.
- [x] Confirm whether one primary account or multiple accounts are allowed. The current routing foundation supports one workspace payout destination.
- [x] Add or confirm owner/admin-only settings access for the subscriber bank account.
- [x] Validate account number length and bank selection through the supported provider flow.
- [x] Verify the account before enabling routing to it.
- [x] Show verification status, last updated time, and masked account details.
- [x] Require re-verification when the bank account or account name changes.
- [x] Prevent ordinary workspace members from viewing or changing sensitive bank details.
- [x] Add audit events for create, update, verification, and removal.

Implementation note: the existing Marketplace Routing settings already provide the subscriber bank-account foundation. Final live-provider verification and production UAT remain release checks.

Acceptance criteria:

- A verified subscriber account can be selected as the workspace’s incoming-payment destination.
- Unverified or incomplete bank details cannot be used for routing.
- Sensitive account numbers are masked in the UI and excluded from non-admin logs.

## 4. Optional customer and vendor bank information

- [~] Confirm whether customer bank information is for receiving refunds, receiving payouts, or only record-keeping. Implemented conservatively as optional record-keeping only until the business purpose is confirmed; no payout or refund flow uses it.
- [x] Confirm whether vendor bank information is for outgoing payouts; current payout flows require provider-compatible recipient details. Vendor records already support optional bank, account name, and account number fields.
- [x] Add optional bank fields without making them mandatory for ordinary customer/vendor creation. Vendor and customer fields are optional.
- [x] Reuse the shared bank directory and provider bank-code mapping for vendor records.
- [x] Validate account number format and required account-name fields when bank details are provided.
- [x] Add masking, least-privilege RLS, audit logging, and secure update/delete behavior for customer bank details.
- [x] Make bank details visible only to authorized workspace roles. Customer bank records are restricted to owner/admin/accountant roles.
- [x] Add customer CSV template columns and import validation for optional bank details. Customer account numbers are masked in exports; imports require a full 10–20 digit account number.
- [x] Add export redaction rules so sensitive vendor account numbers are masked by default. Import templates retain an example format, while downloaded records export only the final four digits.

Acceptance criteria:

- A customer or vendor can be saved without bank details.
- A record with bank details cannot be saved until the provided details pass validation.
- Authorized users can edit/remove details, while unauthorized users cannot read them.
- Any real payout use is clearly separated from internal bill bookkeeping and remains provider-settled.

## 5. Prime Healthcare design draft — deferred

Deferred per client instruction. No Prime Healthcare design work is included in the current release.

### Discovery before design

- [ ] Confirm whether Prime Healthcare needs a Moniger workspace, a marketing website, or a separate healthcare product/interface.
- [ ] Collect logo, colors, typography, preferred imagery, content, and reference websites.
- [ ] Confirm the first screen set: landing page, dashboard, patient/provider directory, billing, reports, or another scope.
- [ ] Confirm target users and the primary workflow to demonstrate.
- [ ] Confirm whether the requested draft is a clickable prototype, static visual direction, or implemented frontend.

### Draft deliverable

- [ ] Prepare a one-page design brief with audience, goals, brand direction, sitemap, and key flows.
- [ ] Produce an initial visual direction with desktop and mobile states.
- [ ] Review the draft with the client before implementation.
- [ ] Capture approved design decisions and open questions.
- [ ] Estimate implementation effort only after the design scope is approved.

## Cross-cutting verification and release

- [x] Add or update database migrations and apply them to the linked Supabase project when approved. The bill-attachment migration has been applied to the linked project.
- [x] Deploy changed Edge Functions after Supabase permissions are available. `workspace-email-delivery` has been deployed.
- [~] Run targeted unit and integration tests for storage, email, payment links, bank validation, and authorization. Payment/subscription tests pass; storage and email-template coverage remains pending.
- [x] Run `npm run lint`.
- [~] Run `npm run test`. The targeted suite passes; the full suite remains pending.
- [x] Run `npm run build`.
- [x] Run `npm run verify:release:security` for link-generation, headers, and secret checks.
- [ ] Complete a signed-in workspace UAT pass for Starter, Growth, and Business entitlements.
- [ ] Complete a public invoice-payment UAT pass from email link through webhook settlement.
- [ ] Complete a cross-workspace authorization and storage-isolation test.
- [x] Update the implementation source of truth and client UAT guide. A release note is still pending the integration/release decision.
- [ ] Merge feature work into `develop`, verify there, then release approved changes into `main`.

## Open decisions required from the client

- [ ] Confirm the project/workspace targets for the requested Super Admin accounts.
- [x] Confirm the exact meaning of invoice upload and whether files may be shared with recipients.
- [ ] Confirm payment methods and bank-transfer wording for invoice emails.
- [~] Confirm the purpose of optional customer bank details. Current implementation is record-keeping only; refunds and payouts are not connected.
- [~] Provide Prime Healthcare brand assets and the preferred design deliverable format. Deferred per client instruction.
