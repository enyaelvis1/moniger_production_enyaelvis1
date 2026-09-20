begin;

alter table public.subscription_checkout_sessions
  add column if not exists replacing_billing_cycle text
    check (replacing_billing_cycle in ('free', 'monthly', 'annual', 'manual')),
  add column if not exists replacing_email_token text,
  add column if not exists replacing_plan text
    check (replacing_plan in ('starter', 'growth', 'business')),
  add column if not exists replacing_subscription_id text,
  add column if not exists switch_kind text
    check (switch_kind in ('new_checkout', 'current', 'upgrade', 'downgrade', 'billing_cycle_change'));

create index if not exists idx_subscription_checkout_sessions_replacing_subscription_id
  on public.subscription_checkout_sessions (replacing_subscription_id)
  where replacing_subscription_id is not null;

commit;
