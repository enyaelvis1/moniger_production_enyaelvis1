begin;

-- New-user provisioning creates the workspace wallet from the business insert
-- trigger. That nested system insert has no interactive JWT actor, while
-- direct wallet mutations must still pass assert_financial_actor().
create or replace function public.enforce_wallet_mutation_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if pg_trigger_depth() <= 1 then
    perform public.assert_financial_actor(new.business_id, coalesce(new.updated_by, new.created_by));
  end if;

  if new.balance < 0 or new.reserved_balance < 0 or new.reserved_balance > new.balance then
    raise exception 'Wallet balance invariants are invalid.' using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
