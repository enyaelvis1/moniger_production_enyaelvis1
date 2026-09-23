begin;

alter table public.customers add column if not exists is_test_data boolean not null default false;
alter table public.vendors add column if not exists is_test_data boolean not null default false;
alter table public.invoices add column if not exists is_test_data boolean not null default false;
alter table public.bills add column if not exists is_test_data boolean not null default false;
alter table public.subscription_checkout_sessions add column if not exists is_test_data boolean not null default false;
alter table public.content_items add column if not exists is_test_data boolean not null default false;
alter table public.announcements add column if not exists is_test_data boolean not null default false;

create index if not exists idx_customers_test_data on public.customers (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_vendors_test_data on public.vendors (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_invoices_test_data on public.invoices (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_bills_test_data on public.bills (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_subscription_checkout_sessions_test_data on public.subscription_checkout_sessions (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_content_items_test_data on public.content_items (is_test_data, created_at desc) where is_test_data = true;
create index if not exists idx_announcements_test_data on public.announcements (is_test_data, created_at desc) where is_test_data = true;

alter table public.admin_test_data_deletion_manifests
  add column if not exists deleted_records jsonb not null default '{}'::jsonb;

commit;
