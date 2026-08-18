import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import resume
from app.core.security import get_current_user
from app.main import app
from app.services.student_persistence import StudentAnalysisNotFound, StudentProfileForbidden


class PersistenceStub:
    def __init__(self, *, student=True, has_analysis=True):
        self.student = student
        self.has_analysis = has_analysis
        self.analysis_id = str(uuid4())

    def get_profile(self, _student_id):
        if not self.student:
            raise StudentProfileForbidden("Student access is required")
        return {"college": "RefAI College"}

    def latest_session(self, _student_id):
        return {"analysisId": self.analysis_id, "role": "Backend Engineer"} if self.has_analysis else None

    def get_analysis(self, _student_id, analysis_id):
        if not self.has_analysis or analysis_id != self.analysis_id:
            raise StudentAnalysisNotFound("not found")
        return {
            "id": self.analysis_id, "updated_at": "2026-08-11T00:00:00Z",
            "resume_text": "Projects\nBuilt Python FastAPI REST APIs with SQL.",
            "target_role": "Backend Engineer",
            "job_description": "Python, FastAPI, SQL, and REST APIs are required. Build and maintain services.",
            "used_general_role_expectations": False,
        }


class SemanticJobMatchRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.original = resume.persistence_service
        app.dependency_overrides[get_current_user] = lambda: {"sub": str(uuid4())}

    def tearDown(self):
        app.dependency_overrides.clear()
        resume.persistence_service = self.original

    def test_student_route_returns_saved_analysis_match(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.get("/resume/analysis/semantic-job-match", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["semantic_match_version"], "semantic-job-match-v1")
        self.assertIn("semantic_match_score", body)
        self.assertIn("matched_skills", body)
        self.assertIn("role_relevance_explanation", body)

    def test_employee_is_forbidden(self):
        resume.persistence_service = PersistenceStub(student=False)
        response = self.client.get("/resume/analysis/semantic-job-match", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 403)

    def test_missing_saved_analysis_returns_404(self):
        resume.persistence_service = PersistenceStub(has_analysis=False)
        response = self.client.get("/resume/analysis/semantic-job-match", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
