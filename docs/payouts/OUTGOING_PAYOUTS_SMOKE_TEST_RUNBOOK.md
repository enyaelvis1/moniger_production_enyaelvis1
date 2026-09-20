# Outgoing Payouts Smoke Test Runbook

Last updated: 2026-05-29

This runbook is the short verification path to use after each non-trivial payout implementation.

## Before You Start

- Confirm the workspace has funding available.
- Confirm the vendor bank has a valid bank code.
- Confirm the funding page, bills page, and admin payout pages load without errors.
- Use an owner or admin account when testing approval or funding flows.

## After Every Implementation

1. Run `npm run build`.
2. Re-open the affected page in the browser.
3. Trigger the narrowest relevant action for the change.
4. Confirm the UI message matches the expected business rule.
5. Confirm the Funding page and admin audit history reflect the action.

## Phase 5 Smoke Tests

- **Below-threshold payout**
  - Create or open a bill whose payout amount is below the configured approval threshold.
  - Click `Pay now`.
  - Confirm the payout proceeds without requiring approval.
  - Confirm the payout is visible in Funding history and audit logs.

- **Above-threshold payout**
  - Create or open a bill whose payout amount is above the configured approval threshold.
  - Click `Pay now` or `Schedule Payment`.
  - Confirm the payout lands in `Awaiting approval`.
  - Approve it from Funding as an owner or admin.
  - Confirm the transfer continues or submits as expected.

- **Unauthorized approval**
  - Sign in as a non-owner/non-admin workspace member.
  - Open a payout that is waiting for approval.
  - Confirm the `Approve` action is hidden or blocked.

- **Approval audit trail**
  - Approve a pending payout.
  - Open Admin Support Lookup or the payout audit trail.
  - Confirm the approval event is recorded with the right workspace and payout reference.

## Phase 6 Smoke Tests

- **Successful payout**
  - Fund the workspace.
  - Pay a bill through `Pay now`.
  - Confirm the funding reserve decreases and the payout settles.
  - Confirm the bill/payment records update correctly.

- **Failed payout**
  - Trigger a payout failure path.
  - Confirm reserved funds are released back to the funding balance.
  - Confirm the payout shows a failure reason and the linked records reconcile.

- **Webhook replay**
  - Re-send the same transfer webhook event.
  - Confirm the second delivery does not double-count or double-settle anything.

- **Reporting totals**
  - Open the admin payout reporting view.
  - Confirm the totals match the workspace funding ledger and payout history for the workspace.

## Expected Signals

- Funding balance changes only after verified funding or settled payout outcomes.
- Approval-required payouts show a distinct `Awaiting approval` state.
- Failed payouts release reserved funds.
- Audit logs capture creation, approval, submission, cancellation, retry, completion, failure, and reversal events.
