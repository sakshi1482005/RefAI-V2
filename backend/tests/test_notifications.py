from pathlib import Path
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import notifications as notification_routes
from app.core.security import get_current_user
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

    def test_soft_clear_migration_keeps_owner_only_update_access(self):
        sql = (Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202608120001_notification_soft_clear.sql").read_text(encoding="utf-8").lower()
        self.assertIn("add column if not exists cleared_at", sql)
        self.assertIn("grant update (cleared_at)", sql)


class NotificationClearRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(notification_routes.router)
        self.actor_id = "00000000-0000-0000-0000-000000000111"
        self.app.dependency_overrides[get_current_user] = lambda: {"sub": self.actor_id}
        self.client = TestClient(self.app)
        self.original_service = notification_routes.service

        class ServiceStub:
            actor_id: str | None = None
            def clear_all(self, actor_id: str) -> int:
                self.actor_id = actor_id
                return 2

        self.service = ServiceStub()
        notification_routes.service = self.service

    def tearDown(self):
        notification_routes.service = self.original_service

    def test_clear_all_uses_only_the_authenticated_recipient(self):
        response = self.client.patch("/notifications/clear-all")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"cleared": 2})
        self.assertEqual(self.service.actor_id, self.actor_id)


if __name__ == "__main__":
    unittest.main()
