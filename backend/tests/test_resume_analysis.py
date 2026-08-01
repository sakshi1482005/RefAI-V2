from types import SimpleNamespace
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.services.groq_client import AIServiceUnavailable, generate_trust_summary
from app.services.resume_analysis import ResumeAnalysisInputError, ResumeAnalysisUnavailable, run_resume_analysis
from app.services.trust_card_engine import build_match_analysis, build_trust_card
from app.services.requirement_extractor import classify_job_description, general_expectations_for_role
from app.models.schemas import MatchScoreRequest


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
        "strengths": ["Strong Python evidence"], "weaknesses": ["FastAPI evidence is missing"],
        "evidence": ["Python appears in projects"],
        "resumeSectionsUsed": ["Projects"], "readinessSummary": "Improve API evidence.",
        "learningRecommendations": ["Build an API"], "confidence": 81,
        "scoreReasons": ["Role Fit is based on weighted requirements."],
        "atsGuidance": [{"title": "Use authentic terminology", "description": "Keep Python attached to project evidence."}],
        "interviewReadiness": {"title": "Prepare evidence", "description": "Explain the Python project."},
    }


class ResumeAnalysisContractTests(unittest.TestCase):
    def test_job_description_without_requirements_is_rejected(self):
        with self.assertRaises(ResumeAnalysisInputError):
            run_resume_analysis("Built several software projects", "Designing and maintaining scalable applications")

    def test_request_trims_and_preserves_real_job_description(self):
        job = "  We require Python and FastAPI skills. You will design and maintain REST APIs, collaborate with product teams, and deliver tested services. Two years of relevant experience are required. AWS is preferred.  "
        payload = MatchScoreRequest(resumeText="resume", jobDescription=job)
        self.assertEqual(payload.jobDescription, job.strip())

    def test_request_rejects_extremely_short_generic_job_description(self):
        with self.assertRaises(ValueError):
            MatchScoreRequest(resumeText="resume", jobDescription="Looking for a great software engineer.")

    def test_request_accepts_omitted_job_description(self):
        payload = MatchScoreRequest(resumeText="resume")
        self.assertEqual(payload.jobDescription, "")

    def test_general_role_expectations_are_deterministic_and_role_specific(self):
        backend = general_expectations_for_role("Backend Engineer")
        frontend = general_expectations_for_role("Frontend Engineer")
        self.assertIn("REST APIs", backend)
        self.assertIn("React", frontend)
        self.assertNotEqual(backend, frontend)

    def test_job_description_is_classified_deterministically(self):
        job = (
            "Python and FastAPI are required. AWS and Docker are preferred. "
            "You will design REST APIs, maintain services, and collaborate with product teams. "
            "A minimum of 2 years experience and a Bachelor's degree are required."
        )
        classification = classify_job_description(job)
        self.assertIn("Python", classification["requiredSkills"])
        self.assertIn("FastAPI", classification["requiredSkills"])
        self.assertIn("AWS", classification["preferredSkills"])
        self.assertTrue(classification["responsibilities"])
        self.assertIn("2+ years of experience", classification["experienceExpectations"])
        self.assertIn("Bachelor’s degree", classification["educationOrCertificationExpectations"])

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
                response = TestClient(app).post("/resume/analyze", json={
                    "resumeText": "resume",
                    "jobDescription": "Python and FastAPI are required. You will design REST APIs, maintain tested services, collaborate with product teams, and deliver reliable production software.",
                }, headers={"Authorization": "Bearer test"})
        finally:
            app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("bad shape", response.text)

    def test_malformed_groq_output_is_rejected(self):
        malformed_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: SimpleNamespace(choices=[]))))
        with patch("app.services.groq_client._client", return_value=malformed_client):
            with self.assertRaises(AIServiceUnavailable):
                generate_trust_summary("resume", "job", {"overall": 70})

    def test_different_resumes_change_scores_for_the_same_job_description(self):
        job = "Python and FastAPI are required. AWS is preferred."
        strong = build_match_analysis(
            "Projects Python FastAPI AWS. Experience delivering Python FastAPI AWS services.",
            job,
            "Python Engineer",
        )
        weak = build_match_analysis(
            "Projects React TypeScript. Experience building React interfaces.",
            job,
            "Python Engineer",
        )
        self.assertGreater(strong["overall"], weak["overall"])
        self.assertNotEqual(strong["matchedSkills"], weak["matchedSkills"])
        self.assertNotEqual(strong["actionPlan"], weak["actionPlan"])

    def test_same_resume_changes_for_different_job_descriptions(self):
        resume = "Projects Python FastAPI APIs. Experience delivering Python FastAPI APIs."
        backend_job = build_match_analysis(resume, "Python and FastAPI are required. AWS is preferred.", "Backend Engineer")
        frontend_job = build_match_analysis(resume, "React and TypeScript are required. Cypress is preferred.", "Frontend Engineer")
        self.assertGreater(backend_job["overall"], frontend_job["overall"])
        self.assertNotEqual(backend_job["missingSkills"], frontend_job["missingSkills"])
        self.assertNotEqual(backend_job["actionPlan"], frontend_job["actionPlan"])

    def test_action_plan_priorities_follow_job_description_language(self):
        result = build_match_analysis(
            "Built a Python project.",
            "FastAPI is required. AWS is preferred.",
            "Python Engineer",
        )
        priorities = {item["requirement"]: item["priority"] for item in result["actionPlan"]}
        self.assertEqual(priorities["FastAPI"], "critical")
        self.assertEqual(priorities["AWS"], "optional")

    @patch("app.services.trust_card_engine.generate_trust_summary", return_value="Dynamic summary")
    def test_trust_card_changes_for_different_resumes(self, _summary):
        job = "Python and FastAPI are required. AWS is preferred."
        strong = build_trust_card(
            "Candidate", "Python Engineer",
            "Projects Python FastAPI AWS. Experience delivering Python FastAPI AWS services.",
            job,
        )
        weak = build_trust_card(
            "Candidate", "Python Engineer",
            "Projects React TypeScript. Experience building React interfaces.",
            job,
        )
        self.assertGreater(strong["trustScore"], weak["trustScore"])
        self.assertNotEqual(strong["referralReadiness"], weak["referralReadiness"])
        self.assertNotEqual(strong["actionPlan"], weak["actionPlan"])

    @patch("app.services.trust_card_engine.generate_trust_summary", return_value="Dynamic summary")
    def test_trust_card_changes_for_different_job_descriptions(self, _summary):
        resume = "Projects Python FastAPI APIs. Experience delivering Python FastAPI APIs."
        backend = build_trust_card("Candidate", "Backend Engineer", resume, "Python and FastAPI are required. AWS is preferred.")
        frontend = build_trust_card("Candidate", "Frontend Engineer", resume, "React and TypeScript are required. Cypress is preferred.")
        self.assertNotEqual(backend["trustScore"], frontend["trustScore"])
        self.assertNotEqual(backend["missingSkills"], frontend["missingSkills"])
        self.assertNotEqual(backend["scoreReasons"], frontend["scoreReasons"])


if __name__ == "__main__": unittest.main()
