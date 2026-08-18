from pathlib import Path
import unittest


class MoreInformationMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202608110001_more_information_responses.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_response_table_is_private_to_referral_participants(self):
        self.assertIn("create table if not exists public.referral_more_information_responses", self.sql)
        self.assertIn("enable row level security", self.sql)
        self.assertIn("student_id = auth.uid()", self.sql)
        self.assertIn("employee_id = auth.uid()", self.sql)
        self.assertIn("rr.status::text = 'more_info_requested'", self.sql)

    def test_response_rpc_validates_ownership_proofs_and_history(self):
        self.assertIn("respond_to_referral_more_information_as", self.sql)
        self.assertIn("proof entries must belong to the student", self.sql)
        self.assertIn("'student_responded'", self.sql)
        self.assertIn("status = 'under_review'", self.sql)

    def test_employee_notification_event_is_allowed(self):
        self.assertIn("'student_responded'", self.sql)


if __name__ == "__main__":
    unittest.main()
