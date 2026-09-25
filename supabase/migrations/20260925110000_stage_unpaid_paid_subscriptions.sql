begin;

-- Older signup/workspace rows could be marked active before payment existed.
-- Only rows with no provider or payment evidence are staged as unpaid. Any
-- provider-backed or referenced subscription remains unchanged.
update public.business_subscriptions
set
  status = 'paused',
  updated_at = timezone('utc', now()),
  notes = concat_ws(E'\n', nullif(notes, ''), 'Staged for payment verification; no provider/payment evidence was present.')
where plan in ('growth', 'business')
  and status = 'active'
  and coalesce(provider, 'manual') = 'manual'
  and provider_subscription_id is null
  and provider_customer_id is null
  and provider_email_token is null
  and last_payment_reference is null;

commit;
