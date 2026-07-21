-- Ensure every new Auth user receives a profiles.role accepted by
-- profiles_role_valid. Selected signup metadata is honored when valid;
-- Google OAuth users without role metadata safely default to student.

create or replace function public.refai_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_email boolean;
  selected_role text;
begin
  selected_role := case
    when lower(coalesce(new.raw_user_meta_data ->> 'role', new.raw_app_meta_data ->> 'role', '')) = 'employee'
      then 'employee'
    else 'student'
  end;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  if not exists (select 1 from public.profiles where id = new.id) then
    if has_email then
      if selected_role = 'employee' then
        insert into public.profiles(id, role, full_name, college, email)
        values (new.id, 'employee', coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')), nullif(new.raw_user_meta_data ->> 'college', ''), new.email);
      else
        insert into public.profiles(id, role, full_name, college, email)
        values (new.id, 'student', coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')), nullif(new.raw_user_meta_data ->> 'college', ''), new.email);
      end if;
    elsif selected_role = 'employee' then
      insert into public.profiles(id, role, full_name, college)
      values (new.id, 'employee', coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')), nullif(new.raw_user_meta_data ->> 'college', ''));
    else
      insert into public.profiles(id, role, full_name, college)
      values (new.id, 'student', coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')), nullif(new.raw_user_meta_data ->> 'college', ''));
    end if;
  end if;
  return new;
end;
$$;

-- Replace only competing auth.users triggers whose function inserts directly
-- into public.profiles. Unrelated Auth triggers remain untouched.
do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgname <> 'refai_on_auth_user_created'
      and regexp_replace(lower(pg_get_functiondef(p.oid)), '[[:space:]]+', ' ', 'g')
        ~ 'insert into (public\.)?profiles[ (]'
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_record.tgname);
  end loop;
end;
$$;

drop trigger if exists refai_on_auth_user_created on auth.users;
create trigger refai_on_auth_user_created
after insert on auth.users
for each row execute function public.refai_handle_new_user();

create or replace function public.refai_sync_profile_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'employee' then
    update public.profiles
    set role = 'employee',
        full_name = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), full_name),
        college = coalesce(nullif(new.raw_user_meta_data ->> 'college', ''), college),
        updated_at = now()
    where id = new.id;
  elsif lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'student' then
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
  return new;
end;
$$;

drop trigger if exists refai_on_auth_user_metadata_updated on auth.users;
create trigger refai_on_auth_user_metadata_updated
after update of raw_user_meta_data on auth.users
for each row execute function public.refai_sync_profile_metadata();
