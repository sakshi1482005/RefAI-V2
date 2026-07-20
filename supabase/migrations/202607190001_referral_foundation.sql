-- RefAI referral foundation compatibility migration.
-- This migration is additive and rerunnable. It never drops tables, columns,
-- indexes, data, enum types, or policies not owned by this migration.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('student', 'employee');
  elsif not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role' and t.typtype = 'e'
  ) then
    raise exception 'public.user_role already exists but is not an enum; manual compatibility review is required';
  end if;
end $$;

do $$
declare value text;
begin
  foreach value in array array['student', 'employee'] loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'user_role' and e.enumlabel = value
    ) then
      raise exception 'public.user_role is missing required value %. Add the value in a separate committed migration, then rerun this migration.', value;
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'referral_status'
  ) then
    create type public.referral_status as enum (
      'pending', 'under_review', 'more_info_requested', 'approved', 'declined', 'referred'
    );
  elsif not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'referral_status' and t.typtype = 'e'
  ) then
    raise exception 'public.referral_status already exists but is not an enum; manual compatibility review is required';
  end if;
end $$;

do $$
declare value text;
begin
  foreach value in array array['pending', 'under_review', 'more_info_requested', 'approved', 'declined', 'referred'] loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'referral_status' and e.enumlabel = value
    ) then
      raise exception 'public.referral_status is missing required value %. Add the value in a separate committed migration, then rerun this migration.', value;
    end if;
  end loop;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text,
  college text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists id uuid;
alter table public.profiles add column if not exists role public.user_role;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Preserve every existing non-null role. Backfill only missing roles from a
-- protected employee profile table or auth app metadata, then default to student.
do $$
begin
  if to_regclass('public.employee_profiles') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employee_profiles' and column_name = 'user_id') then
      begin
        execute 'update public.profiles p set role = ''employee'' where p.role is null and exists (select 1 from public.employee_profiles e where e.user_id = p.id)';
      exception when others then
        raise notice 'Could not backfill roles from employee_profiles.user_id: %', sqlerrm;
      end;
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employee_profiles' and column_name = 'id') then
      begin
        execute 'update public.profiles p set role = ''employee'' where p.role is null and exists (select 1 from public.employee_profiles e where e.id = p.id)';
      exception when others then
        raise notice 'Could not backfill roles from employee_profiles.id: %', sqlerrm;
      end;
    end if;
  end if;

  update public.profiles p
  set role = 'employee'
  from auth.users u
  where p.id = u.id and p.role is null and u.raw_app_meta_data ->> 'role' = 'employee';

  update public.profiles set role = 'student' where role is null;
  alter table public.profiles alter column role set default 'student';
end $$;

