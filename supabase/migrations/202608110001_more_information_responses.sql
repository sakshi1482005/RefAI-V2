-- A single, auditable student response to the employee's persisted clarification request.
-- Proof entries remain owned by the student; this table stores only references to existing entries.
create table if not exists public.referral_more_information_responses (
  id uuid primary key default gen_random_uuid(),
  referral_request_id uuid not null unique references public.referral_requests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  student_response text not null,
  proof_entry_ids uuid[] not null default '{}',
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint referral_more_information_response_length check (length(trim(student_response)) between 1 and 2000),
  constraint referral_more_information_response_proof_count check (cardinality(proof_entry_ids) <= 10)
);

create index if not exists referral_more_information_responses_employee_idx
  on public.referral_more_information_responses(employee_id, responded_at desc);
create index if not exists referral_more_information_responses_student_idx
  on public.referral_more_information_responses(student_id, responded_at desc);

alter table public.referral_more_information_responses enable row level security;
drop policy if exists referral_more_information_response_student_read on public.referral_more_information_responses;
create policy referral_more_information_response_student_read on public.referral_more_information_responses
  for select to authenticated using (student_id = auth.uid());
drop policy if exists referral_more_information_response_employee_read on public.referral_more_information_responses;
create policy referral_more_information_response_employee_read on public.referral_more_information_responses
  for select to authenticated using (employee_id = auth.uid());
drop policy if exists referral_more_information_response_student_insert on public.referral_more_information_responses;
create policy referral_more_information_response_student_insert on public.referral_more_information_responses
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.referral_requests rr
      where rr.id = referral_request_id
        and rr.student_id = auth.uid()
        and rr.employee_id = employee_id
        and rr.status::text = 'more_info_requested'
    )
  );
revoke all on public.referral_more_information_responses from anon, authenticated;
grant select, insert on public.referral_more_information_responses to authenticated;
grant all on public.referral_more_information_responses to service_role;

-- Allow this new notification without weakening the existing recipient-only RLS policy.
alter table public.notifications drop constraint if exists notifications_event_type_valid;
alter table public.notifications add constraint notifications_event_type_valid check (event_type in (
  'employee_viewed_request','more_information_requested','request_approved',
  'referral_submitted','request_declined','employee_stopped_accepting',
  'resume_reanalysis_completed','student_responded'
));

create or replace function public.respond_to_referral_more_information_as(
  p_actor_id uuid,
  p_request_id uuid,
  p_student_response text,
  p_proof_entry_ids uuid[] default '{}'
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.referral_requests;
  v_count integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role::text = 'student') then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.student_id <> p_actor_id then raise exception 'referral request access denied' using errcode = '42501'; end if;
  if v_request.status::text <> 'more_info_requested' then raise exception 'invalid referral status transition'; end if;
  if length(trim(coalesce(p_student_response, ''))) < 1 or length(trim(p_student_response)) > 2000 then
    raise exception 'student response must be between 1 and 2000 characters';
  end if;
  if cardinality(coalesce(p_proof_entry_ids, '{}')) > 10 then raise exception 'no more than 10 proof entries may be attached'; end if;
  if cardinality(coalesce(p_proof_entry_ids, '{}')) > 0 then
    select count(*) into v_count from public.proof_entries pe
    where pe.id = any(p_proof_entry_ids)
      and pe.owner_id = p_actor_id
      and pe.trust_card_id = v_request.trust_card_id;
    if v_count <> cardinality(p_proof_entry_ids) then
      raise exception 'proof entries must belong to the student and this request trust card' using errcode = '42501';
    end if;
  end if;

  insert into public.referral_more_information_responses(
    referral_request_id, student_id, employee_id, student_response, proof_entry_ids
  ) values (
    p_request_id, p_actor_id, v_request.employee_id, trim(p_student_response), coalesce(p_proof_entry_ids, '{}')
  );

  update public.referral_requests set status = 'under_review'::public.referral_status, updated_at = now()
  where id = p_request_id returning * into v_request;
  insert into public.referral_status_history(
    referral_request_id, previous_status, new_status, changed_by, note, event_type
  ) values (
    p_request_id, 'more_info_requested'::public.referral_status, 'under_review'::public.referral_status,
    p_actor_id, null, 'student_responded'
  );
  return v_request;
end $$;

revoke execute on function public.respond_to_referral_more_information_as(uuid, uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.respond_to_referral_more_information_as(uuid, uuid, text, uuid[]) to service_role;
