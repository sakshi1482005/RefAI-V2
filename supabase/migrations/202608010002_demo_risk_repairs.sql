-- Durable, non-status referral journey events used by the shared timeline.
alter table public.referral_status_history add column if not exists event_type text;
update public.referral_status_history set event_type = case when previous_status is null then 'request_created' else 'status_changed' end where event_type is null;
alter table public.referral_status_history alter column event_type set default 'status_changed';
create unique index if not exists referral_history_employee_viewed_once_idx on public.referral_status_history(referral_request_id, event_type) where event_type = 'employee_viewed';

create or replace function public.record_referral_employee_viewed_as(p_actor_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_request public.referral_requests;
begin
  select * into v_request from public.referral_requests where id = p_request_id;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> p_actor_id then raise exception 'request is assigned to another employee' using errcode = '42501'; end if;
  insert into public.referral_status_history(referral_request_id, previous_status, new_status, changed_by, event_type)
  values (p_request_id, v_request.status, v_request.status, p_actor_id, 'employee_viewed')
  on conflict (referral_request_id, event_type) where event_type = 'employee_viewed' do nothing;
  return found;
end $$;
revoke execute on function public.record_referral_employee_viewed_as(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_referral_employee_viewed_as(uuid, uuid) to service_role;
