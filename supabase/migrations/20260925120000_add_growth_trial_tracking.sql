begin;

alter table public.business_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used_at timestamptz;

create index if not exists idx_business_subscriptions_trial_ends
  on public.business_subscriptions (trial_ends_at)
  where trial_ends_at is not null;

commit;
