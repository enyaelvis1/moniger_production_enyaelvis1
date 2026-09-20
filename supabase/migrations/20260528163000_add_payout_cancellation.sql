begin;

alter table public.workspace_payouts
  add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_workspace_payout_reservation(
  p_business_id uuid,
  p_payout_id uuid,
  p_failure_reason text,
  p_updated_by uuid
)
returns table (
  payout_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric,
  reserved_before numeric,
  reserved_after numeric,
  status public.workspace_payout_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_record public.workspace_payouts%rowtype;
  wallet_record public.workspace_wallets%rowtype;
  next_reserved numeric(14,2);
  ledger_entry_id uuid;
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

  if payout_record.status <> 'reserved' then
    raise exception 'This payout can only be cancelled while reserved.';
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

  update public.workspace_wallets
    set reserved_balance = next_reserved,
        updated_by = p_updated_by
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
    'payout_reversed',
    payout_record.amount,
    wallet_record.balance,
    wallet_record.balance,
    wallet_record.reserved_balance,
    next_reserved,
    payout_record.currency,
    concat('cancel-', payout_record.id::text),
    jsonb_build_object(
      'payout_id', payout_record.id,
      'reason', coalesce(nullif(trim(p_failure_reason), ''), 'Payout cancelled before execution')
    ),
    p_updated_by
  )
  returning id into ledger_entry_id;

  update public.workspace_payouts
    set status = 'cancelled',
        failure_reason = coalesce(nullif(trim(p_failure_reason), ''), 'Payout cancelled before execution'),
        cancelled_at = now(),
        provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || jsonb_build_object('cancelled_ledger_entry_id', ledger_entry_id),
        updated_by = p_updated_by
  where id = payout_record.id;

  payout_id := payout_record.id;
  wallet_id := wallet_record.id;
  balance_before := wallet_record.balance;
  balance_after := wallet_record.balance;
  reserved_before := wallet_record.reserved_balance;
  reserved_after := next_reserved;
  status := 'cancelled';
  return next;
end;
$$;

grant execute on function public.cancel_workspace_payout_reservation(uuid, uuid, text, uuid) to authenticated;

commit;
