begin;

create table if not exists public.platform_marketplace_fee_settings (
  singleton boolean primary key default true check (singleton),
  fee_mode text not null check (fee_mode in ('flat', 'percentage')),
  flat_amount numeric(14,2) not null default 0 check (flat_amount >= 0),
  percentage_basis_points integer check (percentage_basis_points between 0 and 10000),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'disabled' check (status in ('active', 'disabled')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    (fee_mode = 'flat' and percentage_basis_points is null)
    or (fee_mode = 'percentage' and percentage_basis_points is not null)
  )
);

alter table public.platform_marketplace_fee_settings enable row level security;
drop policy if exists "platform marketplace fee settings admins" on public.platform_marketplace_fee_settings;
create policy "platform marketplace fee settings admins"
  on public.platform_marketplace_fee_settings for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());
revoke all on public.platform_marketplace_fee_settings from anon, authenticated;
grant select, insert, update, delete on public.platform_marketplace_fee_settings to authenticated;
grant all on public.platform_marketplace_fee_settings to service_role;

create table if not exists public.platform_marketplace_fee_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_settings jsonb,
  next_settings jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.platform_marketplace_fee_audit enable row level security;
drop policy if exists "platform marketplace fee audit admins read" on public.platform_marketplace_fee_audit;
create policy "platform marketplace fee audit admins read"
  on public.platform_marketplace_fee_audit for select to authenticated
  using (public.is_admin_user());
revoke all on public.platform_marketplace_fee_audit from anon, authenticated;
grant select on public.platform_marketplace_fee_audit to authenticated;
grant all on public.platform_marketplace_fee_audit to service_role;

create or replace function public.audit_platform_marketplace_fee_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_marketplace_fee_audit (actor_user_id, previous_settings, next_settings)
  values (
    new.updated_by,
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'updated_at' else null end,
    to_jsonb(new) - 'updated_at'
  );
  return new;
end;
$$;
revoke all on function public.audit_platform_marketplace_fee_change() from public, anon, authenticated;
drop trigger if exists audit_platform_marketplace_fee_change on public.platform_marketplace_fee_settings;
create trigger audit_platform_marketplace_fee_change
  after insert or update on public.platform_marketplace_fee_settings
  for each row execute function public.audit_platform_marketplace_fee_change();

alter table public.business_payment_split_configs
  add column if not exists fee_source text not null default 'workspace_override'
    check (fee_source in ('platform_default', 'workspace_override'));

create or replace function public.marketplace_routing_is_ready(p_business_id uuid, p_currency text default null, p_amount numeric default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_payout_accounts payout
    where payout.business_id = p_business_id
      and payout.provider = 'paystack'
      and payout.status = 'verified'
      and (p_currency is null or payout.currency = upper(p_currency))
      and payout.provider_subaccount_code is not null
      and payout.provider_metadata ->> 'is_verified' = 'true'
      and payout.provider_metadata ->> 'active' = 'true'
      and (
        exists (
          select 1 from public.business_payment_split_configs split
          where split.business_id = p_business_id
            and split.status = 'ready'
            and split.payout_account_id = payout.id
            and split.provider_subaccount_code = payout.provider_subaccount_code
            and split.currency = payout.currency
            and (split.split_mode <> 'percentage' or split.provider_split_code is not null)
            and (p_amount is null or split.split_mode <> 'flat' or split.moniger_fee_flat_amount <= p_amount)
        )
        or exists (
          select 1 from public.platform_marketplace_fee_settings fee
          where fee.singleton = true
            and fee.status = 'active'
            and fee.currency = payout.currency
            and (p_currency is null or fee.currency = upper(p_currency))
            and (p_amount is null or fee.fee_mode <> 'flat' or fee.flat_amount <= p_amount)
        )
      )
  );
$$;
revoke all on function public.marketplace_routing_is_ready(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.marketplace_routing_is_ready(uuid, text, numeric) to service_role;

create or replace function public.enforce_invoice_routing_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    (tg_op = 'INSERT' and (new.status = 'sent' or coalesce(new.payment_link_enabled, false)))
    or (tg_op = 'UPDATE' and (
      (new.status = 'sent' and old.status <> 'sent')
      or (new.payment_link_enabled = true and coalesce(old.payment_link_enabled, false) = false)
    ))
  ) and not public.marketplace_routing_is_ready(new.business_id, new.currency, new.total_amount) then
    raise exception using
      errcode = '23514',
      message = 'Complete and verify marketplace payout routing before sending invoices or enabling payment links.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_invoice_routing_readiness() from public, anon, authenticated;
drop trigger if exists enforce_invoice_routing_readiness on public.invoices;
create trigger enforce_invoice_routing_readiness
  before insert or update on public.invoices
  for each row execute function public.enforce_invoice_routing_readiness();

commit;
