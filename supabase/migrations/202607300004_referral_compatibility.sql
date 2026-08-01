-- Persist the deterministic compatibility snapshot used immediately before
-- referral submission. The snapshot is recalculated by the backend on create.

alter table public.referral_requests
  add column if not exists compatibility_score integer,
  add column if not exists compatibility_label text,
  add column if not exists compatibility_version text,
  add column if not exists compatibility_payload jsonb;

-- Reconcile the original referral constraint with RefAI's optional-JD rule.
alter table public.referral_requests
  drop constraint if exists referral_requests_required_fields;

alter table public.referral_requests
  add constraint referral_requests_required_fields check (
    id is not null
    and student_id is not null
    and employee_id is not null
    and trust_card_id is not null
    and target_role is not null
    and length(trim(target_role)) between 1 and 200
    and target_company is not null
    and length(trim(target_company)) between 1 and 200
    and job_description is not null and length(job_description) <= 100000
    and student_message is not null
    and length(trim(student_message)) between 1 and 1000
    and status is not null
    and status::text in (
      'pending',
      'under_review',
      'more_info_requested',
      'approved',
      'declined',
      'referred'
    )
    and (
      employee_note is null
      or length(employee_note) <= 2000
    )
    and student_id <> employee_id
  ) NOT VALID;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.referral_requests'::regclass
      and conname = 'referral_requests_compatibility_valid'
  ) then
    alter table public.referral_requests
      add constraint referral_requests_compatibility_valid check (
        (compatibility_score is null or compatibility_score between 0 and 100)
        and (
          compatibility_label is null
          or compatibility_label in (
            'Strong fit',
            'Good fit',
            'Review fit',
            'Low fit'
          )
        )
        and (
          compatibility_version is null
          or length(compatibility_version) <= 50
        )
        and (
          compatibility_payload is null
          or jsonb_typeof(compatibility_payload) = 'object'
        )
      );
  end if;
end $$;

create index if not exists referral_requests_compatibility_idx
  on public.referral_requests (
    employee_id,
    compatibility_score,
    created_at desc
  );