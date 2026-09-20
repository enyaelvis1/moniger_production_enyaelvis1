create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invited_email text not null,
  role public.business_role not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invitation_token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  accepted_at timestamptz
);

create unique index if not exists idx_workspace_invitations_pending_email
  on public.workspace_invitations (business_id, invited_email)
  where status = 'pending';

create index if not exists idx_workspace_invitations_business_status
  on public.workspace_invitations (business_id, status, created_at desc);

alter table public.workspace_invitations enable row level security;

drop policy if exists "Workspace members can view invitations for their workspace" on public.workspace_invitations;
create policy "Workspace members can view invitations for their workspace"
  on public.workspace_invitations
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.touch_workspace_invitation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_workspace_invitations_updated_at on public.workspace_invitations;
create trigger trg_workspace_invitations_updated_at
before update on public.workspace_invitations
for each row
execute function public.touch_workspace_invitation_updated_at();

create or replace function public.list_workspace_invitations(p_business_id uuid)
returns table (
  invitation_id uuid,
  business_id uuid,
  invited_email text,
  role public.business_role,
  status text,
  invited_by uuid,
  invited_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    wi.id as invitation_id,
    wi.business_id,
    wi.invited_email,
    wi.role,
    wi.status,
    wi.invited_by,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      lower(au.email)
    ) as invited_by_name,
    wi.created_at,
    wi.updated_at,
    wi.expires_at,
    wi.accepted_at,
    wi.accepted_user_id
  from public.workspace_invitations wi
  join auth.users au
    on au.id = wi.invited_by
  left join public.profiles p
    on p.id = wi.invited_by
  where wi.business_id = p_business_id
    and public.is_business_member(p_business_id)
  order by
    case wi.status
      when 'pending' then 0
      when 'accepted' then 1
      when 'revoked' then 2
      else 3
    end,
    wi.created_at desc;
$$;

