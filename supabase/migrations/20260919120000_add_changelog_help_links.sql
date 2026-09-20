begin;

alter table public.content_items
  add column if not exists related_help_slugs jsonb not null default '[]'::jsonb;

commit;
