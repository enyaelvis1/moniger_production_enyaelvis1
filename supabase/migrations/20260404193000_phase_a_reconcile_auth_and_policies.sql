begin;

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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_business_members_updated_at on public.business_members;
create trigger set_business_members_updated_at
  before update on public.business_members
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_invoice_items_updated_at on public.invoice_items;
create trigger set_invoice_items_updated_at
  before update on public.invoice_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_bills_updated_at on public.bills;
create trigger set_bills_updated_at
  before update on public.bills
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
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

drop policy if exists "profiles select self" on public.profiles;
create policy "profiles select self"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "businesses select members" on public.businesses;
create policy "businesses select members"
  on public.businesses
  for select
  to authenticated
  using (public.is_business_member(id));

drop policy if exists "businesses insert owners" on public.businesses;
create policy "businesses insert owners"
  on public.businesses
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "businesses update admins" on public.businesses;
create policy "businesses update admins"
  on public.businesses
  for update
  to authenticated
  using (public.has_business_role(id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "businesses delete owners" on public.businesses;
create policy "businesses delete owners"
  on public.businesses
  for delete
  to authenticated
  using (public.has_business_role(id, array['owner']::public.business_role[]));

drop policy if exists "business members select members" on public.business_members;
create policy "business members select members"
  on public.business_members
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "business members insert admins" on public.business_members;
create policy "business members insert admins"
  on public.business_members
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "business members update admins" on public.business_members;
create policy "business members update admins"
  on public.business_members
  for update
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "business members delete owners" on public.business_members;
create policy "business members delete owners"
  on public.business_members
  for delete
  to authenticated
  using (public.has_business_role(business_id, array['owner']::public.business_role[]));

drop policy if exists "customers select members" on public.customers;
create policy "customers select members"
  on public.customers
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "customers mutate finance roles" on public.customers;
create policy "customers mutate finance roles"
  on public.customers
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "vendors select members" on public.vendors;
create policy "vendors select members"
  on public.vendors
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "vendors mutate finance roles" on public.vendors;
create policy "vendors mutate finance roles"
  on public.vendors
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "invoices select members" on public.invoices;
create policy "invoices select members"
  on public.invoices
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "invoices mutate finance roles" on public.invoices;
create policy "invoices mutate finance roles"
  on public.invoices
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "invoice items select members" on public.invoice_items;
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

drop policy if exists "invoice items mutate finance roles" on public.invoice_items;
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

drop policy if exists "bills select members" on public.bills;
create policy "bills select members"
  on public.bills
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "bills mutate finance roles" on public.bills;
create policy "bills mutate finance roles"
  on public.bills
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "payments select members" on public.payments;
create policy "payments select members"
  on public.payments
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "payments mutate finance roles" on public.payments;
create policy "payments mutate finance roles"
  on public.payments
  for all
  to authenticated
  using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "audit logs select members" on public.audit_logs;
create policy "audit logs select members"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "audit logs insert finance roles" on public.audit_logs;
create policy "audit logs insert finance roles"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]));

drop policy if exists "notification preferences select self" on public.notification_preferences;
create policy "notification preferences select self"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notification preferences insert self" on public.notification_preferences;
create policy "notification preferences insert self"
  on public.notification_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

drop policy if exists "notification preferences update self" on public.notification_preferences;
create policy "notification preferences update self"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

drop policy if exists "notifications select recipient" on public.notifications;
create policy "notifications select recipient"
  on public.notifications
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists "notifications insert admins" on public.notifications;
create policy "notifications insert admins"
  on public.notifications
  for insert
  to authenticated
  with check (public.has_business_role(business_id, array['owner', 'admin']::public.business_role[]));

drop policy if exists "notifications update recipient" on public.notifications;
create policy "notifications update recipient"
  on public.notifications
  for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

commit;
