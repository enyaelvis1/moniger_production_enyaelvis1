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
      p_feature in ('dashboard', 'invoices', 'customers', 'payments', 'vendors')
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

commit;
