begin;

alter table public.business_admin_overrides
  add column if not exists payout_limit_per_transaction_amount numeric(14,2) not null default 0,
  add column if not exists payout_limit_daily_amount numeric(14,2) not null default 0,
  add column if not exists payout_limit_weekly_amount numeric(14,2) not null default 0;

commit;
