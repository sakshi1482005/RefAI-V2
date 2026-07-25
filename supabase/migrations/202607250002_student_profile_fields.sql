-- Persist the complete editable Student profile in the existing student_profiles row.
-- Additive and safe to rerun; no existing data is changed or removed.

alter table public.student_profiles
  add column if not exists branch text,
  add column if not exists preferred_role text,
  add column if not exists preferred_company text,
  add column if not exists skills text[] not null default '{}'::text[],
  add column if not exists bio text,
  add column if not exists linkedin text,
  add column if not exists github text,
  add column if not exists portfolio text;
