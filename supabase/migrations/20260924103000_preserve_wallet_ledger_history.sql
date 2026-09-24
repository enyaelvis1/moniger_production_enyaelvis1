-- Wallet ledger entries are financial history. A wallet must not be deleted
-- while ledger entries still reference it, even when the wallet's business is
-- removed. Replace the earlier single-column/composite CASCADE references with
-- one workspace-aware RESTRICT constraint.
begin;

alter table public.wallet_ledger_entries
  drop constraint if exists wallet_ledger_entries_wallet_id_fkey,
  drop constraint if exists wallet_ledger_entries_wallet_business_fkey;

alter table public.wallet_ledger_entries
  add constraint wallet_ledger_entries_wallet_business_fkey
  foreign key (wallet_id, business_id)
  references public.workspace_wallets (id, business_id)
  on delete restrict;

commit;
