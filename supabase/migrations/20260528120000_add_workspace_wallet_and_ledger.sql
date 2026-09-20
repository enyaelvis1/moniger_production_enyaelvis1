begin;

create type public.wallet_ledger_entry_type as enum (
  'topup_pending',
  'topup_completed',
  'payout_reserved',
  'payout_completed',
  'payout_failed',
  'payout_reversed',
  'adjustment_credit',
  'adjustment_debit'
);

create table public.workspace_wallets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  currency text not null default 'NGN',
  balance numeric(14,2) not null default 0 check (balance >= 0),
  reserved_balance numeric(14,2) not null default 0 check (reserved_balance >= 0),
  available_balance numeric(14,2) generated always as (greatest(balance - reserved_balance, 0::numeric)) stored,
  provider text not null default 'manual' check (provider in ('manual', 'paystack')),
  provider_metadata jsonb not null default '{}'::jsonb,
  last_funded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  check (reserved_balance <= balance)
);

create unique index if not exists idx_workspace_wallets_business_id
  on public.workspace_wallets (business_id);

create index if not exists idx_workspace_wallets_business_balance
  on public.workspace_wallets (business_id, balance);

create table public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  wallet_id uuid not null references public.workspace_wallets(id) on delete cascade,
  entry_type public.wallet_ledger_entry_type not null,
  amount numeric(14,2) not null check (amount > 0),
  balance_before numeric(14,2) not null check (balance_before >= 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  reserved_before numeric(14,2) not null check (reserved_before >= 0),
  reserved_after numeric(14,2) not null check (reserved_after >= 0),
  currency text not null default 'NGN',
  provider_reference text,
  idempotency_key text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (reserved_before <= balance_before),
  check (reserved_after <= balance_after)
);

create index if not exists idx_wallet_ledger_entries_business_created_at
  on public.wallet_ledger_entries (business_id, created_at desc);

create index if not exists idx_wallet_ledger_entries_wallet_created_at
  on public.wallet_ledger_entries (wallet_id, created_at desc);

create unique index if not exists idx_wallet_ledger_entries_business_idempotency_key
  on public.wallet_ledger_entries (business_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_wallet_ledger_entries_provider_reference
  on public.wallet_ledger_entries (provider_reference)
  where provider_reference is not null;

create or replace function public.handle_new_business_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_wallets (
    business_id,
    currency,
    created_by,
    updated_by
  )
  values (
    new.id,
    coalesce(nullif(trim(new.default_currency), ''), 'NGN'),
    new.owner_user_id,
    new.owner_user_id
  )
  on conflict (business_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_workspace_wallet_on_business_insert on public.businesses;
create trigger create_workspace_wallet_on_business_insert
  after insert on public.businesses
  for each row
  execute procedure public.handle_new_business_wallet();

drop trigger if exists set_workspace_wallets_updated_at on public.workspace_wallets;
create trigger set_workspace_wallets_updated_at
  before update on public.workspace_wallets
  for each row
  execute procedure public.set_updated_at();

insert into public.workspace_wallets (
  business_id,
  currency,
  created_by,
  updated_by
)
select
  b.id,
  coalesce(nullif(trim(b.default_currency), ''), 'NGN'),
  b.owner_user_id,
  b.owner_user_id
from public.businesses b
on conflict (business_id) do nothing;

grant select, insert, update on table public.workspace_wallets to authenticated;
grant select, insert on table public.wallet_ledger_entries to authenticated;

alter table public.workspace_wallets enable row level security;
alter table public.wallet_ledger_entries enable row level security;

drop policy if exists "workspace wallets select members" on public.workspace_wallets;
create policy "workspace wallets select members"
  on public.workspace_wallets
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "workspace wallets mutate finance roles" on public.workspace_wallets;
create policy "workspace wallets mutate finance roles"
  on public.workspace_wallets
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "wallet ledger entries select members" on public.wallet_ledger_entries;
create policy "wallet ledger entries select members"
  on public.wallet_ledger_entries
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "wallet ledger entries insert finance roles" on public.wallet_ledger_entries;
create policy "wallet ledger entries insert finance roles"
  on public.wallet_ledger_entries
  for insert
  to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and exists (
      select 1
      from public.workspace_wallets wallet
      where wallet.id = wallet_id
        and wallet.business_id = business_id
    )
  );

commit;
