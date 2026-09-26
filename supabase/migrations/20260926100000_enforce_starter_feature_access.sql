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
      p_feature in ('dashboard', 'invoices', 'customers', 'payments')
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

drop policy if exists "business members select members" on public.business_members;
create policy "business members select members"
  on public.business_members for select to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_feature_access(business_id, 'team'));

drop policy if exists "business members insert admins" on public.business_members;
create policy "business members insert admins"
  on public.business_members for insert to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'team'));

drop policy if exists "business members update admins" on public.business_members;
create policy "business members update admins"
  on public.business_members for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'team'))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'team'));

drop policy if exists "business members delete owners" on public.business_members;
create policy "business members delete owners"
  on public.business_members for delete to authenticated
  using (public.has_business_role(business_id, array['owner']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'team'));

drop policy if exists "vendors select members" on public.vendors;
create policy "vendors select members"
  on public.vendors for select to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_feature_access(business_id, 'vendors'));

drop policy if exists "vendors mutate finance roles" on public.vendors;
create policy "vendors mutate finance roles"
  on public.vendors for all to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'vendors'))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'vendors'));

drop policy if exists "bills select members" on public.bills;
create policy "bills select members"
  on public.bills for select to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_feature_access(business_id, 'bills'));

drop policy if exists "bills mutate finance roles" on public.bills;
create policy "bills mutate finance roles"
  on public.bills for all to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'bills'))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'bills'));

drop policy if exists "audit logs select members" on public.audit_logs;
create policy "audit logs select members"
  on public.audit_logs for select to authenticated
  using (public.is_business_member(business_id) and public.has_workspace_feature_access(business_id, 'auditTrail'));

drop policy if exists "audit logs insert finance roles" on public.audit_logs;
create policy "audit logs insert finance roles"
  on public.audit_logs for insert to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'auditTrail'));

drop policy if exists "business payout accounts workspace admins" on public.business_payout_accounts;
create policy "business payout accounts workspace admins"
  on public.business_payout_accounts for all to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'marketplaceRouting'))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'marketplaceRouting'));

drop policy if exists "business payment split configs workspace admins" on public.business_payment_split_configs;
create policy "business payment split configs workspace admins"
  on public.business_payment_split_configs for all to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'marketplaceRouting'))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]) and public.has_workspace_feature_access(business_id, 'marketplaceRouting'));

commit;
