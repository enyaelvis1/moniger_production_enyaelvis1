# Bank Code Backfill Runbook

The bank-directory migration `20261111120000_seed_paystack_nigerian_banks.sql` adds a dated snapshot of the Paystack Nigerian NGN bank list. It adds one canonical row per distinct provider code and leaves existing admin-managed rows intact. Applied to the linked project on 2026-11-11. Verification found 303 active rows in total and all 292 distinct provider codes; the five additional provider names that share codes are included as searchable display aliases. Eleven legacy rows remain without verified codes and cannot be selected for payouts.

Bank selectors use a searchable picker. Payout selectors keep active banks visible but disable any bank without a verified provider code. Customer bank records remain optional record-keeping data. The pinned catalog currently supplies institution-specific logos for 279 of the 303 active directory entries; the other 24 show its generic bank mark. Logos are trademarks of their respective institutions.

The production bank directory currently contains rows without Paystack bank codes. The backfill script is read-only by default and only proposes a unique literal-name match, an exact alias explicitly written in the provider's parentheses, or a unique normalized-name match against Paystack's active Nigerian NGN bank directory. Literal full-name matches take priority. It skips fuzzy matches, ambiguous names, non-Nigerian rows, and provider codes already assigned to another directory row.

## Prerequisites

Use a trusted operator environment and provide these values through exported environment variables or a protected local env file that is not committed:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`

Never paste the keys into a ticket, terminal transcript, or chat. The service role key grants broad database access.

## Preview

Run without `--apply` first:

```bash
npm run backfill:bank-codes
```

If using a protected env file instead of exported variables, invoke Node directly:

```bash
node --env-file=.env.bank-backfill scripts/backfill-bank-codes.mjs
```

Review every `MATCH` and `REVIEW` row. The script does not write data in this mode. Investigate skipped rows manually; do not replace exact matching with substring/fuzzy matching for financial routing data.

## Apply reviewed matches

Only after reviewing the preview, run:

```bash
npm run backfill:bank-codes -- --apply
```

With a protected env file, use `node --env-file=.env.bank-backfill scripts/backfill-bank-codes.mjs --apply`.

The script prints the Supabase host and update count, then requires the exact typed phrase `APPLY <count> BANK CODE UPDATES`. It updates only records that still have a null or empty bank code, never overwrites an existing code, and verifies each updated row. Stop if the host is not the intended project.

## After the run

- Re-run the preview; no updateable exact matches should remain.
- The 2026-11-11 production preview leaves these 11 banks unresolved: AB Microfinance Bank, Bayport MFB, FBN Microfinance, Fortis Microfinance Bank, GTBank Microfinance, Heritage Bank, Heritage Microfinance Bank, LAPO Microfinance Bank, Skye Microfinance Bank, Sunrise Microfinance Bank, and Titan Trust Bank. No exact supported Paystack NGN match was found; do not guess codes.
- Review every remaining `REVIEW` result with the bank/provider owner before adding a code.
- Validate representative bank codes through Paystack account resolution in a safe test flow before enabling live payouts to those banks.
- Keep `admin-backfill-bank-codes` available only while the untracked deployed copy is being replaced. Once the checked-in runbook/script is the approved process and missing codes are resolved, review its secret and remove the remote-only function through a separately recorded change.
