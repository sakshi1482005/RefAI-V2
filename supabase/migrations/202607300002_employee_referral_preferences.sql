-- Structured employee referral preferences.
-- Extends the existing employee_profiles row so professional identity and
-- referral availability remain one owner-scoped record.

alter table public.employee_profiles
  add column if not exists supported_companies text[] not null default '{}'::text[],
  add column if not exists supported_roles text[] not null default '{}'::text[],
  add column if not exists supported_departments text[] not null default '{}'::text[],
  add column if not exists accepts_freshers boolean not null default true,
  add column if not exists minimum_evidence_expectations text[] not null default '{}'::text[],
  add column if not exists max_active_requests integer not null default 5,
  add column if not exists availability_status text not null default 'accepting',
  add column if not exists preferred_candidate_levels text[] not null default array['student', 'fresher']::text[],
  add column if not exists preferred_message_length text not null default 'concise',
  add column if not exists referral_guidelines text,
  add column if not exists decline_reason_codes text[] not null default '{}'::text[],
  add column if not exists referral_categories text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_max_active_requests_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_max_active_requests_valid
      check (max_active_requests between 0 and 50);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_availability_status_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_availability_status_valid
      check (availability_status in ('accepting', 'paused', 'unavailable'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_message_length_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_message_length_valid
      check (preferred_message_length in ('concise', 'standard', 'detailed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_candidate_levels_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_candidate_levels_valid
      check (preferred_candidate_levels <@ array['student', 'fresher', 'entry_level', 'experienced']::text[]);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_evidence_expectations_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_evidence_expectations_valid
      check (minimum_evidence_expectations <@ array[
        'resume', 'trust_card', 'project_evidence', 'quantified_outcomes',
        'education_details', 'portfolio_links'
      ]::text[]);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_decline_reasons_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_decline_reasons_valid
      check (decline_reason_codes <@ array[
        'insufficient_evidence', 'role_mismatch', 'capacity_unavailable',
        'profile_incomplete', 'experience_mismatch', 'unsupported_category', 'other'
      ]::text[]);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_referral_categories_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_referral_categories_valid
      check (referral_categories <@ array[
        'internship', 'full_time', 'apprenticeship', 'graduate_program',
        'campus_hiring', 'contract'
      ]::text[]);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_referral_guidelines_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_referral_guidelines_valid
      check (referral_guidelines is null or length(referral_guidelines) <= 2000);
  end if;
end $$;

create index if not exists employee_profiles_availability_idx
  on public.employee_profiles(availability_status, max_active_requests);
create index if not exists employee_profiles_supported_companies_gin
  on public.employee_profiles using gin(supported_companies);
create index if not exists employee_profiles_supported_roles_gin
  on public.employee_profiles using gin(supported_roles);
create index if not exists employee_profiles_supported_departments_gin
  on public.employee_profiles using gin(supported_departments);
create index if not exists employee_profiles_referral_categories_gin
  on public.employee_profiles using gin(referral_categories);

alter table public.employee_profiles enable row level security;

drop policy if exists employee_profiles_insert_own on public.employee_profiles;
create policy employee_profiles_insert_own on public.employee_profiles
for insert to authenticated with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'employee'
  )
);

drop policy if exists employee_profiles_update_own on public.employee_profiles;
create policy employee_profiles_update_own on public.employee_profiles
for update to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'employee'
  )
);

-- Employee profile rows contain only professional/discovery preferences.
-- Authenticated students need SELECT access for discovery; writes remain owner-only.
drop policy if exists employee_profiles_directory_read on public.employee_profiles;
create policy employee_profiles_directory_read on public.employee_profiles
for select to authenticated using (true);

revoke all on public.employee_profiles from anon;
revoke select on public.employee_profiles from authenticated;
grant select (
  profile_id, company, designation, supported_companies, supported_roles,
  supported_departments, accepts_freshers, minimum_evidence_expectations,
  max_active_requests, availability_status, preferred_candidate_levels,
  preferred_message_length, referral_guidelines, referral_categories
) on public.employee_profiles to authenticated;
grant insert, update on public.employee_profiles to authenticated;
