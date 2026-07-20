from datetime import datetime, timezone
from uuid import uuid4
import unittest

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.routes import referral
from app.core.security import get_current_user
from app.main import app
from app.services.referral_requests import ReferralForbidden


class QueueServiceStub:
    def __init__(self, item=None): self.item = item

    def employee_queue(self, actor_id):
        if actor_id == "student-user": raise ReferralForbidden("Employee access is required")
        return [] if self.item is None else [self.item]


class EmployeeQueueRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        now = datetime.now(timezone.utc).isoformat()
        self.item = {
            "id": str(uuid4()), "studentId": str(uuid4()), "candidateId": str(uuid4()),
            "employeeId": str(uuid4()), "trustCardId": str(uuid4()), "targetRole": "Engineer",
            "targetCompany": "Acme", "status": "pending", "createdAt": now, "updatedAt": now,
            "studentName": "Student One", "college": None, "trustScore": 82, "overallMatch": 79,
            "resumeExists": True, "trustCardExists": True,
        }

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_authenticated_employee_receives_minimal_queue_item(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "employee-user"}
        original = referral.service
        referral.service = QueueServiceStub(self.item)
        try: response = self.client.get("/referral/employee/queue", headers={"Authorization": "Bearer test"})
        finally: referral.service = original
        self.assertEqual(response.status_code, 200)
        item = response.json()[0]
        self.assertNotIn("resumeText", item)
        self.assertNotIn("payload", item)
        self.assertNotIn("trustCard", item)

    def test_authenticated_employee_can_receive_empty_queue(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "employee-user"}
        original = referral.service
        referral.service = QueueServiceStub()
        try: response = self.client.get("/referral/employee/queue", headers={"Authorization": "Bearer test"})
        finally: referral.service = original
        self.assertEqual(response.json(), [])

    def test_student_is_forbidden(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "student-user"}
        original = referral.service
        referral.service = QueueServiceStub()
        try: response = self.client.get("/referral/employee/queue", headers={"Authorization": "Bearer test"})
        finally: referral.service = original
        self.assertEqual(response.status_code, 403)

    def test_missing_token_is_rejected(self):
        for endpoint in (
            "/referral/employee/queue",
            f"/referral/employee/requests/{uuid4()}",
            f"/referral/employee/requests/{uuid4()}/resume",
            f"/referral/employee/requests/{uuid4()}/trust-card",
        ):
            response = self.client.get(endpoint)
            self.assertIn(response.status_code, {401, 403})

    def test_invalid_or_expired_token_is_rejected(self):
        def invalid_user(): raise HTTPException(status_code=401, detail="Invalid or expired token")
        app.dependency_overrides[get_current_user] = invalid_user
        response = self.client.get("/referral/employee/queue", headers={"Authorization": "Bearer expired"})
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__": unittest.main()
