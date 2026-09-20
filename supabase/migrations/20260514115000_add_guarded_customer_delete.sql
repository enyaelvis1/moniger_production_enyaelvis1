create or replace function public.delete_customer_with_guard(
  p_business_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_invoice_ids uuid[];
  v_invoice_count integer := 0;
  v_processing_payment_count integer := 0;
begin
  if v_actor_user_id is null then
    raise exception 'You must be signed in to delete a customer.';
  end if;

  if not public.has_business_role(p_business_id, array['owner', 'admin', 'accountant']::public.business_role[]) then
    raise exception 'You do not have permission to delete customers in this workspace.';
  end if;

  select array_agg(id), count(*)
  into v_invoice_ids, v_invoice_count
  from public.invoices
  where business_id = p_business_id
    and customer_id = p_customer_id;

  if v_invoice_count > 0 and v_invoice_ids is not null then
    select count(*)
    into v_processing_payment_count
    from public.payments
    where business_id = p_business_id
      and invoice_id = any(v_invoice_ids)
      and payment_type = 'receivable'
      and status in ('pending', 'scheduled');
  end if;

  if v_processing_payment_count > 0 then
    raise exception 'This customer cannot be deleted while % payment transaction(s) are still processing or scheduled.', v_processing_payment_count;
  end if;

  if v_invoice_count > 0 then
    raise exception 'This customer cannot be deleted because % invoice record(s) are still linked to the account.', v_invoice_count;
  end if;

  delete from public.customers
  where id = p_customer_id
    and business_id = p_business_id;

  if not found then
    raise exception 'Customer not found.';
  end if;

  return jsonb_build_object(
    'customer_id', p_customer_id,
    'deleted', true
  );
end;
$$;

grant execute on function public.delete_customer_with_guard(uuid, uuid) to authenticated;
