-- Auditable, student-owned AI Apply goals and review-only matching snapshots.
-- This phase does not create referral requests automatically.

alter table public.employee_profiles
  add column if not exists ai_apply_opt_in boolean not null default true;

create index if not exists employee_profiles_ai_apply_eligibility_idx
  on public.employee_profiles(ai_apply_opt_in, availability_status)
  where ai_apply_opt_in = true and availability_status = 'accepting';

create table if not exists public.ai_apply_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null references public.resume_analyses(id) on delete restrict,
  trust_card_id uuid not null references public.trust_cards(id) on delete restrict,
  target_role text not null,
  target_company text not null,
  preferred_department text,
  timeline text,
  location text,
  work_mode text,
  minimum_compatibility integer not null default 55,
  requested_match_count integer not null default 5,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_apply_goals_role_valid check (length(btrim(target_role)) between 1 and 200),
  constraint ai_apply_goals_company_valid check (length(btrim(target_company)) between 1 and 200),
  constraint ai_apply_goals_department_valid check (preferred_department is null or length(btrim(preferred_department)) between 1 and 120),
  constraint ai_apply_goals_timeline_valid check (timeline is null or timeline in ('immediate', 'within_30_days', 'within_3_months', 'exploring')),
  constraint ai_apply_goals_location_valid check (location is null or length(btrim(location)) between 1 and 160),
  constraint ai_apply_goals_work_mode_valid check (work_mode is null or work_mode in ('onsite', 'hybrid', 'remote', 'flexible')),
  constraint ai_apply_goals_minimum_valid check (minimum_compatibility between 0 and 100),
  constraint ai_apply_goals_match_count_valid check (requested_match_count between 1 and 10),
  constraint ai_apply_goals_idempotency_valid check (length(btrim(idempotency_key)) between 8 and 100),
  unique (student_id, idempotency_key)
);

create table if not exists public.ai_apply_match_runs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.ai_apply_goals(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  match_version text not null,
  input_key text not null,
  minimum_compatibility integer not null,
  requested_match_count integer not null,
  eligible_employee_count integer not null default 0,
  excluded_employee_count integer not null default 0,
  vector_status text not null,
  limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_apply_match_runs_minimum_valid check (minimum_compatibility between 0 and 100),
  constraint ai_apply_match_runs_match_count_valid check (requested_match_count between 1 and 10),
  constraint ai_apply_match_runs_counts_valid check (eligible_employee_count >= 0 and excluded_employee_count >= 0),
  constraint ai_apply_match_runs_vector_status_valid check (vector_status in ('available', 'partial', 'unavailable', 'not_used')),
  constraint ai_apply_match_runs_limitations_valid check (jsonb_typeof(limitations) = 'array'),
  unique (goal_id, match_version, input_key)
);

create table if not exists public.ai_apply_matches (
  id uuid primary key default gen_random_uuid(),
  match_run_id uuid not null references public.ai_apply_match_runs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  rank integer not null,
  compatibility_score integer not null,
  compatibility_label text not null,
  compatibility_version text not null,
  semantic_similarity numeric(5,2),
  ranking_score numeric(6,2) not null,
  relevance_source text not null,
  compatibility_snapshot jsonb not null,
  reason_snapshot jsonb not null,
  employee_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint ai_apply_matches_rank_valid check (rank between 1 and 10),
  constraint ai_apply_matches_compatibility_valid check (compatibility_score between 0 and 100),
  constraint ai_apply_matches_semantic_valid check (semantic_similarity is null or semantic_similarity between 0 and 100),
  constraint ai_apply_matches_ranking_valid check (ranking_score between 0 and 100),
  constraint ai_apply_matches_source_valid check (relevance_source in ('goal_context', 'deterministic_fallback')),
  constraint ai_apply_matches_payloads_valid check (
    jsonb_typeof(compatibility_snapshot) = 'object'
    and jsonb_typeof(reason_snapshot) = 'object'
    and jsonb_typeof(employee_snapshot) = 'object'
  ),
  unique (match_run_id, employee_id),
  unique (match_run_id, rank)
);

create index if not exists ai_apply_goals_student_created_idx
  on public.ai_apply_goals(student_id, created_at desc);
create index if not exists ai_apply_match_runs_student_created_idx
  on public.ai_apply_match_runs(student_id, created_at desc);
create index if not exists ai_apply_matches_run_rank_idx
  on public.ai_apply_matches(match_run_id, rank);

create or replace function public.set_ai_apply_goal_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_apply_goals_set_updated_at on public.ai_apply_goals;
create trigger ai_apply_goals_set_updated_at
before update on public.ai_apply_goals
for each row execute function public.set_ai_apply_goal_updated_at();

