begin;

create table if not exists public.admin_test_data_deletion_manifests (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  resource text not null check (resource in ('payments', 'payouts', 'all')),
  reason text not null,
  payment_ids jsonb not null default '[]'::jsonb,
  payout_ids jsonb not null default '[]'::jsonb,
  blocked_payouts jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'completed', 'failed')),
  failure_reason text,
  deleted_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_admin_test_data_manifests_deleted_at
  on public.admin_test_data_deletion_manifests (deleted_at desc);

alter table public.admin_test_data_deletion_manifests enable row level security;

commit;
