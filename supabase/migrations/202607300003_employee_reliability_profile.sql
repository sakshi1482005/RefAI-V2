-- Professional fields used by the deterministic Employee Reliability Card.
-- verified_employee is intentionally excluded from authenticated UPDATE grants.

alter table public.employee_profiles
  add column if not exists department text,
  add column if not exists years_experience integer,
  add column if not exists verified_employee boolean not null default false,
  add column if not exists linkedin_url text,
  add column if not exists company_profile_url text,
  add column if not exists portfolio_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_department_valid'
  ) then
    alter table public.employee_profiles add constraint employee_profiles_department_valid
      check (department is null or length(trim(department)) between 1 and 120);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_years_experience_valid'
  ) then
    alter table public.employee_profiles add constraint employee_profiles_years_experience_valid
      check (years_experience is null or years_experience between 0 and 60);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_professional_links_valid'
  ) then
    alter table public.employee_profiles add constraint employee_profiles_professional_links_valid
      check (
        (linkedin_url is null or length(linkedin_url) <= 500)
        and (company_profile_url is null or length(company_profile_url) <= 500)
        and (portfolio_url is null or length(portfolio_url) <= 500)
      );
  end if;
end $$;

create index if not exists employee_profiles_verified_idx
  on public.employee_profiles(verified_employee) where verified_employee = true;

-- Students may read card fields. Verification remains service/admin controlled.
grant select (
  department, years_experience, verified_employee,
  linkedin_url, company_profile_url, portfolio_url
) on public.employee_profiles to authenticated;

revoke insert, update on public.employee_profiles from authenticated;
grant insert (
  profile_id, company, designation, supported_companies, supported_roles,
  supported_departments, accepts_freshers, minimum_evidence_expectations,
  max_active_requests, availability_status, preferred_candidate_levels,
  preferred_message_length, referral_guidelines, decline_reason_codes,
  referral_categories, department, years_experience, linkedin_url,
  company_profile_url, portfolio_url
) on public.employee_profiles to authenticated;
grant update (
  company, designation, supported_companies, supported_roles,
  supported_departments, accepts_freshers, minimum_evidence_expectations,
  max_active_requests, availability_status, preferred_candidate_levels,
  preferred_message_length, referral_guidelines, decline_reason_codes,
  referral_categories, department, years_experience, linkedin_url,
  company_profile_url, portfolio_url
) on public.employee_profiles to authenticated;
