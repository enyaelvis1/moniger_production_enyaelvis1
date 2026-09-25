begin;

create or replace function public.has_workspace_operational_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_subscriptions subscription
    where subscription.business_id = p_business_id
      and subscription.status in ('active', 'trial')
  );
$$;

revoke all on function public.has_workspace_operational_access(uuid) from public;
grant execute on function public.has_workspace_operational_access(uuid) to authenticated, service_role;

create or replace function public.ensure_business_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_subscriptions (business_id, currency, plan, provider, status, billing_cycle, amount)
  values (new.id, coalesce(new.default_currency, 'NGN'), 'starter', 'manual', 'active', 'free', 0)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_business_subscription_after_insert on public.businesses;
create trigger ensure_business_subscription_after_insert after insert on public.businesses
for each row execute function public.ensure_business_subscription_row();

drop policy if exists "customers select members" on public.customers;
create policy "customers select members" on public.customers for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));
drop policy if exists "customers mutate finance roles" on public.customers;
create policy "customers mutate finance roles" on public.customers for all to authenticated
using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "vendors select members" on public.vendors;
create policy "vendors select members" on public.vendors for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));
drop policy if exists "vendors mutate finance roles" on public.vendors;
create policy "vendors mutate finance roles" on public.vendors for all to authenticated
using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "invoices select members" on public.invoices;
create policy "invoices select members" on public.invoices for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));
drop policy if exists "invoices mutate finance roles" on public.invoices;
create policy "invoices mutate finance roles" on public.invoices for all to authenticated
using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "invoice items select members" on public.invoice_items;
create policy "invoice items select members" on public.invoice_items for select to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_business_member(i.business_id) and public.has_workspace_operational_access(i.business_id)));
drop policy if exists "invoice items mutate finance roles" on public.invoice_items;
create policy "invoice items mutate finance roles" on public.invoice_items for all to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and public.has_business_role(i.business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(i.business_id)))
with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.has_business_role(i.business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(i.business_id)));

drop policy if exists "bills select members" on public.bills;
create policy "bills select members" on public.bills for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));
drop policy if exists "bills mutate finance roles" on public.bills;
create policy "bills mutate finance roles" on public.bills for all to authenticated
using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "payments select members" on public.payments;
create policy "payments select members" on public.payments for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));
drop policy if exists "payments mutate finance roles" on public.payments;
create policy "payments mutate finance roles" on public.payments for all to authenticated
using (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id))
with check (public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[]) and public.has_workspace_operational_access(business_id));

drop policy if exists "audit logs select members" on public.audit_logs;
create policy "audit logs select members" on public.audit_logs for select to authenticated
using (public.is_business_member(business_id) and public.has_workspace_operational_access(business_id));

commit;
