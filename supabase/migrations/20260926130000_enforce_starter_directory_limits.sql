begin;

create or replace function public.enforce_starter_directory_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_plan text;
  directory_count integer;
  directory_label text;
begin
  select plan into subscription_plan
  from public.business_subscriptions
  where business_id = new.business_id;

  if subscription_plan = 'starter' then
    if tg_table_name = 'customers' then
      select count(*) into directory_count from public.customers where business_id = new.business_id;
      directory_label := 'customers';
    else
      select count(*) into directory_count from public.vendors where business_id = new.business_id;
      directory_label := 'vendors';
    end if;

    if directory_count >= 3 then
      raise exception 'Starter plan allows up to 3 % per workspace. Upgrade your plan to add more.', directory_label;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_starter_directory_limit() from public;
grant execute on function public.enforce_starter_directory_limit() to authenticated, service_role;

drop trigger if exists enforce_starter_customer_limit on public.customers;
create trigger enforce_starter_customer_limit
  before insert on public.customers
  for each row execute function public.enforce_starter_directory_limit();

drop trigger if exists enforce_starter_vendor_limit on public.vendors;
create trigger enforce_starter_vendor_limit
  before insert on public.vendors
  for each row execute function public.enforce_starter_directory_limit();

commit;
