begin;

create or replace function public.has_workspace_feature_access(
  p_business_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_operational_access(p_business_id)
    and (
      p_feature in ('dashboard', 'invoices', 'customers', 'payments', 'vendors', 'marketplaceRouting')
      or exists (
        select 1
        from public.business_subscriptions subscription
        where subscription.business_id = p_business_id
          and subscription.plan in ('growth', 'business')
          and subscription.status in ('active', 'trial')
      )
    );
$$;

revoke all on function public.has_workspace_feature_access(uuid, text) from public;
grant execute on function public.has_workspace_feature_access(uuid, text) to authenticated, service_role;

drop policy if exists "business payout accounts workspace admins" on public.business_payout_accounts;
create policy "business payout accounts workspace admins"
  on public.business_payout_accounts for all to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'marketplaceRouting')
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'marketplaceRouting')
  );

-- Workspace admins can inspect routing configuration, but platform admins alone
-- can create or change Moniger fee rules.
drop policy if exists "business payment split configs workspace admins" on public.business_payment_split_configs;
create policy "business payment split configs workspace admins read"
  on public.business_payment_split_configs for select to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'marketplaceRouting')
  );

commit;
