import unittest
from unittest.mock import patch

from app.services.trust_score import (
    COMPONENT_WEIGHTS,
    SCORE_VERSION,
    compute_candidate_trust_score,
)
from app.services.requirement_extractor import general_expectations_for_role
from app.services.vector_store import ChromaProjectRelevanceProvider, normalize_cosine_distance


class FixedSimilarityProvider:
    def __init__(self, score: float):
        self.value = score

    def score(self, resume_sections: list[str], responsibilities: list[str]) -> float:
        return self.value


class FailingSimilarityProvider:
    def compare(self, resume_sections: list[str], responsibilities: list[str]) -> dict:
        raise RuntimeError("Chroma unavailable")


class KeywordSimilarityProvider:
    def compare(self, resume_sections: list[str], responsibilities: list[str]) -> dict:
        resume = " ".join(resume_sections).lower()
        score = 92 if "python" in resume and "api" in resume else 8
        return {
            "score": score,
            "matches": [{
                "resumeEvidence": resume_sections[0],
                "comparisonContext": responsibilities[0],
                "normalizedSemanticSimilarity": score,
            }],
            "normalization": "test normalized percentage",
        }


class CandidateTrustScoreTests(unittest.TestCase):
    def component(self, result: dict, key: str) -> dict:
        return next(item for item in result["scoreBreakdown"] if item["key"] == key)

    def assert_reconciles(self, result: dict) -> None:
        self.assertEqual(result["trustScore"], sum(
            item["contribution"] for item in result["scoreBreakdown"]
        ))
        self.assertEqual(
            {item["key"]: item["weight"] for item in result["scoreBreakdown"]},
            COMPONENT_WEIGHTS,
        )

    def test_empty_evidence_scores_zero(self):
        result = compute_candidate_trust_score(
            "", "Python is required. Build reliable Python services.", "Python Engineer"
        )

        self.assertEqual(result["scoreVersion"], SCORE_VERSION)
        self.assertEqual(result["trustScore"], 0)
        self.assertTrue(all(item["score"] == 0 for item in result["scoreBreakdown"]))
        self.assertTrue(all(item["maximumScore"] == item["weight"] for item in result["scoreBreakdown"]))
        self.assert_reconciles(result)

    def test_required_and_preferred_match_use_seventy_thirty_formula(self):
        result = compute_candidate_trust_score(
            "Skills: Python and AWS.",
            "Python and FastAPI are required. AWS is preferred.",
            "Backend Engineer",
        )

        component = self.component(result, "roleRequirementMatch")
        self.assertEqual(component["details"]["requiredMatchPercent"], 50)
        self.assertEqual(component["details"]["preferredMatchPercent"], 100)
        self.assertEqual(component["basisPercentage"], 65)
        self.assertEqual(component["score"], 20)
        self.assertEqual(component["contribution"], 20)
        self.assert_reconciles(result)

    def test_evidence_strength_uses_defined_tiers(self):
        resume = "\n".join((
            "Skills: Python.",
            "Project: Built a React interface for students.",
            "Project: Built a FastAPI service used by 120 users.",
            "Internship experience: Deployed AWS workloads and reduced latency by 30%.",
        ))
        result = compute_candidate_trust_score(
            resume,
            "Python, React, FastAPI, and AWS are required.",
            "Software Engineer",
        )

        component = self.component(result, "evidenceStrength")
        self.assertEqual(component["details"]["requirementTiers"], {
            "AWS": 100,
            "FastAPI": 75,
            "Python": 20,
            "React": 50,
        })
        self.assertEqual(component["basisPercentage"], 61)
        self.assertEqual(component["score"], component["contribution"])
        self.assert_reconciles(result)

    def test_skill_depth_distinguishes_all_four_levels(self):
        cases = (
            ("Skills: Python.", 25),
            ("Project: Built a Python command-line tool.", 50),
            ("Project: Built a Python tool.\nEducation project used Python for analysis.", 75),
            (
                "Project: Built a Python service used by 100 users.\n"
                "Internship: Used Python and reduced processing time by 20%.",
                100,
            ),
        )
        for resume, expected in cases:
            with self.subTest(expected=expected):
                result = compute_candidate_trust_score(
                    resume, "Python is required.", "Backend Engineer"
                )
                self.assertEqual(self.component(result, "skillDepth")["basisPercentage"], expected)

    def test_full_match_reaches_one_hundred_with_deterministic_provider(self):
        resume = "\n".join((
            "Education: Bachelor degree, RefAI University, 2020-2024.",
            "Experience: Software Engineer internship in 2024.",
            "Internship experience: Used Python and FastAPI to build services used by 500 users.",
            "Internship experience: I owned and deployed a scalable Python AWS API, maintained production reliability, and reduced deployment time by 30%.",
            "Project: Completed and shipped a FastAPI API on AWS for 200 users.",
            "https://github.com/refai/candidate",
        ))
        result = compute_candidate_trust_score(
            resume,
            "Python and FastAPI are required. AWS is preferred. "
            "Build and maintain reliable API services.",
            "Python Engineer",
            FixedSimilarityProvider(100),
        )

        self.assertEqual(result["trustScore"], 100)
        self.assertTrue(all(item["score"] == item["maximumScore"] for item in result["scoreBreakdown"]))
        self.assertEqual(
            self.component(result, "projectExperienceRelevance")["details"]["method"],
            "FixedSimilarityProvider",
        )
        self.assert_reconciles(result)

    def test_similarity_provider_result_is_clamped(self):
        result = compute_candidate_trust_score(
            "Project: Built a Python service.",
            "Python is required. Build reliable services.",
            "Python Engineer",
            FixedSimilarityProvider(180),
        )

        relevance = self.component(result, "projectExperienceRelevance")
        self.assertEqual(relevance["details"]["normalizedSemanticSimilarity"], 100)
        self.assertLess(relevance["basisPercentage"], 100)
        self.assert_reconciles(result)

    def test_relevant_project_scores_higher_than_unrelated_project(self):
        job = "Build and maintain Python APIs for production services."
        relevant = compute_candidate_trust_score(
            "Projects:\nI built and deployed a Python API used by 300 users.",
            job, "Backend Engineer", KeywordSimilarityProvider(),
        )
        unrelated = compute_candidate_trust_score(
            "Projects:\nI created a watercolor portfolio for a local art exhibition.",
            job, "Backend Engineer", KeywordSimilarityProvider(),
        )
        self.assertGreater(
            self.component(relevant, "projectExperienceRelevance")["score"],
            self.component(unrelated, "projectExperienceRelevance")["score"],
        )

    def test_empty_project_descriptions_receive_no_semantic_credit(self):
        result = compute_candidate_trust_score(
            "Projects:\nSkills: Python",
            "Build Python APIs.", "Backend Engineer", FixedSimilarityProvider(100),
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertEqual(component["details"]["normalizedSemanticSimilarity"], 0)
        self.assertEqual(component["score"], 0)

    def test_deterministic_evidence_gates_identical_semantic_similarity(self):
        weak = compute_candidate_trust_score(
            "Project: Python API concepts and backend services overview.",
            "Build reliable Python APIs.", "Backend Engineer", FixedSimilarityProvider(100),
        )
        strong = compute_candidate_trust_score(
            "Projects:\nI owned, built, completed, and deployed a scalable Python API used by 500 users.",
            "Build reliable Python APIs.", "Backend Engineer", FixedSimilarityProvider(100),
        )
        weak_component = self.component(weak, "projectExperienceRelevance")
        strong_component = self.component(strong, "projectExperienceRelevance")
        self.assertEqual(weak_component["details"]["normalizedSemanticSimilarity"], 100)
        self.assertEqual(strong_component["details"]["normalizedSemanticSimilarity"], 100)
        self.assertGreater(strong_component["score"], weak_component["score"])
        self.assertLess(weak_component["score"], 20)

    def test_no_jd_uses_role_context_and_never_claims_jd_match(self):
        result = compute_candidate_trust_score(
            "Experience:\nI built and deployed a Python REST API used by 200 users.",
            general_expectations_for_role("Backend Engineer"),
            "Backend Engineer",
            KeywordSimilarityProvider(),
            relevance_source="role_context",
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertEqual(component["details"]["relevanceSource"], "role_context")
        self.assertIn("general expectations for the selected role", component["limitation"])
        self.assertNotIn("JD responsibility with", " ".join(component["evidenceFound"]))

    def test_relevant_experience_without_projects_receives_relevance_credit(self):
        result = compute_candidate_trust_score(
            "Experience:\nSoftware engineering internship where I built and deployed Python APIs for 100 users.",
            "Build Python APIs.", "Backend Engineer", KeywordSimilarityProvider(),
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertGreater(component["score"], 0)
        self.assertGreater(component["details"]["evidenceSectionCount"], 0)

    def test_short_jd_without_responsibility_text_uses_role_and_records_limitation(self):
        result = compute_candidate_trust_score(
            "Projects:\nI built and deployed a Python API used by 100 users.",
            "Python is required.", "Backend Engineer", KeywordSimilarityProvider(),
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertEqual(component["details"]["relevanceSource"], "job_description")
        self.assertIn("No usable JD responsibility text was extracted", component["limitation"])
        self.assertGreaterEqual(component["score"], 0)

    def test_vector_failure_uses_deterministic_fallback(self):
        result = compute_candidate_trust_score(
            "Projects:\nI built and deployed a Python API used by 100 users.",
            "Build Python APIs.", "Backend Engineer", FailingSimilarityProvider(),
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertEqual(component["details"]["method"], "deterministic_lexical_v1")
        self.assertIn("Vector comparison was unavailable", component["limitation"])
        self.assertGreaterEqual(component["score"], 0)

    def test_relevance_contribution_is_capped_and_weights_unchanged(self):
        result = compute_candidate_trust_score(
            "Projects:\nI owned, built, completed, and deployed a scalable Python API used by 500 users.",
            "Build Python APIs.", "Backend Engineer", FixedSimilarityProvider(500),
        )
        component = self.component(result, "projectExperienceRelevance")
        self.assertLessEqual(component["score"], 20)
        self.assertEqual(component["maximumScore"], 20)
        self.assertEqual(COMPONENT_WEIGHTS, {
            "roleRequirementMatch": 30,
            "evidenceStrength": 25,
            "projectExperienceRelevance": 20,
            "skillDepth": 15,
            "resumeEvidenceCompleteness": 10,
        })

    def test_cosine_distance_normalization_is_bounded(self):
        self.assertEqual(normalize_cosine_distance(0), 100)
        self.assertEqual(normalize_cosine_distance(0.25), 75)
        self.assertEqual(normalize_cosine_distance(1), 0)
        self.assertEqual(normalize_cosine_distance(2), 0)

    def test_chroma_provider_indexes_and_queries_only_scoped_evidence(self):
        class Collection:
            def __init__(self):
                self.deleted = None
                self.upserted = None
                self.where = None

            def delete(self, where):
                self.deleted = where

            def upsert(self, **kwargs):
                self.upserted = kwargs

            def query(self, **kwargs):
                self.where = kwargs["where"]
                return {
                    "documents": [["I built a Python API used by 100 users."]],
                    "distances": [[0.2]],
                    "metadatas": [[{"context_id": "analysis-1"}]],
                }

        collection = Collection()
        with patch("app.services.vector_store.get_collection", return_value=collection):
            result = ChromaProjectRelevanceProvider("analysis-1").compare(
                ["I built a Python API used by 100 users."],
                ["Build reliable API services."],
            )
        self.assertEqual(collection.deleted, {"context_id": "analysis-1"})
        self.assertEqual(collection.where, {"context_id": "analysis-1"})
        self.assertEqual(collection.upserted["metadatas"][0]["context_id"], "analysis-1")
        self.assertEqual(result["score"], 80)
        self.assertIn("(1 - cosine_distance)", result["normalization"])

    def test_completeness_uses_observable_signals_and_penalizes_contradictions(self):
        complete = compute_candidate_trust_score(
            "Education: Bachelor degree, College, 2020-2024. "
            "Project: Built a documented Python service for 100 users. "
            "https://linkedin.com/in/candidate",
            "Python is required.",
            "Python Engineer",
        )
        contradictory = compute_candidate_trust_score(
            "Education: Bachelor degree, College, 2025-2022. "
            "Project: Built a documented Python service for 100 users. "
            "https://linkedin.com/in/candidate",
            "Python is required.",
            "Python Engineer",
        )

        self.assertEqual(self.component(complete, "resumeEvidenceCompleteness")["basisPercentage"], 100)
        self.assertEqual(
            self.component(contradictory, "resumeEvidenceCompleteness")["details"]
            ["observableSignals"]["consistency"],
            0,
        )

    def test_every_component_has_complete_explainability_for_strong_and_weak_inputs(self):
        scenarios = (
            (
                "Experience: Python internship reduced processing time by 30%.\n"
                "Project: Built a FastAPI service for 200 users.",
                "Python and FastAPI are required. Build reliable API services.",
            ),
            (
                "Skills: JavaScript.",
                "Python and FastAPI are required. AWS is preferred. Build reliable API services.",
            ),
        )
        required_fields = {
            "score", "maximumScore", "formulaOrBasis", "evidenceFound",
            "evidenceMissing", "improvementAction", "potentialImprovementPoints",
            "limitation",
        }
        for resume, job_description in scenarios:
            with self.subTest(resume=resume):
                result = compute_candidate_trust_score(
                    resume, job_description, "Backend Engineer"
                )
                self.assertEqual(len(result["scoreBreakdown"]), 5)
                for component in result["scoreBreakdown"]:
                    self.assertTrue(required_fields.issubset(component))
                    self.assertIsInstance(component["evidenceFound"], list)
                    self.assertIsInstance(component["evidenceMissing"], list)
                    self.assertGreater(len(component["formulaOrBasis"]), 10)
                    self.assertGreater(len(component["improvementAction"]), 10)
                    self.assertGreater(len(component["limitation"]), 10)
                    self.assertEqual(
                        component["potentialImprovementPoints"],
                        component["maximumScore"] - component["score"],
                    )
                self.assert_reconciles(result)

    def test_structured_evidence_links_exact_resume_snippet_section_and_reference(self):
        resume = (
            "Skills\nPython\n"
            "Projects\nBuilt and deployed a Python API used by 120 students."
        )
        result = compute_candidate_trust_score(
            resume, "Python is required. Build production APIs.", "Backend Engineer"
        )

        evidence = self.component(result, "evidenceStrength")["evidenceItems"]
        supported = next(item for item in evidence if item["status"] == "Resume supported")
        self.assertEqual(supported["snippet"], "Built and deployed a Python API used by 120 students.")
        self.assertEqual(supported["resumeSection"], "Projects")
        self.assertRegex(supported["id"], r"^EV-[A-F0-9]{10}$")
        self.assertIn("evidence tier", supported["whyItAffectsScore"])

    def test_structured_evidence_distinguishes_self_declared_and_missing_claims(self):
        result = compute_candidate_trust_score(
            "Skills\nPython", "Python and FastAPI are required.", "Backend Engineer"
        )

        evidence = self.component(result, "evidenceStrength")["evidenceItems"]
        python = next(item for item in evidence if item["factLabel"] == "Python")
        fastapi = next(item for item in evidence if item["factLabel"] == "FastAPI")
        self.assertEqual(python["status"], "Self-declared")
        self.assertEqual(python["resumeSection"], "Skills")
        self.assertEqual(fastapi["status"], "Missing evidence")
        self.assertIsNone(fastapi["snippet"])

    def test_structured_explainability_does_not_change_score_or_weights(self):
        result = compute_candidate_trust_score(
            "Projects\nBuilt a Python service.",
            "Python is required. Build reliable services.",
            "Backend Engineer",
        )
        self.assertEqual(
            result["trustScore"],
            sum(component["score"] for component in result["scoreBreakdown"]),
        )
        self.assertEqual(
            [component["maximumScore"] for component in result["scoreBreakdown"]],
            [30, 25, 20, 15, 10],
        )
        self.assertTrue(all("evidenceItems" in component for component in result["scoreBreakdown"]))


if __name__ == "__main__":
    unittest.main()
