import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import resume
from app.core.security import get_current_user
from app.main import app
from app.services.student_persistence import StudentPersistenceError, StudentProfileForbidden


def trust_card() -> dict:
    return {
        "id": str(uuid4()),
        "education": {"college": "RefAI College", "degree": "B.Tech", "branch": "CS", "graduationYear": 2027},
        "scoreBreakdown": [
            {"key": "roleRequirementMatch", "basisPercentage": 80},
            {"key": "projectExperienceRelevance", "basisPercentage": 70},
            {"key": "evidenceStrength", "basisPercentage": 75},
            {"key": "resumeEvidenceCompleteness", "basisPercentage": 90},
        ],
    }


class PersistenceStub:
    def __init__(self, session: dict | None, *, role: str = "student", unavailable: bool = False):
        self.session = session
        self.role = role
        self.unavailable = unavailable

    def get_profile(self, _student_id: str) -> dict:
        if self.unavailable:
            raise StudentPersistenceError("database unavailable")
        if self.role != "student":
            raise StudentProfileForbidden("Student access is required")
        return {"college": "RefAI College", "degree": "B.Tech", "branch": "CS", "graduationYear": 2027}

    def latest_session(self, _student_id: str) -> dict | None:
        if self.unavailable:
            raise StudentPersistenceError("database unavailable")
        return self.session


def session(card: dict | None = None) -> dict:
    return {
        "analysis": {
            "matchedSkills": ["Python", "FastAPI", "SQL"],
            "missingSkills": ["Docker"],
            "proof": 68,
            "resumeSectionsUsed": ["Experience", "Projects", "Skills", "Education"],
        },
        "trustCard": card,
    }


class FuzzyCandidateSuitabilityRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.student_id = str(uuid4())
        self.original_persistence = resume.persistence_service
        app.dependency_overrides[get_current_user] = lambda: {"sub": self.student_id}

    def tearDown(self):
        app.dependency_overrides.clear()
        resume.persistence_service = self.original_persistence

    def test_student_receives_fuzzy_result_from_current_card_and_persisted_data(self):
        resume.persistence_service = PersistenceStub(session(trust_card()))
        response = self.client.get("/resume/analysis/fuzzy-suitability", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["algorithm_version"], "fuzzy-candidate-suitability-v1")
        self.assertEqual(body["inputValuesUsed"], {
            "skill_match": 80.0, "project_relevance": 70.0, "experience": 50.0,
            "education": 100.0, "evidence_strength": 75.0, "resume_quality": 90.0,
        })
        self.assertIn("current Trust Card roleRequirementMatch", body["inputSources"]["skill_match"])
        self.assertIn("dedicated persisted experience metric", body["inputSources"]["experience"])
        self.assertTrue(body["activated_rules"])
        self.assertEqual(set(body["input_memberships"]), set(body["inputValuesUsed"]))

    def test_without_current_card_uses_only_documented_analysis_and_neutral_fallbacks(self):
        resume.persistence_service = PersistenceStub(session())
        response = self.client.get("/resume/analysis/fuzzy-suitability", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["inputValuesUsed"]["skill_match"], 75.0)
        self.assertEqual(body["inputValuesUsed"]["project_relevance"], 50.0)
        self.assertEqual(body["inputValuesUsed"]["evidence_strength"], 68.0)
        self.assertEqual(body["inputValuesUsed"]["resume_quality"], 100.0)
        self.assertIn("neutral default", body["inputSources"]["project_relevance"])

    def test_missing_analysis_returns_404(self):
        resume.persistence_service = PersistenceStub(None)
        response = self.client.get("/resume/analysis/fuzzy-suitability", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "No persisted resume analysis is available.")

    def test_non_student_is_forbidden(self):
        resume.persistence_service = PersistenceStub(session(), role="employee")
        response = self.client.get("/resume/analysis/fuzzy-suitability", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Student access is required.")

    def test_persistence_failure_returns_safe_503(self):
        resume.persistence_service = PersistenceStub(session(), unavailable=True)
        response = self.client.get("/resume/analysis/fuzzy-suitability", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "The saved analysis could not be loaded. Please retry.")


if __name__ == "__main__":
    unittest.main()
