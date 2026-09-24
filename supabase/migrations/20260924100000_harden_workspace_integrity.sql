begin;

-- Keep database normalization aligned with the client validator. Blank optional
-- phone values remain NULL, while formatted values are trimmed before parsing.
create or replace function public.normalize_business_phone()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  compact_phone text;
  digit_count integer;
begin
  if new.phone is null or btrim(new.phone) = '' then
    new.phone := null;
    return new;
  end if;

  new.phone := btrim(new.phone);
  if new.phone !~ '^[+0-9 ()\.\-]+$' then
    raise exception 'Phone number contains unsupported characters.' using errcode = '22023';
  end if;

  if length(new.phone) - length(replace(new.phone, '+', '')) > 1
    or (position('+' in new.phone) > 1) then
    raise exception 'Phone number has an invalid country-code prefix.' using errcode = '22023';
  end if;

  compact_phone := regexp_replace(new.phone, '[ ()\.\-]', '', 'g');
  if compact_phone !~ '^\+?[0-9]+$' then
    raise exception 'Phone number must contain digits.' using errcode = '22023';
  end if;

  if left(compact_phone, 1) = '0' then
    compact_phone := '+234' || substr(compact_phone, 2);
  elsif left(compact_phone, 3) = '234' then
    compact_phone := '+' || compact_phone;
  elsif left(compact_phone, 1) <> '+' then
    compact_phone := '+' || compact_phone;
  end if;

  digit_count := length(regexp_replace(compact_phone, '[^0-9]', '', 'g'));
  if compact_phone !~ '^\+[1-9][0-9]{7,14}$' or digit_count < 8 or digit_count > 15 then
    raise exception 'Phone number must contain between 8 and 15 digits.' using errcode = '22023';
  end if;

  new.phone := compact_phone;
  return new;
end;
$$;

-- These unique keys make the workspace part of every parent identity used by
-- a child relationship. The composite foreign keys below then make a parent
-- workspace move atomic with respect to all linked child records.
alter table public.customers add constraint customers_id_business_id_key unique (id, business_id);
alter table public.vendors add constraint vendors_id_business_id_key unique (id, business_id);
alter table public.invoices add constraint invoices_id_business_id_key unique (id, business_id);
alter table public.bills add constraint bills_id_business_id_key unique (id, business_id);
alter table public.workspace_wallets add constraint workspace_wallets_id_business_id_key unique (id, business_id);

alter table public.invoices
  add constraint invoices_customer_business_fkey
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict;

alter table public.bills
  add constraint bills_vendor_business_fkey
  foreign key (vendor_id, business_id) references public.vendors (id, business_id) on delete restrict;

alter table public.payments
  add constraint payments_invoice_business_fkey
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete set null (invoice_id);

alter table public.payments
  add constraint payments_bill_business_fkey
  foreign key (bill_id, business_id) references public.bills (id, business_id) on delete set null (bill_id);

alter table public.workspace_payouts
  add constraint workspace_payouts_wallet_business_fkey
  foreign key (wallet_id, business_id) references public.workspace_wallets (id, business_id) on delete restrict;

alter table public.workspace_payouts
  add constraint workspace_payouts_bill_business_fkey
  foreign key (bill_id, business_id) references public.bills (id, business_id) on delete set null (bill_id);

alter table public.workspace_payouts
  add constraint workspace_payouts_vendor_business_fkey
  foreign key (vendor_id, business_id) references public.vendors (id, business_id) on delete set null (vendor_id);

alter table public.wallet_ledger_entries
  add constraint wallet_ledger_entries_wallet_business_fkey
  foreign key (wallet_id, business_id) references public.workspace_wallets (id, business_id) on delete cascade;

commit;
