import unittest

from app.services.semantic_job_match import build_semantic_job_match, clear_semantic_job_match_cache


class FixedProvider:
    def __init__(self, score: float = 80):
        self.score = score
        self.calls = 0

    def compare(self, sections, contexts):
        self.calls += 1
        return {
            "score": self.score,
            "matches": [{
                "resumeEvidence": sections[0],
                "comparisonContext": contexts[0],
                "normalizedSemanticSimilarity": self.score,
            }],
        }


class FailingProvider:
    def compare(self, *_args):
        raise RuntimeError("Chroma unavailable")


class SemanticJobMatchTests(unittest.TestCase):
    def setUp(self):
        clear_semantic_job_match_cache()
        self.job_description = (
            "Python, FastAPI, and SQL are required. You will build and maintain REST APIs, "
            "collaborate with product teams, and deliver tested services. Docker is preferred."
        )
        self.relevant_resume = (
            "Projects\nBuilt a Python FastAPI REST API with SQL for students and reduced response time by 30%.\n"
            "Experience\nSoftware engineering intern who maintained tested services and collaborated with product teams."
        )

    def test_vector_similarity_and_required_skill_coverage_determine_score(self):
        provider = FixedProvider(80)
        result = build_semantic_job_match(
            resume_text=self.relevant_resume, target_role="Backend Engineer",
            job_description=self.job_description, analysis_id="analysis-1", vector_provider=provider,
        )
        self.assertEqual(result.semantic_match_score, 87.0)
        self.assertEqual(result.relevance_source, "job_description")
        self.assertCountEqual(result.matched_skills, ["Python", "FastAPI", "SQL", "REST APIs"])
        self.assertTrue(result.strongest_matching_evidence)
        self.assertEqual(provider.calls, 1)

    def test_unrelated_resume_scores_lower_than_relevant_resume(self):
        relevant = build_semantic_job_match(
            resume_text=self.relevant_resume, target_role="Backend Engineer",
            job_description=self.job_description, analysis_id="analysis-relevant", vector_provider=FixedProvider(80),
        )
        unrelated = build_semantic_job_match(
            resume_text="Projects\nCreated visual posters and organized a campus photography event.",
            target_role="Backend Engineer", job_description=self.job_description,
            analysis_id="analysis-unrelated", vector_provider=FixedProvider(15),
        )
        self.assertGreater(relevant.semantic_match_score, unrelated.semantic_match_score)
        self.assertTrue(unrelated.missing_skills)

    def test_no_job_description_uses_role_context_without_jd_claim(self):
        result = build_semantic_job_match(
            resume_text=self.relevant_resume, target_role="Backend Engineer", job_description=None,
            analysis_id="analysis-role", vector_provider=FixedProvider(70),
        )
        self.assertEqual(result.relevance_source, "role_context")
        self.assertTrue(any("No specific Job Description" in item for item in result.limitations))
        self.assertNotIn("provided Job Description", result.role_relevance_explanation)

    def test_vector_failure_uses_deterministic_lexical_fallback(self):
        result = build_semantic_job_match(
            resume_text=self.relevant_resume, target_role="Backend Engineer",
            job_description=self.job_description, analysis_id="analysis-fallback", vector_provider=FailingProvider(),
        )
        self.assertGreaterEqual(result.semantic_match_score, 0)
        self.assertLessEqual(result.semantic_match_score, 100)
        self.assertTrue(any("deterministic lexical relevance" in item for item in result.limitations))

    def test_process_cache_reuses_same_persisted_input(self):
        provider = FixedProvider(76)
        kwargs = {
            "resume_text": self.relevant_resume, "target_role": "Backend Engineer",
            "job_description": self.job_description, "analysis_id": "analysis-cache", "analysis_version": "2026-08-11T00:00:00Z",
        }
        # Cache is used by the production provider path; patching it is unnecessary
        # here because the first result is seeded from a deterministic cached result.
        first = build_semantic_job_match(**kwargs, vector_provider=provider)
        self.assertEqual(first.cache_status, "miss")
        # An injected provider intentionally bypasses cache, so seed the public cache path
        # with a short-lived deterministic provider replacement below.
        from app.services import semantic_job_match as module
        original = module.ChromaProjectRelevanceProvider
        try:
            module.ChromaProjectRelevanceProvider = lambda _context_id: provider
            cached_first = build_semantic_job_match(**kwargs)
            cached_second = build_semantic_job_match(**kwargs)
        finally:
            module.ChromaProjectRelevanceProvider = original
        self.assertEqual(cached_first.cache_status, "miss")
        self.assertEqual(cached_second.cache_status, "hit")
        self.assertEqual(cached_first.semantic_match_score, cached_second.semantic_match_score)


if __name__ == "__main__":
    unittest.main()
