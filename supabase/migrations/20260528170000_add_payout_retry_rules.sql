begin;

alter table public.workspace_payouts
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz;

create index if not exists idx_workspace_payouts_business_next_retry_at
  on public.workspace_payouts (business_id, next_retry_at)
  where next_retry_at is not null;

commit;
