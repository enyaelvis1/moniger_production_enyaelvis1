begin;

create or replace function public.enforce_starter_invoice_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_plan text;
  invoice_count integer;
begin
  select plan
    into subscription_plan
  from public.business_subscriptions
  where business_id = new.business_id;

  if subscription_plan = 'starter' and new.status <> 'cancelled' then
    select count(*)
      into invoice_count
    from public.invoices existing_invoice
    where existing_invoice.business_id = new.business_id
      and existing_invoice.status <> 'cancelled'
      and existing_invoice.issue_date >= date_trunc('month', new.issue_date)::date
      and existing_invoice.issue_date < (date_trunc('month', new.issue_date) + interval '1 month')::date
      and (tg_op = 'INSERT' or existing_invoice.id <> new.id);

    if invoice_count >= 10 then
      raise exception 'Starter plan allows up to 10 invoices per calendar month. Upgrade your plan to create more.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_starter_invoice_limit() from public;
grant execute on function public.enforce_starter_invoice_limit() to authenticated, service_role;

drop trigger if exists enforce_starter_invoice_limit on public.invoices;
create trigger enforce_starter_invoice_limit
  before insert or update of business_id, issue_date, status on public.invoices
  for each row execute function public.enforce_starter_invoice_limit();

commit;
