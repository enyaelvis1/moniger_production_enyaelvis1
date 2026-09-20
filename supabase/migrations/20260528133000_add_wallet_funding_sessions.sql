begin;

create type public.wallet_funding_session_status as enum (
  'initialized',
  'completed',
  'failed',
  'cancelled'
);

create table public.workspace_wallet_funding_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wallet_id uuid not null references public.workspace_wallets(id) on delete cascade,
  provider text not null default 'paystack' check (provider in ('paystack')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'NGN',
  status public.wallet_funding_session_status not null default 'initialized',
  provider_reference text not null,
  checkout_url text not null,
  callback_url text not null,
  payer_email text not null,
  payer_name text,
  access_code text,
  provider_metadata jsonb not null default '{}'::jsonb,
  failure_reason text,
  verified_at timestamptz,
  completed_at timestamptz,
  ledger_entry_id uuid references public.wallet_ledger_entries(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_reference)
);

create index if not exists idx_workspace_wallet_funding_sessions_business_created_at
  on public.workspace_wallet_funding_sessions (business_id, created_at desc);

create index if not exists idx_workspace_wallet_funding_sessions_wallet_created_at
  on public.workspace_wallet_funding_sessions (wallet_id, created_at desc);

create index if not exists idx_workspace_wallet_funding_sessions_status
  on public.workspace_wallet_funding_sessions (status);

create index if not exists idx_workspace_wallet_funding_sessions_provider_reference
  on public.workspace_wallet_funding_sessions (provider_reference);

drop trigger if exists set_workspace_wallet_funding_sessions_updated_at on public.workspace_wallet_funding_sessions;
create trigger set_workspace_wallet_funding_sessions_updated_at
  before update on public.workspace_wallet_funding_sessions
  for each row
  execute procedure public.set_updated_at();

grant select on table public.workspace_wallet_funding_sessions to authenticated;

alter table public.workspace_wallet_funding_sessions enable row level security;

drop policy if exists "wallet funding sessions select members" on public.workspace_wallet_funding_sessions;
create policy "wallet funding sessions select members"
  on public.workspace_wallet_funding_sessions
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.apply_wallet_funding_completion(
  p_business_id uuid,
  p_wallet_id uuid,
  p_funding_session_id uuid,
  p_reference text,
  p_amount numeric,
  p_currency text,
  p_paid_at timestamptz,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns table (
  applied boolean,
  balance_after numeric,
  balance_before numeric,
  funding_session_id uuid,
  ledger_entry_id uuid,
  message text,
  reserved_after numeric,
  reserved_before numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_wallet public.workspace_wallets%rowtype;
  current_session public.workspace_wallet_funding_sessions%rowtype;
  inserted_ledger_id uuid;
  next_balance numeric(14,2);
begin
  select *
  into current_wallet
  from public.workspace_wallets
  where id = p_wallet_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Workspace wallet was not found for this funding session.';
  end if;

  select *
  into current_session
  from public.workspace_wallet_funding_sessions
  where id = p_funding_session_id
    and business_id = p_business_id
    and wallet_id = p_wallet_id
    and provider_reference = p_reference
  for update;

  if not found then
    raise exception 'Workspace wallet funding session was not found.';
  end if;

  if current_session.status = 'completed' then
    return query
    select
      false,
      current_wallet.balance,
      current_wallet.balance,
      current_session.id,
      current_session.ledger_entry_id,
      'Wallet funding was already recorded.',
      current_wallet.reserved_balance,
      current_wallet.reserved_balance,
      current_session.status::text;
    return;
  end if;

  if current_session.status = 'failed' then
    raise exception 'This wallet funding session cannot be completed because it failed.';
  end if;

  next_balance := round((current_wallet.balance + p_amount)::numeric, 2);

  insert into public.wallet_ledger_entries (
    business_id,
    wallet_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    reserved_before,
    reserved_after,
    currency,
    provider_reference,
    idempotency_key,
    provider_metadata,
    created_by
  )
  values (
    p_business_id,
    p_wallet_id,
    'topup_completed',
    p_amount,
    current_wallet.balance,
    next_balance,
    current_wallet.reserved_balance,
    current_wallet.reserved_balance,
    coalesce(nullif(trim(p_currency), ''), current_wallet.currency),
    p_reference,
    p_reference,
    coalesce(p_provider_metadata, '{}'::jsonb),
    p_updated_by
  )
  returning id into inserted_ledger_id;

  update public.workspace_wallets
  set
    balance = next_balance,
    last_funded_at = p_paid_at,
    provider = 'paystack',
    provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb),
    updated_by = p_updated_by
  where id = p_wallet_id
    and business_id = p_business_id;

  update public.workspace_wallet_funding_sessions
  set
    status = 'completed',
    verified_at = coalesce(verified_at, p_paid_at),
    completed_at = p_paid_at,
    ledger_entry_id = inserted_ledger_id,
    provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb),
    updated_by = p_updated_by
  where id = p_funding_session_id;

  return query
    select
      true,
      next_balance,
      current_wallet.balance,
      current_session.id,
      inserted_ledger_id,
      'Wallet funding confirmed.',
      current_wallet.reserved_balance,
      current_wallet.reserved_balance,
      'completed'::text;
end;
$$;

commit;
