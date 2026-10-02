begin;

-- Wallet balances, ledger history, and payout state are server-owned financial
-- state. Authenticated clients may read authorized rows, but must use the
-- validated funding/payout functions for every mutation.
revoke insert, update, delete on table public.workspace_wallets from authenticated;
revoke insert, update, delete on table public.wallet_ledger_entries from authenticated;
revoke insert, update, delete on table public.workspace_payouts from authenticated;

drop policy if exists "wallet ledger entries insert finance roles" on public.wallet_ledger_entries;
drop policy if exists "workspace wallets mutate finance roles" on public.workspace_wallets;
drop policy if exists "workspace payouts mutate finance roles" on public.workspace_payouts;

commit;