drop function if exists public.invite_business_member(uuid, text, public.business_role);
create or replace function public.invite_business_member(
  p_business_id uuid,
  p_email text,
  p_role public.business_role default 'viewer'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_business_name text;
  v_existing_invitation public.workspace_invitations%rowtype;
  v_existing_member public.business_members%rowtype;
  v_normalized_email text := lower(trim(coalesce(p_email, '')));
  v_target_user_id uuid;
  v_target_user_name text;
  v_token text;
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

  if v_target_user_id is not null then
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
      '/team'
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

    return jsonb_build_object(
      'member_id', v_existing_member.id,
      'mode', 'existing_account',
      'recipient_email', v_normalized_email,
      'role', p_role,
      'status', v_existing_member.status,
      'user_id', v_target_user_id
    );
  end if;

  update public.workspace_invitations
  set status = 'expired'
  where business_id = p_business_id
    and invited_email = v_normalized_email
    and status = 'pending'
    and expires_at <= timezone('utc', now());

  select *
  into v_existing_invitation
  from public.workspace_invitations wi
  where wi.business_id = p_business_id
    and wi.invited_email = v_normalized_email
    and wi.status = 'pending'
  limit 1;

  v_token := encode(gen_random_bytes(24), 'hex');

  if v_existing_invitation.id is null then
    insert into public.workspace_invitations (
      business_id,
      invited_email,
      role,
      status,
      invitation_token,
      invited_by
    )
    values (
      p_business_id,
      v_normalized_email,
      p_role,
      'pending',
      v_token,
      auth.uid()
    )
    returning *
    into v_existing_invitation;
  else
    update public.workspace_invitations
    set
      accepted_at = null,
      accepted_user_id = null,
      expires_at = timezone('utc', now()) + interval '14 days',
      invited_by = auth.uid(),
      invitation_token = v_token,
      role = p_role,
      status = 'pending'
    where id = v_existing_invitation.id
    returning *
    into v_existing_invitation;
  end if;

  perform public.log_audit_event(
    p_business_id,
    'workspace_invitation',
    v_existing_invitation.id,
    'team.invitation_created',
    'Workspace invitation created',
    jsonb_build_object(
      'email', v_normalized_email,
      'role', p_role,
      'status', v_existing_invitation.status
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'expires_at', v_existing_invitation.expires_at,
    'invitation_id', v_existing_invitation.id,
    'invitation_token', v_existing_invitation.invitation_token,
    'mode', 'invitation_created',
    'recipient_email', v_normalized_email,
    'role', p_role,
    'status', v_existing_invitation.status
  );
end;
$$;

create or replace function public.get_workspace_invitation(p_token text)
returns table (
  invitation_id uuid,
  business_id uuid,
  business_name text,
  invited_email text,
  role public.business_role,
  status text,
  expires_at timestamptz,
  invited_by_name text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    wi.id as invitation_id,
    wi.business_id,
    b.name as business_name,
    wi.invited_email,
    wi.role,
    case
      when wi.status = 'pending' and wi.expires_at <= timezone('utc', now()) then 'expired'
      else wi.status
    end as status,
    wi.expires_at,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      lower(au.email)
    ) as invited_by_name
  from public.workspace_invitations wi
  join public.businesses b
    on b.id = wi.business_id
  join auth.users au
    on au.id = wi.invited_by
  left join public.profiles p
    on p.id = wi.invited_by
  where wi.invitation_token = p_token
  limit 1;
$$;

create or replace function public.accept_workspace_invitation(p_token text)
returns table (
  business_id uuid,
  business_name text,
  membership_id uuid,
  role public.business_role
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
  v_member public.business_members%rowtype;
  v_business_name text;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before accepting this invitation.';
  end if;

  select *
  into v_invitation
  from public.workspace_invitations wi
  where wi.invitation_token = p_token
  limit 1;

  if v_invitation.id is null then
    raise exception 'Invitation not found.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'This invitation is no longer pending.';
  end if;

  if v_invitation.expires_at <= timezone('utc', now()) then
    update public.workspace_invitations
    set status = 'expired'
    where id = v_invitation.id;

    raise exception 'This invitation has expired.';
  end if;

  select lower(email)
  into v_user_email
  from auth.users
  where id = auth.uid();

  if v_user_email is null then
    raise exception 'We could not determine the current account email.';
  end if;

  if v_user_email <> v_invitation.invited_email then
    raise exception 'Sign in with % to accept this invitation.', v_invitation.invited_email;
  end if;

  select name
  into v_business_name
  from public.businesses
  where id = v_invitation.business_id;

  if v_business_name is null then
    raise exception 'Workspace not found.';
  end if;

  select *
  into v_member
  from public.business_members bm
  where bm.business_id = v_invitation.business_id
    and bm.user_id = auth.uid()
  limit 1;

  if v_member.id is null then
    insert into public.business_members (
      business_id,
      user_id,
      role,
      status,
      invited_by
    )
    values (
      v_invitation.business_id,
      auth.uid(),
      v_invitation.role,
      'active',
      v_invitation.invited_by
    )
    returning *
    into v_member;
  else
    update public.business_members
    set
      invited_by = v_invitation.invited_by,
      role = v_invitation.role,
      status = 'active'
    where id = v_member.id
    returning *
    into v_member;
  end if;

  insert into public.notification_preferences (
    business_id,
    user_id
  )
  values (
    v_invitation.business_id,
    auth.uid()
  )
  on conflict (business_id, user_id) do nothing;

  update public.workspace_invitations
  set
    accepted_at = timezone('utc', now()),
    accepted_user_id = auth.uid(),
    status = 'accepted'
  where id = v_invitation.id;

  insert into public.notifications (
    business_id,
    recipient_user_id,
    type,
    title,
    body,
    link
  )
  values (
    v_invitation.business_id,
    auth.uid(),
    'team',
    'Workspace invitation accepted',
    format(
      'You joined %s as %s.',
      v_business_name,
      initcap(replace(v_invitation.role::text, '_', ' '))
    ),
    '/team'
  );

  perform public.log_audit_event(
    v_invitation.business_id,
    'workspace_invitation',
    v_invitation.id,
    'team.invitation_accepted',
    'Workspace invitation accepted',
    jsonb_build_object(
      'email', v_invitation.invited_email,
      'role', v_invitation.role,
      'user_id', auth.uid()
    ),
    auth.uid()
  );

  return query
  select
    v_invitation.business_id,
    v_business_name,
    v_member.id,
    v_member.role;
end;
$$;

grant execute on function public.list_workspace_invitations(uuid) to authenticated;
grant execute on function public.invite_business_member(uuid, text, public.business_role) to authenticated;
grant execute on function public.get_workspace_invitation(text) to anon, authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
