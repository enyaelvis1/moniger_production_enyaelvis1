begin;

alter table public.admin_test_data_deletion_manifests
  drop constraint if exists admin_test_data_deletion_manifests_resource_check;

alter table public.admin_test_data_deletion_manifests
  add constraint admin_test_data_deletion_manifests_resource_check
  check (resource in ('payments', 'payouts', 'receivables', 'all'));

commit;
