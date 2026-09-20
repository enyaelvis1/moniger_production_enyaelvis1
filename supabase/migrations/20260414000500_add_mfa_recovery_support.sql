create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  code_hint text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_session_id text
);

create index if not exists idx_mfa_recovery_codes_user_created_at
  on public.mfa_recovery_codes (user_id, created_at desc);

create index if not exists idx_mfa_recovery_codes_user_used_at
  on public.mfa_recovery_codes (user_id, used_at);

alter table public.mfa_recovery_codes enable row level security;

create table if not exists public.mfa_recovery_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_code_id uuid references public.mfa_recovery_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_mfa_recovery_sessions_user_expires_at
  on public.mfa_recovery_sessions (user_id, expires_at desc);

alter table public.mfa_recovery_sessions enable row level security;

create or replace function public.get_mfa_recovery_summary()
returns table (
  total_codes integer,
  remaining_codes integer,
  latest_generated_at timestamptz,
  last_used_at timestamptz
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    count(*)::integer as total_codes,
    count(*) filter (where used_at is null)::integer as remaining_codes,
    max(created_at) as latest_generated_at,
    max(used_at) as last_used_at
  from public.mfa_recovery_codes
  where user_id = auth.uid();
$$;

create or replace function public.has_mfa_recovery_session(p_session_id text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.mfa_recovery_sessions
    where session_id = p_session_id
      and user_id = auth.uid()
      and expires_at > now()
  );
$$;

grant execute on function public.get_mfa_recovery_summary() to authenticated;
grant execute on function public.has_mfa_recovery_session(text) to authenticated;
