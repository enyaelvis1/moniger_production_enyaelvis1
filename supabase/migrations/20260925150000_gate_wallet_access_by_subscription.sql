begin;

drop policy if exists "workspace wallets select members" on public.workspace_wallets;
create policy "workspace wallets select members"
  on public.workspace_wallets
  for select
  to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));

drop policy if exists "workspace wallets mutate finance roles" on public.workspace_wallets;
create policy "workspace wallets mutate finance roles"
  on public.workspace_wallets
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "wallet ledger entries select members" on public.wallet_ledger_entries;
create policy "wallet ledger entries select members"
  on public.wallet_ledger_entries
  for select
  to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));

drop policy if exists "wallet ledger entries insert finance roles" on public.wallet_ledger_entries;
create policy "wallet ledger entries insert finance roles"
  on public.wallet_ledger_entries
  for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_operational_access(business_id)
    and exists (
      select 1
      from public.workspace_wallets wallet
      where wallet.id = wallet_id
        and wallet.business_id = business_id
    )
  );

drop policy if exists "wallet funding sessions select members" on public.workspace_wallet_funding_sessions;
create policy "wallet funding sessions select members"
  on public.workspace_wallet_funding_sessions
  for select
  to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));

drop policy if exists "workspace payouts select members" on public.workspace_payouts;
create policy "workspace payouts select members"
  on public.workspace_payouts
  for select
  to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));

drop policy if exists "workspace payouts mutate finance roles" on public.workspace_payouts;
create policy "workspace payouts mutate finance roles"
  on public.workspace_payouts
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

commit;
