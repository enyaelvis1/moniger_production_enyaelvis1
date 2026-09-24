begin;

-- Keep phone validation at the database boundary as well as in the UI. The
-- trigger accepts the existing human-friendly formatting, rejects letters and
-- misplaced/repeated plus signs, and stores the same normalized E.164-style
-- value used by the frontend. Existing rows are not rewritten by this change.
create or replace function public.normalize_business_phone()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  digits text;
begin
  if new.phone is null or btrim(new.phone) = '' then
    new.phone := null;
    return new;
  end if;

  if new.phone !~ '^[+0-9[:space:]().-]+$'
     or length(new.phone) - length(replace(new.phone, '+', '')) > 1
     or (position('+' in new.phone) > 1) then
    raise exception 'Phone number may contain digits, spaces, parentheses, hyphens, and one leading plus sign only.'
      using errcode = '22023';
  end if;

  digits := regexp_replace(new.phone, '[^0-9]', '', 'g');
  if length(digits) < 8 or length(digits) > 15 then
    raise exception 'Phone number must contain between 8 and 15 digits.' using errcode = '22023';
  end if;

  if left(new.phone, 1) = '+' then
    new.phone := '+' || digits;
  elsif left(digits, 1) = '0' then
    new.phone := '+234' || substr(digits, 2);
  else
    new.phone := '+' || digits;
  end if;

  if new.phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone number is not valid.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_business_phone on public.businesses;
create trigger validate_business_phone
before insert or update of phone on public.businesses
for each row execute function public.normalize_business_phone();

drop trigger if exists validate_vendor_phone on public.vendors;
create trigger validate_vendor_phone
before insert or update of phone on public.vendors
for each row execute function public.normalize_business_phone();

commit;
