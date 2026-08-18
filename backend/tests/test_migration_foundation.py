from pathlib import Path
import re
import unittest


MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"


class MigrationFoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile_sql = (MIGRATIONS / "202607240001_profile_foundation.sql").read_text(encoding="utf-8").lower()
        cls.storage_sql = (MIGRATIONS / "202607240002_private_resume_storage.sql").read_text(encoding="utf-8").lower()
        cls.employee_preferences_sql = (MIGRATIONS / "202607300002_employee_referral_preferences.sql").read_text(encoding="utf-8").lower()
        cls.employee_reliability_sql = (MIGRATIONS / "202607300003_employee_reliability_profile.sql").read_text(encoding="utf-8").lower()
        cls.referral_compatibility_sql = (MIGRATIONS / "202607300004_referral_compatibility.sql").read_text(encoding="utf-8").lower()
        cls.compatibility_cleanup_sql = (MIGRATIONS / "202607300005_remove_compatibility_request_metadata.sql").read_text(encoding="utf-8").lower()
        cls.employee_company_sql = (MIGRATIONS / "202608030001_employee_company_consistency.sql").read_text(encoding="utf-8").lower()
        cls.ai_apply_sql = (MIGRATIONS / "202608030002_ai_apply_goals.sql").read_text(encoding="utf-8").lower()
        cls.ai_apply_safeguards_sql = (MIGRATIONS / "202608030003_ai_apply_safeguards.sql").read_text(encoding="utf-8").lower()
        cls.migration_names = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
        cls.all_sql = "\n".join((MIGRATIONS / name).read_text(encoding="utf-8").lower() for name in cls.migration_names)

    def test_complete_fresh_deploy_manifest_is_chronological(self):
        self.assertEqual(self.migration_names, [
            "202607190001_referral_foundation.sql",
            "202607200001_student_workflow_persistence.sql",
            "202607210001_oauth_profile_role_fix.sql",
            "202607240001_profile_foundation.sql",
            "202607240002_private_resume_storage.sql",
            "202607250001_student_profile_branch.sql",
            "202607250002_student_profile_fields.sql",
            "202607300001_job_description_context.sql",
            "202607300002_employee_referral_preferences.sql",
            "202607300003_employee_reliability_profile.sql",
            "202607300004_referral_compatibility.sql",
            "202607300005_remove_compatibility_request_metadata.sql",
            "202607310001_proof_vault.sql",
            "202607310002_structured_referral_decisions.sql",
            "202607310003_referral_status_model.sql",
            "202607310004_referral_submission_workflow.sql",
            "202608010001_in_app_notifications.sql",
            "202608010002_demo_risk_repairs.sql",
            "202608030001_employee_company_consistency.sql",
            "202608030002_ai_apply_goals.sql",
            "202608030003_ai_apply_safeguards.sql",
            "202608110001_more_information_responses.sql",
            "202608110002_employee_review_copilot_cache.sql",
            "202608110003_refai_credits.sql",
        ])

    def test_every_required_persisted_object_has_an_earlier_creator_and_rls(self):
        required_tables = {
            "profiles", "student_profiles", "employee_profiles", "trust_cards",
            "resume_analyses", "referral_requests", "referral_status_history",
            "proof_entries", "referral_decision_private_notes", "notifications",
            "ai_apply_goals", "ai_apply_match_runs", "ai_apply_matches",
            "ai_apply_credit_accounts", "ai_apply_submission_batches",
            "ai_apply_credit_ledger", "ai_apply_submission_attempts",
            "employee_review_copilot_cache",
            "refai_credit_accounts", "refai_credit_operations", "refai_credit_ledger", "refai_ai_output_cache",
        }
        for table in required_tables:
            with self.subTest(table=table):
                self.assertRegex(self.all_sql, rf"create table if not exists public\.{table}\b")
                self.assertIn(f"alter table public.{table} enable row level security", self.all_sql)
        self.assertIn("insert into storage.buckets", self.all_sql)
        self.assertIn("values ('resumes', 'resumes', false", self.all_sql)

    def test_auth_trigger_accepts_student_and_employee_roles(self):
        sql = (MIGRATIONS / "202607210001_oauth_profile_role_fix.sql").read_text(encoding="utf-8").lower()
        self.assertIn("new.raw_user_meta_data ->> 'role'", sql)
        self.assertIn("new.raw_app_meta_data ->> 'role'", sql)
        self.assertIn("then 'employee'", sql)
        self.assertIn("else 'student'", sql)
        self.assertIn("values (new.id, 'employee'", sql)
        self.assertIn("values (new.id, 'student'", sql)
        self.assertIn("create trigger refai_on_auth_user_created", sql)
        self.assertIn("after insert on auth.users", sql)
        self.assertIn("create trigger refai_on_auth_user_metadata_updated", sql)

    def test_policy_replacements_drop_before_create(self):
        for name in self.migration_names:
            sql = (MIGRATIONS / name).read_text(encoding="utf-8").lower()
            created = re.findall(r"create policy\s+\"?([a-z0-9_ ]+)\"?\s+on", sql)
            for policy in created:
                with self.subTest(migration=name, policy=policy):
                    quoted = f'drop policy if exists "{policy}" on'
                    plain = f"drop policy if exists {policy} on"
                    self.assertTrue(quoted in sql or plain in sql)

    def test_persisted_extensions_are_created_only_after_base_tables(self):
        positions = {name: index for index, name in enumerate(self.migration_names)}
        self.assertLess(positions["202607190001_referral_foundation.sql"], positions["202607200001_student_workflow_persistence.sql"])
        self.assertLess(positions["202607200001_student_workflow_persistence.sql"], positions["202607300001_job_description_context.sql"])
        self.assertLess(positions["202607240001_profile_foundation.sql"], positions["202607300002_employee_referral_preferences.sql"])
        self.assertLess(positions["202607190001_referral_foundation.sql"], positions["202607300004_referral_compatibility.sql"])
        self.assertLess(positions["202607190001_referral_foundation.sql"], positions["202607310002_structured_referral_decisions.sql"])
        self.assertLess(positions["202607200001_student_workflow_persistence.sql"], positions["202608010001_in_app_notifications.sql"])

    def test_no_public_table_alteration_assumes_manual_creation(self):
        created_at = {}
        for index, name in enumerate(self.migration_names):
            sql = (MIGRATIONS / name).read_text(encoding="utf-8").lower()
            for table in re.findall(r"create table if not exists public\.([a-z0-9_]+)", sql):
                created_at.setdefault(table, index)
            for table in re.findall(r"alter table public\.([a-z0-9_]+)", sql):
                with self.subTest(migration=name, table=table):
                    self.assertIn(table, created_at)
                    self.assertLessEqual(created_at[table], index)

    def test_every_refai_trigger_function_is_declared_before_trigger_creation(self):
        declared = set()
        for name in self.migration_names:
            sql = (MIGRATIONS / name).read_text(encoding="utf-8").lower()
            declared.update(re.findall(r"create or replace function public\.([a-z0-9_]+)\s*\(", sql))
            invoked = re.findall(r"execute function public\.([a-z0-9_]+)\s*\(", sql)
            for function in invoked:
                with self.subTest(migration=name, function=function):
                    self.assertIn(function, declared)

    def test_employee_reliability_and_compatibility_storage_are_declared(self):
        for column in ("department", "years_experience", "verified_employee", "linkedin_url", "company_profile_url", "portfolio_url"):
            self.assertIn(f"add column if not exists {column}", self.employee_reliability_sql)
        for column in ("compatibility_score", "compatibility_label", "compatibility_version", "compatibility_payload"):
            self.assertIn(f"add column if not exists {column}", self.referral_compatibility_sql)

    def test_employee_company_is_canonical_and_referrals_keep_a_snapshot(self):
        sql = self.employee_company_sql
        self.assertIn("keep employee_profiles.company as refai's canonical employer field", sql)
        self.assertIn("add column if not exists employee_company_snapshot text", sql)
        self.assertIn("new.raw_user_meta_data ->> 'company_name'", sql)
        self.assertIn("insert into public.employee_profiles(profile_id, company)", sql)
        self.assertIn("where public.employee_profiles.company is null", sql)
        self.assertNotIn("raw_user_meta_data ->> 'preferred_company'", sql)
        self.assertIn("referral_requests_employee_company_snapshot_valid", sql)
        self.assertIn("old.employee_company_snapshot", sql)
        self.assertIn("existing rls policies remain in force", sql)

    def test_profile_foundation_precedes_compatibility_migrations(self):
        names = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
        self.assertLess(names.index("202607240001_profile_foundation.sql"), names.index("202607250001_student_profile_branch.sql"))
        self.assertIn("create table if not exists public.student_profiles", self.profile_sql)
        self.assertIn("create table if not exists public.employee_profiles", self.profile_sql)

    def test_job_description_context_extends_existing_analysis_table(self):
        sql = (MIGRATIONS / "202607300001_job_description_context.sql").read_text(encoding="utf-8").lower()
        self.assertIn("alter table public.resume_analyses", sql)
        for column in ("used_general_role_expectations", "job_description_classification"):
            self.assertIn(f"add column if not exists {column}", sql)
        self.assertNotIn("add column if not exists job_id", sql)
        self.assertNotIn("add column if not exists job_link", sql)
        self.assertNotIn("add column if not exists application_deadline", sql)

    def test_student_profile_rls_is_owner_scoped(self):
        self.assertIn("alter table public.student_profiles enable row level security", self.profile_sql)
        self.assertIn("profile_id = auth.uid()", self.profile_sql)
        self.assertIn("student_profiles_insert_own", self.profile_sql)
        self.assertIn("student_profiles_update_own", self.profile_sql)
        self.assertIn("foreign key (profile_id) references public.profiles(id) on delete cascade", self.profile_sql)

    def test_employee_profile_rls_supports_directory_and_owner_writes(self):
        self.assertIn("alter table public.employee_profiles enable row level security", self.profile_sql)
        self.assertIn("employee_profiles_directory_read", self.profile_sql)
        self.assertIn("employee_profiles_insert_own", self.profile_sql)
        self.assertIn("employee_profiles_update_own", self.profile_sql)
        self.assertIn("p.role::text = 'employee'", self.profile_sql)

    def test_resume_bucket_is_private_and_every_write_policy_is_folder_scoped(self):
        self.assertIn("values ('resumes', 'resumes', false", self.storage_sql)
        self.assertIn("set public = false", self.storage_sql)
        for operation in ("insert", "select", "update", "delete"):
            self.assertIn(f"for {operation} to authenticated", self.storage_sql)
        self.assertEqual(self.storage_sql.count("(storage.foldername(name))[1] = auth.uid()::text"), 5)
        self.assertNotIn("create policy resumes_public", self.storage_sql)

    def test_employee_preferences_extend_profile_with_owner_scoped_writes(self):
        sql = self.employee_preferences_sql
        self.assertIn("alter table public.employee_profiles", sql)
        for column in (
            "supported_companies", "supported_roles", "supported_departments",
            "accepts_freshers", "minimum_evidence_expectations",
            "max_active_requests", "availability_status",
            "preferred_candidate_levels", "preferred_message_length",
            "referral_guidelines", "decline_reason_codes", "referral_categories",
        ):
            self.assertIn(f"add column if not exists {column}", sql)
        self.assertIn("employee_profiles_insert_own", sql)
        self.assertIn("employee_profiles_update_own", sql)
        self.assertGreaterEqual(sql.count("profile_id = auth.uid()"), 3)
        self.assertIn("employee_profiles_directory_read", sql)
        self.assertIn("revoke all on public.employee_profiles from anon", sql)

    def test_employee_reliability_profile_fields_are_additive_and_verification_is_not_self_editable(self):
        sql = self.employee_reliability_sql
        for column in ("department", "years_experience", "verified_employee", "linkedin_url", "company_profile_url", "portfolio_url"):
            self.assertIn(f"add column if not exists {column}", sql)
        insert_grant = sql.split("grant insert (", 1)[1].split(") on public.employee_profiles", 1)[0]
        update_grant = sql.split("grant update (", 1)[1].split(") on public.employee_profiles", 1)[0]
        self.assertNotIn("verified_employee", insert_grant)
        self.assertNotIn("verified_employee", update_grant)
        self.assertIn("revoke insert, update on public.employee_profiles from authenticated", sql)

    def test_referral_compatibility_snapshot_is_persisted_additively(self):
        sql = self.referral_compatibility_sql
        for column in ("compatibility_score", "compatibility_label", "compatibility_version", "compatibility_payload"):
            self.assertIn(f"add column if not exists {column}", sql)
        self.assertNotIn("add column if not exists job_id", sql)
        self.assertNotIn("add column if not exists referral_category", sql)
        self.assertIn("compatibility_score between 0 and 100", sql)
        self.assertIn("jsonb_typeof(compatibility_payload) = 'object'", sql)
        self.assertIn("drop constraint if exists referral_requests_required_fields", sql)
        self.assertIn("job_description is not null and length(job_description) <= 100000", sql)
        self.assertIn("drop column if exists job_id", self.compatibility_cleanup_sql)
        self.assertIn("drop column if exists referral_category", self.compatibility_cleanup_sql)

    def test_ai_apply_is_student_owned_review_only_persistence(self):
        sql = self.ai_apply_sql
        self.assertIn("add column if not exists ai_apply_opt_in boolean", sql)
        for table in ("ai_apply_goals", "ai_apply_match_runs", "ai_apply_matches"):
            self.assertIn(f"create table if not exists public.{table}", sql)
            self.assertIn(f"alter table public.{table} enable row level security", sql)
        self.assertGreaterEqual(sql.count("student_id = auth.uid()"), 6)
        self.assertIn("unique (student_id, idempotency_key)", sql)
        self.assertIn("unique (goal_id, match_version, input_key)", sql)
        self.assertIn("create or replace function public.persist_ai_apply_match_run", sql)
        self.assertIn("for update", sql)
        self.assertIn("to service_role", sql)
        self.assertNotIn("insert into public.referral_requests", sql)

    def test_ai_apply_submission_safeguards_are_atomic_and_server_only(self):
        sql = self.ai_apply_safeguards_sql
        self.assertIn("create or replace function public.submit_ai_apply_match_as", sql)
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertIn("date_trunc('week', now())", sql)
        self.assertIn("balance = balance - 1", sql)
        self.assertIn("insert into public.referral_requests", sql)
        self.assertIn("match_run_id uuid not null references public.ai_apply_match_runs", sql)
        self.assertIn("ai_apply_opt_in", sql)
        self.assertIn("max_active_requests", sql)
        self.assertIn("unique (student_id, idempotency_key)", sql)
        self.assertIn("unique (batch_id)", sql)
        self.assertIn("to service_role", sql)
        self.assertIn("from public, anon, authenticated", sql)
        self.assertIn("where ai_apply_match_id is not null", sql)

    def test_employee_review_copilot_cache_is_employee_scoped_and_opaque(self):
        sql = (MIGRATIONS / "202608110002_employee_review_copilot_cache.sql").read_text(encoding="utf-8").lower()
        self.assertIn("unique (employee_id, referral_request_id, input_key)", sql)
        self.assertIn("input_key ~ '^[0-9a-f]{64}$'", sql)
        self.assertIn("alter table public.employee_review_copilot_cache enable row level security", sql)
        self.assertIn("employee_id = auth.uid()", sql)
        self.assertIn("grant all on public.employee_review_copilot_cache to service_role", sql)


if __name__ == "__main__":
    unittest.main()
