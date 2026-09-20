alter table public.customers
add column if not exists business_name text;

create index if not exists idx_customers_business_name
on public.customers (business_name);
