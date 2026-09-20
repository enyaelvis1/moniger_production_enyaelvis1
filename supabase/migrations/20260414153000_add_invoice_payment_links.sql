alter table public.invoices
  add column if not exists payment_public_token text,
  add column if not exists payment_link_enabled boolean not null default false,
  add column if not exists payment_link_last_shared_at timestamptz;

update public.invoices
set payment_public_token = encode(gen_random_bytes(24), 'hex')
where payment_public_token is null;

alter table public.invoices
  alter column payment_public_token set default encode(gen_random_bytes(24), 'hex');

alter table public.invoices
  alter column payment_public_token set not null;

create unique index if not exists invoices_payment_public_token_key
  on public.invoices (payment_public_token);

create index if not exists invoices_payment_link_enabled_idx
  on public.invoices (business_id, payment_link_enabled)
  where payment_link_enabled = true;