create or replace function public.persist_ai_apply_match_run(
  p_student_id uuid,
  p_goal_id uuid,
  p_match_version text,
  p_input_key text,
  p_minimum_compatibility integer,
  p_requested_match_count integer,
  p_eligible_employee_count integer,
  p_excluded_employee_count integer,
  p_vector_status text,
  p_limitations jsonb,
  p_matches jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal public.ai_apply_goals;
  v_run public.ai_apply_match_runs;
  v_match jsonb;
begin
  select * into v_goal from public.ai_apply_goals
  where id = p_goal_id for update;
  if v_goal.id is null or v_goal.student_id <> p_student_id then
    raise exception 'AI Apply goal access denied';
  end if;

  select * into v_run from public.ai_apply_match_runs
  where goal_id = p_goal_id and match_version = p_match_version and input_key = p_input_key;

  if v_run.id is null then
    insert into public.ai_apply_match_runs(
      goal_id, student_id, match_version, input_key, minimum_compatibility,
      requested_match_count, eligible_employee_count, excluded_employee_count,
      vector_status, limitations
    ) values (
      p_goal_id, p_student_id, p_match_version, p_input_key, p_minimum_compatibility,
      p_requested_match_count, p_eligible_employee_count, p_excluded_employee_count,
      p_vector_status, coalesce(p_limitations, '[]'::jsonb)
    ) returning * into v_run;

    for v_match in select value from jsonb_array_elements(coalesce(p_matches, '[]'::jsonb)) as item(value)
    loop
      insert into public.ai_apply_matches(
        match_run_id, student_id, employee_id, rank, compatibility_score,
        compatibility_label, compatibility_version, semantic_similarity,
        ranking_score, relevance_source, compatibility_snapshot,
        reason_snapshot, employee_snapshot
      ) values (
        v_run.id, p_student_id, (v_match->>'employee_id')::uuid,
        (v_match->>'rank')::integer, (v_match->>'compatibility_score')::integer,
        v_match->>'compatibility_label', v_match->>'compatibility_version',
        nullif(v_match->>'semantic_similarity', '')::numeric,
        (v_match->>'ranking_score')::numeric, v_match->>'relevance_source',
        v_match->'compatibility_snapshot', v_match->'reason_snapshot',
        v_match->'employee_snapshot'
      );
    end loop;
  end if;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.rank)
      from public.ai_apply_matches m where m.match_run_id = v_run.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.persist_ai_apply_match_run(uuid,uuid,text,text,integer,integer,integer,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_ai_apply_match_run(uuid,uuid,text,text,integer,integer,integer,integer,text,jsonb,jsonb) to service_role;

alter table public.ai_apply_goals enable row level security;
alter table public.ai_apply_match_runs enable row level security;
alter table public.ai_apply_matches enable row level security;

drop policy if exists ai_apply_goals_student_read_own on public.ai_apply_goals;
create policy ai_apply_goals_student_read_own on public.ai_apply_goals
  for select to authenticated using (student_id = auth.uid());
drop policy if exists ai_apply_goals_student_insert_own on public.ai_apply_goals;
create policy ai_apply_goals_student_insert_own on public.ai_apply_goals
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'student')
    and exists (select 1 from public.resume_analyses a where a.id = analysis_id and a.student_id = auth.uid())
    and exists (select 1 from public.trust_cards t where t.id = trust_card_id and t.student_id = auth.uid() and t.analysis_id = analysis_id)
  );
drop policy if exists ai_apply_goals_student_update_own on public.ai_apply_goals;
create policy ai_apply_goals_student_update_own on public.ai_apply_goals
  for update to authenticated using (student_id = auth.uid()) with check (
    student_id = auth.uid()
    and exists (select 1 from public.resume_analyses a where a.id = analysis_id and a.student_id = auth.uid())
    and exists (select 1 from public.trust_cards t where t.id = trust_card_id and t.student_id = auth.uid() and t.analysis_id = analysis_id)
  );
drop policy if exists ai_apply_goals_student_delete_own on public.ai_apply_goals;
create policy ai_apply_goals_student_delete_own on public.ai_apply_goals
  for delete to authenticated using (student_id = auth.uid());

drop policy if exists ai_apply_match_runs_student_read_own on public.ai_apply_match_runs;
create policy ai_apply_match_runs_student_read_own on public.ai_apply_match_runs
  for select to authenticated using (student_id = auth.uid());
drop policy if exists ai_apply_match_runs_student_insert_own on public.ai_apply_match_runs;
create policy ai_apply_match_runs_student_insert_own on public.ai_apply_match_runs
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.ai_apply_goals g where g.id = goal_id and g.student_id = auth.uid())
  );

drop policy if exists ai_apply_matches_student_read_own on public.ai_apply_matches;
create policy ai_apply_matches_student_read_own on public.ai_apply_matches
  for select to authenticated using (student_id = auth.uid());
drop policy if exists ai_apply_matches_student_insert_own on public.ai_apply_matches;
create policy ai_apply_matches_student_insert_own on public.ai_apply_matches
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.ai_apply_match_runs r where r.id = match_run_id and r.student_id = auth.uid())
    and exists (select 1 from public.profiles p where p.id = employee_id and p.role::text = 'employee')
  );

revoke all on public.ai_apply_goals, public.ai_apply_match_runs, public.ai_apply_matches from anon;
revoke all on public.ai_apply_goals, public.ai_apply_match_runs, public.ai_apply_matches from authenticated;
grant select, insert, update, delete on public.ai_apply_goals to authenticated;
-- Match runs and snapshots are server-authored. Authenticated students receive
-- SELECT only; the backend service role persists validated calculations.
grant select on public.ai_apply_match_runs, public.ai_apply_matches to authenticated;

-- Students may see only the explicit matching opt-in alongside existing directory fields.
grant select (ai_apply_opt_in) on public.employee_profiles to authenticated;
grant insert (ai_apply_opt_in), update (ai_apply_opt_in) on public.employee_profiles to authenticated;
