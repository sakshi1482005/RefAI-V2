-- Keep employee_profiles.company as RefAI's canonical employer field.
-- Auth metadata is used only to backfill a genuinely missing canonical value.

create or replace function public.refai_normalize_employee_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company is not null then
    new.company := nullif(
      regexp_replace(btrim(new.company), '[[:space:]]+', ' ', 'g'),
      ''
    );
  end if;
  return new;
end;
$$;

drop trigger if exists employee_profiles_normalize_company on public.employee_profiles;
create trigger employee_profiles_normalize_company
before insert or update of company on public.employee_profiles
for each row execute function public.refai_normalize_employee_company();

-- Normalize existing canonical values without replacing any non-empty employer.
update public.employee_profiles
set company = regexp_replace(btrim(company), '[[:space:]]+', ' ', 'g')
where company is not null
  and btrim(company) <> ''
  and company is distinct from regexp_replace(btrim(company), '[[:space:]]+', ' ', 'g');

-- Create or complete an employee profile only when legacy Auth metadata contains
-- a real employer. preferred_company is deliberately excluded because it is a
-- student opportunity preference, not an employee's employer.
insert into public.employee_profiles(profile_id, company)
select
  p.id,
  metadata.company
from public.profiles p
join auth.users u on u.id = p.id
cross join lateral (
  select nullif(
    regexp_replace(
      btrim(coalesce(
        nullif(u.raw_user_meta_data ->> 'company_name', ''),
        nullif(u.raw_user_meta_data ->> 'company', ''),
        ''
      )),
      '[[:space:]]+', ' ', 'g'
    ),
    ''
  ) as company
) metadata
where p.role::text = 'employee'
  and metadata.company is not null
  and length(metadata.company) <= 200
on conflict (profile_id) do update
set company = excluded.company
where public.employee_profiles.company is null
   or btrim(public.employee_profiles.company) = '';

-- New email/password employee signups can now seed the canonical profile from
-- the company_name metadata supplied by the existing onboarding form.
create or replace function public.refai_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_email boolean;
  selected_role text;
  normalized_company text;
begin
  selected_role := case
    when lower(coalesce(new.raw_user_meta_data ->> 'role', new.raw_app_meta_data ->> 'role', '')) = 'employee'
      then 'employee'
    else 'student'
  end;
  normalized_company := nullif(
    regexp_replace(
      btrim(coalesce(
        nullif(new.raw_user_meta_data ->> 'company_name', ''),
        nullif(new.raw_user_meta_data ->> 'company', ''),
        ''
      )),
      '[[:space:]]+', ' ', 'g'
    ),
    ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  if not exists (select 1 from public.profiles where id = new.id) then
    if has_email then
      insert into public.profiles(id, role, full_name, college, email)
      values (
        new.id,
        selected_role::public.user_role,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
        nullif(new.raw_user_meta_data ->> 'college', ''),
        new.email
      );
    else
      insert into public.profiles(id, role, full_name, college)
      values (
        new.id,
        selected_role::public.user_role,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
        nullif(new.raw_user_meta_data ->> 'college', '')
      );
    end if;
  end if;

  if selected_role = 'employee'
     and normalized_company is not null
     and length(normalized_company) <= 200 then
    insert into public.employee_profiles(profile_id, company)
    values (new.id, normalized_company)
    on conflict (profile_id) do update
    set company = excluded.company
    where public.employee_profiles.company is null
       or btrim(public.employee_profiles.company) = '';
  end if;

  return new;
end;
$$;

create or replace function public.refai_sync_profile_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text;
  normalized_company text;
begin
  selected_role := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));

  if selected_role = 'employee' then
    update public.profiles
    set role = 'employee',
        full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), full_name),
        college = coalesce(nullif(new.raw_user_meta_data ->> 'college', ''), college),
        updated_at = now()
    where id = new.id;
  elsif selected_role = 'student' then
    update public.profiles
    set role = 'student',
        full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), full_name),
        college = coalesce(nullif(new.raw_user_meta_data ->> 'college', ''), college),
        updated_at = now()
    where id = new.id;
  else
    update public.profiles
    set full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), full_name),
        college = coalesce(nullif(new.raw_user_meta_data ->> 'college', ''), college),
        updated_at = now()
    where id = new.id;
  end if;

  normalized_company := nullif(
    regexp_replace(
      btrim(coalesce(
        nullif(new.raw_user_meta_data ->> 'company_name', ''),
        nullif(new.raw_user_meta_data ->> 'company', ''),
        ''
      )),
      '[[:space:]]+', ' ', 'g'
    ),
    ''
  );

  if selected_role = 'employee'
     and normalized_company is not null
     and length(normalized_company) <= 200 then
    insert into public.employee_profiles(profile_id, company)
    values (new.id, normalized_company)
    on conflict (profile_id) do update
    set company = excluded.company
    where public.employee_profiles.company is null
       or btrim(public.employee_profiles.company) = '';
  end if;

  return new;
end;
$$;

-- Referral rows keep the employer shown at submission time. The snapshot is
-- nullable for historical requests whose employee company is genuinely absent.
alter table public.referral_requests
  add column if not exists employee_company_snapshot text;

update public.referral_requests r
set employee_company_snapshot = ep.company
from public.employee_profiles ep
where ep.profile_id = r.employee_id
  and (r.employee_company_snapshot is null or btrim(r.employee_company_snapshot) = '')
  and ep.company is not null
  and btrim(ep.company) <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referral_requests'::regclass
      and conname = 'referral_requests_employee_company_snapshot_valid'
  ) then
    alter table public.referral_requests
      add constraint referral_requests_employee_company_snapshot_valid
      check (
        employee_company_snapshot is null
        or length(btrim(employee_company_snapshot)) between 1 and 200
      ) not valid;
  end if;
end;
$$;

create or replace function public.refai_normalize_referral_employee_company_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.employee_company_snapshot is not null
     and new.employee_company_snapshot is distinct from old.employee_company_snapshot then
    new.employee_company_snapshot := old.employee_company_snapshot;
  elsif new.employee_company_snapshot is not null then
    new.employee_company_snapshot := nullif(
      regexp_replace(btrim(new.employee_company_snapshot), '[[:space:]]+', ' ', 'g'),
      ''
    );
  end if;
  return new;
end;
$$;

drop trigger if exists referral_requests_normalize_employee_company_snapshot on public.referral_requests;
create trigger referral_requests_normalize_employee_company_snapshot
before insert or update of employee_company_snapshot on public.referral_requests
for each row execute function public.refai_normalize_referral_employee_company_snapshot();

-- Existing RLS policies remain in force for both tables and automatically cover
-- these columns. No anonymous grant or public policy is added.
