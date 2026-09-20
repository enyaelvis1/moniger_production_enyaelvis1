begin;

create or replace function public.apply_workspace_payout_completion(
  p_business_id uuid,
  p_payout_id uuid,
  p_reference text,
  p_transfer_code text,
  p_paid_at timestamptz,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns table (
  applied boolean,
  balance_after numeric,
  balance_before numeric,
  ledger_entry_id uuid,
  message text,
  payout_id uuid,
  reserved_after numeric,
  reserved_before numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_record public.workspace_payouts%rowtype;
  wallet_record public.workspace_wallets%rowtype;
  next_reserved numeric(14,2);
  inserted_ledger_id uuid;
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

  if payout_record.status = 'completed' then
    select *
      into wallet_record
    from public.workspace_wallets
    where id = payout_record.wallet_id
      and business_id = p_business_id
    for update;

    return query
      select
        false,
        wallet_record.balance,
        wallet_record.balance,
        nullif(payout_record.provider_metadata ->> 'completed_ledger_entry_id', '')::uuid,
        'Payout was already completed.',
        payout_record.id,
        wallet_record.reserved_balance,
        wallet_record.reserved_balance,
        payout_record.status::text;
    return;
  end if;

  if payout_record.status = 'failed' then
    raise exception 'This payout cannot be completed because it already failed.';
  end if;

  if payout_record.status = 'cancelled' then
    raise exception 'This payout cannot be completed because it was cancelled.';
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

  next_reserved := greatest(wallet_record.reserved_balance - payout_record.amount, 0::numeric);

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
    provider_reference,
    idempotency_key,
    provider_metadata,
    created_by
  )
  values (
    p_business_id,
    wallet_record.id,
    'payout_completed',
    payout_record.amount,
    wallet_record.balance,
    wallet_record.balance,
    wallet_record.reserved_balance,
    next_reserved,
    payout_record.currency,
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(p_provider_metadata, '{}'::jsonb),
    p_updated_by
  )
  returning id into inserted_ledger_id;

  update public.workspace_wallets
    set reserved_balance = next_reserved,
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || jsonb_build_object(
          'last_payout_completed_at', p_paid_at,
          'last_payout_reference', coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
          'last_payout_transfer_code', nullif(trim(p_transfer_code), '')
        ),
        updated_by = p_updated_by
  where id = wallet_record.id
    and business_id = p_business_id;

  update public.workspace_payouts
    set status = 'completed',
        completed_at = p_paid_at,
        failure_reason = null,
        provider_reference = coalesce(provider_reference, nullif(trim(p_reference), '')),
        provider_transfer_code = coalesce(provider_transfer_code, nullif(trim(p_transfer_code), '')),
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('completed_ledger_entry_id', inserted_ledger_id),
        updated_by = p_updated_by
  where id = payout_record.id
    and business_id = p_business_id;

  return query
    select
      true,
      wallet_record.balance,
      wallet_record.balance,
      inserted_ledger_id,
      'Payout completed.',
      payout_record.id,
      next_reserved,
      wallet_record.reserved_balance,
      'completed'::text;
end;
$$;

create or replace function public.apply_workspace_payout_failure(
  p_business_id uuid,
  p_payout_id uuid,
  p_failure_reason text,
  p_reference text,
  p_transfer_code text,
  p_failed_at timestamptz,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns table (
  applied boolean,
  balance_after numeric,
  balance_before numeric,
  ledger_entry_id uuid,
  message text,
  payout_id uuid,
  reserved_after numeric,
  reserved_before numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_record public.workspace_payouts%rowtype;
  wallet_record public.workspace_wallets%rowtype;
  next_reserved numeric(14,2);
  inserted_ledger_id uuid;
  resolved_reason text;
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

  if payout_record.status = 'failed' then
    select *
      into wallet_record
    from public.workspace_wallets
    where id = payout_record.wallet_id
      and business_id = p_business_id
    for update;

    return query
      select
        false,
        wallet_record.balance,
        wallet_record.balance,
        nullif(payout_record.provider_metadata ->> 'failed_ledger_entry_id', '')::uuid,
        'Payout was already marked as failed.',
        payout_record.id,
        wallet_record.reserved_balance,
        wallet_record.reserved_balance,
        payout_record.status::text;
    return;
  end if;

  if payout_record.status = 'completed' then
    raise exception 'This payout cannot be marked failed because it has already completed.';
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

  resolved_reason := coalesce(nullif(trim(p_failure_reason), ''), 'The payout could not be processed.');
  next_reserved := greatest(wallet_record.reserved_balance - payout_record.amount, 0::numeric);

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
    provider_reference,
    idempotency_key,
    provider_metadata,
    created_by
  )
  values (
    p_business_id,
    wallet_record.id,
    'payout_failed',
    payout_record.amount,
    wallet_record.balance,
    wallet_record.balance,
    wallet_record.reserved_balance,
    next_reserved,
    payout_record.currency,
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('failure_reason', resolved_reason),
    p_updated_by
  )
  returning id into inserted_ledger_id;

  update public.workspace_wallets
    set reserved_balance = next_reserved,
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || jsonb_build_object(
          'last_payout_failed_at', p_failed_at,
          'last_payout_reference', coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
          'last_payout_transfer_code', nullif(trim(p_transfer_code), '')
        ),
        updated_by = p_updated_by
  where id = wallet_record.id
    and business_id = p_business_id;

  update public.workspace_payouts
    set status = 'failed',
        failed_at = p_failed_at,
        failure_reason = resolved_reason,
        provider_reference = coalesce(provider_reference, nullif(trim(p_reference), '')),
        provider_transfer_code = coalesce(provider_transfer_code, nullif(trim(p_transfer_code), '')),
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('failed_ledger_entry_id', inserted_ledger_id),
        updated_by = p_updated_by
  where id = payout_record.id
    and business_id = p_business_id;

  return query
    select
      true,
      wallet_record.balance,
      wallet_record.balance,
      inserted_ledger_id,
      resolved_reason,
      payout_record.id,
      next_reserved,
      wallet_record.reserved_balance,
      'failed'::text;
end;
$$;

create or replace function public.apply_workspace_payout_reversal(
  p_business_id uuid,
  p_payout_id uuid,
  p_reason text,
  p_reference text,
  p_transfer_code text,
  p_reversed_at timestamptz,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns table (
  applied boolean,
  balance_after numeric,
  balance_before numeric,
  ledger_entry_id uuid,
  message text,
  payout_id uuid,
  reserved_after numeric,
  reserved_before numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_record public.workspace_payouts%rowtype;
  wallet_record public.workspace_wallets%rowtype;
  next_balance numeric(14,2);
  next_reserved numeric(14,2);
  inserted_ledger_id uuid;
  resolved_reason text;
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

  if payout_record.status = 'reversed' then
    select *
      into wallet_record
    from public.workspace_wallets
    where id = payout_record.wallet_id
      and business_id = p_business_id
    for update;

    return query
      select
        false,
        wallet_record.balance,
        wallet_record.balance,
        nullif(payout_record.provider_metadata ->> 'reversed_ledger_entry_id', '')::uuid,
        'Payout was already marked as reversed.',
        payout_record.id,
        wallet_record.reserved_balance,
        wallet_record.reserved_balance,
        payout_record.status::text;
    return;
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

  resolved_reason := coalesce(nullif(trim(p_reason), ''), 'The transfer was reversed by the provider.');

  if payout_record.status = 'completed' then
    next_balance := wallet_record.balance + payout_record.amount;
    next_reserved := wallet_record.reserved_balance;
  else
    next_balance := wallet_record.balance;
    next_reserved := greatest(wallet_record.reserved_balance - payout_record.amount, 0::numeric);
  end if;

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
    provider_reference,
    idempotency_key,
    provider_metadata,
    created_by
  )
  values (
    p_business_id,
    wallet_record.id,
    'payout_reversed',
    payout_record.amount,
    wallet_record.balance,
    next_balance,
    wallet_record.reserved_balance,
    next_reserved,
    payout_record.currency,
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
    coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('reason', resolved_reason),
    p_updated_by
  )
  returning id into inserted_ledger_id;

  update public.workspace_wallets
    set balance = next_balance,
        reserved_balance = next_reserved,
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || jsonb_build_object(
          'last_payout_reversed_at', p_reversed_at,
          'last_payout_reference', coalesce(nullif(trim(p_reference), ''), payout_record.provider_reference),
          'last_payout_transfer_code', nullif(trim(p_transfer_code), '')
        ),
        updated_by = p_updated_by
  where id = wallet_record.id
    and business_id = p_business_id;

  update public.workspace_payouts
    set status = 'reversed',
        reversed_at = p_reversed_at,
        failure_reason = resolved_reason,
        provider_reference = coalesce(provider_reference, nullif(trim(p_reference), '')),
        provider_transfer_code = coalesce(provider_transfer_code, nullif(trim(p_transfer_code), '')),
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object('reversed_ledger_entry_id', inserted_ledger_id),
        updated_by = p_updated_by
  where id = payout_record.id
    and business_id = p_business_id;

  return query
    select
      true,
      next_balance,
      wallet_record.balance,
      inserted_ledger_id,
      resolved_reason,
      payout_record.id,
      next_reserved,
      wallet_record.reserved_balance,
      'reversed'::text;
end;
$$;

commit;
