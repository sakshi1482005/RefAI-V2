from unittest import TestCase
from unittest.mock import patch

from app.services.groq_client import AIServiceUnavailable
from app.services.groq_client import generate_trust_summary
from app.services.trust_card_cache import build_trust_card_input_metadata, is_current_trust_card
from app.services.trust_card_engine import build_trust_card


def analysis(**changes):
    value = {
        "id": "analysis-1",
        "target_role": "Backend Engineer",
        "target_company": "RefAI",
        "job_description": "Python and FastAPI are required. Build reliable APIs.",
    }
    value.update(changes)
    return value


class TrustCardCacheTests(TestCase):
    def test_all_relevant_inputs_and_versions_change_the_key(self):
        baseline = build_trust_card_input_metadata(analysis())["inputKey"]
        variants = [
            analysis(id="analysis-2"),
            analysis(resume_text="A changed resume with different evidence"),
            analysis(target_role="Data Engineer"),
            analysis(target_company="Another Company"),
            analysis(job_description="Python and SQL are required. Build data pipelines."),
        ]
        for variant in variants:
            self.assertNotEqual(build_trust_card_input_metadata(variant)["inputKey"], baseline)

        with patch("app.services.trust_card_cache.SCORE_VERSION", "future-score-version"):
            self.assertNotEqual(build_trust_card_input_metadata(analysis())["inputKey"], baseline)

    def test_only_exact_versioned_metadata_is_current(self):
        current = build_trust_card_input_metadata(analysis())
        self.assertTrue(is_current_trust_card({"payload": current}, analysis()))
        for field in ("inputKey", "scoreVersion", "schemaVersion", "generationVersion"):
            stale = {**current, field: "stale"}
            self.assertFalse(is_current_trust_card({"payload": stale}, analysis()))

    @patch("app.services.groq_client._client")
    def test_raw_groq_timeout_is_converted_to_service_unavailable(self, client):
        client.return_value.chat.completions.create.side_effect = TimeoutError("timed out")
        with self.assertRaises(AIServiceUnavailable):
            generate_trust_summary("Resume evidence", "Python required", {"overall": 70})

    @patch("app.services.trust_card_engine.generate_trust_summary", side_effect=AIServiceUnavailable("timeout"))
    def test_groq_timeout_preserves_deterministic_score_and_grounded_fallback(self, _summary):
        result = build_trust_card(
            "Candidate",
            "Backend Engineer",
            "Projects: Built a Python FastAPI API and deployed it with tests.",
            "Python and FastAPI are required. Build reliable APIs.",
        )
        self.assertIsInstance(result["trustScore"], int)
        self.assertEqual(result["narrativeSource"], "deterministic_fallback")
        self.assertIn("optional AI narrative", result["aiSummary"])
        self.assertNotIn("will succeed", result["aiSummary"].lower())
