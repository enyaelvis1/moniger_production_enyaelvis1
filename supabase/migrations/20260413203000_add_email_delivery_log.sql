begin;

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  recipient_email text not null,
  template_key text not null,
  provider text not null default 'resend',
  status text not null check (status in ('sent', 'failed')),
  subject text not null,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_email_deliveries_business_id_created_at
  on public.email_deliveries (business_id, created_at desc);

create index if not exists idx_email_deliveries_recipient_email_created_at
  on public.email_deliveries (recipient_email, created_at desc);

drop trigger if exists set_email_deliveries_updated_at on public.email_deliveries;
create trigger set_email_deliveries_updated_at
  before update on public.email_deliveries
  for each row execute procedure public.set_updated_at();

alter table public.email_deliveries enable row level security;

grant select on public.email_deliveries to authenticated;

create policy "email deliveries select members"
  on public.email_deliveries
  for select
  using (
    business_id is not null
    and public.is_business_member(business_id)
  );

commit;
