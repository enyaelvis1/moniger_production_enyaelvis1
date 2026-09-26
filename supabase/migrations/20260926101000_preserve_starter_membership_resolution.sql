begin;

-- Membership discovery is required to resolve the current workspace. Keep
-- reads available to workspace members, while Starter route access and team
-- mutations remain restricted by the application gate and write policies.
drop policy if exists "business members select members" on public.business_members;
create policy "business members select members"
  on public.business_members for select to authenticated
  using (public.is_business_member(business_id));

commit;
