begin;

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (bill_id, line_number)
);

create index idx_bill_items_bill_id on public.bill_items (bill_id, line_number);

alter table public.bill_items enable row level security;

create policy "bill items select workspace members"
  on public.bill_items for select to authenticated
  using (
    public.is_business_member(business_id)
    and public.has_workspace_feature_access(business_id, 'bills')
  );

create policy "bill items insert finance roles"
  on public.bill_items for insert to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'bills')
    and exists (
      select 1 from public.bills
      where bills.id = bill_id and bills.business_id = bill_items.business_id
    )
  );

create policy "bill items update finance roles"
  on public.bill_items for update to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'bills')
  )
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'bills')
  );

create policy "bill items delete finance roles"
  on public.bill_items for delete to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'bills')
  );

commit;
