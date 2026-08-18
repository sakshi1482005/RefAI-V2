import unittest

from app.services.improvement_simulator import attach_intelligence_snapshot, build_improvement_simulator, simulate_hypothetical_improvements


def component(key, label, score, maximum, missing=None, found=None):
    return {
        "key": key, "label": label, "score": score, "maximumScore": maximum,
        "potentialImprovementPoints": maximum - score,
        "evidenceMissing": missing or [], "evidenceFound": found or [],
        "improvementAction": f"Add truthful evidence for {label}.",
    }


class ImprovementSimulatorTests(unittest.TestCase):
    def payload(self, scores=(20, 15, 10, 8, 7), version="trust-score-v4"):
        definitions = [
            ("roleRequirementMatch", "Role Requirement Match", 30),
            ("evidenceStrength", "Evidence Strength", 25),
            ("projectExperienceRelevance", "Project and Experience Relevance", 20),
            ("skillDepth", "Skill Depth", 15),
            ("resumeEvidenceCompleteness", "Resume Evidence Completeness", 10),
        ]
        items = [component(key, label, score, maximum, [f"Missing {label}"], [f"Existing {label}"]) for (key, label, maximum), score in zip(definitions, scores)]
        return {"trustScore": sum(scores), "scoreVersion": version, "scoreBreakdown": items}

    def test_suggestions_are_ranked_by_highest_bounded_potential(self):
        result = build_improvement_simulator(self.payload())
        potentials = [item["maximumPotentialPoints"] for item in result["suggestions"]]
        self.assertEqual(potentials, sorted(potentials, reverse=True))
        self.assertIn("truthful", result["suggestions"][0]["recommendedAction"])
        self.assertIn("keyword repetition alone earns no credit", result["suggestions"][0]["limitation"])

    def test_suggestion_never_exceeds_component_remaining_points(self):
        payload = self.payload()
        payload["scoreBreakdown"][0]["potentialImprovementPoints"] = 999
        result = build_improvement_simulator(payload)
        for suggestion in result["suggestions"]:
            source = next(item for item in payload["scoreBreakdown"] if item["key"] == suggestion["componentKey"])
            self.assertLessEqual(suggestion["maximumPotentialPoints"], source["maximumScore"] - source["score"])

    def test_total_potential_never_exceeds_total_score_maximum(self):
        result = build_improvement_simulator(self.payload())
        self.assertLessEqual(result["totalMaximumPotentialPoints"], 100 - result["currentScore"])
        self.assertLessEqual(sum(item["maximumPotentialPoints"] for item in result["suggestions"]), 100 - result["currentScore"])

    def test_full_score_has_no_improvement_suggestions(self):
        result = build_improvement_simulator(self.payload((30, 25, 20, 15, 10)))
        self.assertEqual(result["currentScore"], 100)
        self.assertEqual(result["suggestions"], [])
        self.assertEqual(result["totalMaximumPotentialPoints"], 0)

    def test_same_version_comparison_returns_component_delta_and_new_evidence(self):
        previous = self.payload((18, 12, 8, 6, 6))
        current = self.payload((22, 17, 12, 8, 7))
        current["scoreBreakdown"][0]["evidenceFound"].append("Resume: Built a production API")
        result = build_improvement_simulator(current, previous)
        self.assertEqual(result["comparison"]["previousScore"], 50)
        self.assertEqual(result["comparison"]["currentScore"], 66)
        role_delta = result["comparison"]["componentDeltas"][0]
        self.assertEqual(role_delta["delta"], 4)
        self.assertIn("Resume: Built a production API", role_delta["evidenceCausingChange"])

    def test_different_score_versions_are_not_compared(self):
        result = build_improvement_simulator(self.payload(), self.payload(version="trust-score-v3"))
        self.assertIsNone(result["comparison"])
        self.assertIn("same target role, company, and score version", result["limitations"][-1])

    def _intelligence(self):
        fuzzy = {
            "fuzzy_suitability_score": 50, "label": "Moderate",
            "inputValuesUsed": {"skill_match": 50, "project_relevance": 50, "experience": 50, "education": 50, "evidence_strength": 50, "resume_quality": 50},
        }
        semantic = {"semantic_match_score": 45, "missing_skills": ["Docker"], "matched_skills": [], "weak_missing_evidence": [], "limitations": []}
        hybrid = {"hybrid_score": 55, "algorithm_version": "hybrid-candidate-intelligence-v1"}
        card = {"trustScore": 60}
        claims = {"claims": []}
        recommendations = [{"skill": "Docker", "priority": "High"}]
        return fuzzy, semantic, hybrid, card, claims, recommendations

    def test_snapshot_preserves_existing_trust_score_and_exposes_academic_signals(self):
        fuzzy, semantic, hybrid, *_ = self._intelligence()
        result = attach_intelligence_snapshot(build_improvement_simulator(self.payload()), fuzzy_suitability=fuzzy, semantic_job_match=semantic, hybrid_intelligence=hybrid, recommendations=[{"skill": "Docker", "priority": "High"}])
        self.assertEqual(result["currentScore"], 60)
        self.assertEqual(result["intelligenceSnapshot"]["hybridScore"], 55)
        self.assertEqual(result["intelligenceSnapshot"]["availableSkillScenarios"][0]["skill"], "Docker")
        self.assertIsNone(result["simulation"])

    def test_hypothetical_skill_and_project_evidence_are_in_memory_and_deterministic(self):
        fuzzy, semantic, hybrid, card, claims, recommendations = self._intelligence()
        baseline = build_improvement_simulator(self.payload())
        result = simulate_hypothetical_improvements(
            baseline, fuzzy_suitability=fuzzy, semantic_job_match=semantic, hybrid_intelligence=hybrid,
            trust_card=card, claim_verification=claims, recommendations=recommendations,
            selected_skills=["Docker"], add_project_evidence=True,
        )
        simulation = result["simulation"]
        self.assertTrue(simulation["isSimulation"])
        self.assertGreater(simulation["simulatedScore"], simulation["currentScore"])
        self.assertEqual(card, {"trustScore": 60})
        self.assertEqual(fuzzy["inputValuesUsed"]["skill_match"], 50)
        self.assertIn("does not modify", " ".join(simulation["limitations"]))
        self.assertIn("Candidate Trust Score v2", " ".join(item["whyChanged"] for item in simulation["affectedComponents"]))

    def test_unknown_or_unavailable_skill_cannot_be_simulated(self):
        fuzzy, semantic, hybrid, card, claims, recommendations = self._intelligence()
        with self.assertRaises(ValueError):
            simulate_hypothetical_improvements(
                build_improvement_simulator(self.payload()), fuzzy_suitability=fuzzy, semantic_job_match=semantic,
                hybrid_intelligence=hybrid, trust_card=card, claim_verification=claims, recommendations=recommendations,
                selected_skills=["Invented skill"], add_project_evidence=False,
            )


if __name__ == "__main__":
    unittest.main()
