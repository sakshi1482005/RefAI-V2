import unittest

from app.services.model_comparison import build_model_comparison


class ModelComparisonTests(unittest.TestCase):
    def build(self):
        return build_model_comparison(
            trust_card={"trustScore": 74, "scoreVersion": "trust-score-v4", "scoreBreakdown": [{"key": "roleRequirementMatch", "label": "Role Requirement Match", "weight": 30, "contribution": 22, "reason": "Observed requirement evidence."}]},
            fuzzy_suitability={"fuzzy_suitability_score": 68, "algorithm_version": "fuzzy-candidate-suitability-v1", "inputValuesUsed": {"skill_match": 75, "project_relevance": 60}, "input_memberships": {"skill_match": {"low": 0, "medium": 0.5, "high": 0.4}}, "activated_rules": [{"id": "R1", "rule": "IF evidence is High THEN suitability is High.", "consequent": "High", "activation": 0.4}], "explanation": "Existing deterministic fuzzy output."},
            semantic_job_match={"semantic_match_score": 72, "semantic_match_version": "semantic-job-match-v1", "matched_skills": ["Python", "SQL"], "missing_skills": ["Docker"], "strongest_matching_evidence": [{"resume_evidence": "Built Python APIs.", "compared_to": "Python requirement", "match_type": "required_skill", "normalized_similarity": 91}], "role_relevance_explanation": "Saved semantic explanation.", "relevance_source": "job_description", "limitations": ["No independent capability verification."]},
            hybrid_intelligence={"hybrid_score": 71, "algorithm_version": "hybrid-candidate-intelligence-v1", "contribution_breakdown": [{"key": "trust_score_v2", "label": "Candidate Trust Score v2", "score": 74, "contribution": 29.6, "weight": 40, "basis": "Existing deterministic Trust Score."}]},
            target_role="Backend Engineer",
        )

    def test_returns_all_existing_models_without_accuracy_or_outcome_claims(self):
        result = self.build()
        self.assertEqual(result.comparisonVersion, "model-comparison-v1")
        self.assertEqual(result.targetRole, "Backend Engineer")
        self.assertEqual([item.key for item in result.models], ["trust_score_v2", "fuzzy_suitability", "semantic_job_match", "hybrid_candidate_intelligence"])
        self.assertIn("no fabricated accuracy", result.methodologyNote.lower())
        self.assertNotRegex(result.methodologyNote.lower(), r"hiring probability|selection probability")
        self.assertTrue(all(item.maximumScore == 100 for item in result.models))

    def test_exposes_chart_and_table_friendly_components_with_original_units(self):
        result = self.build()
        fuzzy = next(item for item in result.models if item.key == "fuzzy_suitability")
        semantic = next(item for item in result.models if item.key == "semantic_job_match")
        self.assertTrue(any(item.unit == "normalized_input" for item in fuzzy.components))
        self.assertTrue(any(item.unit == "membership" for item in fuzzy.components))
        self.assertTrue(any(item.unit == "count" for item in semantic.components))
        self.assertEqual(next(item for item in semantic.components if item.key == "missing_skill_count").value, 1)

    def test_keeps_existing_explainability_details_for_the_academic_lab(self):
        result = self.build()
        self.assertEqual(result.semanticMatchedSkills, ["Python", "SQL"])
        self.assertEqual(result.semanticMissingSkills, ["Docker"])
        self.assertEqual(result.activatedFuzzyRules[0].id, "R1")
        self.assertEqual(result.semanticEvidence[0].normalized_similarity, 91)
        self.assertEqual(result.hybridContributions[0].key, "trust_score_v2")

    def test_values_remain_bounded_without_recalculation(self):
        result = build_model_comparison(
            trust_card={"trustScore": 500, "scoreBreakdown": []}, fuzzy_suitability={"fuzzy_suitability_score": -1},
            semantic_job_match={"semantic_match_score": 120, "relevance_source": "role_context"},
            hybrid_intelligence={"hybrid_score": 70, "contribution_breakdown": []}, target_role=None,
        )
        self.assertEqual([item.score for item in result.models], [100, 0, 100, 70])
        self.assertEqual(result.relevanceSource, "role_context")


if __name__ == "__main__":
    unittest.main()
