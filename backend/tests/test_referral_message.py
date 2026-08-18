from unittest.mock import patch
import unittest

from app.models.schemas import ReferralMessageRequest
from app.services.groq_client import AIServiceUnavailable
from app.services.referral_requests import ReferralError, ReferralForbidden, ReferralRequestService
from tests.test_referral_requests import FakeRepository


class ReferralMessageTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.service = ReferralRequestService(self.repository)

    def payload(self, **changes):
        values = {
            "employeeId": self.repository.employee,
            "trustCardId": self.repository.card_id,
            "targetCompany": "Acme",
            "targetRole": "Software Engineer",
            "jobDescription": "",
            "tone": "professional_concise",
            "action": "generate",
        }
        values.update(changes)
        return ReferralMessageRequest(**values)

    @patch("app.services.referral_requests.generate_referral_message", return_value="Please review my Python project evidence for the Software Engineer role at Acme.")
    def test_generation_with_job_description(self, generator):
        result = self.service.generate_message(
            self.repository.student,
            self.payload(jobDescription="Build reliable Python services and collaborate with product teams."),
        )
        self.assertFalse(result["usedFallback"])
        self.assertTrue(any(fact["sourceType"] == "job_description" for fact in result["usedFacts"]))
        self.assertNotIn("No specific Job Description", " ".join(result["groundingLimitations"]))

    @patch("app.services.referral_requests.generate_referral_message", return_value="Please review my evidence for the Software Engineer role at Acme.")
    def test_generation_without_job_description_is_role_focused(self, generator):
        result = self.service.generate_message(self.repository.student, self.payload())
        self.assertIn("No specific Job Description", " ".join(result["groundingLimitations"]))
        self.assertFalse(any(fact["sourceType"] == "job_description" for fact in result["usedFacts"]))

    @patch("app.services.referral_requests.generate_referral_message", side_effect=AIServiceUnavailable("offline"))
    def test_groq_unavailable_uses_deterministic_fallback_within_limit(self, generator):
        result = self.service.generate_message(self.repository.student, self.payload())
        self.assertTrue(result["usedFallback"])
        self.assertLessEqual(result["wordCount"], 120)
        self.assertIn("Software Engineer", result["message"])

    def test_unverified_alumni_connection_is_blocked(self):
        with self.assertRaises(ReferralForbidden):
            self.service.generate_message(self.repository.student, self.payload(tone="alumni_connection"))

    def test_employee_cannot_use_student_message_route(self):
        with self.assertRaises(ReferralForbidden):
            self.service.generate_message(self.repository.employee, self.payload())

    @patch("app.services.referral_requests.generate_referral_message", return_value="As verified alumni, I would appreciate your review.")
    def test_verified_alumni_connection_is_allowed(self, generator):
        self.repository.shared_connections[(self.repository.student, self.repository.employee)] = {
            "verified": True, "safe_summary": "Verified alumni of RefAI College"
        }
        result = self.service.generate_message(self.repository.student, self.payload(tone="alumni_connection"))
        self.assertTrue(result["alumniConnectionAvailable"])
        self.assertTrue(any(fact["sourceType"] == "verified_shared_data" for fact in result["usedFacts"]))

    @patch("app.services.referral_requests.generate_referral_message", return_value="My supported project evidence is included.")
    def test_strongest_project_requires_resume_evidence(self, generator):
        result = self.service.generate_message(self.repository.student, self.payload(action="add_strongest_project"))
        self.assertTrue(any(fact["sourceType"] in {"resume", "trust_card"} for fact in result["usedFacts"]))
        self.repository.cards[self.repository.card_id]["payload"]["evidence"] = []
        self.repository.cards[self.repository.card_id]["analysis_id"] = None
        with self.assertRaises(ReferralError):
            self.service.generate_message(self.repository.student, self.payload(action="add_strongest_project"))

    @patch("app.services.referral_requests.generate_referral_message", return_value="Only supported Python project evidence remains.")
    def test_weak_claim_removal_uses_grounded_context(self, generator):
        result = self.service.generate_message(
            self.repository.student,
            self.payload(action="remove_weak_claims", currentMessage="I know Acme deeply and guarantee success."),
        )
        self.assertNotIn("guarantee", result["message"].lower())

    @patch("app.services.referral_requests.generate_referral_message", return_value="Please review my grounded evidence.")
    def test_private_employee_data_is_not_sent_to_model(self, generator):
        self.service.generate_message(self.repository.student, self.payload())
        facts = generator.call_args.args[0]
        serialized = str(facts)
        self.assertNotIn("private@acme.test", serialized)
        self.assertNotIn("email", serialized.lower())

    def test_student_cannot_use_another_students_trust_card_or_draft(self):
        with self.assertRaises(ReferralForbidden):
            self.service.generate_message(self.repository.other_student, self.payload())
        created = self.service.create(self.repository.student, self.service_payload())
        other_card_id = "11111111-1111-4111-8111-111111111111"
        self.repository.cards[other_card_id] = {
            "id": other_card_id, "student_id": self.repository.other_student,
            "analysis_id": None, "payload": {},
        }
        with self.assertRaises(ReferralForbidden):
            self.service.generate_message(
                self.repository.other_student,
                self.payload(referralRequestId=created["id"], trustCardId=other_card_id),
            )

    def service_payload(self):
        from app.models.schemas import CreateReferralRequest
        return CreateReferralRequest(
            employeeId=self.repository.employee,
            trustCardId=self.repository.card_id,
            targetRole="Software Engineer",
            targetCompany="Acme",
            studentMessage="Please review this request.",
        )

    @patch("app.services.referral_requests.generate_referral_message", return_value="word " * 180)
    def test_generated_message_is_capped_at_120_words(self, generator):
        result = self.service.generate_message(self.repository.student, self.payload())
        self.assertEqual(result["wordCount"], 120)

    @patch("app.services.referral_requests.generate_referral_message", return_value="Please review my grounded evidence.")
    def test_cached_message_reuse_does_not_charge_twice(self, generator):
        self.service.generate_message(self.repository.student, self.payload())
        self.service.generate_message(self.repository.student, self.payload())
        self.assertEqual(generator.call_count, 1)
        self.assertEqual(self.repository.credit_accounts[self.repository.student], 9)

    @patch("app.services.referral_requests.generate_referral_message", side_effect=AIServiceUnavailable("offline"))
    def test_provider_failure_uses_fallback_without_charging(self, generator):
        result = self.service.generate_message(self.repository.student, self.payload())
        self.assertTrue(result["usedFallback"])
        self.assertEqual(self.repository.credit_accounts[self.repository.student], 10)


if __name__ == "__main__":
    unittest.main()
