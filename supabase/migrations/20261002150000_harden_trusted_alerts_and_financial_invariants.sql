begin;

create extension if not exists pgcrypto with schema extensions;

-- A signed, short-lived request is created by the auth.users trigger and can be
-- consumed exactly once by signup-alert. The function never needs to trust a
-- browser-supplied user id or reveal whether that id exists.
create table if not exists public.signup_alert_request_nonces (
  nonce text primary key,
  issued_at timestamptz not null,
  consumed_at timestamptz
);

alter table public.signup_alert_request_nonces enable row level security;
revoke all on table public.signup_alert_request_nonces from public, anon, authenticated;

create or replace function public.consume_signup_alert_nonce(
  p_nonce text,
  p_issued_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed boolean;
begin
  update public.signup_alert_request_nonces
  set consumed_at = now()
  where nonce = nullif(trim(p_nonce), '')
    and consumed_at is null
    and issued_at = p_issued_at
    and issued_at between now() - interval '10 minutes' and now() + interval '5 minutes'
  returning true into consumed;

  return coalesce(consumed, false);
end;
$$;

revoke all on function public.consume_signup_alert_nonce(text, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_signup_alert_nonce(text, timestamptz) to service_role;

create table if not exists public.signup_alert_rate_limits (
  scope text not null check (scope in ('ip', 'user')),
  key_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  primary key (scope, key_hash, window_started_at)
);

alter table public.signup_alert_rate_limits enable row level security;
revoke all on table public.signup_alert_rate_limits from public, anon, authenticated;

create or replace function public.consume_signup_alert_rate_limit(
  p_ip_key text,
  p_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  ip_hash text;
  user_hash text;
  ip_attempts integer;
  user_attempts integer;
begin
  if nullif(trim(p_ip_key), '') is null or nullif(trim(p_user_id), '') is null then
    return false;
  end if;

  ip_hash := encode(extensions.digest(trim(p_ip_key), 'sha256'), 'hex');
  user_hash := encode(extensions.digest(trim(p_user_id), 'sha256'), 'hex');

  insert into public.signup_alert_rate_limits (scope, key_hash, window_started_at, attempt_count)
  values ('ip', ip_hash, window_start, 1)
  on conflict (scope, key_hash, window_started_at)
  do update set attempt_count = public.signup_alert_rate_limits.attempt_count + 1
  returning attempt_count into ip_attempts;

  insert into public.signup_alert_rate_limits (scope, key_hash, window_started_at, attempt_count)
  values ('user', user_hash, window_start, 1)
  on conflict (scope, key_hash, window_started_at)
  do update set attempt_count = public.signup_alert_rate_limits.attempt_count + 1
  returning attempt_count into user_attempts;

  return ip_attempts <= 20 and user_attempts <= 3;
end;
$$;

revoke all on function public.consume_signup_alert_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_signup_alert_rate_limit(text, text) to service_role;

-- Replace the old static-secret-only trigger request with a timestamped,
-- nonce-bound HMAC request. The secret remains in Vault and the function
-- secret; no browser can manufacture a valid request.
create or replace function public.enqueue_signup_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  internal_secret text;
  plan text := coalesce(new.raw_user_meta_data ->> 'signup_plan', 'starter');
  nonce text := gen_random_uuid()::text;
  issued_at bigint := floor(extract(epoch from clock_timestamp()));
  signature text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into internal_secret
  from vault.decrypted_secrets
  where name = 'signup_alert_internal_secret';

  if nullif(trim(project_url), '') is null or nullif(trim(internal_secret), '') is null then
    return new;
  end if;

  insert into public.signup_alert_request_nonces (nonce, issued_at)
  values (nonce, to_timestamp(issued_at));

  signature := encode(
    extensions.hmac(
      format('%s|%s|%s|%s', plan, new.id::text, issued_at, nonce),
      internal_secret,
      'sha256'
    ),
    'hex'
  );

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/signup-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-signup-alert-secret', internal_secret,
      'x-signup-alert-source', 'auth-trigger'
    ),
    body := jsonb_build_object(
      'issuedAt', issued_at,
      'nonce', nonce,
      'plan', plan,
      'signature', signature,
      'userId', new.id::text
    )
  );

  return new;
end;
$$;

revoke all on function public.enqueue_signup_alert() from public, anon, authenticated;

-- Central actor check used by financial mutation triggers. Service-role calls
-- are limited to trusted Edge Functions; authenticated RPC callers must be a
-- finance role in the target workspace and identify themselves as the actor.
create or replace function public.assert_financial_actor(
  p_business_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return;
  end if;

  if auth.uid() is null
     or p_actor_id is null
     or p_actor_id <> auth.uid()
     or not public.has_business_role(
       p_business_id,
       array['owner', 'admin', 'accountant']::public.business_role[]
     ) then
    raise exception 'Financial mutation is not authorized for this workspace.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_financial_actor(uuid, uuid) from public, anon;
grant execute on function public.assert_financial_actor(uuid, uuid) to authenticated, service_role;

create or replace function public.enforce_wallet_mutation_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_financial_actor(new.business_id, coalesce(new.updated_by, new.created_by));
  if new.balance < 0 or new.reserved_balance < 0 or new.reserved_balance > new.balance then
    raise exception 'Wallet balance invariants are invalid.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_payout_mutation_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  wallet_currency text;
begin
  perform public.assert_financial_actor(new.business_id, coalesce(new.updated_by, new.created_by));

  if new.amount is null or new.amount <= 0 or nullif(trim(new.idempotency_key), '') is null then
    raise exception 'Payout amount and idempotency key are required.' using errcode = '23514';
  end if;

  select currency into wallet_currency
  from public.workspace_wallets
  where id = new.wallet_id and business_id = new.business_id;

  if wallet_currency is null or upper(trim(new.currency)) <> upper(trim(wallet_currency)) then
    raise exception 'Payout currency does not match the workspace wallet.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status <> new.status and not (
    (old.status = 'pending' and new.status in ('reserved', 'cancelled', 'failed'))
    or (old.status = 'reserved' and new.status in ('submitted', 'completed', 'failed', 'cancelled'))
    or (old.status = 'submitted' and new.status in ('completed', 'failed', 'reversed', 'cancelled'))
    or (old.status = 'completed' and new.status = 'reversed')
  ) then
    raise exception 'Illegal payout status transition.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_funding_session_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  wallet_currency text;
begin
  select currency into wallet_currency
  from public.workspace_wallets
  where id = new.wallet_id and business_id = new.business_id;

  if wallet_currency is null or upper(trim(new.currency)) <> upper(trim(wallet_currency)) then
    raise exception 'Funding currency does not match the workspace wallet.' using errcode = '23514';
  end if;
  if new.amount <= 0 or nullif(trim(new.provider_reference), '') is null then
    raise exception 'Funding amount and provider reference are required.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_ledger_mutation_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  wallet_currency text;
  source_event text;
begin
  perform public.assert_financial_actor(new.business_id, new.created_by);
  select currency into wallet_currency
  from public.workspace_wallets
  where id = new.wallet_id and business_id = new.business_id;

  if wallet_currency is null or upper(trim(new.currency)) <> upper(trim(wallet_currency)) then
    raise exception 'Ledger currency does not match the workspace wallet.' using errcode = '23514';
  end if;

  source_event := nullif(trim(new.provider_metadata ->> 'source_event'), '');
  if source_event is null then
    source_event := case new.entry_type::text
      when 'topup_completed' then 'wallet_funding.provider_settlement'
      when 'payout_reserved' then 'workspace_payout.reserve'
      when 'payout_completed' then 'workspace_payout.complete'
      when 'payout_failed' then 'workspace_payout.fail'
      when 'payout_reversed' then 'workspace_payout.reverse'
      when 'adjustment_credit' then 'admin.wallet_adjustment'
      when 'adjustment_debit' then 'admin.wallet_adjustment'
      else 'financial.mutation'
    end;
    new.provider_metadata := coalesce(new.provider_metadata, '{}'::jsonb) || jsonb_build_object('source_event', source_event);
  end if;

  if nullif(trim(new.provider_metadata ->> 'source_event'), '') is null then
    raise exception 'A financial source event is required.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_wallet_mutation_invariants on public.workspace_wallets;
create trigger enforce_wallet_mutation_invariants
  before insert or update on public.workspace_wallets
  for each row execute procedure public.enforce_wallet_mutation_invariants();

drop trigger if exists enforce_payout_mutation_invariants on public.workspace_payouts;
create trigger enforce_payout_mutation_invariants
  before insert or update on public.workspace_payouts
  for each row execute procedure public.enforce_payout_mutation_invariants();

drop trigger if exists enforce_funding_session_invariants on public.workspace_wallet_funding_sessions;
create trigger enforce_funding_session_invariants
  before insert or update on public.workspace_wallet_funding_sessions
  for each row execute procedure public.enforce_funding_session_invariants();

drop trigger if exists enforce_ledger_mutation_invariants on public.wallet_ledger_entries;
create trigger enforce_ledger_mutation_invariants
  before insert on public.wallet_ledger_entries
  for each row execute procedure public.enforce_ledger_mutation_invariants();

commit;
