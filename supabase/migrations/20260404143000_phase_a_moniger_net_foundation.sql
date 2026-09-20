begin;

create extension if not exists pgcrypto with schema extensions;

create type public.business_role as enum ('owner', 'admin', 'accountant', 'viewer');
create type public.business_member_status as enum ('active', 'pending', 'revoked');
create type public.invoice_status as enum ('draft', 'sent', 'overdue', 'paid', 'cancelled');
create type public.bill_status as enum ('unpaid', 'scheduled', 'paid', 'overdue');
create type public.payment_type as enum ('receivable', 'payable');
create type public.payment_status as enum ('pending', 'completed', 'failed', 'scheduled');
create type public.payment_gateway as enum ('paystack', 'stripe', 'bank_transfer', 'manual');
create type public.notification_type as enum ('invoice', 'bill', 'payment', 'team', 'report', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  default_currency text not null default 'NGN',
  timezone text not null default 'Africa/Lagos',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  email text,
  phone text,
  website text,
  address text,
  rc_number text,
  tax_id text,
  default_currency text not null default 'NGN',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null default 'viewer',
  status public.business_member_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  billing_address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  bank_name text,
  account_number text,
  account_name text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status public.invoice_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (greatest(total_amount - amount_paid, 0::numeric)) stored,
  currency text not null default 'NGN',
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_number integer not null,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, line_number)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  bill_number text not null,
  bill_date date not null default current_date,
  due_date date,
  status public.bill_status not null default 'unpaid',
  category text,
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (greatest(total_amount - amount_paid, 0::numeric)) stored,
  currency text not null default 'NGN',
  notes text,
  scheduled_payment_date date,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, bill_number)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  bill_id uuid references public.bills(id) on delete set null,
  payment_reference text not null,
  payment_type public.payment_type not null,
  gateway public.payment_gateway not null default 'manual',
  status public.payment_status not null default 'pending',
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  paid_on date not null default current_date,
  counterparty_name text,
  gateway_response text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, payment_reference),
  check ((invoice_id is null) or (bill_id is null))
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_sent boolean not null default true,
  payment_received boolean not null default true,
  bill_due boolean not null default true,
  overdue boolean not null default true,
  team_updates boolean not null default false,
  weekly_report boolean not null default true,
  email_digest boolean not null default true,
  push_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_business_members_user_id on public.business_members(user_id);
create index idx_business_members_business_id on public.business_members(business_id);
create index idx_customers_business_id on public.customers(business_id);
create index idx_vendors_business_id on public.vendors(business_id);
create index idx_invoices_business_id on public.invoices(business_id);
create index idx_invoices_customer_id on public.invoices(customer_id);
create index idx_invoices_due_date on public.invoices(due_date);
create index idx_invoices_status on public.invoices(status);
create index idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index idx_bills_business_id on public.bills(business_id);
create index idx_bills_vendor_id on public.bills(vendor_id);
create index idx_bills_due_date on public.bills(due_date);
create index idx_bills_status on public.bills(status);
create index idx_payments_business_id on public.payments(business_id);
create index idx_payments_invoice_id on public.payments(invoice_id);
create index idx_payments_bill_id on public.payments(bill_id);
create index idx_payments_status on public.payments(status);
create index idx_audit_logs_business_id_created_at on public.audit_logs(business_id, created_at desc);
create index idx_notification_preferences_user_id on public.notification_preferences(user_id);
create index idx_notifications_recipient_user_id_read_at on public.notifications(recipient_user_id, read_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
  );
$$;

create or replace function public.has_business_role(
  target_business_id uuid,
  allowed_roles public.business_role[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
      and bm.role = any(allowed_roles)
  );
$$;

create or replace function public.log_audit_event(
  p_business_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_summary text,
  p_detail jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.audit_logs;
begin
  insert into public.audit_logs (
    business_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    summary,
    detail
  )
  values (
    p_business_id,
    p_actor_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_summary,
    coalesce(p_detail, '{}'::jsonb)
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  created_business_id uuid;
  derived_full_name text;
  derived_business_name text;
begin
  derived_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  if derived_full_name is null then
    derived_full_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;

  derived_business_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'business_name', '')), '');
  if derived_business_name is null then
    derived_business_name := derived_full_name || ' Workspace';
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, derived_full_name)
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now();

  insert into public.businesses (name, owner_user_id, email)
  values (derived_business_name, new.id, new.email)
  returning id into created_business_id;

  insert into public.business_members (
    business_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    created_business_id,
    new.id,
    'owner',
    'active',
    new.id,
    now()
  );

  insert into public.notification_preferences (business_id, user_id)
  values (created_business_id, new.id)
  on conflict (business_id, user_id) do nothing;

  perform public.log_audit_event(
    created_business_id,
    'business',
    created_business_id,
    'business.created',
    'moniger.net workspace created for a new account',
    jsonb_build_object('owner_user_id', new.id, 'email', new.email),
    new.id
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

create trigger set_business_members_updated_at
  before update on public.business_members
  for each row execute procedure public.set_updated_at();

create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute procedure public.set_updated_at();

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

create trigger set_invoice_items_updated_at
  before update on public.invoice_items
  for each row execute procedure public.set_updated_at();

create trigger set_bills_updated_at
  before update on public.bills
  for each row execute procedure public.set_updated_at();

create trigger set_payments_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.set_updated_at();

grant select, insert, update, delete on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.customers,
  public.vendors,
  public.invoices,
  public.invoice_items,
  public.bills,
  public.payments,
  public.audit_logs,
  public.notification_preferences,
  public.notifications
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, public.business_role[]) to authenticated;
grant execute on function public.log_audit_event(uuid, text, uuid, text, text, jsonb, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

create policy "profiles select self"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles insert self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles update self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "businesses select members"
  on public.businesses
  for select
  to authenticated
  using (public.is_business_member(id));

create policy "businesses insert owners"
  on public.businesses
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "businesses update admins"
  on public.businesses
  for update
  to authenticated
  using (public.has_business_role(id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(id, array['owner', 'admin']::public.business_role[]));

create policy "businesses delete owners"
  on public.businesses
  for delete
  to authenticated
  using (public.has_business_role(id, array['owner']::public.business_role[]));

create policy "business members select members"
  on public.business_members
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "business members insert admins"
  on public.business_members
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

create policy "business members update admins"
  on public.business_members
  for update
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

create policy "business members delete owners"
  on public.business_members
  for delete
  to authenticated
  using (public.has_business_role(business_id, array['owner']::public.business_role[]));

create policy "customers select members"
  on public.customers
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "customers mutate finance roles"
  on public.customers
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "vendors select members"
  on public.vendors
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "vendors mutate finance roles"
  on public.vendors
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "invoices select members"
  on public.invoices
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "invoices mutate finance roles"
  on public.invoices
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "invoice items select members"
  on public.invoice_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and public.is_business_member(i.business_id)
    )
  );

create policy "invoice items mutate finance roles"
  on public.invoice_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and public.has_business_role(i.business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and public.has_business_role(i.business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    )
  );

create policy "bills select members"
  on public.bills
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "bills mutate finance roles"
  on public.bills
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "payments select members"
  on public.payments
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "payments mutate finance roles"
  on public.payments
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "audit logs select members"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_business_member(business_id));

create policy "audit logs insert finance roles"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

create policy "notification preferences select self"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification preferences insert self"
  on public.notification_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

create policy "notification preferences update self"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

create policy "notifications select recipient"
  on public.notifications
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

create policy "notifications insert admins"
  on public.notifications
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

create policy "notifications update recipient"
  on public.notifications
  for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

commit;
