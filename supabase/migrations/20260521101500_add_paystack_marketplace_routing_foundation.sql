begin;

create table if not exists public.business_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bank_id uuid references public.banks(id) on delete set null,
  bank_name text not null,
  account_number text not null,
  account_number_last4 text generated always as (right(regexp_replace(account_number, '\D', '', 'g'), 4)) stored,
  account_name text not null,
  currency text not null default 'NGN',
  country_code text not null default 'NG',
  provider text not null default 'paystack' check (provider in ('manual', 'paystack')),
  status text not null default 'draft' check (status in ('draft', 'pending_verification', 'verified', 'errored', 'disabled')),
  is_default boolean not null default true,
  provider_settlement_bank_code text,
  provider_subaccount_code text,
  provider_subaccount_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  last_sync_error text,
  last_verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  check (length(regexp_replace(account_number, '\D', '', 'g')) between 10 and 20)
);

create unique index if not exists idx_business_payout_accounts_provider_subaccount_code
  on public.business_payout_accounts (provider_subaccount_code)
  where provider_subaccount_code is not null;

create index if not exists idx_business_payout_accounts_business_status
  on public.business_payout_accounts (business_id, status);

create table if not exists public.business_payment_split_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payout_account_id uuid references public.business_payout_accounts(id) on delete set null,
  provider text not null default 'paystack' check (provider in ('manual', 'paystack')),
  status text not null default 'draft' check (status in ('draft', 'pending_provider_sync', 'ready', 'errored', 'disabled')),
  split_mode text not null default 'percentage' check (split_mode in ('flat', 'percentage')),
  moniger_fee_flat_amount numeric(14,2) not null default 0 check (moniger_fee_flat_amount >= 0),
  moniger_fee_percentage_basis_points integer check (
    moniger_fee_percentage_basis_points is null
    or moniger_fee_percentage_basis_points between 0 and 10000
  ),
  currency text not null default 'NGN',
  provider_split_code text,
  provider_split_id text,
  provider_subaccount_code text,
  provider_metadata jsonb not null default '{}'::jsonb,
  last_sync_error text,
  last_verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  check (
    (split_mode = 'flat' and moniger_fee_percentage_basis_points is null)
    or (split_mode = 'percentage' and moniger_fee_percentage_basis_points is not null)
  )
);

create unique index if not exists idx_business_payment_split_configs_provider_split_code
  on public.business_payment_split_configs (provider_split_code)
  where provider_split_code is not null;

create index if not exists idx_business_payment_split_configs_business_status
  on public.business_payment_split_configs (business_id, status);

create index if not exists idx_business_payment_split_configs_payout_account
  on public.business_payment_split_configs (payout_account_id);

alter table public.business_payout_accounts enable row level security;
alter table public.business_payment_split_configs enable row level security;

drop trigger if exists set_business_payout_accounts_updated_at on public.business_payout_accounts;
create trigger set_business_payout_accounts_updated_at
  before update on public.business_payout_accounts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_business_payment_split_configs_updated_at on public.business_payment_split_configs;
create trigger set_business_payment_split_configs_updated_at
  before update on public.business_payment_split_configs
  for each row
  execute function public.set_updated_at();

drop policy if exists "business payout accounts workspace admins" on public.business_payout_accounts;
create policy "business payout accounts workspace admins"
  on public.business_payout_accounts
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "business payout accounts admin access" on public.business_payout_accounts;
create policy "business payout accounts admin access"
  on public.business_payout_accounts
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "business payment split configs workspace admins" on public.business_payment_split_configs;
create policy "business payment split configs workspace admins"
  on public.business_payment_split_configs
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "business payment split configs admin access" on public.business_payment_split_configs;
create policy "business payment split configs admin access"
  on public.business_payment_split_configs
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

commit;
