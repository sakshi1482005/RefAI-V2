from types import SimpleNamespace
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.services.groq_client import AIServiceUnavailable, generate_trust_summary
from app.services.resume_analysis import ResumeAnalysisInputError, ResumeAnalysisUnavailable, run_resume_analysis


def action_item():
    return {
        "requirement": "FastAPI", "category": "framework", "priority": "important",
        "whyItMatters": "Required for the role", "practicalAction": "Build an API",
        "evidenceSuggestion": "Add a project outcome", "estimatedEffort": "2 hours",
        "nextStep": "Update the resume",
    }


def service_output():
    return {
        "overall": 72, "roleFit": 80, "proof": 64, "gaps": 20,
        "analysisStatus": "complete", "matchedSkills": ["Python"], "missingSkills": ["FastAPI"],
        "missingRequirements": [action_item()], "actionPlan": [action_item()],
        "strengths": ["Strong Python evidence"], "evidence": ["Python appears in projects"],
        "resumeSectionsUsed": ["Projects"], "readinessSummary": "Improve API evidence.",
        "learningRecommendations": ["Build an API"], "confidence": 81,
    }


class ResumeAnalysisContractTests(unittest.TestCase):
    def test_job_description_without_requirements_is_rejected(self):
        with self.assertRaises(ResumeAnalysisInputError):
            run_resume_analysis("Built several software projects", "Designing and maintaining scalable applications")

    def test_valid_typed_response_uses_camel_case(self):
        with patch("app.services.resume_analysis.build_match_analysis", return_value=service_output()):
            result = run_resume_analysis("resume", "job")
        self.assertIsInstance(result["overall"], int)
        self.assertIn("roleFit", result)
        self.assertIn("processingTimeMs", result)
        self.assertNotIn("role_fit", result)

    def test_missing_required_field_is_rejected(self):
        malformed = service_output(); malformed.pop("confidence")
        with patch("app.services.resume_analysis.build_match_analysis", return_value=malformed):
            with self.assertRaises(ResumeAnalysisUnavailable): run_resume_analysis("resume", "job")

    def test_numeric_string_is_rejected_not_coerced(self):
        malformed = service_output(); malformed["overall"] = "72"
        with patch("app.services.resume_analysis.build_match_analysis", return_value=malformed):
            with self.assertRaises(ResumeAnalysisUnavailable): run_resume_analysis("resume", "job")

    def test_nullable_optional_service_metadata_is_ignored(self):
        output = service_output(); output["providerMetadata"] = None
        with patch("app.services.resume_analysis.build_match_analysis", return_value=output):
            self.assertEqual(run_resume_analysis("resume", "job")["overall"], 72)

    def test_malformed_service_output_becomes_non_200(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "student-user"}
        try:
            with patch("app.api.routes.resume.run_resume_analysis", side_effect=ResumeAnalysisUnavailable("bad shape")):
                response = TestClient(app).post("/resume/analyze", json={"resumeText": "resume", "jobDescription": "job"}, headers={"Authorization": "Bearer test"})
        finally:
            app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("bad shape", response.text)

    def test_malformed_groq_output_is_rejected(self):
        malformed_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: SimpleNamespace(choices=[]))))
        with patch("app.services.groq_client._client", return_value=malformed_client):
            with self.assertRaises(AIServiceUnavailable):
                generate_trust_summary("resume", "job", {"overall": 70})


if __name__ == "__main__": unittest.main()
