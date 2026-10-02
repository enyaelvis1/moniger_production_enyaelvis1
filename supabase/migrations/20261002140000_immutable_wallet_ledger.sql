begin;

create or replace function public.prevent_wallet_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'wallet ledger entries are immutable; add a compensating entry instead';
end;
$$;

drop trigger if exists prevent_wallet_ledger_update on public.wallet_ledger_entries;
create trigger prevent_wallet_ledger_update
  before update or delete on public.wallet_ledger_entries
  for each row execute procedure public.prevent_wallet_ledger_mutation();

revoke update, delete on table public.wallet_ledger_entries from authenticated;

create or replace function public.validate_notification_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link is not null and (
    (new.link <> '/' and new.link !~ '^/[^/]')
    or left(new.link, 2) = '//'
    or position(chr(92) in new.link) > 0
    or new.link ~ '[[:cntrl:]]'
  ) then
    raise exception 'notification links must be internal application paths';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_notification_link on public.notifications;
create trigger validate_notification_link
  before insert or update of link on public.notifications
  for each row execute procedure public.validate_notification_link();

commit;
