begin;

create extension if not exists pg_net with schema extensions;

-- Signup alerts are emitted from the trusted auth event, never from a browser
-- supplied user ID. The shared secret is kept in Supabase Vault and is also
-- configured as the signup-alert Edge Function secret.
create or replace function public.enqueue_signup_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  internal_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into internal_secret
  from vault.decrypted_secrets
  where name = 'signup_alert_internal_secret';

  if nullif(trim(project_url), '') is null or nullif(trim(internal_secret), '') is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/signup-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-signup-alert-secret', internal_secret
    ),
    body := jsonb_build_object(
      'plan', coalesce(new.raw_user_meta_data ->> 'signup_plan', 'starter'),
      'userId', new.id::text
    )
  );

  return new;
end;
$$;

revoke all on function public.enqueue_signup_alert() from public, anon, authenticated;

drop trigger if exists enqueue_signup_alert_on_user_created on auth.users;
create trigger enqueue_signup_alert_on_user_created
  after insert on auth.users
  for each row execute procedure public.enqueue_signup_alert();

commit;
