begin;

create table if not exists public.customer_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  bank_id uuid references public.banks(id) on delete set null,
  bank_name text not null,
  account_number text not null,
  account_number_last4 text generated always as (right(regexp_replace(account_number, '\D', '', 'g'), 4)) stored,
  account_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id),
  check (length(regexp_replace(account_number, '\D', '', 'g')) between 10 and 20)
);

create index if not exists idx_customer_bank_accounts_business on public.customer_bank_accounts (business_id);

alter table public.customer_bank_accounts enable row level security;

drop policy if exists customer_bank_accounts_select on public.customer_bank_accounts;
create policy customer_bank_accounts_select
  on public.customer_bank_accounts
  for select
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists customer_bank_accounts_insert on public.customer_bank_accounts;
create policy customer_bank_accounts_insert
  on public.customer_bank_accounts
  for insert
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and exists (select 1 from public.customers c where c.id = customer_id and c.business_id = business_id)
  );

drop policy if exists customer_bank_accounts_update on public.customer_bank_accounts;
create policy customer_bank_accounts_update
  on public.customer_bank_accounts
  for update
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and exists (select 1 from public.customers c where c.id = customer_id and c.business_id = business_id)
  );

drop policy if exists customer_bank_accounts_delete on public.customer_bank_accounts;
create policy customer_bank_accounts_delete
  on public.customer_bank_accounts
  for delete
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop trigger if exists set_customer_bank_accounts_updated_at on public.customer_bank_accounts;
create trigger set_customer_bank_accounts_updated_at
  before update on public.customer_bank_accounts
  for each row execute function public.set_updated_at();

commit;
