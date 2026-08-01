-- RefAI role-specific profile foundation.
-- Creates the tables used by the existing API on fresh projects and completes
-- partially provisioned tables without duplicating columns.

create table if not exists public.student_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  college text,
  degree text,
  branch text,
  graduation_year integer,
  preferred_role text,
  preferred_company text,
  skills text[] not null default '{}'::text[],
  bio text,
  linkedin text,
  github text,
  portfolio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles
  add column if not exists profile_id uuid,
  add column if not exists college text,
  add column if not exists degree text,
  add column if not exists branch text,
  add column if not exists graduation_year integer,
  add column if not exists preferred_role text,
  add column if not exists preferred_company text,
  add column if not exists skills text[] default '{}'::text[],
  add column if not exists bio text,
  add column if not exists linkedin text,
  add column if not exists github text,
  add column if not exists portfolio text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.student_profiles set skills = '{}'::text[] where skills is null;
update public.student_profiles set created_at = now() where created_at is null;
update public.student_profiles set updated_at = now() where updated_at is null;

alter table public.student_profiles
  alter column profile_id set not null,
  alter column skills set default '{}'::text[],
  alter column skills set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists student_profiles_profile_id_uidx
  on public.student_profiles(profile_id);
create index if not exists student_profiles_college_idx
  on public.student_profiles(college) where college is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_profiles'::regclass
      and conname = 'student_profiles_profile_id_fkey'
  ) then
    alter table public.student_profiles
      add constraint student_profiles_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_profiles'::regclass
      and conname = 'student_profiles_graduation_year_valid'
  ) then
    alter table public.student_profiles
      add constraint student_profiles_graduation_year_valid
      check (graduation_year is null or graduation_year between 1900 and 2200);
  end if;
end $$;

create or replace function public.refai_set_student_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.refai_set_student_profile_updated_at();

alter table public.student_profiles enable row level security;

drop policy if exists student_profiles_read_own on public.student_profiles;
create policy student_profiles_read_own on public.student_profiles
for select to authenticated using (profile_id = auth.uid());

drop policy if exists student_profiles_insert_own on public.student_profiles;
create policy student_profiles_insert_own on public.student_profiles
for insert to authenticated with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'student'
  )
);

drop policy if exists student_profiles_update_own on public.student_profiles;
create policy student_profiles_update_own on public.student_profiles
for update to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'student'
  )
);

revoke all on public.student_profiles from anon;
grant select, insert, update on public.student_profiles to authenticated;

create table if not exists public.employee_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  company text not null,
  designation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_profiles
  add column if not exists profile_id uuid,
  add column if not exists company text,
  add column if not exists designation text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.employee_profiles set created_at = now() where created_at is null;
update public.employee_profiles set updated_at = now() where updated_at is null;

alter table public.employee_profiles
  alter column profile_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists employee_profiles_profile_id_uidx
  on public.employee_profiles(profile_id);
create index if not exists employee_profiles_company_idx
  on public.employee_profiles(company) where company is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_profile_id_fkey'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_company_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_company_valid
      check (company is null or length(trim(company)) between 1 and 200);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employee_profiles'::regclass
      and conname = 'employee_profiles_designation_valid'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_designation_valid
      check (designation is null or length(trim(designation)) between 1 and 200);
  end if;
end $$;

create or replace function public.refai_set_employee_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;
create trigger employee_profiles_set_updated_at
before update on public.employee_profiles
for each row execute function public.refai_set_employee_profile_updated_at();

alter table public.employee_profiles enable row level security;

drop policy if exists employee_profiles_directory_read on public.employee_profiles;
create policy employee_profiles_directory_read on public.employee_profiles
for select to authenticated using (true);

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

revoke all on public.employee_profiles from anon;
grant select, insert, update on public.employee_profiles to authenticated;
