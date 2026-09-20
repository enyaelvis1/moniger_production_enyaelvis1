begin;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  subject text not null,
  message text not null,
  requester_ip_hash text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_contact_messages_ip_created_at
  on public.contact_messages (requester_ip_hash, created_at desc);

create table if not exists public.signup_alert_events (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  business_name text,
  plan text not null check (plan in ('starter', 'growth', 'business')),
  signup_status text not null default 'created' check (signup_status in ('created', 'email_confirmation_pending', 'active')),
  environment text not null default 'production',
  provider_reference text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (auth_user_id, plan)
);

create index if not exists idx_signup_alert_events_created_at
  on public.signup_alert_events (created_at desc);

alter table public.contact_messages enable row level security;
alter table public.signup_alert_events enable row level security;

commit;
