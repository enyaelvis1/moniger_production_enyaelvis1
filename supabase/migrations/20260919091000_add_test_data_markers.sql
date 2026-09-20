begin;

alter table public.payments
  add column if not exists is_test_data boolean not null default false;

alter table public.workspace_payouts
  add column if not exists is_test_data boolean not null default false;

update public.payments
set is_test_data = true
where metadata ->> 'test_data' = 'true'
   or lower(coalesce(metadata ->> 'environment', '')) in ('test', 'sandbox')
   or lower(coalesce(metadata ->> 'provider_mode', '')) in ('test', 'sandbox');

update public.workspace_payouts
set is_test_data = true
where provider_metadata ->> 'test_data' = 'true'
   or lower(coalesce(provider_metadata ->> 'environment', '')) in ('test', 'sandbox')
   or lower(coalesce(provider_metadata ->> 'provider_mode', '')) in ('test', 'sandbox');

create index if not exists idx_payments_test_data
  on public.payments (is_test_data, created_at desc)
  where is_test_data = true;

create index if not exists idx_workspace_payouts_test_data
  on public.workspace_payouts (is_test_data, created_at desc)
  where is_test_data = true;

commit;
