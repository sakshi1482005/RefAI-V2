-- Phase 4B: atomic AI Apply referral safeguards.
-- Successful AI Apply-created referral requests are the only actions counted
-- toward the weekly cap and the only actions that consume one credit.

alter table public.ai_apply_match_runs
  add column if not exists exclusion_reasons jsonb not null default '[]'::jsonb;

alter table public.ai_apply_matches
  add column if not exists referral_request_id uuid references public.referral_requests(id) on delete set null;

create unique index if not exists ai_apply_matches_referral_request_uidx
  on public.ai_apply_matches(referral_request_id)
  where referral_request_id is not null;

alter table public.referral_requests
  add column if not exists ai_apply_match_id uuid references public.ai_apply_matches(id) on delete set null,
  add column if not exists ai_apply_batch_id uuid;

create unique index if not exists referral_requests_ai_apply_match_uidx
  on public.referral_requests(ai_apply_match_id)
  where ai_apply_match_id is not null;

create table if not exists public.ai_apply_credit_accounts (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ai_apply_credit_balance_valid check (balance >= 0)
);

create table if not exists public.ai_apply_submission_batches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  match_run_id uuid not null references public.ai_apply_match_runs(id) on delete restrict,
  match_id uuid not null references public.ai_apply_matches(id) on delete restrict,
  referral_request_id uuid references public.referral_requests(id) on delete set null,
  idempotency_key text not null,
  status text not null default 'processing',
  error_code text,
  compatibility_score integer,
  compatibility_threshold integer not null,
  charged_credits integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_apply_batch_idempotency_valid check (length(btrim(idempotency_key)) between 8 and 100),
  constraint ai_apply_batch_status_valid check (status in ('processing', 'completed', 'rejected')),
  constraint ai_apply_batch_score_valid check (compatibility_score is null or compatibility_score between 0 and 100),
  constraint ai_apply_batch_threshold_valid check (compatibility_threshold between 0 and 100),
  constraint ai_apply_batch_charge_valid check (charged_credits in (0, 1)),
  unique (student_id, idempotency_key)
);

alter table public.referral_requests
  drop constraint if exists referral_requests_ai_apply_batch_id_fkey;
alter table public.referral_requests
  add constraint referral_requests_ai_apply_batch_id_fkey
  foreign key (ai_apply_batch_id) references public.ai_apply_submission_batches(id) on delete set null;

create table if not exists public.ai_apply_credit_ledger (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.ai_apply_submission_batches(id) on delete restrict,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint ai_apply_credit_ledger_amount_valid check (amount = -1),
  constraint ai_apply_credit_ledger_balance_valid check (balance_after >= 0),
  unique (batch_id)
);

create table if not exists public.ai_apply_submission_attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  attempted_at timestamptz not null default now(),
  unique (student_id, idempotency_key)
);

create index if not exists ai_apply_batches_student_created_idx
  on public.ai_apply_submission_batches(student_id, created_at desc);
create index if not exists ai_apply_attempts_student_time_idx
  on public.ai_apply_submission_attempts(student_id, attempted_at desc);
create index if not exists referral_requests_ai_apply_weekly_idx
  on public.referral_requests(student_id, created_at desc)
  where ai_apply_match_id is not null;

