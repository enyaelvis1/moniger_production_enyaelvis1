begin;

create table if not exists public.admin_global_data_deletion_manifests (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  protected_super_admin_ids jsonb not null default '[]'::jsonb,
  target_user_ids jsonb not null default '[]'::jsonb,
  target_business_ids jsonb not null default '[]'::jsonb,
  planned_records jsonb not null default '{}'::jsonb,
  deleted_records jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_admin_global_data_deletion_manifests_created_at
  on public.admin_global_data_deletion_manifests (created_at desc);

alter table public.admin_global_data_deletion_manifests enable row level security;

commit;
