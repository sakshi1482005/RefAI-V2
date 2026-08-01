import unittest
from uuid import uuid4

from app.services.claim_verification import build_claim_verifications


def proof(claim: str) -> dict:
    return {
        "id": str(uuid4()), "title": f"{claim} repository",
        "proof_type": "github_repository", "url_or_reference": "https://github.com/student/project",
        "related_skill_claim": claim,
    }


class ClaimVerificationTests(unittest.TestCase):
    def status(self, result, claim):
        return next(item for item in result["claims"] if item["claim"] == claim)

    def test_structured_proof_vault_link_is_verified_evidence(self):
        result = build_claim_verifications({"matchedSkills": ["Python"]}, "Skills: Python", [proof("Python")])
        item = self.status(result, "Python")
        self.assertEqual(item["status"], "Verified evidence")
        self.assertEqual(len(item["proofEvidence"]), 1)
        self.assertIn("not independently verified", item["reason"])

    def test_demonstrated_resume_claim_is_resume_supported(self):
        result = build_claim_verifications(
            {"matchedSkills": ["Python"]},
            "Projects\nBuilt and deployed a Python API used by 40 students.", [],
        )
        item = self.status(result, "Python")
        self.assertEqual(item["status"], "Resume supported")
        self.assertTrue(item["resumeEvidence"])

    def test_listed_only_claim_is_self_declared(self):
        result = build_claim_verifications({"matchedSkills": ["Python"]}, "Skills: Python", [])
        self.assertEqual(self.status(result, "Python")["status"], "Self-declared")

    def test_conflicting_saved_signals_need_clarification(self):
        result = build_claim_verifications({
            "matchedSkills": ["Python"],
            "missingRequirements": [{"requirement": "Python"}],
        }, "Built a Python service.", [])
        self.assertEqual(self.status(result, "Python")["status"], "Needs clarification")

    def test_legacy_card_without_claim_metadata_returns_safe_empty_state(self):
        result = build_claim_verifications({"trustScore": 70}, "", [])
        self.assertEqual(result["claims"], [])
        self.assertIn("does not independently verify", result["limitation"])

    def test_claim_status_does_not_mutate_score_payload(self):
        payload = {"trustScore": 82, "scoreVersion": "trust-score-v4", "matchedSkills": ["Python"]}
        original = dict(payload)
        build_claim_verifications(payload, "Built a Python API.", [])
        self.assertEqual(payload, original)


if __name__ == "__main__":
    unittest.main()
