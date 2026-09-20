alter table public.invoices
  drop constraint if exists invoices_delivery_method_check;

alter table public.invoices
  add constraint invoices_delivery_method_check
  check (delivery_method in ('mail_app', 'backend_email'));

alter table public.invoices
  drop constraint if exists invoices_delivery_status_check;

alter table public.invoices
  add constraint invoices_delivery_status_check
  check (delivery_status in ('not_sent', 'prepared', 'sent', 'failed'));
