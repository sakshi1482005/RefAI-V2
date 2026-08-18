import unittest

from app.services.hybrid_candidate_intelligence import (
    WEIGHTS,
    build_hybrid_candidate_intelligence,
    claim_evidence_score,
)


def trust_card(score=80):
    return {"trustScore": score, "scoreVersion": "trust-score-v2"}


def fuzzy(score=70):
    return {
        "fuzzy_suitability_score": score,
        "inputSources": {"experience": "neutral default (no dedicated persisted metric)"},
        "strongest_positive_factors": [{"input": "skill_match", "value": 88}],
    }


def semantic(score=60):
    return {
        "semantic_match_score": score,
        "matched_skills": ["Python"],
        "missing_skills": ["Docker"],
        "weak_missing_evidence": ["No implementation evidence was found for Docker."],
        "limitations": [],
    }


class HybridCandidateIntelligenceTests(unittest.TestCase):
    def test_documented_weighted_formula_and_contributions_reconcile_exactly(self):
        result = build_hybrid_candidate_intelligence(
            trust_card=trust_card(80), fuzzy_suitability=fuzzy(70), semantic_job_match=semantic(60),
            claim_verification={"claims": [
                {"claim": "Built an API", "status": "Evidence supported"},
                {"claim": "Led ten people", "status": "Needs clarification"},
            ]},
        )
        expected = round(80 * 0.40 + 70 * 0.25 + 60 * 0.25 + ((100 + 20) / 2) * 0.10, 2)
        self.assertEqual(result.hybrid_score, expected)
        self.assertEqual(sum(item.weight for item in result.contribution_breakdown), 100)
        self.assertEqual(round(sum(item.contribution for item in result.contribution_breakdown), 2), result.hybrid_score)
        self.assertEqual(WEIGHTS, {"trust_score_v2": 40, "fuzzy_suitability": 25, "semantic_job_match": 25, "claim_evidence_verification": 10})

    def test_claim_statuses_are_reduced_deterministically_without_ai(self):
        score, basis, positives, risks = claim_evidence_score({"claims": [
            {"claim": "Python", "status": "Evidence supported"},
            {"claim": "Leadership", "status": "Self-declared"},
            {"claim": "Metrics", "status": "Partially supported"},
        ]})
        self.assertEqual(score, round((100 + 35 + 65) / 3, 2))
        self.assertIn("deterministic", basis)
        self.assertTrue(positives)
        self.assertTrue(risks)

    def test_no_claims_uses_explicit_neutral_value_instead_of_inventing_evidence(self):
        result = build_hybrid_candidate_intelligence(
            trust_card=trust_card(), fuzzy_suitability=fuzzy(), semantic_job_match=semantic(),
            claim_verification={"claims": []},
        )
        self.assertEqual(result.component_scores["claim_evidence_verification"], 50.0)
        claim_component = next(item for item in result.contribution_breakdown if item.key == "claim_evidence_verification")
        self.assertIn("neutral", claim_component.basis)

    def test_result_is_bounded_and_has_grounded_positive_and_gap_factors(self):
        result = build_hybrid_candidate_intelligence(
            trust_card=trust_card(100), fuzzy_suitability=fuzzy(100), semantic_job_match=semantic(100),
            claim_verification={"claims": [{"claim": "Python service", "status": "Evidence supported"}]},
        )
        self.assertEqual(result.hybrid_score, 100.0)
        self.assertEqual(result.label, "High")
        self.assertIn("Python", " ".join(result.positive_factors))
        self.assertIn("Docker", " ".join(result.risk_gap_factors))
        self.assertIn("not a hiring prediction", result.explanation)


if __name__ == "__main__":
    unittest.main()
