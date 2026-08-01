-- Compatibility migration for projects that had the original education table.
-- Branch is owned by 202607250001; the fields below are intentionally
-- non-overlapping and are already present on fresh foundation deployments.

alter table public.student_profiles
  add column if not exists preferred_role text,
  add column if not exists preferred_company text,
  add column if not exists skills text[] not null default '{}'::text[],
  add column if not exists bio text,
  add column if not exists linkedin text,
  add column if not exists github text,
  add column if not exists portfolio text;
