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


class EmployeeProfileServiceStub:
    def __init__(self): self.saved_actor = None
    @staticmethod
    def badge():
        return {
            "badgeType": "new_referrer", "label": "New Referrer", "reliabilityLevel": "Building history",
            "basis": "Limited history.",
            "relevantCounts": {"meaningfulResponses": 0, "completedReferrals": 0, "recentMeaningfulResponses": 0, "overdueUnansweredRequests": 0},
            "lastCalculatedAt": datetime.now(timezone.utc).isoformat(), "limitations": [],
        }
    def employee_profile(self, actor_id):
        return {"profileId": actor_id, "company": "Acme", "designation": "Engineer", "reliabilityBadge": self.badge()}
    def save_employee_profile(self, actor_id, payload):
        self.saved_actor = actor_id
        return {"profileId": actor_id, "company": payload.company, "designation": payload.designation, "reliabilityBadge": self.badge()}


class CompatibilityServiceStub:
    def __init__(self): self.actor = None
    def compatibility(self, actor_id, payload):
        self.actor = actor_id
        return {
            "score": 76, "maximumScore": 100, "label": "Good fit",
            "scoreVersion": "referral-compatibility-v1",
            "positiveFactors": ["Role is supported."],
            "missingOrConflictingFactors": [],
            "limitations": ["Does not predict acceptance or hiring."],
            "suggestedImprovements": [],
            "components": [
                {"key": "role_alignment", "label": "Role alignment", "score": 28, "maximumScore": 35},
                {"key": "department_relevance", "label": "Employee department relevance", "score": 20, "maximumScore": 25},
                {"key": "employee_preferences", "label": "Employee referral preferences", "score": 15, "maximumScore": 20},
                {"key": "candidate_readiness", "label": "Candidate readiness", "score": 10, "maximumScore": 15},
                {"key": "request_completeness", "label": "Request completeness", "score": 3, "maximumScore": 5},
            ],
        }


class QualityServiceStub:
    def __init__(self): self.actor = None
    def quality(self, actor_id, payload):
        self.actor = actor_id
        return {
            "score": 84, "maximumScore": 100, "label": "Strong",
            "scoreVersion": "referral-message-quality-v1",
            "passedChecks": ["Trust Card attached."], "warnings": [],
            "blockingErrors": [], "recommendedEdits": [], "canSubmit": True,
            "limitations": [],
            "checks": [
                {"key": "opportunity_accuracy", "label": "Recipient and opportunity accuracy", "score": 20, "maximumScore": 25, "status": "warning", "basis": "Recipient and opportunity."},
                {"key": "evidence_grounding", "label": "Resume and Trust Card grounding", "score": 25, "maximumScore": 30, "status": "warning", "basis": "Evidence."},
                {"key": "factual_integrity", "label": "Factual integrity", "score": 20, "maximumScore": 20, "status": "passed", "basis": "Integrity."},
                {"key": "employee_preferences", "label": "Employee preference fit", "score": 10, "maximumScore": 15, "status": "warning", "basis": "Preferences."},
                {"key": "professional_clarity", "label": "Professional clarity", "score": 9, "maximumScore": 10, "status": "warning", "basis": "Clarity."},
            ],
        }


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
        copilot = self.client.post(f"/referral/employee/requests/{uuid4()}/copilot")
        self.assertIn(copilot.status_code, {401, 403})

    def test_invalid_or_expired_token_is_rejected(self):
        def invalid_user(): raise HTTPException(status_code=401, detail="Invalid or expired token")
        app.dependency_overrides[get_current_user] = invalid_user
        response = self.client.get("/referral/employee/queue", headers={"Authorization": "Bearer expired"})
        self.assertEqual(response.status_code, 401)

    def test_employee_profile_routes_use_authenticated_employee_id(self):
        employee_id = str(uuid4())
        app.dependency_overrides[get_current_user] = lambda: {"sub": employee_id}
        stub = EmployeeProfileServiceStub()
        original = referral.service
        referral.service = stub
        try:
            loaded = self.client.get("/referral/employee/profile", headers={"Authorization": "Bearer test"})
            saved = self.client.put("/referral/employee/profile", json={"company": "RefAI Labs", "designation": "Staff Engineer"}, headers={"Authorization": "Bearer test"})
        finally:
            referral.service = original
        self.assertEqual(loaded.status_code, 200)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["company"], "RefAI Labs")
        self.assertEqual(stub.saved_actor, employee_id)

    def test_compatibility_endpoint_uses_authenticated_student(self):
        student_id = str(uuid4())
        app.dependency_overrides[get_current_user] = lambda: {"sub": student_id}
        stub = CompatibilityServiceStub()
        original = referral.service
        referral.service = stub
        try:
            response = self.client.post("/referral/compatibility", json={
                "employeeId": str(uuid4()),
                "trustCardId": str(uuid4()),
                "targetRole": "Software Engineer",
                "targetCompany": "Acme",
                "jobDescription": "",
                "studentMessage": "Please review my evidence.",
            }, headers={"Authorization": "Bearer test"})
        finally:
            referral.service = original
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["label"], "Good fit")
        self.assertEqual(stub.actor, student_id)

    def test_quality_endpoint_uses_authenticated_student(self):
        student_id = str(uuid4())
        app.dependency_overrides[get_current_user] = lambda: {"sub": student_id}
        stub = QualityServiceStub()
        original = referral.service
        referral.service = stub
        try:
            response = self.client.post("/referral/quality", json={
                "employeeId": str(uuid4()),
                "trustCardId": str(uuid4()),
                "targetRole": "Software Engineer",
                "targetCompany": "Acme",
                "jobDescription": "",
                "studentMessage": "Please review my Candidate Trust Card.",
            }, headers={"Authorization": "Bearer test"})
        finally:
            referral.service = original
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["scoreVersion"], "referral-message-quality-v1")
        self.assertEqual(stub.actor, student_id)


if __name__ == "__main__": unittest.main()