drop function if exists public.persist_ai_apply_match_run(uuid,uuid,text,text,integer,integer,integer,integer,text,jsonb,jsonb);
create or replace function public.persist_ai_apply_match_run(
  p_student_id uuid, p_goal_id uuid, p_match_version text, p_input_key text,
  p_minimum_compatibility integer, p_requested_match_count integer,
  p_eligible_employee_count integer, p_excluded_employee_count integer,
  p_vector_status text, p_limitations jsonb, p_matches jsonb,
  p_exclusion_reasons jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_goal public.ai_apply_goals;
  v_run public.ai_apply_match_runs;
  v_match jsonb;
begin
  select * into v_goal from public.ai_apply_goals where id = p_goal_id for update;
  if v_goal.id is null or v_goal.student_id <> p_student_id then
    raise exception 'AI Apply goal access denied';
  end if;
  select * into v_run from public.ai_apply_match_runs
  where goal_id = p_goal_id and match_version = p_match_version and input_key = p_input_key;
  if v_run.id is null then
    insert into public.ai_apply_match_runs(
      goal_id, student_id, match_version, input_key, minimum_compatibility,
      requested_match_count, eligible_employee_count, excluded_employee_count,
      vector_status, limitations, exclusion_reasons
    ) values (
      p_goal_id, p_student_id, p_match_version, p_input_key, p_minimum_compatibility,
      p_requested_match_count, p_eligible_employee_count, p_excluded_employee_count,
      p_vector_status, coalesce(p_limitations, '[]'::jsonb), coalesce(p_exclusion_reasons, '[]'::jsonb)
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
        v_match->'compatibility_snapshot', v_match->'reason_snapshot', v_match->'employee_snapshot'
      );
    end loop;
  end if;
  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'matches', coalesce((select jsonb_agg(to_jsonb(m) order by m.rank)
      from public.ai_apply_matches m where m.match_run_id = v_run.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_ai_apply_allowance_as(
  p_student_id uuid, p_weekly_cap integer, p_initial_credit_balance integer,
  p_minimum_threshold integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_used integer;
  v_balance integer;
begin
  if not exists (select 1 from public.profiles where id = p_student_id and role::text = 'student') then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select count(*)::integer into v_used from public.referral_requests
  where student_id = p_student_id and ai_apply_match_id is not null
    and created_at >= date_trunc('week', now());
  select balance into v_balance from public.ai_apply_credit_accounts where student_id = p_student_id;
  v_balance := coalesce(v_balance, greatest(0, p_initial_credit_balance));
  return jsonb_build_object(
    'minimumCompatibilityThreshold', greatest(0, least(100, p_minimum_threshold)),
    'weeklyCap', greatest(0, p_weekly_cap), 'weeklyUsed', v_used,
    'weeklyRemaining', greatest(0, p_weekly_cap - v_used),
    'creditBalance', v_balance,
    'available', v_used < greatest(0, p_weekly_cap) and v_balance > 0
  );
end;
$$;

create or replace function public.submit_ai_apply_match_as(
  p_student_id uuid, p_match_id uuid, p_idempotency_key text,
  p_student_message text, p_job_description text,
  p_compatibility_score integer, p_compatibility_label text,
  p_compatibility_version text, p_compatibility_payload jsonb,
  p_minimum_threshold integer, p_weekly_cap integer,
  p_initial_credit_balance integer, p_rate_limit_count integer,
  p_rate_window_seconds integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_match public.ai_apply_matches;
  v_run public.ai_apply_match_runs;
  v_goal public.ai_apply_goals;
  v_employee public.employee_profiles;
  v_batch public.ai_apply_submission_batches;
  v_request public.referral_requests;
  v_balance integer;
  v_weekly_used integer;
  v_active integer;
  v_attempts integer;
  v_threshold integer := greatest(0, least(100, p_minimum_threshold));
  v_error text;
  v_message text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text, 4182));
  if not exists (select 1 from public.profiles where id = p_student_id and role::text = 'student') then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into v_batch from public.ai_apply_submission_batches
    where student_id = p_student_id and idempotency_key = p_idempotency_key;
  if v_batch.id is not null then
    if v_batch.status = 'completed' then
      select * into v_request from public.referral_requests where id = v_batch.referral_request_id;
      select balance into v_balance from public.ai_apply_credit_accounts where student_id = p_student_id;
      select count(*)::integer into v_weekly_used from public.referral_requests
        where student_id = p_student_id and ai_apply_match_id is not null
          and created_at >= date_trunc('week', now());
      return jsonb_build_object('ok', true, 'requestId', v_request.id, 'matchId', v_batch.match_id,
        'status', 'submitted', 'chargedCredits', v_batch.charged_credits,
        'creditBalance', coalesce(v_balance, 0),
        'weeklyRemaining', greatest(0, p_weekly_cap - v_weekly_used),
        'compatibilityScore', v_batch.compatibility_score,
        'compatibilityThreshold', v_batch.compatibility_threshold, 'idempotentReplay', true);
    end if;
    return jsonb_build_object('ok', false, 'errorCode', v_batch.error_code,
      'message', case v_batch.error_code
        when 'weekly_cap_reached' then 'Your weekly AI Apply allowance has been used.'
        when 'no_credit' then 'No AI Apply credit is available.'
        when 'compatibility_below_threshold' then 'This match is below the current compatibility threshold.'
        when 'existing_request' then 'A referral request already exists for this employee and opportunity.'
        when 'rate_limited' then 'Too many AI Apply submission attempts were made. Please wait and try again.'
        else 'This employee is no longer eligible for AI Apply.' end);
  end if;

  insert into public.ai_apply_submission_attempts(student_id, idempotency_key)
    values (p_student_id, p_idempotency_key) on conflict do nothing;
  select count(*)::integer into v_attempts from public.ai_apply_submission_attempts
    where student_id = p_student_id
      and attempted_at >= now() - make_interval(secs => greatest(60, p_rate_window_seconds));

  select * into v_match from public.ai_apply_matches where id = p_match_id and student_id = p_student_id;
  if v_match.id is not null then
    select * into v_run from public.ai_apply_match_runs where id = v_match.match_run_id and student_id = p_student_id;
    select * into v_goal from public.ai_apply_goals where id = v_run.goal_id and student_id = p_student_id;
  end if;
  if v_match.id is null or v_goal.id is null then v_error := 'no_eligible_employee'; end if;
  if v_error is null and v_match.referral_request_id is not null then v_error := 'existing_request'; end if;
  if v_error is null and v_attempts > greatest(1, p_rate_limit_count) then v_error := 'rate_limited'; end if;
  if v_error is null and p_compatibility_score < greatest(v_threshold, v_run.minimum_compatibility) then
    v_error := 'compatibility_below_threshold';
  end if;

  if v_error is null then
    select * into v_employee from public.employee_profiles where profile_id = v_match.employee_id for update;
    if v_employee.profile_id is null or not v_employee.ai_apply_opt_in
      or v_employee.availability_status <> 'accepting' or v_employee.max_active_requests <= 0
      or not v_employee.accepts_freshers then v_error := 'no_eligible_employee'; end if;
  end if;
  if v_error is null and cardinality(coalesce(v_employee.preferred_candidate_levels, array[]::text[])) > 0
    and not exists (select 1 from unnest(v_employee.preferred_candidate_levels) x
      where lower(btrim(x)) in ('student','fresher','entry_level')) then v_error := 'no_eligible_employee'; end if;
  if v_error is null and cardinality(coalesce(v_employee.supported_roles, array[]::text[])) > 0
    and not exists (select 1 from unnest(v_employee.supported_roles) x
      where lower(btrim(v_goal.target_role)) like '%' || lower(btrim(x)) || '%'
         or lower(btrim(x)) like '%' || lower(btrim(v_goal.target_role)) || '%') then v_error := 'no_eligible_employee'; end if;
  if v_error is null and cardinality(coalesce(v_employee.supported_companies, array[]::text[])) > 0
    and lower(btrim(coalesce(v_employee.company, ''))) <> lower(btrim(v_goal.target_company))
    and not exists (select 1 from unnest(v_employee.supported_companies) x
      where lower(btrim(v_goal.target_company)) like '%' || lower(btrim(x)) || '%'
         or lower(btrim(x)) like '%' || lower(btrim(v_goal.target_company)) || '%') then v_error := 'no_eligible_employee'; end if;
  if v_error is null and v_goal.preferred_department is not null
    and cardinality(coalesce(v_employee.supported_departments, array[]::text[])) > 0
    and lower(btrim(coalesce(v_employee.department, ''))) <> lower(btrim(v_goal.preferred_department))
    and not exists (select 1 from unnest(v_employee.supported_departments) x
      where lower(btrim(v_goal.preferred_department)) like '%' || lower(btrim(x)) || '%'
         or lower(btrim(x)) like '%' || lower(btrim(v_goal.preferred_department)) || '%') then v_error := 'no_eligible_employee'; end if;

  if v_error is null then
    select count(*)::integer into v_active from public.referral_requests
      where employee_id = v_match.employee_id and status::text in ('submitted','pending','under_review','more_info_requested');
    if v_active >= v_employee.max_active_requests then v_error := 'no_eligible_employee'; end if;
  end if;
  if v_error is null and exists (
    select 1 from public.referral_requests where student_id = p_student_id
      and employee_id = v_match.employee_id
      and lower(btrim(target_role)) = lower(btrim(v_goal.target_role))
      and lower(btrim(target_company)) = lower(btrim(v_goal.target_company))
      and status::text not in ('withdrawn','expired')
  ) then v_error := 'existing_request'; end if;

  select count(*)::integer into v_weekly_used from public.referral_requests
    where student_id = p_student_id and ai_apply_match_id is not null
      and created_at >= date_trunc('week', now());
  if v_error is null and v_weekly_used >= greatest(0, p_weekly_cap) then v_error := 'weekly_cap_reached'; end if;

  insert into public.ai_apply_credit_accounts(student_id, balance)
    values (p_student_id, greatest(0, p_initial_credit_balance)) on conflict do nothing;
  select balance into v_balance from public.ai_apply_credit_accounts where student_id = p_student_id for update;
  if v_error is null and v_balance < 1 then v_error := 'no_credit'; end if;

  insert into public.ai_apply_submission_batches(
    student_id, match_run_id, match_id, idempotency_key, status, error_code,
    compatibility_score, compatibility_threshold
  ) values (
    p_student_id, v_run.id, p_match_id, p_idempotency_key,
    case when v_error is null then 'processing' else 'rejected' end,
    v_error, p_compatibility_score, greatest(v_threshold, coalesce(v_run.minimum_compatibility, 0))
  ) returning * into v_batch;

  if v_error is not null then
    return jsonb_build_object('ok', false, 'errorCode', v_error,
      'message', case v_error
        when 'weekly_cap_reached' then 'Your weekly AI Apply allowance has been used.'
        when 'no_credit' then 'No AI Apply credit is available.'
        when 'compatibility_below_threshold' then 'This match is below the current compatibility threshold.'
        when 'existing_request' then 'A referral request already exists for this employee and opportunity.'
        when 'rate_limited' then 'Too many AI Apply submission attempts were made. Please wait and try again.'
        else 'This employee is no longer eligible or has reached referral capacity.' end);
  end if;

  v_message := btrim(p_student_message);
  if length(v_message) < 1 or length(v_message) > 1000 then
    raise exception 'student message is invalid';
  end if;
  insert into public.referral_requests(
    student_id, employee_id, trust_card_id, target_role, target_company,
    job_description, student_message, employee_company_snapshot,
    compatibility_score, compatibility_label, compatibility_version,
    compatibility_payload, status, ai_apply_match_id, ai_apply_batch_id
  ) values (
    p_student_id, v_match.employee_id, v_goal.trust_card_id, v_goal.target_role,
    v_goal.target_company, coalesce(p_job_description, ''), v_message,
    nullif(btrim(v_employee.company), ''), p_compatibility_score,
    p_compatibility_label, p_compatibility_version, p_compatibility_payload,
    'submitted'::public.referral_status, v_match.id, v_batch.id
  ) returning * into v_request;

  update public.ai_apply_credit_accounts set balance = balance - 1, updated_at = now()
    where student_id = p_student_id returning balance into v_balance;
  insert into public.ai_apply_credit_ledger(student_id, batch_id, amount, balance_after, reason)
    values (p_student_id, v_batch.id, -1, v_balance, 'ai_apply_referral_request');
  update public.ai_apply_matches set referral_request_id = v_request.id where id = v_match.id;
  update public.ai_apply_submission_batches set status = 'completed', referral_request_id = v_request.id,
    charged_credits = 1, completed_at = now() where id = v_batch.id;
  return jsonb_build_object('ok', true, 'requestId', v_request.id, 'matchId', v_match.id,
    'status', 'submitted', 'chargedCredits', 1, 'creditBalance', v_balance,
    'weeklyRemaining', greatest(0, p_weekly_cap - v_weekly_used - 1),
    'compatibilityScore', p_compatibility_score,
    'compatibilityThreshold', greatest(v_threshold, v_run.minimum_compatibility),
    'idempotentReplay', false);
end;
$$;

revoke all on function public.persist_ai_apply_match_run(uuid,uuid,text,text,integer,integer,integer,integer,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_ai_apply_match_run(uuid,uuid,text,text,integer,integer,integer,integer,text,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.get_ai_apply_allowance_as(uuid,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.get_ai_apply_allowance_as(uuid,integer,integer,integer) to service_role;
revoke all on function public.submit_ai_apply_match_as(uuid,uuid,text,text,text,integer,text,text,jsonb,integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.submit_ai_apply_match_as(uuid,uuid,text,text,text,integer,text,text,jsonb,integer,integer,integer,integer,integer) to service_role;

alter table public.ai_apply_credit_accounts enable row level security;
alter table public.ai_apply_submission_batches enable row level security;
alter table public.ai_apply_credit_ledger enable row level security;
alter table public.ai_apply_submission_attempts enable row level security;

drop policy if exists ai_apply_credit_accounts_student_read_own on public.ai_apply_credit_accounts;
create policy ai_apply_credit_accounts_student_read_own on public.ai_apply_credit_accounts
  for select to authenticated using (student_id = auth.uid());
drop policy if exists ai_apply_batches_student_read_own on public.ai_apply_submission_batches;
create policy ai_apply_batches_student_read_own on public.ai_apply_submission_batches
  for select to authenticated using (student_id = auth.uid());
drop policy if exists ai_apply_credit_ledger_student_read_own on public.ai_apply_credit_ledger;
create policy ai_apply_credit_ledger_student_read_own on public.ai_apply_credit_ledger
  for select to authenticated using (student_id = auth.uid());

revoke all on public.ai_apply_credit_accounts, public.ai_apply_submission_batches,
  public.ai_apply_credit_ledger, public.ai_apply_submission_attempts from anon, authenticated;
grant select on public.ai_apply_credit_accounts, public.ai_apply_submission_batches,
  public.ai_apply_credit_ledger to authenticated;

-- Safe rollback (after stopping AI Apply submissions): drop the three service-only
-- functions, remove the three AI Apply foreign-key columns, then drop the ledger,
-- attempts, batches and credit-account tables. Existing referral requests remain.