update public.profiles set created_at = now() where created_at is null;
update public.profiles set updated_at = now() where updated_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_valid') then
    alter table public.profiles add constraint profiles_role_valid
      check (role is not null and role::text in ('student', 'employee')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_id_required') then
    alter table public.profiles add constraint profiles_id_required check (id is not null) not valid;
  end if;
end $$;

do $$
begin
  if not exists (select id from public.profiles where id is not null group by id having count(*) > 1) then
    create unique index if not exists profiles_id_refai_uidx on public.profiles(id);
  else
    raise notice 'profiles.id contains nulls or duplicates; unique index and dependent foreign keys require manual cleanup';
  end if;
end $$;

create table if not exists public.trust_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trust_cards add column if not exists id uuid default gen_random_uuid();
alter table public.trust_cards add column if not exists student_id uuid;
alter table public.trust_cards add column if not exists payload jsonb default '{}'::jsonb;
alter table public.trust_cards add column if not exists created_at timestamptz default now();
update public.trust_cards set id = gen_random_uuid() where id is null;
update public.trust_cards set payload = '{}'::jsonb where payload is null;
update public.trust_cards set created_at = now() where created_at is null;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trust_cards' and column_name = 'user_id') then
    begin
      execute 'update public.trust_cards set student_id = user_id where student_id is null and user_id is not null';
    exception when others then
      raise notice 'Could not backfill trust_cards.student_id from legacy user_id: %', sqlerrm;
    end;
  end if;
end $$;

do $$
begin
  if not exists (select id from public.trust_cards group by id having count(*) > 1) then
    create unique index if not exists trust_cards_id_refai_uidx on public.trust_cards(id);
  else
    raise notice 'trust_cards.id contains duplicates; unique index requires manual cleanup';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.trust_cards'::regclass and conname = 'trust_cards_required_fields') then
    alter table public.trust_cards add constraint trust_cards_required_fields
      check (id is not null and student_id is not null and payload is not null and jsonb_typeof(payload) = 'object') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.trust_cards'::regclass and conname = 'trust_cards_student_id_fkey') then
    begin
      alter table public.trust_cards add constraint trust_cards_student_id_fkey
        foreign key (student_id) references public.profiles(id) on delete cascade not valid;
    exception when others then
      raise notice 'Could not add trust_cards student foreign key: %', sqlerrm;
    end;
  end if;
end $$;

create table if not exists public.referral_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  trust_card_id uuid not null references public.trust_cards(id) on delete restrict,
  target_role text not null,
  target_company text not null,
  job_description text not null,
  student_message text not null,
  status public.referral_status not null default 'pending',
  employee_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referral_requests add column if not exists id uuid default gen_random_uuid();
alter table public.referral_requests add column if not exists student_id uuid;
alter table public.referral_requests add column if not exists employee_id uuid;
alter table public.referral_requests add column if not exists trust_card_id uuid;
alter table public.referral_requests add column if not exists target_role text;
alter table public.referral_requests add column if not exists target_company text;
alter table public.referral_requests add column if not exists job_description text;
alter table public.referral_requests add column if not exists student_message text;
alter table public.referral_requests add column if not exists status public.referral_status default 'pending';
alter table public.referral_requests add column if not exists employee_note text;
alter table public.referral_requests add column if not exists created_at timestamptz default now();
alter table public.referral_requests add column if not exists updated_at timestamptz default now();
update public.referral_requests set id = gen_random_uuid() where id is null;
update public.referral_requests set status = 'pending' where status is null;
update public.referral_requests set created_at = now() where created_at is null;
update public.referral_requests set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.referral_requests alter column status set default 'pending';

do $$
begin
  if not exists (select id from public.referral_requests group by id having count(*) > 1) then
    create unique index if not exists referral_requests_id_refai_uidx on public.referral_requests(id);
  else
    raise notice 'referral_requests.id contains duplicates; unique index requires manual cleanup';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_requests'::regclass and conname = 'referral_requests_required_fields') then
    alter table public.referral_requests add constraint referral_requests_required_fields check (
      id is not null and student_id is not null and employee_id is not null and trust_card_id is not null
      and target_role is not null and length(trim(target_role)) between 1 and 200
      and target_company is not null and length(trim(target_company)) between 1 and 200
      and job_description is not null and length(trim(job_description)) between 1 and 100000
      and student_message is not null and length(trim(student_message)) between 1 and 1000
      and status is not null and status::text in ('pending','under_review','more_info_requested','approved','declined','referred')
      and (employee_note is null or length(employee_note) <= 2000)
      and student_id <> employee_id
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_requests'::regclass and conname = 'referral_requests_student_id_fkey') then
    begin
      alter table public.referral_requests add constraint referral_requests_student_id_fkey
        foreign key (student_id) references public.profiles(id) on delete cascade not valid;
    exception when others then raise notice 'Could not add referral student foreign key: %', sqlerrm;
    end;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_requests'::regclass and conname = 'referral_requests_employee_id_fkey') then
    begin
      alter table public.referral_requests add constraint referral_requests_employee_id_fkey
        foreign key (employee_id) references public.profiles(id) on delete restrict not valid;
    exception when others then raise notice 'Could not add referral employee foreign key: %', sqlerrm;
    end;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_requests'::regclass and conname = 'referral_requests_trust_card_id_fkey') then
    begin
      alter table public.referral_requests add constraint referral_requests_trust_card_id_fkey
        foreign key (trust_card_id) references public.trust_cards(id) on delete restrict not valid;
    exception when others then raise notice 'Could not add referral Trust Card foreign key: %', sqlerrm;
    end;
  end if;
end $$;

create table if not exists public.referral_status_history (
  id bigint generated always as identity primary key,
  referral_request_id uuid not null references public.referral_requests(id) on delete cascade,
  previous_status public.referral_status,
  new_status public.referral_status not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);

alter table public.referral_status_history add column if not exists id bigint;
alter table public.referral_status_history add column if not exists referral_request_id uuid;
alter table public.referral_status_history add column if not exists previous_status public.referral_status;
alter table public.referral_status_history add column if not exists new_status public.referral_status;
alter table public.referral_status_history add column if not exists changed_by uuid;
alter table public.referral_status_history add column if not exists note text;
alter table public.referral_status_history add column if not exists created_at timestamptz default now();
create sequence if not exists public.referral_status_history_id_refai_seq;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_status_history'
      and column_name = 'id' and is_identity = 'YES'
  ) then
    alter sequence public.referral_status_history_id_refai_seq owned by public.referral_status_history.id;
    alter table public.referral_status_history alter column id set default nextval('public.referral_status_history_id_refai_seq');
  end if;
end $$;
create sequence if not exists public.referral_status_history_id_refai_seq;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_status_history'
      and column_name = 'id' and is_identity = 'YES'
  ) then
    alter sequence public.referral_status_history_id_refai_seq owned by public.referral_status_history.id;
    alter table public.referral_status_history alter column id set default nextval('public.referral_status_history_id_refai_seq');
    -- Only backfill here: this branch only runs when id is a plain bigint
    -- (not GENERATED ALWAYS AS IDENTITY), so a direct UPDATE is legal.
    update public.referral_status_history
    set id = nextval('public.referral_status_history_id_refai_seq') where id is null;
  end if;
