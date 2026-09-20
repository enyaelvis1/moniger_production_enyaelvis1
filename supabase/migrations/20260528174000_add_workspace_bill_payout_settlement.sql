begin;

create or replace function public.apply_workspace_bill_payout_settlement(
  p_business_id uuid,
  p_bill_id uuid,
  p_payout_id uuid,
  p_payment_reference text,
  p_status text,
  p_paid_at timestamptz,
  p_failure_reason text default null,
  p_gateway_response text default null,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns table (
  applied boolean,
  bill_id uuid,
  bill_status text,
  amount_paid numeric,
  payment_id uuid,
  payment_status text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  bill_record public.bills%rowtype;
  vendor_record public.vendors%rowtype;
  payment_record public.payments%rowtype;
  resolved_status text := lower(coalesce(nullif(trim(p_status), ''), 'failed'));
  resolved_reference text := nullif(trim(p_payment_reference), '');
  resolved_reason text := coalesce(nullif(trim(p_failure_reason), ''), nullif(trim(p_gateway_response), ''), 'The payout could not be completed.');
  resolved_gateway_response text := coalesce(nullif(trim(p_gateway_response), ''), resolved_reason);
  next_payment_status public.payment_status;
  next_bill_status public.bill_status;
  next_amount_paid numeric(14,2);
  next_paid_on date;
  resolved_payment_reference text;
begin
  select *
    into bill_record
  from public.bills
  where id = p_bill_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Bill not found for this workspace.';
  end if;

  select *
    into vendor_record
  from public.vendors
  where id = bill_record.vendor_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Vendor not found for this workspace.';
  end if;

  select *
    into payment_record
  from public.payments
  where bill_id = p_bill_id
    and business_id = p_business_id
  for update;

  if resolved_status = 'completed' then
    next_bill_status := 'paid';
    next_payment_status := 'completed';
    next_amount_paid := bill_record.total_amount;
    next_paid_on := coalesce(p_paid_at::date, current_date);
    resolved_payment_reference := coalesce(resolved_reference, payment_record.payment_reference, p_payout_id::text);
  else
    next_bill_status := 'unpaid';
    next_payment_status := 'failed';
    next_amount_paid := 0;
    next_paid_on := coalesce(p_paid_at::date, current_date);
    resolved_payment_reference := coalesce(resolved_reference, payment_record.payment_reference, p_payout_id::text);
  end if;

  if found then
    update public.payments
      set amount = bill_record.total_amount,
          bill_id = bill_record.id,
          business_id = p_business_id,
          counterparty_name = coalesce(vendor_record.business_name, payment_record.counterparty_name),
          currency = bill_record.currency,
          gateway = 'paystack',
          gateway_response = resolved_gateway_response,
          invoice_id = null,
          metadata = coalesce(payment_record.metadata, '{}'::jsonb)
            || coalesce(p_provider_metadata, '{}'::jsonb)
            || jsonb_build_object(
              'payout_id', p_payout_id,
              'payout_status', resolved_status,
              'source', 'workspace_payout'
            ),
          paid_on = next_paid_on,
          payment_reference = resolved_payment_reference,
          payment_type = 'payable',
          status = next_payment_status,
          updated_at = now()
    where id = payment_record.id
    returning * into payment_record;
  else
    insert into public.payments (
      business_id,
      bill_id,
      payment_reference,
      payment_type,
      gateway,
      status,
      amount,
      currency,
      paid_on,
      counterparty_name,
      gateway_response,
      metadata,
      created_by
    )
    values (
      p_business_id,
      bill_record.id,
      resolved_payment_reference,
      'payable',
      'paystack',
      next_payment_status,
      bill_record.total_amount,
      bill_record.currency,
      next_paid_on,
      vendor_record.business_name,
      resolved_gateway_response,
      coalesce(p_provider_metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_id', p_payout_id,
        'payout_status', resolved_status,
        'source', 'workspace_payout'
      ),
      p_updated_by
    )
    returning * into payment_record;
  end if;

  update public.bills
    set amount_paid = next_amount_paid,
        scheduled_payment_date = case
          when next_bill_status = 'paid' then scheduled_payment_date
          else null
        end,
        status = next_bill_status,
        updated_by = p_updated_by
  where id = bill_record.id
    and business_id = p_business_id;

  return query
    select
      true,
      bill_record.id,
      next_bill_status::text,
      next_amount_paid,
      payment_record.id,
      next_payment_status::text,
      case
        when next_bill_status = 'paid' then 'Bill marked as paid from payout settlement.'
        else 'Bill reverted to unpaid after payout failure.'
      end;
end;
$$;

grant execute on function public.apply_workspace_bill_payout_settlement(uuid, uuid, uuid, text, text, timestamptz, text, text, jsonb, uuid) to authenticated;

commit;
