from pathlib import Path
import unittest

from app.models.schemas import EmployeeDecisionUpdate
from app.services.referral_requests import ReferralRequestService
from test_referral_requests import FakeRepository


class NotificationEmissionTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.events = []
        self.service = ReferralRequestService(self.repository, notifier=lambda **event: self.events.append(event))

    def test_employee_view_event_uses_stable_deduplication_key(self):
        request = self.service.create(self.repository.student, self._payload())
        request_id = str(request["id"])
        self.service.employee_request_detail(self.repository.employee, request_id)
        self.service.employee_request_detail(self.repository.employee, request_id)
        viewed = [event for event in self.events if event["event_type"] == "employee_viewed_request"]
        self.assertEqual(len(viewed), 2)
        self.assertEqual(viewed[0]["event_key"], viewed[1]["event_key"])
        self.assertEqual(viewed[0]["recipient_id"], self.repository.student)

    def test_decision_notification_contains_no_private_note(self):
        request = self.service.create(self.repository.student, self._payload())
        self.service.update_status(
            self.repository.employee, str(request["id"]),
            EmployeeDecisionUpdate(status="approved", reason="strong_evidence", note="private internal note"),
        )
        approved = next(event for event in self.events if event["event_type"] == "request_approved")
        self.assertNotIn("private internal note", approved["body"])
        self.assertEqual(approved["recipient_id"], self.repository.student)

    def _payload(self):
        from app.models.schemas import CreateReferralRequest
        return CreateReferralRequest(
            employeeId=self.repository.employee, trustCardId=self.repository.card_id,
            targetRole="Engineer", targetCompany="Acme", jobDescription="Build reliable services",
            studentMessage="Please review my evidence",
        )


class NotificationMigrationTests(unittest.TestCase):
    def test_notification_rls_and_event_deduplication_are_declared(self):
        sql = (Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202608010001_in_app_notifications.sql").read_text(encoding="utf-8").lower()
        self.assertIn("enable row level security", sql)
        self.assertIn("recipient_id = auth.uid()", sql)
        self.assertIn("event_key text not null unique", sql)
        self.assertIn("grant update (read_at)", sql)


if __name__ == "__main__":
    unittest.main()