end $$;
update public.referral_status_history set created_at = now() where created_at is null;

do $$
begin
  if not exists (select id from public.referral_status_history where id is not null group by id having count(*) > 1) then
    create unique index if not exists referral_status_history_id_refai_uidx on public.referral_status_history(id);
  else
    raise notice 'referral_status_history.id contains duplicates; unique index requires manual cleanup';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_status_history'::regclass and conname = 'referral_history_required_fields') then
    alter table public.referral_status_history add constraint referral_history_required_fields check (
      id is not null and referral_request_id is not null and new_status is not null
      and new_status::text in ('pending','under_review','more_info_requested','approved','declined','referred')
      and (previous_status is null or previous_status::text in ('pending','under_review','more_info_requested','approved','declined','referred'))
      and changed_by is not null and (note is null or length(note) <= 2000)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_status_history'::regclass and conname = 'referral_status_history_request_id_fkey') then
    begin
      alter table public.referral_status_history add constraint referral_status_history_request_id_fkey
        foreign key (referral_request_id) references public.referral_requests(id) on delete cascade not valid;
    exception when others then raise notice 'Could not add referral history request foreign key: %', sqlerrm;
    end;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.referral_status_history'::regclass and conname = 'referral_status_history_changed_by_fkey') then
    begin
      alter table public.referral_status_history add constraint referral_status_history_changed_by_fkey
        foreign key (changed_by) references public.profiles(id) on delete restrict not valid;
    exception when others then raise notice 'Could not add referral history actor foreign key: %', sqlerrm;
    end;
  end if;
end $$;

create index if not exists referral_requests_student_idx on public.referral_requests(student_id, created_at desc);
create index if not exists referral_requests_employee_idx on public.referral_requests(employee_id, created_at desc);
create index if not exists referral_history_request_idx on public.referral_status_history(referral_request_id, created_at);

-- Use RefAI-specific function and trigger names. Existing auth triggers are not
-- removed or replaced. If another trigger already maintains public.profiles,
-- this migration leaves that trigger in charge.
create or replace function public.refai_handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  has_email boolean;
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
    ) into has_email;

    if has_email then
      insert into public.profiles(id, role, full_name, college, email)
      values (new.id, 'student', nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'college', ''), new.email);
    else
      insert into public.profiles(id, role, full_name, college)
      values (new.id, 'student', nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'college', ''));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists refai_on_auth_user_created on auth.users;
do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgname <> 'refai_on_auth_user_created'
      and lower(pg_get_functiondef(p.oid)) like '%profiles%'
  ) then
    raise notice 'An existing auth trigger already appears to maintain profiles; refai_on_auth_user_created was not added';
  else
    create trigger refai_on_auth_user_created after insert on auth.users
    for each row execute function public.refai_handle_new_user();
  end if;
end $$;

do $$
declare
  role_type text;
  has_email boolean;
