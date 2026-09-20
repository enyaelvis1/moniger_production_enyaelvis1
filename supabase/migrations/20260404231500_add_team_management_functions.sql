begin;

create or replace function public.list_business_members(p_business_id uuid)
returns table (
  membership_id uuid,
  business_id uuid,
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.business_role,
  status public.business_member_status,
  invited_by uuid,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    bm.id as membership_id,
    bm.business_id,
    bm.user_id,
    lower(au.email) as email,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      lower(au.email)
    ) as full_name,
    p.avatar_url,
    bm.role,
    bm.status,
    bm.invited_by,
    bm.joined_at,
    bm.created_at,
    bm.updated_at
  from public.business_members bm
  join auth.users au
    on au.id = bm.user_id
  left join public.profiles p
    on p.id = bm.user_id
  where bm.business_id = p_business_id
    and public.is_business_member(p_business_id)
  order by
    case bm.status
      when 'active' then 0
      when 'pending' then 1
      else 2
    end,
    case bm.role
      when 'owner' then 0
      when 'admin' then 1
      when 'accountant' then 2
      else 3
    end,
    bm.joined_at asc;
$$;

create or replace function public.invite_business_member(
  p_business_id uuid,
  p_email text,
  p_role public.business_role default 'viewer'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_business_name text;
  v_existing_member public.business_members%rowtype;
  v_normalized_email text := lower(trim(coalesce(p_email, '')));
  v_target_user_id uuid;
  v_target_user_name text;
begin
  if not public.has_business_role(p_business_id, array['owner', 'admin']::public.business_role[]) then
    raise exception 'You do not have permission to manage this team.';
  end if;

  if v_normalized_email = '' or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  if p_role = 'owner' then
    raise exception 'Owner access cannot be assigned from the team settings page.';
  end if;

  select b.name
  into v_business_name
  from public.businesses b
  where b.id = p_business_id;

  if v_business_name is null then
    raise exception 'Workspace not found.';
  end if;

  select
    au.id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      lower(au.email)
    )
  into v_target_user_id, v_target_user_name
  from auth.users au
  left join public.profiles p
    on p.id = au.id
  where lower(au.email) = v_normalized_email
  limit 1;

  if v_target_user_id is null then
    raise exception 'That email does not have a moniger.net account yet.';
  end if;

  select *
  into v_existing_member
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = v_target_user_id
  limit 1;

  if v_existing_member.id is not null and v_existing_member.status = 'active' then
    raise exception 'That user is already an active team member.';
  end if;

  if v_existing_member.id is null then
    insert into public.business_members (
      business_id,
      user_id,
      role,
      status,
      invited_by
    )
    values (
      p_business_id,
      v_target_user_id,
      p_role,
      'active',
      auth.uid()
    )
    returning *
    into v_existing_member;
  else
    update public.business_members
    set
      invited_by = auth.uid(),
      role = p_role,
      status = 'active'
    where id = v_existing_member.id
    returning *
    into v_existing_member;
  end if;

  insert into public.notification_preferences (
    business_id,
    user_id
  )
  values (
    p_business_id,
    v_target_user_id
  )
  on conflict (business_id, user_id) do nothing;

  insert into public.notifications (
    business_id,
    recipient_user_id,
    type,
    title,
    body,
    link
  )
  values (
    p_business_id,
    v_target_user_id,
    'team',
    'You were added to a workspace',
    format(
      'You now have %s access to %s.',
      initcap(replace(p_role::text, '_', ' ')),
      v_business_name
    ),
    '/settings?tab=team'
  );

  perform public.log_audit_event(
    p_business_id,
    'business_member',
    v_existing_member.id,
    'team.member_added',
    'Team member added',
    jsonb_build_object(
      'email', v_normalized_email,
      'full_name', v_target_user_name,
      'role', p_role,
      'status', v_existing_member.status,
      'user_id', v_target_user_id
    ),
    auth.uid()
  );
end;
$$;

