create table if not exists public.auth_email_rate_limit_windows (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  scope text not null check (scope in ('email', 'ip')),
  key_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (action, scope, key_hash, window_started_at)
);

create index if not exists auth_email_rate_limit_windows_lookup_idx
  on public.auth_email_rate_limit_windows (action, scope, key_hash, window_started_at desc);

alter table public.auth_email_rate_limit_windows enable row level security;

create or replace function public.bump_auth_email_rate_limit_window(
  p_action text,
  p_scope text,
  p_key_hash text,
  p_window_started_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
begin
  if p_action is null or p_scope is null or p_key_hash is null or p_window_started_at is null then
    raise exception 'Missing auth email rate-limit parameters.';
  end if;

  insert into public.auth_email_rate_limit_windows (
    action,
    scope,
    key_hash,
    window_started_at,
    attempt_count
  )
  values (
    p_action,
    p_scope,
    p_key_hash,
    p_window_started_at,
    1
  )
  on conflict (action, scope, key_hash, window_started_at)
  do update
    set attempt_count = public.auth_email_rate_limit_windows.attempt_count + 1,
        updated_at = timezone('utc', now())
  returning attempt_count into v_attempt_count;

  return v_attempt_count;
end;
$$;

grant execute on function public.bump_auth_email_rate_limit_window(text, text, text, timestamptz) to anon;
grant execute on function public.bump_auth_email_rate_limit_window(text, text, text, timestamptz) to authenticated;
grant execute on function public.bump_auth_email_rate_limit_window(text, text, text, timestamptz) to service_role;
