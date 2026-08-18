import unittest

from app.services.candidate_intelligence_cache import (
    candidate_intelligence_cache_key,
    clear_candidate_intelligence_cache,
    get_or_build_candidate_intelligence,
)


class CandidateIntelligenceCacheTests(unittest.TestCase):
    def setUp(self):
        clear_candidate_intelligence_cache()

    def session(self, *, analysis_id="analysis-a", card_id="card-a", input_key="input-a"):
        return {
            "analysisId": analysis_id,
            "analyzedAt": "2026-08-18T00:00:00Z",
            "trustCard": {"id": card_id, "inputKey": input_key, "scoreVersion": "trust-score-v2"},
        }

    def test_reuses_identical_saved_inputs_and_defensively_copies_result(self):
        key = candidate_intelligence_cache_key("student-a", self.session())
        calls = 0

        def build():
            nonlocal calls
            calls += 1
            return {"semantic": {"score": 74}}

        first, first_hit = get_or_build_candidate_intelligence(key, build)
        first["semantic"]["score"] = 0
        second, second_hit = get_or_build_candidate_intelligence(key, build)

        self.assertFalse(first_hit)
        self.assertTrue(second_hit)
        self.assertEqual(calls, 1)
        self.assertEqual(second["semantic"]["score"], 74)

    def test_changed_analysis_or_trust_card_version_does_not_reuse_context(self):
        original = candidate_intelligence_cache_key("student-a", self.session())
        new_analysis = candidate_intelligence_cache_key("student-a", self.session(analysis_id="analysis-b"))
        new_card = candidate_intelligence_cache_key("student-a", self.session(input_key="input-b"))

        self.assertNotEqual(original, new_analysis)
        self.assertNotEqual(original, new_card)

    def test_student_identity_is_part_of_cache_key(self):
        session = self.session()
        self.assertNotEqual(
            candidate_intelligence_cache_key("student-a", session),
            candidate_intelligence_cache_key("student-b", session),
        )


if __name__ == "__main__":
    unittest.main()
