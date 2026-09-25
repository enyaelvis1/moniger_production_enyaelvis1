begin;

alter table public.business_subscriptions
  drop constraint if exists business_subscriptions_status_check;

alter table public.business_subscriptions
  add constraint business_subscriptions_status_check
  check (status in ('active', 'trial', 'past_due', 'paused', 'cancelled', 'expired'));

alter table public.business_subscriptions
  add column if not exists expired_at timestamptz;

create index if not exists idx_business_subscriptions_paid_renewal
  on public.business_subscriptions (next_renewal_at)
  where plan in ('growth', 'business') and status in ('active', 'past_due');

create table if not exists public.subscription_renewal_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  renewal_at timestamptz not null,
  notice_type text not null check (notice_type in ('14_day', '48_hour', 'expired')),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  unique (business_id, user_id, renewal_at, notice_type)
);

create index if not exists idx_subscription_renewal_notifications_business_created
  on public.subscription_renewal_notifications (business_id, created_at desc);

alter table public.subscription_renewal_notifications enable row level security;

drop policy if exists "subscription renewal notifications admin read" on public.subscription_renewal_notifications;
create policy "subscription renewal notifications admin read"
  on public.subscription_renewal_notifications
  for select
  to authenticated
  using (public.is_admin_user());

grant select on public.subscription_renewal_notifications to authenticated;

create or replace function public.has_workspace_operational_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_subscriptions subscription
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
create trigger ensure_business_subscription_after_insert
  after insert on public.businesses
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

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'subscription-renewal-automation'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'subscription-renewal-automation',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/subscription-renewal-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'subscription_renewal_cron_secret')
    ),
    body := jsonb_build_object('triggeredAt', timezone('utc', now()))
  ) as request_id;
  $cron$
);

commit;
