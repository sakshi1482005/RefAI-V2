import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import resume
from app.core.security import get_current_user
from app.main import app
from app.services.student_persistence import StudentProfileForbidden


class PersistenceStub:
    def __init__(self, *, student=True, has_card=True):
        self.student = student
        self.has_card = has_card
        self.analysis_id = str(uuid4())

    def get_profile(self, _student_id):
        if not self.student:
            raise StudentProfileForbidden("Student access is required")
        return {"college": "RefAI College", "degree": "B.Tech", "branch": "CS", "graduationYear": 2027}

    def latest_session(self, _student_id):
        return {
            "analysisId": self.analysis_id, "role": "Backend Engineer",
            "trustCard": None if not self.has_card else {"id": str(uuid4()), "scoreBreakdown": []},
            "analysis": {"matchedSkills": ["Python"], "missingSkills": ["Docker"], "proof": 70, "resumeSectionsUsed": ["Projects", "Skills"]},
        }

    def get_analysis(self, _student_id, _analysis_id):
        return {
            "id": self.analysis_id, "updated_at": "2026-08-11T00:00:00Z",
            "resume_text": "Projects\nBuilt Python FastAPI REST APIs with SQL.",
            "target_role": "Backend Engineer",
            "job_description": "Docker is required. Python and SQL are required. Build and maintain services.",
            "used_general_role_expectations": False,
        }


class ClaimServiceStub:
    def student_claim_verifications(self, _student_id, _trust_card_id):
        return {"claims": [{"claim": "Python API", "status": "Evidence supported"}]}


class SkillGapRecommendationRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.original_persistence = resume.persistence_service
        self.original_referrals = resume.referral_service
        app.dependency_overrides[get_current_user] = lambda: {"sub": str(uuid4())}
        resume.referral_service = ClaimServiceStub()

    def tearDown(self):
        app.dependency_overrides.clear()
        resume.persistence_service = self.original_persistence
        resume.referral_service = self.original_referrals

    def test_student_receives_deterministic_gap_recommendations(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.get("/resume/analysis/skill-gap-recommendations", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["algorithm_version"], "skill-gap-recommendation-v1")
        self.assertIn("Docker", body["missing_skills"])
        self.assertEqual(body["recommendations"][0]["learning_order"], 1)

    def test_employee_is_forbidden(self):
        resume.persistence_service = PersistenceStub(student=False)
        response = self.client.get("/resume/analysis/skill-gap-recommendations", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 403)

    def test_current_trust_card_is_required_for_evidence_based_recommendations(self):
        resume.persistence_service = PersistenceStub(has_card=False)
        response = self.client.get("/resume/analysis/skill-gap-recommendations", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 404)
        self.assertIn("Trust Card", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
