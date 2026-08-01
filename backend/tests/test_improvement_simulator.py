import unittest

from app.services.improvement_simulator import build_improvement_simulator


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


if __name__ == "__main__":
    unittest.main()
