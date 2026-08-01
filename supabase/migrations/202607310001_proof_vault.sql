-- Private, metadata-only Proof Vault entries attached to persisted Trust Cards.
create table if not exists public.proof_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  trust_card_id uuid not null references public.trust_cards(id) on delete cascade,
  proof_type text not null,
  title text not null,
  url_or_reference text not null,
  related_project text,
  related_skill_claim text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proof_entries_type_valid check (proof_type in (
    'github_repository', 'live_demo', 'certification', 'project_screenshot',
    'internship_letter_reference', 'portfolio', 'research_paper',
    'presentation', 'competition_result'
  )),
  constraint proof_entries_title_valid check (length(trim(title)) between 1 and 200),
  constraint proof_entries_reference_valid check (length(trim(url_or_reference)) between 1 and 1000),
  constraint proof_entries_reference_protocol_safe check (
    url_or_reference !~* '^\s*(javascript|data|file|vbscript|ftp):'
  ),
  constraint proof_entries_project_valid check (related_project is null or length(trim(related_project)) between 1 and 200),
  constraint proof_entries_claim_valid check (related_skill_claim is null or length(trim(related_skill_claim)) between 1 and 200),
  constraint proof_entries_description_valid check (description is null or length(description) <= 2000)
);

create index if not exists proof_entries_owner_created_idx
  on public.proof_entries(owner_id, created_at desc);
create index if not exists proof_entries_trust_card_idx
  on public.proof_entries(trust_card_id, created_at desc);
create index if not exists proof_entries_skill_claim_idx
  on public.proof_entries(owner_id, related_skill_claim)
  where related_skill_claim is not null;

alter table public.proof_entries enable row level security;

drop policy if exists proof_entries_student_read_own on public.proof_entries;
create policy proof_entries_student_read_own on public.proof_entries
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists proof_entries_student_insert_own on public.proof_entries;
create policy proof_entries_student_insert_own on public.proof_entries
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role::text = 'student'
    )
    and exists (
      select 1 from public.trust_cards tc
      where tc.id = trust_card_id and tc.student_id = auth.uid()
    )
  );

drop policy if exists proof_entries_student_update_own on public.proof_entries;
create policy proof_entries_student_update_own on public.proof_entries
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.trust_cards tc
      where tc.id = trust_card_id and tc.student_id = auth.uid()
    )
  );

drop policy if exists proof_entries_student_delete_own on public.proof_entries;
create policy proof_entries_student_delete_own on public.proof_entries
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists proof_entries_assigned_employee_read on public.proof_entries;
create policy proof_entries_assigned_employee_read on public.proof_entries
  for select to authenticated
  using (exists (
    select 1 from public.referral_requests rr
    where rr.trust_card_id = proof_entries.trust_card_id
      and rr.student_id = proof_entries.owner_id
      and rr.employee_id = auth.uid()
  ));

revoke all on public.proof_entries from anon;
revoke all on public.proof_entries from authenticated;
grant select, insert, update, delete on public.proof_entries to authenticated;

create or replace function public.set_proof_entry_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proof_entries_set_updated_at on public.proof_entries;
create trigger proof_entries_set_updated_at
before update on public.proof_entries
for each row execute function public.set_proof_entry_updated_at();
