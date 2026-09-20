begin;

-- Enable row level security for banks and add policies.
alter table public.banks enable row level security;

drop policy if exists "banks select active" on public.banks;
create policy "banks select active"
  on public.banks
  for select
  to authenticated
  using (is_active);

drop policy if exists "banks admin access" on public.banks;
create policy "banks admin access"
  on public.banks
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Seed a comprehensive list of Nigerian banks + microfinance banks.
insert into public.banks (name, is_active) values
  ('Access Bank', true),
  ('Citibank Nigeria', true),
  ('Ecobank Nigeria', true),
  ('Fidelity Bank', true),
  ('First Bank of Nigeria', true),
  ('First City Monument Bank (FCMB)', true),
  ('Globus Bank', true),
  ('Guaranty Trust Bank (GTBank)', true),
  ('Heritage Bank', true),
  ('Jaiz Bank', true),
  ('Keystone Bank', true),
  ('Kuda Bank', true),
  ('Lotus Bank', true),
  ('Opay', true),
  ('Polaris Bank', true),
  ('Providus Bank', true),
  ('Stanbic IBTC Bank', true),
  ('Standard Chartered Bank', true),
  ('Sterling Bank', true),
  ('Titan Trust Bank', true),
  ('Union Bank of Nigeria', true),
  ('United Bank for Africa (UBA)', true),
  ('Unity Bank', true),
  ('VFD Microfinance Bank', true),
  ('Wema Bank', true),
  ('Zenith Bank', true),
  ('Coronation Merchant Bank', true),
  ('Rand Merchant Bank (Nigeria)', true),
  ('Stanbic IBTC Bank', true),
  ('ALAT by Wema', true),
  ('FCMB Microfinance Bank', true),
  ('LAPO Microfinance Bank', true),
  ('AB Microfinance Bank', true),
  ('Accion Microfinance Bank', true),
  ('Fortis Microfinance Bank', true),
  ('Mainstreet Microfinance Bank', true),
  ('Rubies Microfinance Bank', true),
  ('Sunrise Microfinance Bank', true),
  ('Bayport MFB', true),
  ('Heritage Microfinance Bank', true),
  ('Skye Microfinance Bank', true),
  ('FBN Microfinance', true),
  ('GTBank Microfinance', true)
on conflict (name) do nothing;

commit;
