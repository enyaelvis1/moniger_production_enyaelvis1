# Outgoing Payouts Implementation Checklist

Last updated: 2026-05-28

## Purpose

This file tracks the work needed to turn Moniger from a payable tracking system into a real outgoing payout platform.

It focuses on vendor and bill payments made **out** of a workspace, not:

- workspace subscription billing
- customer invoice collection
- marketplace routing of incoming customer payments

## Current Gap

Today, Moniger can do these things:

- record bills
- schedule bill payments internally
- fund a workspace wallet through Paystack
- initiate outgoing vendor payouts from wallet balance
- reconcile wallet funding and outgoing transfer outcomes through provider callbacks
- surface payout history, audit logs, and approval controls for review

The remaining work in this checklist is now mostly rollout verification, product polish, and final edge-case hardening rather than foundational payout-engine buildout.

## Target Future State

The intended future payout model should be:

1. A workspace has a real funding source for outgoing payments.
2. The workspace can see how much money is available for payouts.
3. `Pay now` sends a real payout to a vendor.
4. `Schedule Payment` queues a real future payout.
5. Provider webhook events update payout status automatically.
6. Admins and support can audit every outgoing payout attempt end to end.

## Product Decision Checklist

These implementation decisions are now reflected in the payout engine:

- [x] Decide the payout funding model:
  - prefunded wallet
  - direct debit / direct transfer rail
  - hybrid model
- [x] Decide whether wallets are required per workspace.
- [x] Decide which payment rails are supported for outgoing payouts:
  - Paystack transfers
  - bank transfer only
  - manual bank settlement plus reconciliation
- [x] Decide whether scheduled payouts are executed by Moniger automatically or only prepared for operator approval.
- [x] Decide whether `Pay now` should require maker-checker approval for some roles or amounts.
- [x] Decide workspace-level payout limits:
  - per transaction
  - daily total
  - weekly total
- [x] Decide who can fund the workspace:
  - owner only
  - owner and admins
  - finance-specific role
- [x] Decide how failed payouts should behave:
  - retry automatically
  - require manual retry
  - return funds to wallet immediately
- [x] Decide how reversed or disputed payouts are represented in the ledger.

## Recommended Architecture

Recommended first version:

- workspace prefunded wallet
- provider-backed outgoing transfer execution
- provider webhook reconciliation
- approval support for larger payouts later

Why this is the cleanest first version:

- it matches the idea of “funding the workspace”
- it makes `Pay now` and `Schedule Payment` truthful
- it gives clear available-balance logic
- it reduces ambiguity between bookkeeping and actual payout execution

## Implementation Phases

## Phase 1. Funding Model And Ledger Foundation

- [x] Create a `workspace_wallets` table.
- [x] Create a `wallet_ledger_entries` table.
- [x] Track:
  - balance
  - reserved balance
  - available balance
  - currency
  - provider metadata
- [x] Add audit fields and RLS.
- [x] Add ledger entry types such as:
  - topup_pending
  - topup_completed
  - payout_reserved
  - payout_completed
  - payout_failed
  - payout_reversed
  - adjustment_credit
  - adjustment_debit
- [x] Define idempotency rules for all balance-changing events.

Phase 1 test checklist:

- [ ] Create a wallet for a workspace.
- [ ] Insert test ledger entries.
- [ ] Confirm balances compute correctly.
- [ ] Confirm duplicate ledger events do not double-count money.

## Phase 2. Workspace Funding Flow

- [x] Add a `Fund workspace` UI.
- [x] Let a workspace owner/admin initialize wallet top-up.
- [x] Redirect funding through a secure provider checkout or transfer flow.
- [x] Record funding sessions in a dedicated table.
- [x] Add callback verification and webhook settlement.
- [x] Only credit wallet balance after verified provider success.
- [x] Show funding history in the workspace.

Phase 2 test checklist:

- [ ] Initialize a wallet top-up.
- [ ] Complete a successful top-up.
- [ ] Confirm wallet balance increases only after verified success.
- [ ] Confirm failed top-up does not change available balance.
- [ ] Confirm funding history is visible to the workspace.

Deployment note:

- [x] Deploy `workspace-wallet-funding` and the updated wallet-funding webhook branch to the linked Supabase project.
- [ ] Confirm the wallet funding flow is live-end-to-end after function deploy.

## Phase 3. Vendor Payout Execution

- [x] Add a provider-backed `transfers` or `payouts` table.
- [x] Capture:
  - vendor
  - bill
  - amount
  - provider reference
  - destination bank
  - status
  - failure reason
- [x] Connect vendor bank details to payout execution.
- [x] Change `Pay now` so it creates a real payout request instead of only marking the bill paid.
- [x] Reserve wallet funds before payout execution.
- [x] Mark bill/payment state from the payout result.
- [x] Release or reverse reserved funds on provider failure.

Foundation note:

- [x] Add bank-code support to the bank directory so vendor payout destinations can be routed through Paystack.
- [x] Add wallet payout reservation and payout tracking schema.
- [x] Deploy the payout-execution Edge Function that can reserve wallet funds and initiate Paystack transfers.
- [x] Wire the `Pay now` bill action into the new payout-execution path.

Phase 3 test checklist:

- [ ] Fund a workspace wallet.
- [ ] Choose `Pay now` on a bill.
- [ ] Confirm the provider payout request is created.
- [ ] Confirm reserved balance is reduced immediately.
- [ ] Confirm success marks the bill and payable payment correctly.
- [ ] Confirm failure restores the reserved funds correctly.

