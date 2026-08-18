import unittest

from pydantic import ValidationError

from app.models.schemas import FuzzyCandidateSuitabilityInput
from app.services.fuzzy_candidate_suitability import (
    ALGORITHM_VERSION,
    evaluate_fuzzy_candidate_suitability,
    membership_values,
)


def payload(**overrides: float) -> FuzzyCandidateSuitabilityInput:
    values = {
        "skill_match": 50,
        "project_relevance": 50,
        "experience": 50,
        "education": 50,
        "evidence_strength": 50,
        "resume_quality": 50,
    }
    values.update(overrides)
    return FuzzyCandidateSuitabilityInput(**values)


class FuzzyMembershipTests(unittest.TestCase):
    def test_membership_boundaries_are_transparent_and_bounded(self):
        self.assertEqual(membership_values(0), {"Low": 1.0, "Medium": 0.0, "High": 0.0})
        self.assertEqual(membership_values(25), {"Low": 1.0, "Medium": 0.5, "High": 0.0})
        self.assertEqual(membership_values(50), {"Low": 0.0, "Medium": 1.0, "High": 0.0})
        self.assertEqual(membership_values(75), {"Low": 0.0, "Medium": 0.5, "High": 1.0})
        self.assertEqual(membership_values(100), {"Low": 0.0, "Medium": 0.0, "High": 1.0})

    def test_schema_rejects_non_normalized_inputs(self):
        with self.assertRaises(ValidationError):
            payload(skill_match=101)
        with self.assertRaises(ValidationError):
            payload(resume_quality=-1)


class FuzzyCandidateSuitabilityTests(unittest.TestCase):
    def test_all_high_inputs_produce_high_suitability(self):
        result = evaluate_fuzzy_candidate_suitability(payload(**{name: 100 for name in payload().model_dump()}))
        self.assertEqual(result.algorithm_version, ALGORITHM_VERSION)
        self.assertEqual(result.fuzzy_suitability_score, 100)
        self.assertEqual(result.label, "High")
        self.assertTrue(all(rule.consequent == "High" for rule in result.activated_rules))

    def test_all_low_inputs_produce_low_suitability(self):
        result = evaluate_fuzzy_candidate_suitability(payload(**{name: 0 for name in payload().model_dump()}))
        self.assertEqual(result.fuzzy_suitability_score, 0)
        self.assertEqual(result.label, "Low")
        self.assertTrue(all(rule.consequent == "Low" for rule in result.activated_rules))

    def test_middle_inputs_activate_moderate_rules(self):
        result = evaluate_fuzzy_candidate_suitability(payload())
        self.assertEqual(result.fuzzy_suitability_score, 50)
        self.assertEqual(result.label, "Moderate")
        self.assertTrue(any(rule.id == "R4" for rule in result.activated_rules))
        self.assertTrue(any(rule.id == "R5" for rule in result.activated_rules))

    def test_mixed_high_and_low_inputs_are_moderated_by_rule_base(self):
        result = evaluate_fuzzy_candidate_suitability(payload(
            skill_match=90, project_relevance=90, evidence_strength=90,
            experience=10, education=10, resume_quality=10,
        ))
        self.assertEqual(result.label, "Moderate")
        self.assertTrue(any(rule.id == "R10" for rule in result.activated_rules))

    def test_output_includes_traceable_memberships_rules_and_factors(self):
        result = evaluate_fuzzy_candidate_suitability(payload(
            skill_match=88, project_relevance=82, experience=45,
            education=61, evidence_strength=76, resume_quality=34,
        ))
        self.assertEqual(set(result.input_memberships), {
            "skill_match", "project_relevance", "experience", "education", "evidence_strength", "resume_quality",
        })
        self.assertTrue(result.activated_rules)
        self.assertEqual(len(result.strongest_positive_factors), 3)
        self.assertEqual(len(result.weakest_factors), 3)
        self.assertIn("activated rule", result.explanation)
        self.assertTrue(all(0 <= item.activation <= 1 for item in result.activated_rules))

    def test_result_is_deterministic_and_bounded(self):
        request = payload(skill_match=62, project_relevance=71, experience=35, education=58, evidence_strength=66, resume_quality=49)
        first = evaluate_fuzzy_candidate_suitability(request)
        second = evaluate_fuzzy_candidate_suitability(request)
        self.assertEqual(first.model_dump(), second.model_dump())
        self.assertGreaterEqual(first.fuzzy_suitability_score, 0)
        self.assertLessEqual(first.fuzzy_suitability_score, 100)


if __name__ == "__main__":
    unittest.main()
