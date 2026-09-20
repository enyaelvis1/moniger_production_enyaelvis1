begin;

create table if not exists public.business_subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'business')),
  status text not null default 'active' check (status in ('active', 'trial', 'past_due', 'paused', 'cancelled')),
  billing_cycle text not null default 'free' check (billing_cycle in ('free', 'monthly', 'annual', 'manual')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  next_renewal_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  started_at timestamptz not null default now(),
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_business_subscriptions_status_next_renewal
  on public.business_subscriptions (status, next_renewal_at);

alter table public.business_subscriptions enable row level security;

drop policy if exists "business subscriptions admin access" on public.business_subscriptions;
create policy "business subscriptions admin access"
  on public.business_subscriptions
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop trigger if exists set_business_subscriptions_updated_at on public.business_subscriptions;
create trigger set_business_subscriptions_updated_at
  before update on public.business_subscriptions
  for each row
  execute function public.set_updated_at();

insert into public.business_subscriptions (
  amount,
  billing_cycle,
  business_id,
  currency,
  next_renewal_at,
  plan,
  provider,
  started_at,
  status
)
select
  case coalesce(bao.plan, 'starter')
    when 'growth' then 29000
    when 'business' then 89000
    else 0
  end as amount,
  case coalesce(bao.plan, 'starter')
    when 'starter' then 'free'
    else 'monthly'
  end as billing_cycle,
  b.id as business_id,
  b.default_currency as currency,
  case coalesce(bao.plan, 'starter')
    when 'starter' then null
    else b.created_at + interval '30 days'
  end as next_renewal_at,
  coalesce(bao.plan, 'starter') as plan,
  'manual' as provider,
  b.created_at as started_at,
  case
    when coalesce(bao.status, 'active') = 'suspended' then 'paused'
    else 'active'
  end as status
from public.businesses b
left join public.business_admin_overrides bao on bao.business_id = b.id
on conflict (business_id) do nothing;

insert into public.platform_config (key, value)
values (
  'billing_catalog',
  jsonb_build_object(
    'starter', jsonb_build_object('amount', 0, 'billing_cycle', 'free', 'currency', 'NGN'),
    'growth', jsonb_build_object('amount', 29000, 'billing_cycle', 'monthly', 'currency', 'NGN'),
    'business', jsonb_build_object('amount', 89000, 'billing_cycle', 'monthly', 'currency', 'NGN')
  )
)
on conflict (key) do nothing;

commit;
