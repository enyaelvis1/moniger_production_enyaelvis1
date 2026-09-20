begin;

-- Add bank_id to vendors and backfill from existing bank_name values
alter table public.vendors add column if not exists bank_id uuid references public.banks(id) on delete set null;

-- Backfill: match by case-insensitive substring between bank_name and banks.name
update public.vendors v
set bank_id = b.id
from public.banks b
where v.bank_id is null
  and (
    lower(b.name) like '%' || lower(coalesce(v.bank_name, '')) || '%'
    or lower(coalesce(v.bank_name, '')) like '%' || lower(b.name) || '%'
  );

create index if not exists idx_vendors_bank_id on public.vendors(bank_id);

commit;
