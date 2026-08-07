do $$
declare missing text;
begin
  select string_agg(name, ', ') into missing from (values
    ('profiles'),('student_profiles'),('employee_profiles'),('resume_analyses'),('trust_cards'),
    ('referral_requests'),('referral_status_history'),
    ('proof_entries'),('notifications'),('ai_apply_goals'),('ai_apply_match_runs'),('ai_apply_matches')
  ) expected(name) where to_regclass('public.' || name) is null;
  if missing is not null then raise exception 'Missing tables: %', missing; end if;
  if not exists (select 1 from storage.buckets where id='resumes' and public=false) then raise exception 'Private resumes bucket is missing or public'; end if;
  if not exists (select 1 from pg_trigger where tgname='refai_on_auth_user_created' and not tgisinternal) then raise exception 'Auth profile trigger is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_profiles' and column_name='company') then raise exception 'Canonical employee company column is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='referral_requests' and column_name='employee_company_snapshot') then raise exception 'Referral employee company snapshot is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='employee_profiles' and column_name='ai_apply_opt_in') then raise exception 'Employee AI Apply opt-in column is missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='employee_profiles_normalize_company' and not tgisinternal) then raise exception 'Employee company normalization trigger is missing'; end if;
  if exists (select 1 from (values ('profiles'),('student_profiles'),('employee_profiles'),('resume_analyses'),('trust_cards'),('referral_requests'),('referral_status_history'),('proof_entries'),('notifications'),('ai_apply_goals'),('ai_apply_match_runs'),('ai_apply_matches')) x(name) join pg_class c on c.relname=x.name join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where not c.relrowsecurity) then raise exception 'A required table does not have RLS enabled'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'resume_%') < 4 then raise exception 'Resume object policies are incomplete'; end if;
end $$;
select 'fresh deployment structural verification passed' as result;
