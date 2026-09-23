begin;

update public.businesses as businesses
set is_test_data = true
from auth.users as auth_users
where businesses.owner_user_id = auth_users.id
  and (
    lower(coalesce(auth_users.email, '')) like '%@moniger.test'
    or lower(coalesce(auth_users.email, '')) like '%@example.com'
    or lower(coalesce(auth_users.email, '')) like '%playwright%'
    or lower(coalesce(auth_users.email, '')) like '%debug%'
    or lower(coalesce(auth_users.email, '')) like '%test-user%'
    or lower(coalesce(auth_users.raw_user_meta_data ->> 'name', '')) like '%playwright%'
    or lower(coalesce(auth_users.raw_user_meta_data ->> 'name', '')) like '%debug%'
  );

commit;