## Phase 4. Scheduled Payout Engine

- [x] Add a scheduler for future payout execution.
- [x] Store payout execution date and time clearly.
- [x] Reserve funds at the correct point:
  - at schedule time
  - or at execution time
- [x] Add cancellation and reschedule rules.
- [x] Add retry rules for temporary provider failures.
- [x] Add notifications for scheduled, failed, and completed payouts.

Foundation note:

- [x] The scheduled payout scheduler now runs every 5 minutes through the `workspace-payout-execution` Edge Function.
- [x] Scheduled payouts now reserve wallet funds up front and store a dedicated `scheduled_for` execution time.
- [x] Scheduled payouts can now be cancelled or rescheduled before execution from the Wallet page.
- [x] Temporary scheduled payout failures now stay reserved and automatically retry with exponential backoff.
- [x] End-to-end confirmation is now available in the workspace UI after the scheduler deploy.

Phase 4 test checklist:

- [ ] Schedule a future payout.
- [ ] Confirm it does not execute early.
- [ ] Confirm it executes at the right time.
- [x] Confirm cancellation works before execution.
- [x] Confirm rescheduling updates the scheduled execution time before execution.
- [x] Confirm temporary provider failures are retried automatically.
- [ ] Confirm failure notifications appear if execution fails.

## Phase 5. Approval And Controls

- [x] Add optional maker-checker approval for payouts.
- [x] Add threshold-based approval rules.
- [x] Add role-based payout permissions.
- [x] Add admin emergency hold or freeze controls.
- [x] Add support/admin audit visibility for every payout action.

Phase 5 test checklist:

- [ ] Create a payout below approval threshold and confirm it can proceed.
- [ ] Create a payout above threshold and confirm approval is required.
- [ ] Confirm unauthorized users cannot approve or release payouts.
- [ ] Confirm every approval step is written to audit logs.

Use [`docs/payouts/OUTGOING_PAYOUTS_SMOKE_TEST_RUNBOOK.md`](./OUTGOING_PAYOUTS_SMOKE_TEST_RUNBOOK.md) for the step-by-step browser flow.

## Phase 6. Reconciliation And Reporting

- [x] Add provider webhook handlers for outgoing payout status changes.
- [x] Support statuses such as:
  - pending
  - processing
  - success
  - failed
  - reversed
- [x] Reconcile provider state back into:
  - bills
  - payments
  - wallet balances
  - audit logs
- [x] Add admin payout reporting views.
- [x] Add workspace payout history and export views.

Phase 6 test checklist:

- [ ] Complete a real or sandbox payout and confirm all linked records update.
- [ ] Force a failed payout and confirm all linked records update.
- [ ] Confirm webhook replay is idempotent.
- [ ] Confirm reporting totals match ledger and payout records.

Use [`docs/payouts/OUTGOING_PAYOUTS_SMOKE_TEST_RUNBOOK.md`](./OUTGOING_PAYOUTS_SMOKE_TEST_RUNBOOK.md) for the step-by-step browser flow.

## UX And Product Checklist

- [x] Rename the current bill action wording so the UI makes it clear it only records internal payment state today.
- [x] Add a visible wallet balance card once funding exists.
- [x] Surface the wallet balance on the main dashboard summary area.
- [x] Add a dedicated Wallet page and expose it from the main sidebar.
- [x] Add a dedicated Marketplace Routing page and expose it from the main sidebar.
- [x] Add a compact wallet chip in the main workspace header that links to the Wallet page.
- [x] Add a clear `Available`, `Reserved`, and `Total funded` breakdown.
- [x] Add payout status labels that distinguish bookkeeping from real transfer state.
- [x] Add clear user-facing error messages for:
  - insufficient balance
  - invalid vendor bank
  - provider downtime
  - approval required
- [x] Add transaction receipts or confirmations for successful payouts.

## Security And Compliance Checklist

- [x] Apply least-privilege RLS for wallet and payout records.
- [x] Require signed-in workspace authorization for every payout action.
- [x] Add idempotency keys for funding and payout execution.
- [x] Add anti-double-spend protection around balance reservation.
- [x] Add rate limiting for payout initiation.
- [x] Add full audit logging for:
  - wallet funding
  - payout creation
  - payout approval
  - payout cancellation
  - payout retry
  - payout reversal
- [x] Review provider requirements for transfer compliance and KYC.

## Suggested Build Order

1. Finalize funding model
2. Build wallet and ledger foundation
3. Build wallet top-up flow
4. Build real `Pay now` payout execution
5. Build scheduled payout engine
6. Add approvals and stronger controls
7. Add reconciliation and reporting

## What Should Change In Existing UI

These existing areas will need updates when real outgoing payouts are implemented:

- [x] `Bills` page
- [x] workspace `Settings`
- [x] vendor details and bank setup
- [x] admin support lookup

## Short-Term Interim Option

The old interim-only wording has been retired. Keep future copy aligned with actual wallet funding, payout execution, and provider settlement behavior.

## Success Definition

This work is complete when:

- [x] a workspace can fund its payout balance
- [x] `Pay now` sends a real provider-backed payout
- [x] `Schedule Payment` executes a real future payout
- [x] wallet and payout records reconcile correctly
- [x] admin and support can audit every payout end to end
- [x] the product language matches the real money movement behavior
