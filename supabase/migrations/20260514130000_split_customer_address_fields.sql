alter table public.customers
add column if not exists street_address text,
add column if not exists city_state text;

update public.customers
set street_address = coalesce(street_address, billing_address)
where billing_address is not null
  and street_address is null;