begin
  select udt_name into role_type from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  if role_type = 'user_role' then
    if has_email then
      execute $sql$
        insert into public.profiles(id, role, full_name, college, email)
        select u.id,
          (case when u.raw_app_meta_data ->> 'role' = 'employee' then 'employee' else 'student' end)::public.user_role,
          nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'college', ''), u.email
        from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)
      $sql$;
    else
      execute $sql$
        insert into public.profiles(id, role, full_name, college)
        select u.id,
          (case when u.raw_app_meta_data ->> 'role' = 'employee' then 'employee' else 'student' end)::public.user_role,
          nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'college', '')
        from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)
      $sql$;
    end if;
  else
    if has_email then
      execute $sql$
        insert into public.profiles(id, role, full_name, college, email)
        select u.id,
          case when u.raw_app_meta_data ->> 'role' = 'employee' then 'employee' else 'student' end,
          nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'college', ''), u.email
        from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)
      $sql$;
    else
      execute $sql$
        insert into public.profiles(id, role, full_name, college)
        select u.id,
          case when u.raw_app_meta_data ->> 'role' = 'employee' then 'employee' else 'student' end,
          nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'college', '')
        from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)
      $sql$;
    end if;
  end if;
end $$;

create or replace function public.refai_sync_profile_metadata() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), full_name),
      college = coalesce(nullif(new.raw_user_meta_data ->> 'college', ''), college),
      updated_at = now()
  where id = new.id;
  return new;
end $$;

drop trigger if exists refai_on_auth_user_metadata_updated on auth.users;
create trigger refai_on_auth_user_metadata_updated after update of raw_user_meta_data on auth.users
for each row execute function public.refai_sync_profile_metadata();

create or replace function public.validate_referral_request() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = new.student_id and role::text = 'student') then
    raise exception 'student_id must identify a student';
  end if;
  if not exists (select 1 from public.profiles where id = new.employee_id and role::text = 'employee') then
    raise exception 'employee_id must identify an employee';
  end if;
  if not exists (select 1 from public.trust_cards where id = new.trust_card_id and student_id = new.student_id) then
    raise exception 'trust card must belong to the student';
  end if;
  return new;
end $$;

drop trigger if exists validate_referral_request_before_write on public.referral_requests;
create trigger validate_referral_request_before_write
before insert or update of student_id, employee_id, trust_card_id on public.referral_requests
for each row execute function public.validate_referral_request();

