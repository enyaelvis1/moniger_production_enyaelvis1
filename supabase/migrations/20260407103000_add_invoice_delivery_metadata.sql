alter table public.invoices
  add column if not exists delivery_email text,
  add column if not exists delivery_subject text,
  add column if not exists delivery_message text,
  add column if not exists delivery_method text not null default 'mail_app',
  add column if not exists delivery_status text not null default 'not_sent',
  add column if not exists delivery_last_attempt_at timestamptz,
  add column if not exists delivery_last_error text,
  add column if not exists delivery_attempt_count integer not null default 0;

update public.invoices
set
  delivery_method = coalesce(delivery_method, 'mail_app'),
  delivery_status = case
    when status in ('sent', 'overdue', 'paid')
      and sent_at is not null
      and coalesce(delivery_status, 'not_sent') = 'not_sent'
      then 'prepared'
    else coalesce(delivery_status, 'not_sent')
  end,
  delivery_last_attempt_at = case
    when status in ('sent', 'overdue', 'paid')
      and sent_at is not null
      then coalesce(delivery_last_attempt_at, sent_at)
    else delivery_last_attempt_at
  end,
  delivery_attempt_count = case
    when status in ('sent', 'overdue', 'paid')
      and sent_at is not null
      and coalesce(delivery_attempt_count, 0) = 0
      then 1
    else coalesce(delivery_attempt_count, 0)
  end;

alter table public.invoices
  drop constraint if exists invoices_delivery_method_check;

alter table public.invoices
  add constraint invoices_delivery_method_check
  check (delivery_method in ('mail_app'));

alter table public.invoices
  drop constraint if exists invoices_delivery_status_check;

alter table public.invoices
  add constraint invoices_delivery_status_check
  check (delivery_status in ('not_sent', 'prepared', 'failed'));
