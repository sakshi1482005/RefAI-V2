-- Persist authenticated Student analysis data and link Trust Cards to it.
-- Additive and safe for existing RefAI data.

create extension if not exists pgcrypto;

create table if not exists public.resume_analyses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  resume_id text not null,
  file_name text not null,
  storage_path text,
  storage_status text not null,
  resume_text text not null,
  target_role text not null,
  target_company text not null,
  job_description text not null,
  upload_payload jsonb not null,
  analysis_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, resume_id)
);

alter table public.trust_cards add column if not exists analysis_id uuid references public.resume_analyses(id) on delete set null;
create unique index if not exists trust_cards_analysis_id_uidx on public.trust_cards(analysis_id);
create index if not exists resume_analyses_student_created_idx on public.resume_analyses(student_id, created_at desc);

create or replace function public.set_resume_analysis_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resume_analyses_set_updated_at on public.resume_analyses;
create trigger resume_analyses_set_updated_at
before update on public.resume_analyses
for each row execute function public.set_resume_analysis_updated_at();

alter table public.resume_analyses enable row level security;

drop policy if exists "refai students read own analyses" on public.resume_analyses;
create policy "refai students read own analyses" on public.resume_analyses
for select to authenticated using (student_id = auth.uid());

drop policy if exists "refai students insert own analyses" on public.resume_analyses;
create policy "refai students insert own analyses" on public.resume_analyses
for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "refai students update own analyses" on public.resume_analyses;
create policy "refai students update own analyses" on public.resume_analyses
for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Employees never query resume_analyses directly. Authorized Employee views are
-- assembled by FastAPI only after validating the linked referral request.
