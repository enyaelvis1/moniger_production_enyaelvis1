begin;

-- Create bill_categories table
create table if not exists public.bill_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now()
);

-- Enable row level security and add policies similar to banks
alter table public.bill_categories enable row level security;

drop policy if exists "bill_categories select active" on public.bill_categories;
create policy "bill_categories select active"
  on public.bill_categories
  for select
  to authenticated
  using (is_active);

drop policy if exists "bill_categories admin access" on public.bill_categories;
create policy "bill_categories admin access"
  on public.bill_categories
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Seed default categories
insert into public.bill_categories (name, is_active) values
  ('Rent', true),
  ('Utilities', true),
  ('Supplies', true),
  ('Services', true),
  ('Other', true)
on conflict (name) do nothing;

commit;
