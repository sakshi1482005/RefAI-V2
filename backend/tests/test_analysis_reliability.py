import unittest

from app.services.analysis_reliability import assess_analysis_reliability


def strong_resume() -> str:
    evidence = (
        "Experience: Software engineering internship from 2023 to 2024. "
        "Built Python and FastAPI services, reduced processing time by 30%, "
        "and supported 500 users. "
        "Projects: Developed a PostgreSQL application with unit tests and Docker. "
        "Collaborated with a product team and documented technical decisions. "
        "Education: Bachelor of Technology in Computer Science, graduating 2026. "
    )
    return evidence * 3


def supported_analysis(evidence_count: int = 4) -> dict:
    return {
        "evidence": [f"Observable resume claim {index}" for index in range(evidence_count)],
        "resumeSectionsUsed": ["Experience", "Projects", "Education", "Skills"],
    }


class AnalysisReliabilityTests(unittest.TestCase):
    def test_complete_job_description_is_high_reliability(self):
        job_description = (
            "We require Python, FastAPI, PostgreSQL, Docker, and unit testing. "
            "The engineer will build and maintain reliable APIs, review code, "
            "troubleshoot production issues, collaborate across teams, document "
            "technical decisions, and communicate delivery risks to stakeholders. "
            "Experience with AWS and CI/CD is preferred."
        )
        result = assess_analysis_reliability(
            strong_resume(), supported_analysis(), job_description
        )
        self.assertEqual(result["label"], "High reliability")
        self.assertIn("extracted JD requirements", result["basis"])

    def test_short_job_description_is_medium_reliability(self):
        result = assess_analysis_reliability(
            strong_resume(), supported_analysis(), "Python is required."
        )
        self.assertEqual(result["label"], "Medium reliability")
        self.assertIn("Short or unspecific job descriptions", result["limitations"])

    def test_no_job_description_uses_resume_only_without_penalty(self):
        result = assess_analysis_reliability(
            strong_resume(), supported_analysis(), None
        )
        self.assertEqual(result["label"], "High reliability")
        self.assertIn("resume evidence alone", result["limitations"])
        self.assertIn("general expectations for the selected role", result["limitations"])

    def test_poor_resume_parsing_is_low_reliability(self):
        result = assess_analysis_reliability(
            "%%% ### unreadable fragment",
            supported_analysis(),
            "Python and FastAPI are required.",
            parsing_success=False,
        )
        self.assertEqual(result["label"], "Low reliability")
        self.assertIn("was incomplete", result["basis"])

    def test_insufficient_resume_evidence_is_low_reliability(self):
        result = assess_analysis_reliability(
            "Resume summary with limited details and no project outcomes. " * 4,
            supported_analysis(evidence_count=0),
            None,
        )
        self.assertEqual(result["label"], "Low reliability")
        self.assertIn("0 evidence-backed claims", result["basis"])

    def test_contract_never_returns_numeric_probability(self):
        result = assess_analysis_reliability(
            strong_resume(), supported_analysis(), None
        )
        self.assertEqual(set(result), {"label", "basis", "limitations"})
        self.assertNotRegex(result["label"], r"\d|%")


if __name__ == "__main__":
    unittest.main()
