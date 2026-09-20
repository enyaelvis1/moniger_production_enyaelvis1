create table if not exists public.account_session_inventory (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  signed_out_at timestamptz,
  device_label text not null,
  browser text not null,
  os text not null,
  platform text not null,
  provider text,
  aal text,
  auth_methods jsonb not null default '[]'::jsonb,
  recovery_bypass_active boolean not null default false
);

create index if not exists idx_account_session_inventory_user_last_seen
  on public.account_session_inventory (user_id, last_seen_at desc);

create index if not exists idx_account_session_inventory_user_signed_out
  on public.account_session_inventory (user_id, signed_out_at);

alter table public.account_session_inventory enable row level security;

drop policy if exists "Users can view their own account sessions" on public.account_session_inventory;
create policy "Users can view their own account sessions"
  on public.account_session_inventory
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.upsert_account_session_inventory(
  p_session_id text,
  p_expires_at timestamptz default null,
  p_device_label text default 'Unknown device',
  p_browser text default 'Unknown browser',
  p_os text default 'Unknown OS',
  p_platform text default 'Unknown platform',
  p_provider text default null,
  p_aal text default null,
  p_auth_methods jsonb default '[]'::jsonb,
  p_recovery_bypass_active boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'You must be signed in to sync session inventory.';
  end if;

  insert into public.account_session_inventory (
    session_id,
    user_id,
    expires_at,
    device_label,
    browser,
    os,
    platform,
    provider,
    aal,
    auth_methods,
    recovery_bypass_active,
    last_seen_at,
    signed_out_at
  )
  values (
    p_session_id,
    v_user_id,
    p_expires_at,
    p_device_label,
    p_browser,
    p_os,
    p_platform,
    p_provider,
    p_aal,
    coalesce(p_auth_methods, '[]'::jsonb),
    coalesce(p_recovery_bypass_active, false),
    timezone('utc', now()),
    null
  )
  on conflict (session_id) do update
  set
    user_id = excluded.user_id,
    expires_at = excluded.expires_at,
    device_label = excluded.device_label,
    browser = excluded.browser,
    os = excluded.os,
    platform = excluded.platform,
    provider = excluded.provider,
    aal = excluded.aal,
    auth_methods = excluded.auth_methods,
    recovery_bypass_active = excluded.recovery_bypass_active,
    last_seen_at = timezone('utc', now()),
    signed_out_at = null;
end;
$$;

create or replace function public.list_account_session_inventory()
returns table (
  session_id text,
  created_at timestamptz,
  last_seen_at timestamptz,
  expires_at timestamptz,
  signed_out_at timestamptz,
  device_label text,
  browser text,
  os text,
  platform text,
  provider text,
  aal text,
  auth_methods jsonb,
  recovery_bypass_active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    inventory.session_id,
    inventory.created_at,
    inventory.last_seen_at,
    inventory.expires_at,
    inventory.signed_out_at,
    inventory.device_label,
    inventory.browser,
    inventory.os,
    inventory.platform,
    inventory.provider,
    inventory.aal,
    inventory.auth_methods,
    inventory.recovery_bypass_active
  from public.account_session_inventory inventory
  where inventory.user_id = auth.uid()
  order by inventory.last_seen_at desc
  limit 12;
$$;

create or replace function public.mark_account_sessions_signed_out(
  p_scope text,
  p_current_session_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to update session inventory.';
  end if;

  if p_scope = 'others' then
    update public.account_session_inventory
    set signed_out_at = timezone('utc', now())
    where user_id = v_user_id
      and signed_out_at is null
      and (p_current_session_id is null or session_id <> p_current_session_id);
  elsif p_scope = 'global' then
    update public.account_session_inventory
    set signed_out_at = timezone('utc', now())
    where user_id = v_user_id
      and signed_out_at is null;
  elsif p_scope = 'local' then
    update public.account_session_inventory
    set signed_out_at = timezone('utc', now())
    where user_id = v_user_id
      and session_id = p_current_session_id
      and signed_out_at is null;
  else
    raise exception 'Unsupported sign-out scope: %', p_scope;
  end if;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

grant execute on function public.upsert_account_session_inventory(
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean
) to authenticated;

grant execute on function public.list_account_session_inventory() to authenticated;
grant execute on function public.mark_account_sessions_signed_out(text, text) to authenticated;
