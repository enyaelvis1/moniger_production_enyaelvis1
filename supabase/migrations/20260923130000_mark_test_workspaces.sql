begin;

alter table public.businesses add column if not exists is_test_data boolean not null default false;

update public.businesses as businesses
set is_test_data = true
from auth.users as auth_users
where businesses.owner_user_id = auth_users.id
  and (
    auth_users.raw_user_meta_data ->> 'is_test_user' = 'true'
    or auth_users.raw_user_meta_data ->> 'test_user' = 'true'
    or lower(coalesce(auth_users.raw_user_meta_data ->> 'environment', '')) in ('test', 'qa', 'sandbox')
    or lower(coalesce(auth_users.raw_app_meta_data ->> 'environment', '')) in ('test', 'qa', 'sandbox')
    or lower(coalesce(auth_users.email, '')) like '%@moniger.test'
    or lower(coalesce(auth_users.email, '')) like '%@example.com'
    or lower(coalesce(auth_users.email, '')) like '%playwright%'
    or lower(coalesce(auth_users.email, '')) like '%debug%'
    or lower(coalesce(auth_users.email, '')) like '%test-user%'
    or lower(coalesce(auth_users.raw_user_meta_data ->> 'name', '')) like '%playwright%'
    or lower(coalesce(auth_users.raw_user_meta_data ->> 'name', '')) like '%debug%'
  );

create index if not exists idx_businesses_test_data on public.businesses (is_test_data, created_at desc) where is_test_data = true;

commit;
