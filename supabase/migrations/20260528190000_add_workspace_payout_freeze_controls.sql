begin;

alter table public.business_admin_overrides
  add column if not exists payouts_frozen boolean not null default false;

drop policy if exists "business admin overrides admin access" on public.business_admin_overrides;
create policy "business admin overrides admin access"
  on public.business_admin_overrides
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

commit;
