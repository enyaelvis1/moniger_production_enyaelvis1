begin;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'support')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null check (type in ('info', 'warning', 'maintenance', 'feature')),
  target text not null check (target in ('all', 'starter', 'growth', 'business')),
  target_filters jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_health_checks (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('operational', 'degraded', 'down')),
  response_ms integer,
  checked_at timestamptz not null default now()
);

create table if not exists public.business_admin_overrides (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'business')),
  internal_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.user_admin_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.platform_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_type text not null,
  business_id uuid references public.businesses(id) on delete set null,
  amount numeric(14,2),
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'retried')),
  processing_time_ms integer,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0
);

create index if not exists idx_announcements_published_at
  on public.announcements (published_at desc nulls last);

create index if not exists idx_platform_health_checks_service_checked_at
  on public.platform_health_checks (service, checked_at desc);

create index if not exists idx_platform_webhook_events_received_at
  on public.platform_webhook_events (received_at desc);

alter table public.admin_users enable row level security;
alter table public.announcements enable row level security;
alter table public.platform_config enable row level security;
alter table public.platform_health_checks enable row level security;
alter table public.business_admin_overrides enable row level security;
alter table public.user_admin_overrides enable row level security;
alter table public.platform_webhook_events enable row level security;

drop policy if exists "admin users select self" on public.admin_users;
create policy "admin users select self"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admin users mutate admins" on public.admin_users;
create policy "admin users mutate admins"
  on public.admin_users
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "announcements admin access" on public.announcements;
create policy "announcements admin access"
  on public.announcements
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "platform config admin access" on public.platform_config;
create policy "platform config admin access"
  on public.platform_config
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "platform health checks admin access" on public.platform_health_checks;
create policy "platform health checks admin access"
  on public.platform_health_checks
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "business admin overrides admin access" on public.business_admin_overrides;
create policy "business admin overrides admin access"
  on public.business_admin_overrides
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "user admin overrides admin access" on public.user_admin_overrides;
create policy "user admin overrides admin access"
  on public.user_admin_overrides
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "platform webhook events admin access" on public.platform_webhook_events;
create policy "platform webhook events admin access"
  on public.platform_webhook_events
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_platform_config_updated_at on public.platform_config;
create trigger set_platform_config_updated_at
  before update on public.platform_config
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_business_admin_overrides_updated_at on public.business_admin_overrides;
create trigger set_business_admin_overrides_updated_at
  before update on public.business_admin_overrides
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_user_admin_overrides_updated_at on public.user_admin_overrides;
create trigger set_user_admin_overrides_updated_at
  before update on public.user_admin_overrides
  for each row
  execute function public.set_updated_at();

insert into public.platform_config (key, value)
values
  ('platform_name', jsonb_build_object('value', 'Moniger')),
  ('support_email', jsonb_build_object('value', 'support@moniger.net')),
  ('landing_banner', jsonb_build_object('enabled', false, 'text', '')),
  ('maintenance_mode', jsonb_build_object('enabled', false))
on conflict (key) do nothing;

commit;
