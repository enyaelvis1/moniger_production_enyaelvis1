begin;

create table public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.banks (name, is_active) values ('Lotus Bank', true);

create index if not exists idx_banks_name on public.banks(name);

commit;
