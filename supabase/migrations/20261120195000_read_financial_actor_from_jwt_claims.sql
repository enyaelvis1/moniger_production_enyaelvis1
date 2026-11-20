begin;

-- Supabase/PostgREST runtimes expose JWT claims in both the legacy per-claim
-- settings and the consolidated request.jwt.claims JSON setting. Accept the
-- service role from either trusted request context so server-side settlement
-- RPCs can pass financial mutation triggers consistently across runtime
-- versions. Authenticated callers still need to be the matching finance actor.
create or replace function public.assert_financial_actor(
  p_business_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_claims jsonb := '{}'::jsonb;
  request_claims_text text;
  request_role text;
begin
  request_claims_text := nullif(current_setting('request.jwt.claims', true), '');

  if request_claims_text is not null then
    begin
      request_claims := request_claims_text::jsonb;
    exception when others then
      request_claims := '{}'::jsonb;
    end;
  end if;

  request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    request_claims ->> 'role'
  );

  if request_role = 'service_role' then
    return;
  end if;

  if auth.uid() is null
     or p_actor_id is null
     or p_actor_id <> auth.uid()
     or not public.has_business_role(
       p_business_id,
       array['owner', 'admin', 'accountant']::public.business_role[]
     ) then
    raise exception 'Financial mutation is not authorized for this workspace.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_financial_actor(uuid, uuid) from public, anon;
grant execute on function public.assert_financial_actor(uuid, uuid) to authenticated, service_role;

commit;
