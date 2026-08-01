-- Compatibility migration for projects that predate the profile foundation.
-- The foundation already creates branch on fresh projects; this remains a safe
-- no-op there and adds only the historical branch field on older projects.

alter table public.student_profiles
  add column if not exists branch text;
