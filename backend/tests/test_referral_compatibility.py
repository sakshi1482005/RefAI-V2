import unittest

from app.services.referral_compatibility import WEIGHTS, calculate_referral_compatibility


def employee(**overrides):
    return {
        "profile_id": "employee-1",
        "company": "Acme",
        "department": "Engineering",
        "supported_roles": ["Software Engineer", "Backend Engineer"],
        "supported_departments": ["Engineering"],
        "supported_companies": ["Acme"],
        "accepts_freshers": True,
        "preferred_candidate_levels": ["student", "fresher"],
        "availability_status": "accepting",
        **overrides,
    }


def trust_card(**overrides):
    return {
        "role": "Software Engineer",
        "trustScore": 82,
        "referralReadiness": "Ready to request referral",
        **overrides,
    }


def request(**overrides):
    return {
        "target_role": "Software Engineer",
        "target_company": "Acme",
        "job_description": "Software engineer building backend APIs with Python and cloud services.",
        "student_message": "Please review my project evidence for this software engineering opportunity.",
        **overrides,
    }


class ReferralCompatibilityTests(unittest.TestCase):
    def test_exact_weights_and_component_total(self):
        self.assertEqual(WEIGHTS, {
            "role_alignment": 35,
            "department_relevance": 25,
            "employee_preferences": 20,
            "candidate_readiness": 15,
            "request_completeness": 5,
        })
        result = calculate_referral_compatibility(employee(), trust_card(), request())
        self.assertEqual(sum(component["maximumScore"] for component in result["components"]), 100)
        self.assertEqual(result["score"], sum(component["score"] for component in result["components"]))

    def test_strong_appropriate_request_scores_above_conflicting_request(self):
        strong = calculate_referral_compatibility(employee(), trust_card(), request())
        weak = calculate_referral_compatibility(
            employee(department="Finance", supported_departments=["Finance"], supported_roles=["Accountant"], supported_companies=["Other Co"], accepts_freshers=False, preferred_candidate_levels=["experienced"]),
            trust_card(role="Data Analyst", trustScore=42, referralReadiness="Not ready yet"),
            request(job_description="", student_message="Please refer me"),
        )
        self.assertGreater(strong["score"], weak["score"])
        self.assertTrue(weak["missingOrConflictingFactors"])
        self.assertTrue(weak["suggestedImprovements"])

    def test_with_and_without_job_description_have_complete_supported_requests(self):
        with_jd = calculate_referral_compatibility(employee(), trust_card(), request())
        without_jd = calculate_referral_compatibility(employee(), trust_card(), request(job_description=""))
        with_component = {component["key"]: component for component in with_jd["components"]}["request_completeness"]
        without_component = {component["key"]: component for component in without_jd["components"]}["request_completeness"]
        self.assertEqual(with_component["score"], 5)
        self.assertEqual(without_component["score"], 5)
        self.assertEqual(with_jd["score"], without_jd["score"])
        self.assertFalse(any("job id" in item.lower() for item in without_jd["missingOrConflictingFactors"]))

    def test_request_completeness_uses_only_supported_required_fields(self):
        incomplete = calculate_referral_compatibility(
            employee(profile_id=None), {},
            request(target_company="", target_role="", student_message="", job_description=""),
        )
        completeness = {component["key"]: component for component in incomplete["components"]}["request_completeness"]
        self.assertEqual(completeness["score"], 0)
        for expected in (
            "No employee is selected.",
            "The target company is missing.",
            "The target role is missing.",
            "The referral request message is missing.",
            "A persisted Candidate Trust Card is not available.",
        ):
            self.assertIn(expected, incomplete["missingOrConflictingFactors"])

    def test_output_never_claims_acceptance_or_hiring_prediction(self):
        result = calculate_referral_compatibility(employee(), trust_card(), request())
        limitation_text = " ".join(result["limitations"]).lower()
        self.assertIn("does not predict acceptance or hiring", limitation_text)


if __name__ == "__main__":
    unittest.main()
