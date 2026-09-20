# Client Outgoing Payouts Test Instructions

This guide helps you test the full outgoing payout flow from both the workspace side and the platform owner/admin side.

## What To Test

### 1) Admin setup checks

- Open the admin console as a platform owner or admin.
- Go to `Businesses -> Payout`.
- Confirm you can set a payout approval threshold.
- Confirm you can set payout limits.
- Confirm you can freeze and unfreeze payouts for a workspace.
- Open `Banks` and confirm vendor bank codes can be reviewed and updated.
- Open `Payouts` and confirm you can see payout reporting and export history.
- Open `Support Lookup` and confirm you can look up a payout by reference or transfer code.

### 2) Workspace funding

- Open `Funding` from the sidebar.
- Confirm you can see `Total funded`, `Reserved`, and `Available`.
- Click `Fund workspace`.
- Start a low-value top-up.
- Confirm the workspace funding balance updates only after the payment is verified.

### 3) Pay a bill now

- Open `Bills`.
- Choose a bill that is ready for payment.
- Click `Pay now`.
- Confirm the bill shows the correct payout state in `Funding` history.
- Confirm the outgoing payout appears in the payout history.

### 4) Schedule a payment

- Open a bill with a due date.
- Click `Schedule Payment`.
- Pick a future date and time.
- Confirm the payout is scheduled and visible in `Funding`.
- Confirm you can cancel or reschedule it before execution.

### 5) Approval flow

- Ask an admin to set an approval threshold in `Admin -> Businesses -> Payout`.
- Create a payout above the threshold.
- Confirm it lands in `Awaiting approval`.
- Approve it with an owner or admin account.
- Confirm the payout continues and settles normally.

### 6) Limits and holds

- Ask an admin to set payout limits or freeze payouts.
- Try to start a payout that violates the configured limit.
- Confirm the UI explains why it is blocked.
- Unfreeze payouts and try again.

### 7) History and export

- Open `Funding`.
- Confirm you can see funding history and outgoing payout history.
- Export the funding history CSV.
- Confirm the file downloads and includes the expected entries.

## What Success Looks Like

- Workspace funding only increases after verified success.
- Payouts appear in history with clear status labels.
- Admin controls can configure thresholds, limits, and freeze state for a workspace.
- Support/admin tools can look up payout records and export payout reporting.
- Approval-required payouts are blocked until approved.
- Scheduled payouts can be cancelled or rescheduled before execution.
- Limits and freeze controls stop payout requests when configured.
- The CSV export matches the visible workspace funding activity.

## What To Send Back

- A screenshot or note for each step that passes.
- Any error message you see.
- The bill number, payout amount, and reference if something fails.

## Tip

Use low-value test amounts first so you can confirm the flow safely before running a larger real-money check.
