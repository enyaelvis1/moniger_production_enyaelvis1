begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.workspace_payouts
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_workspace_payouts_business_scheduled_for
  on public.workspace_payouts (business_id, scheduled_for)
  where scheduled_for is not null;

create or replace function public.schedule_workspace_payout(
  p_business_id uuid,
  p_wallet_id uuid,
  p_bill_id uuid,
  p_vendor_id uuid,
  p_vendor_bank_id uuid,
  p_amount numeric,
  p_currency text,
  p_idempotency_key text,
  p_created_by uuid,
  p_scheduled_for timestamptz,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns table (
  payout_id uuid,
  status public.workspace_payout_status,
  scheduled_for timestamptz
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

  if p_scheduled_for is null then
    raise exception 'A scheduled execution time is required.';
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
    if existing_payout.status <> 'pending' then
      payout_id := existing_payout.id;
      status := existing_payout.status;
      scheduled_for := existing_payout.scheduled_for;
      return next;
      return;
    end if;
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

  if found then
    update public.workspace_payouts
      set wallet_id = wallet_record.id,
          bill_id = p_bill_id,
          vendor_id = p_vendor_id,
          vendor_bank_id = p_vendor_bank_id,
          amount = p_amount,
          currency = coalesce(nullif(trim(p_currency), ''), wallet_record.currency),
          status = 'reserved',
          provider_metadata = coalesce(existing_payout.provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('ledger_entry_id', ledger_entry_id),
          reserved_at = now(),
          scheduled_for = p_scheduled_for,
          updated_by = p_created_by
      where id = existing_payout.id
      returning id into payout_id;
  else
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
      scheduled_for,
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
      p_scheduled_for,
      now(),
      p_created_by,
      p_created_by
    )
    returning id into payout_id;
  end if;

  status := 'reserved';
  scheduled_for := p_scheduled_for;
  return next;
end;
$$;

grant execute on function public.schedule_workspace_payout(uuid, uuid, uuid, uuid, uuid, numeric, text, text, uuid, timestamptz, jsonb) to authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'scheduled-workspace-payout-execution'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select
  cron.schedule(
    'scheduled-workspace-payout-execution',
    '*/5 * * * *',
    $cron$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/workspace-payout-execution',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'workspace_payout_cron_secret')
        ),
        body := jsonb_build_object(
          'action', 'self.process-due-payouts',
          'limit', 50,
          'triggeredAt', timezone('utc', now())
        )
      ) as request_id;
    $cron$
  );

commit;
