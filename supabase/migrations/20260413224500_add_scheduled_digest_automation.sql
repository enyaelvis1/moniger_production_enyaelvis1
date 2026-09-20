begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.scheduled_digest_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  scheduled_for timestamptz not null,
  status text not null check (status in ('sent', 'failed')),
  item_count integer not null default 0,
  email_delivery_id uuid references public.email_deliveries(id) on delete set null,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_scheduled_digest_runs_business_user_created_at
  on public.scheduled_digest_runs (business_id, user_id, created_at desc);

create unique index if not exists idx_scheduled_digest_runs_sent_period
  on public.scheduled_digest_runs (business_id, user_id, period_key)
  where status = 'sent';

alter table public.scheduled_digest_runs enable row level security;

grant select on public.scheduled_digest_runs to authenticated;

drop policy if exists "scheduled digest runs select self" on public.scheduled_digest_runs;
create policy "scheduled digest runs select self"
  on public.scheduled_digest_runs
  for select
  using (
    user_id = auth.uid()
    and public.is_business_member(business_id)
  );

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'scheduled-workspace-digest-delivery'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select
  cron.schedule(
    'scheduled-workspace-digest-delivery',
    '0 8 * * 1',
    $cron$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/workspace-digest-automation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret')
        ),
        body := jsonb_build_object('triggeredAt', timezone('utc', now()))
      ) as request_id;
    $cron$
  );

commit;
