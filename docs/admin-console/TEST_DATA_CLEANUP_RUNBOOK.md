# Test Data Cleanup Runbook

Use this runbook only for records created in an explicitly labelled QA or sandbox environment. The cleanup action is destructive, super-admin-only, and must never be used as a general financial-record deletion tool.

## Qualification rules

A record is eligible only when it has an explicit test marker:

- `is_test_data = true`, or
- `metadata.test_data = true` / `provider_metadata.test_data = true`, or
- its environment/provider mode is `test` or `sandbox`.

Paystack payment records also need explicit `metadata.provider_mode` or `metadata.environment` set to `test` or `sandbox`. A generic test flag does not prove that a provider settlement is safe to remove.

Payments linked to an invoice or bill are blocked because the related financial document and its reconciliation history must remain intact. Payouts are eligible only in `failed`, `reversed`, or `cancelled` states. Active, submitted, completed, and settled records are blocked.

## Safe operator sequence

1. Confirm the target environment is QA or sandbox and record the operator, date, and reason.
2. In Admin → Settings → Danger Zone, choose Payments, Payouts, or All.
3. Run **Preview eligible records** and review eligible and blocked counts.
4. Confirm that no live provider settlement, invoice, bill, wallet ledger entry, webhook record, receipt, or audit record is in the deletion set.
5. Export a platform snapshot if the cleanup is material or the records may be needed for investigation.
6. Enter a reason of at least 10 characters and type `DELETE TEST DATA` exactly.
7. Execute the cleanup once. Do not retry blindly if the result is unclear.
8. Confirm the result counts and review the generated deletion manifest and audit event.
9. Re-run Preview and verify the deleted IDs no longer appear while blocked records remain.

## User cleanup

For test users, first filter Admin → Settings → Admin Users by the explicit test-user marker. Confirm the user does not own a workspace, export any required evidence, revoke active access, and use the destructive delete action only when retention and audit requirements allow it. Never delete a production user to remove test financial data.

## Recovery and escalation

The current financial cleanup action is destructive; the deletion manifest preserves IDs, counts, blocked records, reason, actor, and outcome but does not restore rows. If a live or linked record is suspected to have been removed, stop further cleanup, preserve the manifest ID, notify the platform owner, and restore from the approved database backup/recovery process.
