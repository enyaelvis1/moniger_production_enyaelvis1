begin;

-- Prevent a valid record from one workspace being attached to a record owned
-- by another workspace. RLS protects who can call these writes; these
-- triggers protect the relationship itself at the database boundary.
create or replace function public.validate_workspace_record_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'invoices' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.business_id = new.business_id
    ) then
      raise exception 'Customer does not belong to the invoice workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'bills' then
    if not exists (
      select 1 from public.vendors v
      where v.id = new.vendor_id and v.business_id = new.business_id
    ) then
      raise exception 'Vendor does not belong to the bill workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'payments' then
    if new.invoice_id is not null and not exists (
      select 1 from public.invoices i
      where i.id = new.invoice_id and i.business_id = new.business_id
    ) then
      raise exception 'Invoice does not belong to the payment workspace.' using errcode = '23514';
    end if;

    if new.bill_id is not null and not exists (
      select 1 from public.bills b
      where b.id = new.bill_id and b.business_id = new.business_id
    ) then
      raise exception 'Bill does not belong to the payment workspace.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'workspace_payouts' then
    if new.bill_id is not null and not exists (
      select 1 from public.bills b
      where b.id = new.bill_id and b.business_id = new.business_id
    ) then
      raise exception 'Bill does not belong to the payout workspace.' using errcode = '23514';
    end if;

    if new.vendor_id is not null and not exists (
      select 1 from public.vendors v
      where v.id = new.vendor_id and v.business_id = new.business_id
    ) then
      raise exception 'Vendor does not belong to the payout workspace.' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.workspace_wallets w
      where w.id = new.wallet_id and w.business_id = new.business_id
    ) then
      raise exception 'Wallet does not belong to the payout workspace.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_invoice_workspace_links on public.invoices;
create trigger validate_invoice_workspace_links
before insert or update of business_id, customer_id on public.invoices
for each row execute function public.validate_workspace_record_links();

drop trigger if exists validate_bill_workspace_links on public.bills;
create trigger validate_bill_workspace_links
before insert or update of business_id, vendor_id on public.bills
for each row execute function public.validate_workspace_record_links();

drop trigger if exists validate_payment_workspace_links on public.payments;
create trigger validate_payment_workspace_links
before insert or update of business_id, invoice_id, bill_id on public.payments
for each row execute function public.validate_workspace_record_links();

drop trigger if exists validate_payout_workspace_links on public.workspace_payouts;
create trigger validate_payout_workspace_links
before insert or update of business_id, wallet_id, bill_id, vendor_id on public.workspace_payouts
for each row execute function public.validate_workspace_record_links();

commit;
