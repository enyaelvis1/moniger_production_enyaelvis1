do $$
declare
  v_business_id uuid;
  v_actor_id uuid;
  v_customer_id uuid;
  v_vendor_id uuid;
  v_invoice_id uuid;
  v_bill_id uuid;
begin
  select id, owner_user_id
  into v_business_id, v_actor_id
  from public.businesses
  order by created_at
  limit 1;

  if v_business_id is null then
    raise notice 'No business found. Create a moniger.net account first, then rerun the seed.';
    return;
  end if;

  insert into public.customers (
    business_id,
    name,
    email,
    phone,
    billing_address,
    notes,
    created_by
  )
  values (
    v_business_id,
    'Lagos Retail Group',
    'finance@lagosretail.example',
    '+234 801 555 0100',
    '42 Marina Road, Lagos Island',
    'Phase A sample customer for moniger.net development.',
    v_actor_id
  )
  on conflict do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select id
    into v_customer_id
    from public.customers
    where business_id = v_business_id
      and email = 'finance@lagosretail.example'
    limit 1;
  end if;

  insert into public.vendors (
    business_id,
    business_name,
    contact_name,
    email,
    phone,
    bank_name,
    account_number,
    account_name,
    notes,
    created_by
  )
  values (
    v_business_id,
    'Mainland Power Services',
    'Tosin Bello',
    'accounts@mainlandpower.example',
    '+234 802 555 0140',
    'GTBank',
    '0123456789',
    'Mainland Power Services Ltd',
    'Phase A sample vendor for moniger.net development.',
    v_actor_id
  )
  on conflict do nothing
  returning id into v_vendor_id;

  if v_vendor_id is null then
    select id
    into v_vendor_id
    from public.vendors
    where business_id = v_business_id
      and email = 'accounts@mainlandpower.example'
    limit 1;
  end if;

  insert into public.invoices (
    business_id,
    customer_id,
    invoice_number,
    issue_date,
    due_date,
    status,
    subtotal,
    tax_total,
    total_amount,
    amount_paid,
    currency,
    notes,
    created_by,
    updated_by
  )
  values (
    v_business_id,
    v_customer_id,
    'INV-1001',
    current_date - interval '5 days',
    current_date + interval '10 days',
    'sent',
    450000,
    0,
    450000,
    0,
    'NGN',
    'Initial sample invoice for moniger.net local development.',
    v_actor_id,
    v_actor_id
  )
  on conflict (business_id, invoice_number) do update
    set updated_at = now()
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id,
    line_number,
    description,
    quantity,
    unit_price
  )
  values (
    v_invoice_id,
    1,
    'Accounts receivable workflow setup',
    1,
    450000
  )
  on conflict (invoice_id, line_number) do nothing;

  insert into public.bills (
    business_id,
    vendor_id,
    bill_number,
    bill_date,
    due_date,
    status,
    category,
    subtotal,
    tax_total,
    total_amount,
    amount_paid,
    currency,
    notes,
    created_by,
    updated_by
  )
  values (
    v_business_id,
    v_vendor_id,
    'BILL-1001',
    current_date - interval '3 days',
    current_date + interval '7 days',
    'scheduled',
    'Utilities',
    210000,
    0,
    210000,
    0,
    'NGN',
    'Initial sample bill for moniger.net local development.',
    v_actor_id,
    v_actor_id
  )
  on conflict (business_id, bill_number) do update
    set updated_at = now()
  returning id into v_bill_id;

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
    v_business_id,
    v_bill_id,
    'PAY-1001',
    'payable',
    'paystack',
    'scheduled',
    210000,
    'NGN',
    current_date + interval '7 days',
    'Mainland Power Services',
    'Seeded scheduled payment',
    jsonb_build_object('source', 'supabase/seed.sql'),
    v_actor_id
  )
  on conflict (business_id, payment_reference) do nothing;

  perform public.log_audit_event(
    v_business_id,
    'seed',
    v_business_id,
    'seed.loaded',
    'moniger.net Phase A development seed loaded',
    jsonb_build_object(
      'customer_id', v_customer_id,
      'vendor_id', v_vendor_id,
      'invoice_id', v_invoice_id,
      'bill_id', v_bill_id
    ),
    v_actor_id
  );
end
$$;
