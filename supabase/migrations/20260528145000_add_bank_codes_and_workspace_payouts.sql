begin;

alter table public.banks
  add column if not exists bank_code text,
  add column if not exists country_code text not null default 'NG';

create unique index if not exists idx_banks_bank_code
  on public.banks (bank_code)
  where bank_code is not null;

create type public.workspace_payout_status as enum (
  'pending',
  'reserved',
  'submitted',
  'completed',
  'failed',
  'reversed',
  'cancelled'
);

create table public.workspace_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wallet_id uuid not null references public.workspace_wallets(id) on delete restrict,
  bill_id uuid references public.bills(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_bank_id uuid references public.banks(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack' check (provider in ('paystack')),
  provider_reference text,
  provider_recipient_code text,
  provider_transfer_code text,
  status public.workspace_payout_status not null default 'pending',
  failure_reason text,
  idempotency_key text,
  provider_metadata jsonb not null default '{}'::jsonb,
  reserved_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_reference),
  unique (business_id, idempotency_key)
);

create index if not exists idx_workspace_payouts_business_created_at
  on public.workspace_payouts (business_id, created_at desc);

create index if not exists idx_workspace_payouts_business_status
  on public.workspace_payouts (business_id, status);

create index if not exists idx_workspace_payouts_bill_id
  on public.workspace_payouts (bill_id);

create index if not exists idx_workspace_payouts_provider_reference
  on public.workspace_payouts (provider_reference)
  where provider_reference is not null;

drop trigger if exists set_workspace_payouts_updated_at on public.workspace_payouts;
create trigger set_workspace_payouts_updated_at
  before update on public.workspace_payouts
  for each row
  execute procedure public.set_updated_at();

create or replace function public.reserve_workspace_payout(
  p_business_id uuid,
  p_wallet_id uuid,
  p_bill_id uuid,
  p_vendor_id uuid,
  p_vendor_bank_id uuid,
  p_amount numeric,
  p_currency text,
  p_idempotency_key text,
  p_created_by uuid,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns table (
  payout_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric,
  reserved_before numeric,
  reserved_after numeric,
  status public.workspace_payout_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_record public.workspace_wallets%rowtype;
  existing_payout public.workspace_payouts%rowtype;
  next_balance numeric(14,2);
  next_reserved numeric(14,2);
  ledger_entry_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payout amount must be greater than zero.';
  end if;

  select *
    into wallet_record
  from public.workspace_wallets
  where id = p_wallet_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Wallet not found for this workspace.';
  end if;

  select *
    into existing_payout
  from public.workspace_payouts
  where business_id = p_business_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    payout_id := existing_payout.id;
    wallet_id := existing_payout.wallet_id;
    balance_before := wallet_record.balance;
    balance_after := wallet_record.balance;
    reserved_before := wallet_record.reserved_balance;
    reserved_after := wallet_record.reserved_balance;
    status := existing_payout.status;
    return next;
    return;
  end if;

  if wallet_record.available_balance < p_amount then
    raise exception 'Insufficient wallet balance.';
  end if;

  next_balance := wallet_record.balance;
  next_reserved := wallet_record.reserved_balance + p_amount;

  update public.workspace_wallets
    set reserved_balance = next_reserved,
        updated_by = p_created_by,
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || jsonb_build_object(
          'last_payout_reserved_at', now()
        )
  where id = wallet_record.id;

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
    idempotency_key,
    provider_metadata,
    created_by
  )
  values (
    p_business_id,
    wallet_record.id,
    'payout_reserved',
    p_amount,
    wallet_record.balance,
    next_balance,
    wallet_record.reserved_balance,
    next_reserved,
    coalesce(nullif(trim(p_currency), ''), wallet_record.currency),
    p_idempotency_key,
    coalesce(p_provider_metadata, '{}'::jsonb),
    p_created_by
  )
  returning id into ledger_entry_id;

  insert into public.workspace_payouts (
    business_id,
    wallet_id,
    bill_id,
    vendor_id,
    vendor_bank_id,
    amount,
    currency,
    status,
    idempotency_key,
    provider_metadata,
    reserved_at,
    created_by,
    updated_by
  )
  values (
    p_business_id,
    wallet_record.id,
    p_bill_id,
    p_vendor_id,
    p_vendor_bank_id,
    p_amount,
    coalesce(nullif(trim(p_currency), ''), wallet_record.currency),
    'reserved',
    p_idempotency_key,
    coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('ledger_entry_id', ledger_entry_id),
    now(),
    p_created_by,
    p_created_by
  )
  returning id into payout_id;

  wallet_id := wallet_record.id;
  balance_before := wallet_record.balance;
  balance_after := next_balance;
  reserved_before := wallet_record.reserved_balance;
  reserved_after := next_reserved;
  status := 'reserved';
  return next;
end;
$$;

create or replace function public.release_workspace_payout_reservation(
  p_business_id uuid,
  p_payout_id uuid,
  p_failure_reason text,
  p_updated_by uuid
)
returns table (
  payout_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric,
  reserved_before numeric,
  reserved_after numeric,
  status public.workspace_payout_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_record public.workspace_payouts%rowtype;
  wallet_record public.workspace_wallets%rowtype;
  next_reserved numeric(14,2);
begin
  select *
    into payout_record
  from public.workspace_payouts
  where id = p_payout_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Payout not found for this workspace.';
  end if;

  select *
    into wallet_record
  from public.workspace_wallets
  where id = payout_record.wallet_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Wallet not found for this workspace.';
  end if;

  if payout_record.status not in ('reserved', 'submitted') then
    payout_id := payout_record.id;
    wallet_id := wallet_record.id;
    balance_before := wallet_record.balance;
    balance_after := wallet_record.balance;
    reserved_before := wallet_record.reserved_balance;
    reserved_after := wallet_record.reserved_balance;
    status := payout_record.status;
    return next;
    return;
  end if;

  next_reserved := greatest(wallet_record.reserved_balance - payout_record.amount, 0::numeric);

  update public.workspace_wallets
    set reserved_balance = next_reserved,
        updated_by = p_updated_by
  where id = wallet_record.id;

  update public.workspace_payouts
    set status = 'failed',
        failure_reason = coalesce(nullif(trim(p_failure_reason), ''), failure_reason),
        failed_at = now(),
        updated_by = p_updated_by
  where id = payout_record.id;

  payout_id := payout_record.id;
  wallet_id := wallet_record.id;
  balance_before := wallet_record.balance;
  balance_after := wallet_record.balance;
  reserved_before := wallet_record.reserved_balance;
  reserved_after := next_reserved;
  status := 'failed';
  return next;
end;
$$;

grant select, insert, update on table public.workspace_payouts to authenticated;
grant execute on function public.reserve_workspace_payout(uuid, uuid, uuid, uuid, uuid, numeric, text, text, uuid, jsonb) to authenticated;
grant execute on function public.release_workspace_payout_reservation(uuid, uuid, text, uuid) to authenticated;

alter table public.workspace_payouts enable row level security;

drop policy if exists "workspace payouts select members" on public.workspace_payouts;
create policy "workspace payouts select members"
  on public.workspace_payouts
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "workspace payouts mutate finance roles" on public.workspace_payouts;
create policy "workspace payouts mutate finance roles"
  on public.workspace_payouts
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

commit;
