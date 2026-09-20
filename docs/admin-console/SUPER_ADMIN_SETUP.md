# Super Admin Setup

Last updated: 2026-04-20

## Purpose

Use this guide to grant, verify, update, or remove Moniger admin-console access for a user.

Admin access is controlled by the `public.admin_users` table.

Available roles:

- `super_admin`
- `support`

Important difference:

- `support` can access the admin console, but cannot perform super-admin-only actions such as user deletion.
- `super_admin` can perform restricted platform-level actions.

## Before You Start

Make sure:

1. The user already exists in `auth.users`.
2. The admin migration has been applied.
3. You are connected to the correct Supabase project or environment.

## Check Current Admin Access

Run this query to see current admin users:

```sql
select
  au.id as admin_user_id,
  au.user_id,
  u.email,
  au.role,
  au.created_at
from public.admin_users au
join auth.users u
  on u.id = au.user_id
order by au.created_at asc;
```

## Grant Super Admin Access

Replace the email address before running:

```sql
insert into public.admin_users (user_id, role)
select id, 'super_admin'
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update
set role = excluded.role;
```

## Grant Support Admin Access

Replace the email address before running:

```sql
insert into public.admin_users (user_id, role)
select id, 'support'
from auth.users
where email = 'support@example.com'
on conflict (user_id) do update
set role = excluded.role;
```

## Promote Support To Super Admin

Replace the email address before running:

```sql
update public.admin_users
set role = 'super_admin'
where user_id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);
```

## Downgrade Super Admin To Support

Replace the email address before running:

```sql
update public.admin_users
set role = 'support'
where user_id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);
```

## Remove Admin Access

Replace the email address before running:

```sql
delete from public.admin_users
where user_id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);
```

## Verify A Specific User Role

Replace the email address before running:

```sql
select
  u.email,
  au.role,
  au.created_at
from auth.users u
left join public.admin_users au
  on au.user_id = u.id
where u.email = 'admin@example.com';
```

## How To Test Super Admin Setup

### Test support access

1. Grant the user the `support` role.
2. Sign in as that user.
3. Open `/admin`.
4. Confirm the admin console loads.
5. Try a super-admin-only action such as deleting a user.
6. Confirm the action is blocked with a permissions error.

### Test super admin access

1. Promote the same user to `super_admin`.
2. Sign out and sign back in.
3. Refresh `/admin`.
4. Retry the restricted action.
5. Confirm the action is now allowed, subject to any business rules.

## Common Reasons You Might Still See "Not A Super Admin"

- The user is only in `public.admin_users` with role `support`.
- The user was promoted in the database but has not refreshed or signed in again yet.
- You updated the wrong Supabase project or environment.
- The email you used in SQL does not match the actual `auth.users.email` value.

## Recommended Admin Setup Pattern

For local or staging testing:

1. Create a normal user account through the app.
2. Promote that user with SQL to `super_admin`.
3. Keep a second account with `support` role for permission testing.
4. Keep a third non-admin account for access-denied testing.
