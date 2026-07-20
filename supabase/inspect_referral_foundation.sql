-- Read-only inventory for the RefAI referral foundation.
-- Run this in the Supabase SQL editor before the migration.
with relevant_tables(table_name) as (
  values
    ('profiles'), ('student_profiles'), ('employee_profiles'),
    ('trust_cards'), ('referral_requests'), ('referral_status_history')
), inventory as (
  select
    'table'::text as object_kind,
    t.table_schema as schema_name,
    t.table_name as object_name,
    jsonb_build_object('table_type', t.table_type, 'rls_enabled', c.relrowsecurity) as details
  from information_schema.tables t
  join relevant_tables r on r.table_name = t.table_name
  left join pg_namespace n on n.nspname = t.table_schema
  left join pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
  where t.table_schema = 'public'

  union all

  select
    'column', c.table_schema, c.table_name || '.' || c.column_name,
    jsonb_build_object(
      'ordinal_position', c.ordinal_position,
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'nullable', c.is_nullable,
      'default', c.column_default
    )
  from information_schema.columns c
  join relevant_tables r on r.table_name = c.table_name
  where c.table_schema = 'public'

  union all

  select
    'policy', p.schemaname, p.tablename || '.' || p.policyname,
    jsonb_build_object(
      'command', p.cmd,
      'roles', p.roles,
      'permissive', p.permissive,
      'using', p.qual,
      'with_check', p.with_check
    )
  from pg_policies p
  join relevant_tables r on r.table_name = p.tablename
  where p.schemaname = 'public'

  union all

  select
    'enum', n.nspname, t.typname,
    jsonb_build_object('values', jsonb_agg(e.enumlabel order by e.enumsortorder))
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
    and t.typname in ('user_role', 'referral_status')
  group by n.nspname, t.typname
)
select object_kind, schema_name, object_name, details
from inventory
order by object_kind, schema_name, object_name;
