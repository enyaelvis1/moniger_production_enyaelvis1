begin;

-- Workspace members need to read the subscription for their active workspace so
-- feature gates and plan-status UI can reflect a completed upgrade. Mutations
-- remain restricted to the existing admin policy and server-side billing flows.
drop policy if exists "business subscriptions workspace members read" on public.business_subscriptions;
create policy "business subscriptions workspace members read"
  on public.business_subscriptions
  for select
  to authenticated
  using (public.is_business_member(business_id));

commit;
