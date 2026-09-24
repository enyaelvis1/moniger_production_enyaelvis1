-- Read-only release preflight. Run against the target database before applying
-- composite workspace relationship constraints. This script never rewrites data.
select 'invoice_customer_mismatch' as check_name, count(*) as mismatch_count
from public.invoices i
join public.customers c on c.id = i.customer_id
where c.business_id <> i.business_id;

select 'bill_vendor_mismatch' as check_name, count(*) as mismatch_count
from public.bills b
join public.vendors v on v.id = b.vendor_id
where v.business_id <> b.business_id;

select 'payment_invoice_mismatch' as check_name, count(*) as mismatch_count
from public.payments p
join public.invoices i on i.id = p.invoice_id
where p.business_id <> i.business_id;

select 'payment_bill_mismatch' as check_name, count(*) as mismatch_count
from public.payments p
join public.bills b on b.id = p.bill_id
where p.business_id <> b.business_id;

select 'payout_wallet_mismatch' as check_name, count(*) as mismatch_count
from public.workspace_payouts p
join public.workspace_wallets w on w.id = p.wallet_id
where p.business_id <> w.business_id;

select 'ledger_wallet_mismatch' as check_name, count(*) as mismatch_count
from public.wallet_ledger_entries l
join public.workspace_wallets w on w.id = l.wallet_id
where l.business_id <> w.business_id;
