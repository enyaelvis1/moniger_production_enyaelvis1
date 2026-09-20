begin;

alter type public.workspace_payout_status add value if not exists 'pending_approval';

alter table public.business_admin_overrides
  add column if not exists payout_approval_threshold_amount numeric(14,2) not null default 0;

alter table public.workspace_payouts
  add column if not exists approval_required_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

commit;