create or replace function public.refai_append_referral_status(
  p_request_id uuid, p_previous_status text, p_new_status text,
  p_changed_by uuid, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  previous_type text;
  new_type text;
begin
  select udt_name into previous_type from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_status_history' and column_name = 'previous_status';
  select udt_name into new_type from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_status_history' and column_name = 'new_status';

  if previous_type = 'referral_status' and new_type = 'referral_status' then
    execute 'insert into public.referral_status_history(referral_request_id, previous_status, new_status, changed_by, note) values ($1, $2::public.referral_status, $3::public.referral_status, $4, $5)'
      using p_request_id, p_previous_status, p_new_status, p_changed_by, p_note;
  elsif previous_type in ('text', 'varchar') and new_type in ('text', 'varchar') then
    insert into public.referral_status_history(referral_request_id, previous_status, new_status, changed_by, note)
    values (p_request_id, p_previous_status, p_new_status, p_changed_by, p_note);
  else
    raise exception 'referral_status_history status columns use incompatible types (% and %)', previous_type, new_type;
  end if;
end $$;

create or replace function public.record_initial_referral_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refai_append_referral_status(
    new.id, null, new.status::text, new.student_id, 'Referral request created'
  );
  return new;
end $$;

drop trigger if exists referral_created_history on public.referral_requests;
create trigger referral_created_history after insert on public.referral_requests
for each row execute function public.record_initial_referral_status();

create or replace function public.transition_referral_request(
  p_request_id uuid, p_new_status public.referral_status, p_note text default null
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.referral_requests;
  v_role text;
  v_previous text;
  v_status_type text;
begin
  select role::text into v_role from public.profiles where id = auth.uid();
  if v_role <> 'employee' then raise exception 'employee access required' using errcode = '42501'; end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> auth.uid() then raise exception 'request is assigned to another employee' using errcode = '42501'; end if;
  v_previous := v_request.status::text;
  if not (
    (v_previous = 'pending' and p_new_status::text in ('under_review','more_info_requested','approved','declined')) or
    (v_previous = 'under_review' and p_new_status::text in ('more_info_requested','approved','declined')) or
    (v_previous = 'more_info_requested' and p_new_status::text in ('under_review','declined')) or
    (v_previous = 'approved' and p_new_status::text = 'referred')
  ) then raise exception 'invalid referral status transition'; end if;
  select udt_name into v_status_type from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_requests' and column_name = 'status';
  if v_status_type = 'referral_status' then
    execute 'update public.referral_requests set status = $1, employee_note = $2, updated_at = now() where id = $3 returning *'
      into v_request using p_new_status, p_note, p_request_id;
  else
    execute 'update public.referral_requests set status = $1::text, employee_note = $2, updated_at = now() where id = $3 returning *'
      into v_request using p_new_status, p_note, p_request_id;
  end if;
  perform public.refai_append_referral_status(
    p_request_id, v_previous, p_new_status::text, auth.uid(), p_note
  );
  return v_request;
end $$;

create or replace function public.transition_referral_request_as(
  p_actor_id uuid, p_request_id uuid, p_new_status public.referral_status, p_note text default null
) returns public.referral_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.referral_requests;
  v_role text;
  v_previous text;
  v_status_type text;
begin
  select role::text into v_role from public.profiles where id = p_actor_id;
  if v_role <> 'employee' then raise exception 'employee access required' using errcode = '42501'; end if;
  select * into v_request from public.referral_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'referral request not found'; end if;
  if v_request.employee_id <> p_actor_id then raise exception 'request is assigned to another employee' using errcode = '42501'; end if;
  v_previous := v_request.status::text;
  if not (
    (v_previous = 'pending' and p_new_status::text in ('under_review','more_info_requested','approved','declined')) or
    (v_previous = 'under_review' and p_new_status::text in ('more_info_requested','approved','declined')) or
    (v_previous = 'more_info_requested' and p_new_status::text in ('under_review','declined')) or
    (v_previous = 'approved' and p_new_status::text = 'referred')
  ) then raise exception 'invalid referral status transition'; end if;
  select udt_name into v_status_type from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_requests' and column_name = 'status';
  if v_status_type = 'referral_status' then
    execute 'update public.referral_requests set status = $1, employee_note = $2, updated_at = now() where id = $3 returning *'
      into v_request using p_new_status, p_note, p_request_id;
  else
    execute 'update public.referral_requests set status = $1::text, employee_note = $2, updated_at = now() where id = $3 returning *'
      into v_request using p_new_status, p_note, p_request_id;
  end if;
  perform public.refai_append_referral_status(
    p_request_id, v_previous, p_new_status::text, p_actor_id, p_note
  );
  return v_request;
end $$;

alter table public.profiles enable row level security;
alter table public.trust_cards enable row level security;
alter table public.referral_requests enable row level security;
alter table public.referral_status_history enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select using (id = auth.uid());

drop policy if exists trust_cards_student_insert on public.trust_cards;
create policy trust_cards_student_insert on public.trust_cards for insert
with check (student_id = auth.uid() and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'student'
));

drop policy if exists trust_cards_authorized_read on public.trust_cards;
create policy trust_cards_authorized_read on public.trust_cards for select using (
  student_id = auth.uid() or exists (
    select 1 from public.referral_requests r where r.trust_card_id = trust_cards.id and r.employee_id = auth.uid()
  )
);

drop policy if exists requests_student_create on public.referral_requests;
create policy requests_student_create on public.referral_requests for insert
with check (student_id = auth.uid() and status::text = 'pending');

drop policy if exists requests_participant_read on public.referral_requests;
create policy requests_participant_read on public.referral_requests for select
using (student_id = auth.uid() or employee_id = auth.uid());

drop policy if exists requests_assigned_employee_update on public.referral_requests;
create policy requests_assigned_employee_update on public.referral_requests for update
using (employee_id = auth.uid()) with check (employee_id = auth.uid());

drop policy if exists history_participant_read on public.referral_status_history;
create policy history_participant_read on public.referral_status_history for select using (exists (
  select 1 from public.referral_requests r
  where r.id = referral_status_history.referral_request_id
    and (r.student_id = auth.uid() or r.employee_id = auth.uid())
));

revoke all on public.profiles, public.trust_cards, public.referral_requests, public.referral_status_history from anon;
grant select on public.profiles to authenticated;
grant select, insert on public.trust_cards to authenticated;
grant select, insert on public.referral_requests to authenticated;
grant select on public.referral_status_history to authenticated;
grant execute on function public.transition_referral_request(uuid, public.referral_status, text) to authenticated;
revoke execute on function public.transition_referral_request(uuid, public.referral_status, text) from public, anon;
revoke execute on function public.transition_referral_request_as(uuid, uuid, public.referral_status, text) from public, anon, authenticated;
grant execute on function public.transition_referral_request_as(uuid, uuid, public.referral_status, text) to service_role;
revoke execute on function public.refai_append_referral_status(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.refai_append_referral_status(uuid, text, text, uuid, text) to service_role;
