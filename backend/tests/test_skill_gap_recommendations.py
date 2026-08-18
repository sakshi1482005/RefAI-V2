import unittest

from app.services.skill_gap_recommendations import build_skill_gap_recommendations


def requirement(skill, priority="important", category="tool"):
    return {"requirement": skill, "priority": priority, "category": category, "aliases": [skill.lower()]}


def semantic(missing, *, source="job_description"):
    return {"missing_skills": missing, "relevance_source": source}


def fuzzy(score=64):
    return {"fuzzy_suitability_score": score, "label": "Moderate"}


class SkillGapRecommendationTests(unittest.TestCase):
    def test_ranks_missing_requirements_by_existing_requirement_priority(self):
        result = build_skill_gap_recommendations(
            requirements=[requirement("Docker", "important"), requirement("Kubernetes", "critical"), requirement("Terraform", "optional")],
            semantic_job_match=semantic(["Docker", "Kubernetes", "Terraform"]),
            fuzzy_suitability=fuzzy(64), claim_verification={"claims": []},
        )
        self.assertEqual(result.recommended_learning_order, ["Kubernetes", "Docker", "Terraform"])
        self.assertEqual([item.priority for item in result.recommendations], ["High", "Medium", "Low"])
        self.assertGreater(result.recommendations[0].estimated_suitability_impact, result.recommendations[-1].estimated_suitability_impact)
        self.assertIn("no verified resume evidence", result.recommendations[0].reason)

    def test_verified_claim_prevents_stale_missing_requirement_from_being_recommended(self):
        result = build_skill_gap_recommendations(
            requirements=[requirement("Docker", "critical")], semantic_job_match=semantic(["Docker"]),
            fuzzy_suitability=fuzzy(),
            claim_verification={"claims": [{"claim": "Built and deployed a Docker container", "status": "Evidence supported"}]},
        )
        self.assertEqual(result.recommendations, [])
        self.assertIn("No unsupported", result.limitations[-1])

    def test_self_declared_claim_is_not_treated_as_verified_evidence(self):
        result = build_skill_gap_recommendations(
            requirements=[requirement("Docker", "critical")], semantic_job_match=semantic(["Docker"]),
            fuzzy_suitability=fuzzy(),
            claim_verification={"claims": [{"claim": "Docker", "status": "Self-declared"}]},
        )
        self.assertEqual(result.recommended_learning_order, ["Docker"])

    def test_impact_is_deterministic_bounded_and_not_an_outcome_claim(self):
        result = build_skill_gap_recommendations(
            requirements=[requirement("Docker", "critical")], semantic_job_match=semantic(["Docker"]),
            fuzzy_suitability=fuzzy(0), claim_verification={"claims": []},
        )
        self.assertEqual(result.recommendations[0].estimated_suitability_impact, 25.0)
        self.assertLessEqual(result.recommendations[0].estimated_suitability_impact, 25)
        self.assertTrue(any("not a guaranteed" in item for item in result.limitations))
        self.assertNotRegex(" ".join(result.limitations).lower(), r"employment|referral outcome")

    def test_no_job_description_keeps_role_context_limitation(self):
        result = build_skill_gap_recommendations(
            requirements=[requirement("SQL", "important", "database")], semantic_job_match=semantic(["SQL"], source="role_context"),
            fuzzy_suitability=fuzzy(), claim_verification={"claims": []},
        )
        self.assertTrue(any("No specific Job Description" in item for item in result.limitations))


if __name__ == "__main__":
    unittest.main()
