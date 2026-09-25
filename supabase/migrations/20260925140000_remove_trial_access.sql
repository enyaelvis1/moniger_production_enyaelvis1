create or replace function public.has_workspace_operational_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_subscriptions subscription
    where subscription.business_id = p_business_id
      and (
        (
          subscription.plan = 'starter'
          and subscription.status = 'active'
        )
        or
        (
          subscription.plan in ('growth', 'business')
          and subscription.status = 'active'
          and subscription.provider = 'paystack'
          and subscription.provider_subscription_id is not null
          and subscription.last_payment_reference is not null
          and (
            subscription.next_renewal_at is null
            or subscription.next_renewal_at > now()
          )
        )
      )
  );
$$;

revoke execute on function public.has_workspace_operational_access(uuid) from public, anon;
grant execute on function public.has_workspace_operational_access(uuid) to authenticated, service_role;
