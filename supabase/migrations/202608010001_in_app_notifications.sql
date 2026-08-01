-- Hackathon-scoped in-app notifications. No external delivery channels.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_key text not null unique,
  title text not null,
  body text not null,
  referral_request_id uuid references public.referral_requests(id) on delete cascade,
  analysis_id uuid references public.resume_analyses(id) on delete cascade,
  target_url text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_event_type_valid check (event_type in (
    'employee_viewed_request','more_information_requested','request_approved',
    'referral_submitted','request_declined','employee_stopped_accepting',
    'resume_reanalysis_completed'
  )),
  constraint notifications_target_valid check (target_url like '/%'),
  constraint notifications_content_valid check (
    length(trim(title)) between 1 and 160 and length(trim(body)) between 1 and 500
  )
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update to authenticated using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
