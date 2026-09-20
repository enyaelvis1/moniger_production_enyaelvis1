begin;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('help_article', 'changelog')),
  slug text not null,
  title text not null,
  excerpt text,
  body text not null default '',
  category text,
  version text,
  release_date date,
  tag text,
  changes jsonb not null default '[]'::jsonb,
  locale text not null default 'en',
  sort_order integer not null default 0,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, slug, locale)
);

create index if not exists idx_content_items_public_order
  on public.content_items (content_type, locale, published, sort_order, created_at desc);

alter table public.content_items enable row level security;

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at
  before update on public.content_items
  for each row execute procedure public.set_updated_at();

commit;
