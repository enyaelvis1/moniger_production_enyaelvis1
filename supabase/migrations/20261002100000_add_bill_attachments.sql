begin;

create table public.bill_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_bill_attachments_bill_id on public.bill_attachments (bill_id, created_at desc);

alter table public.bill_attachments enable row level security;

create policy "bill attachments select paid workspace members"
  on public.bill_attachments for select to authenticated
  using (
    public.is_business_member(business_id)
    and public.has_workspace_feature_access(business_id, 'billAttachments')
  );

create policy "bill attachments insert finance roles"
  on public.bill_attachments for insert to authenticated
  with check (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'billAttachments')
    and uploaded_by = auth.uid()
    and exists (
      select 1
      from public.bills
      where bills.id = bill_id
        and bills.business_id = bill_attachments.business_id
    )
  );

create policy "bill attachments delete finance roles"
  on public.bill_attachments for delete to authenticated
  using (
    public.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access(business_id, 'billAttachments')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bill-attachments',
  'bill-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bill attachments storage read" on storage.objects;
create policy "bill attachments storage read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bill-attachments'
    and public.is_business_member((storage.foldername(name))[1]::uuid)
    and public.has_workspace_feature_access((storage.foldername(name))[1]::uuid, 'billAttachments')
  );

drop policy if exists "bill attachments storage upload" on storage.objects;
create policy "bill attachments storage upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bill-attachments'
    and public.has_business_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access((storage.foldername(name))[1]::uuid, 'billAttachments')
    and (storage.foldername(name))[3] = auth.uid()::text
  );

drop policy if exists "bill attachments storage delete" on storage.objects;
create policy "bill attachments storage delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bill-attachments'
    and public.has_business_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'accountant']::public.business_role[])
    and public.has_workspace_feature_access((storage.foldername(name))[1]::uuid, 'billAttachments')
  );

commit;
