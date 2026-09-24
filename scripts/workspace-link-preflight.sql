-- Read-only release preflight. Run against the target database before applying
-- composite workspace relationship constraints. This is one statement so it
-- works with the Supabase CLI prepared-statement query path.
with relationships (relationship, child_table, parent_table) as (
  values
    ('invoice -> customer', 'invoices', 'customers'),
    ('bill -> vendor', 'bills', 'vendors'),
    ('payment -> invoice', 'payments', 'invoices'),
    ('payment -> bill', 'payments', 'bills'),
    ('payout -> wallet', 'workspace_payouts', 'workspace_wallets'),
    ('payout -> bill', 'workspace_payouts', 'bills'),
    ('payout -> vendor', 'workspace_payouts', 'vendors'),
    ('ledger entry -> wallet', 'wallet_ledger_entries', 'workspace_wallets')
), violations (relationship, issue_type, child_id, child_business_id, parent_id, parent_business_id) as (
  select 'invoice -> customer', case when c.id is null then 'orphan' else 'mismatch' end,
         i.id, i.business_id, i.customer_id, c.business_id
  from public.invoices i
  left join public.customers c on c.id = i.customer_id
  where c.id is null or c.business_id <> i.business_id
  union all
  select 'bill -> vendor', case when v.id is null then 'orphan' else 'mismatch' end,
         b.id, b.business_id, b.vendor_id, v.business_id
  from public.bills b
  left join public.vendors v on v.id = b.vendor_id
  where v.id is null or v.business_id <> b.business_id
  union all
  select 'payment -> invoice', case when i.id is null then 'orphan' else 'mismatch' end,
         p.id, p.business_id, p.invoice_id, i.business_id
  from public.payments p
  left join public.invoices i on i.id = p.invoice_id
  where p.invoice_id is not null and (i.id is null or i.business_id <> p.business_id)
  union all
  select 'payment -> bill', case when b.id is null then 'orphan' else 'mismatch' end,
         p.id, p.business_id, p.bill_id, b.business_id
  from public.payments p
  left join public.bills b on b.id = p.bill_id
  where p.bill_id is not null and (b.id is null or b.business_id <> p.business_id)
  union all
  select 'payout -> wallet', case when w.id is null then 'orphan' else 'mismatch' end,
         p.id, p.business_id, p.wallet_id, w.business_id
  from public.workspace_payouts p
  left join public.workspace_wallets w on w.id = p.wallet_id
  where w.id is null or w.business_id <> p.business_id
  union all
  select 'payout -> bill', case when b.id is null then 'orphan' else 'mismatch' end,
         p.id, p.business_id, p.bill_id, b.business_id
  from public.workspace_payouts p
  left join public.bills b on b.id = p.bill_id
  where p.bill_id is not null and (b.id is null or b.business_id <> p.business_id)
  union all
  select 'payout -> vendor', case when v.id is null then 'orphan' else 'mismatch' end,
         p.id, p.business_id, p.vendor_id, v.business_id
  from public.workspace_payouts p
  left join public.vendors v on v.id = p.vendor_id
  where p.vendor_id is not null and (v.id is null or v.business_id <> p.business_id)
  union all
  select 'ledger entry -> wallet', case when w.id is null then 'orphan' else 'mismatch' end,
         l.id, l.business_id, l.wallet_id, w.business_id
  from public.wallet_ledger_entries l
  left join public.workspace_wallets w on w.id = l.wallet_id
  where w.id is null or w.business_id <> l.business_id
), summary as (
  select r.relationship, issue.issue_type, count(v.child_id)::bigint as issue_count
  from relationships r
  cross join (values ('orphan'), ('mismatch')) as issue(issue_type)
  left join violations v on v.relationship = r.relationship and v.issue_type = issue.issue_type
  group by r.relationship, issue.issue_type
)
select 'summary' as result_type, relationship, issue_type, issue_count,
       null::uuid as child_id, null::uuid as child_business_id,
       null::uuid as parent_id, null::uuid as parent_business_id
from summary
union all
select 'detail', relationship, issue_type, 1,
       child_id, child_business_id, parent_id, parent_business_id
from violations
order by result_type, relationship, issue_type, child_id;