create or replace function public.update_business_member_role(
  p_membership_id uuid,
  p_role public.business_role
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_business_name text;
  v_target_email text;
  v_target_member public.business_members%rowtype;
begin
  if p_role = 'owner' then
    raise exception 'Owner access cannot be assigned from the team settings page.';
  end if;

  select bm.*
  into v_target_member
  from public.business_members bm
  where bm.id = p_membership_id
  limit 1;

  if v_target_member.id is null then
    raise exception 'Team member not found.';
  end if;

  select
    au.email,
    b.name
  into v_target_email, v_business_name
  from auth.users au
  join public.businesses b
    on b.id = v_target_member.business_id
  where au.id = v_target_member.user_id
  limit 1;

  if not public.has_business_role(v_target_member.business_id, array['owner', 'admin']::public.business_role[]) then
    raise exception 'You do not have permission to manage this team.';
  end if;

  if v_target_member.role = 'owner' then
    raise exception 'The workspace owner role cannot be changed here.';
  end if;

  if v_target_member.user_id = auth.uid() then
    raise exception 'Update another team member instead of your own access.';
  end if;

  if v_target_member.status <> 'active' then
    raise exception 'Only active team members can have roles updated.';
  end if;

  update public.business_members
  set role = p_role
  where id = p_membership_id;

  insert into public.notifications (
    business_id,
    recipient_user_id,
    type,
    title,
    body,
    link
  )
  values (
    v_target_member.business_id,
    v_target_member.user_id,
    'team',
    'Workspace role updated',
    format(
      'Your access in %s was updated to %s.',
      v_business_name,
      initcap(replace(p_role::text, '_', ' '))
    ),
    '/settings?tab=team'
  );

  perform public.log_audit_event(
    v_target_member.business_id,
    'business_member',
    v_target_member.id,
    'team.role_updated',
    'Team member role updated',
    jsonb_build_object(
      'email', lower(v_target_email),
      'role', p_role,
      'status', v_target_member.status,
      'user_id', v_target_member.user_id
    ),
    auth.uid()
  );
end;
$$;

create or replace function public.update_business_member_status(
  p_membership_id uuid,
  p_status public.business_member_status
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_action text;
  v_business_name text;
  v_summary text;
  v_target_email text;
  v_target_member public.business_members%rowtype;
begin
  if p_status = 'pending' then
    raise exception 'Pending invitations will be added in a later team workflow.';
  end if;

  select bm.*
  into v_target_member
  from public.business_members bm
  where bm.id = p_membership_id
  limit 1;

  if v_target_member.id is null then
    raise exception 'Team member not found.';
  end if;

  select
    au.email,
    b.name
  into v_target_email, v_business_name
  from auth.users au
  join public.businesses b
    on b.id = v_target_member.business_id
  where au.id = v_target_member.user_id
  limit 1;

  if not public.has_business_role(v_target_member.business_id, array['owner', 'admin']::public.business_role[]) then
    raise exception 'You do not have permission to manage this team.';
  end if;

  if v_target_member.role = 'owner' then
    raise exception 'The workspace owner cannot be changed here.';
  end if;

  if v_target_member.user_id = auth.uid() then
    raise exception 'Update another team member instead of your own access.';
  end if;

  update public.business_members
  set status = p_status
  where id = p_membership_id;

  if p_status = 'active' then
    insert into public.notification_preferences (
      business_id,
      user_id
    )
    values (
      v_target_member.business_id,
      v_target_member.user_id
    )
    on conflict (business_id, user_id) do nothing;

    insert into public.notifications (
      business_id,
      recipient_user_id,
      type,
      title,
      body,
      link
    )
    values (
      v_target_member.business_id,
      v_target_member.user_id,
      'team',
      'Workspace access restored',
      format('Your access to %s has been restored.', v_business_name),
      '/settings?tab=team'
    );

    v_action := 'team.member_restored';
    v_summary := 'Team member restored';
  else
    insert into public.notifications (
      business_id,
      recipient_user_id,
      type,
      title,
      body,
      link
    )
    values (
      v_target_member.business_id,
      v_target_member.user_id,
      'team',
      'Workspace access removed',
      format('Your access to %s has been removed.', v_business_name),
      null
    );

    v_action := 'team.member_revoked';
    v_summary := 'Team member access revoked';
  end if;

  perform public.log_audit_event(
    v_target_member.business_id,
    'business_member',
    v_target_member.id,
    v_action,
    v_summary,
    jsonb_build_object(
      'email', lower(v_target_email),
      'role', v_target_member.role,
      'status', p_status,
      'user_id', v_target_member.user_id
    ),
    auth.uid()
  );
end;
$$;

grant execute on function public.list_business_members(uuid) to authenticated;
grant execute on function public.invite_business_member(uuid, text, public.business_role) to authenticated;
grant execute on function public.update_business_member_role(uuid, public.business_role) to authenticated;
grant execute on function public.update_business_member_status(uuid, public.business_member_status) to authenticated;

commit;
