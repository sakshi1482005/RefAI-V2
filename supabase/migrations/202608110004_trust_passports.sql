-- Privacy-controlled, revocable public credentials for persisted Trust Cards.
-- Tokens are stored only as SHA-256 hashes; public reads are served by FastAPI
-- after an allowlisted payload has been assembled.

create table if not exists public.trust_passports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  trust_card_id uuid not null references public.trust_cards(id) on delete cascade,
  token_hash text not null unique,
  visibility jsonb not null default '["role","scores","evidence","reliability"]'::jsonb,
  enabled boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  constraint trust_passports_visibility_array check (jsonb_typeof(visibility) = 'array'),
  constraint trust_passports_access_count_nonnegative check (access_count >= 0)
);

create unique index if not exists trust_passports_active_card_uidx
  on public.trust_passports(student_id, trust_card_id) where revoked_at is null;
create index if not exists trust_passports_token_hash_idx on public.trust_passports(token_hash);
create index if not exists trust_passports_owner_idx on public.trust_passports(student_id, created_at desc);

create table if not exists public.trust_passport_events (
  id bigint generated always as identity primary key,
  passport_id uuid not null references public.trust_passports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'revoked', 'accessed')),
  created_at timestamptz not null default now()
);
create index if not exists trust_passport_events_passport_idx on public.trust_passport_events(passport_id, created_at desc);

create or replace function public.refai_set_trust_passport_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trust_passports_set_updated_at on public.trust_passports;
create trigger trust_passports_set_updated_at before update on public.trust_passports
for each row execute function public.refai_set_trust_passport_updated_at();

alter table public.trust_passports enable row level security;
alter table public.trust_passport_events enable row level security;

drop policy if exists trust_passports_owner_read on public.trust_passports;
create policy trust_passports_owner_read on public.trust_passports for select to authenticated using (student_id = auth.uid());
drop policy if exists trust_passports_owner_manage on public.trust_passports;
create policy trust_passports_owner_manage on public.trust_passports for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists trust_passport_events_owner_read on public.trust_passport_events;
create policy trust_passport_events_owner_read on public.trust_passport_events for select to authenticated
using (exists (select 1 from public.trust_passports p where p.id = passport_id and p.student_id = auth.uid()));

revoke all on public.trust_passports, public.trust_passport_events from anon;
grant select, insert, update, delete on public.trust_passports to authenticated;
grant select on public.trust_passport_events to authenticated;
