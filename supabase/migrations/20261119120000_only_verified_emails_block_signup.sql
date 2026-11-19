begin;

create or replace function public.is_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(coalesce(p_email, '')))
      and email_confirmed_at is not null
  );
$$;

comment on function public.is_email_registered(text) is
  'Returns true only when the email belongs to a confirmed account; pending email confirmations may continue signup verification.';

grant execute on function public.is_email_registered(text) to anon, authenticated;

commit;
