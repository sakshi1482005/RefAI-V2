-- Structured employee referral outcomes. Student-facing wording remains on the
-- referral request; this table retains safe, categorized data for later
-- anonymized aggregate evaluation without exposing employee-private notes.

create table if not exists public.referral_feedback_outcomes (
  id bigint generated always as identity primary key,
  referral_request_id uuid not null unique references public.referral_requests(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  outcome_status text not null check (outcome_status in ('declined', 'more_info_requested', 'approved')),
  reason_code text not null,
  student_summary text not null,
  actionable_tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);
create index if not exists referral_feedback_outcomes_employee_idx on public.referral_feedback_outcomes(employee_id, created_at desc);

alter table public.referral_feedback_outcomes enable row level security;
drop policy if exists referral_feedback_outcomes_employee_read on public.referral_feedback_outcomes;
create policy referral_feedback_outcomes_employee_read on public.referral_feedback_outcomes
for select to authenticated using (employee_id = auth.uid());
revoke all on public.referral_feedback_outcomes from anon, authenticated;
grant select on public.referral_feedback_outcomes to authenticated;
grant all on public.referral_feedback_outcomes to service_role;

-- Extend the existing transition RPC without changing status transitions or
-- legacy reason codes. New reason codes are only valid for a decline.
create or replace function public.transition_structured_referral_decision_as(
  p_actor_id uuid, p_request_id uuid, p_new_status public.referral_status,
  p_reason text, p_decision_message text, p_private_note text default null
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare v_request public.referral_requests; v_previous text; v_status_type text;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role::text = 'employee') then raise exception 'employee access required' using errcode = '42501'; end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> p_actor_id then raise exception 'request is assigned to another employee' using errcode = '42501'; end if;
  v_previous := v_request.status::text;
  if not ((v_previous in ('pending','submitted') and p_new_status::text in ('under_review','more_info_requested','approved','declined')) or (v_previous = 'under_review' and p_new_status::text in ('more_info_requested','approved','declined')) or (v_previous = 'more_info_requested' and p_new_status::text in ('under_review','declined')) or (v_previous = 'approved' and p_new_status::text = 'referred')) then raise exception 'invalid referral status transition'; end if;
  if p_new_status::text = 'approved' and p_reason not in ('suitable_profile','strong_evidence','relevant_role_alignment','will_refer_externally','additional_details_required_first') then raise exception 'invalid approve reason';
  elsif p_new_status::text = 'declined' and p_reason not in ('role_mismatch','insufficient_evidence','not_accepting_referrals','job_closed','unable_to_verify_experience','skill_mismatch','experience_gap','resume_quality','employee_company_policy','opportunity_unavailable','other') then raise exception 'invalid decline reason';
  elsif p_new_status::text = 'more_info_requested' and p_reason <> 'clarification_required' then raise exception 'invalid more-information reason'; end if;
  if length(trim(coalesce(p_decision_message, ''))) < 1 then raise exception 'student-safe decision message required'; end if;
  select udt_name into v_status_type from information_schema.columns where table_schema = 'public' and table_name = 'referral_requests' and column_name = 'status';
  if v_status_type = 'referral_status' then execute 'update public.referral_requests set status = $1, employee_note = null, decision_reason = $2, decision_message = $3, decision_at = now(), updated_at = now() where id = $4 returning *' into v_request using p_new_status, p_reason, p_decision_message, p_request_id;
  else execute 'update public.referral_requests set status = $1::text, employee_note = null, decision_reason = $2, decision_message = $3, decision_at = now(), updated_at = now() where id = $4 returning *' into v_request using p_new_status, p_reason, p_decision_message, p_request_id; end if;
  perform public.refai_append_referral_status(p_request_id, v_previous, p_new_status::text, p_actor_id, null);
  update public.referral_status_history set decision_reason = p_reason, decision_message = p_decision_message where id = (select id from public.referral_status_history where referral_request_id = p_request_id and changed_by = p_actor_id order by created_at desc, id desc limit 1);
  if p_private_note is not null and length(trim(p_private_note)) > 0 then insert into public.referral_decision_private_notes(referral_request_id, employee_id, decision_status, decision_reason, note) values (p_request_id, p_actor_id, p_new_status::text, p_reason, trim(p_private_note)); end if;
  return v_request;
end $$;
