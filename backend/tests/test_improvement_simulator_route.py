import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import resume
from app.core.security import get_current_user
from app.main import app
from app.services.student_persistence import StudentProfileForbidden


class PersistenceStub:
    def __init__(self, *, student=True):
        self.student = student
        self.analysis_id = str(uuid4())
        self.card_id = str(uuid4())

    def get_profile(self, _student_id):
        if not self.student:
            raise StudentProfileForbidden("Student access is required")
        return {"college": "RefAI College", "degree": "B.Tech", "branch": "CS", "graduationYear": 2027}

    def latest_session(self, _student_id):
        return {
            "analysisId": self.analysis_id, "role": "Backend Engineer",
            "trustCard": {"id": self.card_id, "trustScore": 62, "scoreBreakdown": [
                {"key": "roleRequirementMatch", "label": "Role Requirement Match", "weight": 30, "score": 18, "maximumScore": 30, "basisPercentage": 60, "contribution": 18, "reason": "Current role evidence."},
                {"key": "projectExperienceRelevance", "label": "Project and Experience Relevance", "weight": 20, "score": 10, "maximumScore": 20, "basisPercentage": 50, "contribution": 10, "reason": "Current project evidence."},
                {"key": "evidenceStrength", "label": "Evidence Strength", "weight": 25, "score": 15, "maximumScore": 25, "basisPercentage": 60, "contribution": 15, "reason": "Current evidence strength."},
                {"key": "resumeEvidenceCompleteness", "label": "Resume Evidence Completeness", "weight": 10, "score": 7, "maximumScore": 10, "basisPercentage": 70, "contribution": 7, "reason": "Current resume completeness."},
            ]},
            "analysis": {"matchedSkills": ["Python"], "missingSkills": ["Docker"], "proof": 60, "resumeSectionsUsed": ["Projects", "Skills"]},
        }

    def get_analysis(self, _student_id, _analysis_id):
        return {
            "id": self.analysis_id, "updated_at": "2026-08-11T00:00:00Z",
            "resume_text": "Projects\nBuilt Python FastAPI REST APIs with SQL.", "target_role": "Backend Engineer",
            "job_description": "Docker is required. Python and SQL are required. Build and maintain services.",
            "used_general_role_expectations": False,
        }

    def improvement_simulator(self, _student_id):
        return {"simulatorVersion": "smart-improvement-simulator-v1", "scoreVersion": "trust-score-v4", "currentScore": 62, "maximumScore": 100, "suggestions": [], "totalMaximumPotentialPoints": 0, "comparison": None, "limitations": []}


class ClaimServiceStub:
    def student_claim_verifications(self, _student_id, _card_id):
        return {"claims": [{"claim": "Python API", "status": "Evidence supported"}]}


class ImprovementSimulatorRouteTests(unittest.TestCase):
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

    def test_get_includes_current_intelligence_snapshot_without_changing_trust_score(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.get("/resume/analysis/improvement-simulator", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["currentScore"], 62)
        self.assertIsNone(body["simulation"])
        self.assertIn("hybridScore", body["intelligenceSnapshot"])

    def test_candidate_intelligence_uses_one_current_student_scoped_aggregate(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.get("/resume/analysis/candidate-intelligence", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["trustScore"], 62)
        self.assertIn("hybrid_score", body["hybrid"])
        self.assertIn("fuzzy_suitability_score", body["fuzzy"])
        self.assertIn("semantic_match_score", body["semantic"])
        self.assertIn("recommendations", body["skillGaps"])

    def test_model_comparison_returns_the_existing_four_models_without_accuracy_claims(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.get("/resume/analysis/model-comparison", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["comparisonVersion"], "model-comparison-v1")
        self.assertEqual(len(body["models"]), 4)
        self.assertIn("no fabricated accuracy", body["methodologyNote"].lower())

    def test_post_returns_in_memory_hypothesis_only(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.post("/resume/analysis/improvement-simulator/simulate", json={"skillEvidence": ["Docker"], "addProjectEvidence": True}, headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["simulation"]["isSimulation"])
        self.assertEqual(body["currentScore"], 62)
        self.assertIn("does not modify", " ".join(body["simulation"]["limitations"]))

    def test_employee_is_forbidden(self):
        resume.persistence_service = PersistenceStub(student=False)
        response = self.client.get("/resume/analysis/improvement-simulator", headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 403)

    def test_unknown_skill_scenario_is_rejected(self):
        resume.persistence_service = PersistenceStub()
        response = self.client.post("/resume/analysis/improvement-simulator/simulate", json={"skillEvidence": ["Invented"], "addProjectEvidence": False}, headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
