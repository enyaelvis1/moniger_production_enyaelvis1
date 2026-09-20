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

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

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
