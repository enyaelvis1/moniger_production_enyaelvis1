create table if not exists public.privacy_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  analytics_opt_in boolean not null default false,
  product_updates_opt_in boolean not null default true,
  include_contact_details_in_exports boolean not null default true,
  include_audit_log_in_exports boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists idx_privacy_preferences_user_id on public.privacy_preferences(user_id);

drop trigger if exists set_privacy_preferences_updated_at on public.privacy_preferences;
create trigger set_privacy_preferences_updated_at
  before update on public.privacy_preferences
  for each row execute function public.set_updated_at();

alter table public.privacy_preferences enable row level security;

drop policy if exists "privacy preferences select self" on public.privacy_preferences;
create policy "privacy preferences select self"
  on public.privacy_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "privacy preferences insert self" on public.privacy_preferences;
create policy "privacy preferences insert self"
  on public.privacy_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

drop policy if exists "privacy preferences update self" on public.privacy_preferences;
create policy "privacy preferences update self"
  on public.privacy_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );
