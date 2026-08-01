-- Run after 202607310003 so the enum additions are committed before use.
alter table public.referral_requests
  add column if not exists referral_date date,
  add column if not exists referral_confirmation_number text,
  add column if not exists referral_note_to_student text,
  add column if not exists referral_submitted_at timestamptz,
  add column if not exists referral_submitted_by uuid references public.profiles(id) on delete set null;

alter table public.referral_requests drop constraint if exists referral_requests_required_fields;
alter table public.referral_requests alter column status set default 'submitted'::public.referral_status;
update public.referral_requests set status = 'submitted'::public.referral_status where status::text = 'pending';
alter table public.referral_requests add constraint referral_requests_required_fields check (
  student_id is not null and employee_id is not null and trust_card_id is not null
  and target_role is not null and target_company is not null and student_message is not null
  and status is not null and status::text in (
    'draft','submitted','pending','under_review','more_info_requested','approved',
    'referred','declined','withdrawn','expired'
  )
);

alter table public.referral_status_history drop constraint if exists referral_history_required_fields;
alter table public.referral_status_history add constraint referral_history_required_fields check (
  referral_request_id is not null and new_status is not null and changed_by is not null
  and new_status::text in (
    'draft','submitted','pending','under_review','more_info_requested','approved',
    'referred','declined','withdrawn','expired'
  )
  and (previous_status is null or previous_status::text in (
    'draft','submitted','pending','under_review','more_info_requested','approved',
    'referred','declined','withdrawn','expired'
  ))
);

create index if not exists referral_requests_submitted_by_idx
  on public.referral_requests(referral_submitted_by, referral_submitted_at desc)
  where referral_submitted_at is not null;

create or replace function public.transition_structured_referral_decision_as(
  p_actor_id uuid, p_request_id uuid, p_new_status public.referral_status,
  p_reason text, p_decision_message text, p_private_note text default null
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.referral_requests;
  v_previous text;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role::text = 'employee') then
    raise exception 'employee access required' using errcode = '42501';
  end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> p_actor_id then
    raise exception 'request is assigned to another employee' using errcode = '42501';
  end if;
  v_previous := v_request.status::text;
  if not (
    (v_previous in ('submitted','pending') and p_new_status::text in ('under_review','more_info_requested','approved','declined')) or
    (v_previous = 'under_review' and p_new_status::text in ('more_info_requested','approved','declined')) or
    (v_previous = 'more_info_requested' and p_new_status::text in ('under_review','declined'))
  ) then raise exception 'invalid referral status transition'; end if;
  if p_new_status::text = 'approved' and p_reason not in ('suitable_profile','strong_evidence','relevant_role_alignment','will_refer_externally','additional_details_required_first') then
    raise exception 'invalid approve reason';
  elsif p_new_status::text = 'declined' and p_reason not in ('role_mismatch','insufficient_evidence','not_accepting_referrals','job_closed','unable_to_verify_experience','other') then
    raise exception 'invalid decline reason';
  elsif p_new_status::text = 'more_info_requested' and p_reason <> 'clarification_required' then
    raise exception 'invalid more-information reason';
  end if;
  if length(trim(coalesce(p_decision_message, ''))) < 1 then
    raise exception 'student-safe decision message required';
  end if;

  update public.referral_requests set
    status = p_new_status, employee_note = null, decision_reason = p_reason,
    decision_message = p_decision_message, decision_at = now(), updated_at = now()
  where id = p_request_id returning * into v_request;
  perform public.refai_append_referral_status(p_request_id, v_previous, p_new_status::text, p_actor_id, null);
  update public.referral_status_history
  set decision_reason = p_reason, decision_message = p_decision_message
  where id = (
    select id from public.referral_status_history
    where referral_request_id = p_request_id and changed_by = p_actor_id
    order by created_at desc, id desc limit 1
  );
  if p_private_note is not null and length(trim(p_private_note)) > 0 then
    insert into public.referral_decision_private_notes(
      referral_request_id, employee_id, decision_status, decision_reason, note
    ) values (p_request_id, p_actor_id, p_new_status::text, p_reason, trim(p_private_note));
  end if;
  return v_request;
end $$;

create or replace function public.mark_referral_submitted_as(
  p_actor_id uuid,
  p_request_id uuid,
  p_referral_date date default null,
  p_confirmation_number text default null,
  p_note_to_student text default null
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.referral_requests;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role::text = 'employee') then
    raise exception 'employee access required' using errcode = '42501';
  end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> p_actor_id then
    raise exception 'request is assigned to another employee' using errcode = '42501';
  end if;
  if v_request.status::text <> 'approved' then
    raise exception 'invalid referral status transition';
  end if;
  if coalesce(p_referral_date, current_date) > current_date then
    raise exception 'referral date cannot be in the future';
  end if;

  update public.referral_requests set
    status = 'referred'::public.referral_status,
    referral_date = coalesce(p_referral_date, current_date),
    referral_confirmation_number = nullif(trim(p_confirmation_number), ''),
    referral_note_to_student = nullif(trim(p_note_to_student), ''),
    referral_submitted_at = now(),
    referral_submitted_by = p_actor_id,
    updated_at = now()
  where id = p_request_id returning * into v_request;

  perform public.refai_append_referral_status(
    p_request_id, 'approved', 'referred', p_actor_id,
    nullif(trim(p_note_to_student), '')
  );
  return v_request;
end $$;

revoke execute on function public.mark_referral_submitted_as(uuid, uuid, date, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_referral_submitted_as(uuid, uuid, date, text, text)
  to service_role;
