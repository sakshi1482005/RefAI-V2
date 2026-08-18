-- Keep notification records for auditability while allowing each recipient to
-- clear their own Notification Centre without deleting shared platform data.
alter table public.notifications
  add column if not exists cleared_at timestamptz;

create index if not exists notifications_recipient_visible_created_idx
  on public.notifications(recipient_id, created_at desc)
  where cleared_at is null;

grant update (cleared_at) on public.notifications to authenticated;
