begin;

alter table public.business_subscriptions
  add column if not exists provider_plan_code text,
  add column if not exists provider_email_token text,
  add column if not exists last_payment_reference text;

create unique index if not exists idx_business_subscriptions_provider_subscription_id
  on public.business_subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists idx_business_subscriptions_provider_plan_code
  on public.business_subscriptions (business_id, provider_plan_code)
  where provider_plan_code is not null;

create table if not exists public.subscription_checkout_sessions (
  reference text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,
  plan text not null check (plan in ('starter', 'growth', 'business')),
  billing_cycle text not null check (billing_cycle in ('free', 'monthly', 'annual', 'manual')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  provider_plan_code text,
  payer_email text not null,
  payer_name text,
  checkout_url text,
  status text not null default 'initialized' check (status in ('initialized', 'completed', 'failed', 'cancelled', 'expired')),
  provider_customer_id text,
  provider_subscription_id text,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscription_checkout_sessions_business_id_created_at
  on public.subscription_checkout_sessions (business_id, created_at desc);

create index if not exists idx_subscription_checkout_sessions_provider_subscription_id
  on public.subscription_checkout_sessions (provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.subscription_checkout_sessions enable row level security;

drop trigger if exists set_subscription_checkout_sessions_updated_at on public.subscription_checkout_sessions;
create trigger set_subscription_checkout_sessions_updated_at
  before update on public.subscription_checkout_sessions
  for each row
  execute function public.set_updated_at();

commit;
