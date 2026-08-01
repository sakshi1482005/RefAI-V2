import unittest

from app.models.schemas import CreateReferralRequest, ReferralQualityRequest
from app.services.referral_requests import ReferralQualityBlocked, ReferralRequestService
from tests.test_referral_requests import FakeRepository


class ReferralQualityTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.repository.employee_profiles[self.repository.employee].update(
            preferred_message_length="concise",
            minimum_evidence_expectations=["resume", "trust_card", "project_evidence"],
        )
        self.service = ReferralRequestService(self.repository)

    def payload(self, message: str, **changes):
        values = {
            "employeeId": self.repository.employee,
            "trustCardId": self.repository.card_id,
            "targetCompany": "Acme",
            "targetRole": "Software Engineer",
            "jobDescription": "",
            "studentMessage": message,
        }
        values.update(changes)
        return ReferralQualityRequest(**values)

    @staticmethod
    def clean_message():
        return (
            "Hi Employee One, I’m requesting a referral for the Software Engineer "
            "role at Acme. I built a Python project used by 40 students. "
            "Please review my attached Candidate Trust Card. Thank you."
        )

    def test_clean_grounded_message(self):
        result = self.service.quality(self.repository.student, self.payload(self.clean_message()))
        self.assertTrue(result["canSubmit"])
        self.assertFalse(result["blockingErrors"])
        self.assertEqual(sum(item["score"] for item in result["checks"]), result["score"])
        self.assertEqual(result["scoreVersion"], "referral-message-quality-v1")

    def test_overlong_message_is_warning_not_block(self):
        message = self.clean_message() + " " + ("context " * 100)
        result = self.service.quality(self.repository.student, self.payload(message))
        self.assertTrue(result["canSubmit"])
        self.assertTrue(any("exceeds" in warning or "120 words" in warning for warning in result["warnings"]))

    def test_missing_employee_name_is_warning(self):
        result = self.service.quality(
            self.repository.student,
            self.payload("I’m requesting a referral for the Software Engineer role at Acme. Thank you."),
        )
        self.assertTrue(result["canSubmit"])
        self.assertIn("The selected employee’s name is not used.", result["warnings"])

    def test_missing_relevant_project_is_warning(self):
        result = self.service.quality(
            self.repository.student,
            self.payload("Hi Employee One, I’m requesting a referral for the Software Engineer role at Acme. Thank you."),
        )
        self.assertTrue(result["canSubmit"])
        self.assertIn("No specific supported project or experience is mentioned.", result["warnings"])

    def test_invented_shared_connection_blocks(self):
        message = "Hi Employee One, as a fellow alumni, please refer me for the Software Engineer role at Acme."
        result = self.service.quality(self.repository.student, self.payload(message))
        self.assertFalse(result["canSubmit"])
        self.assertTrue(any("connection" in error for error in result["blockingErrors"]))

    def test_unsupported_skill_or_achievement_blocks(self):
        message = (
            "Hi Employee One, please refer me for the Software Engineer role at Acme. "
            "I built a Kubernetes platform that improved revenue by 95%."
        )
        result = self.service.quality(self.repository.student, self.payload(message))
        self.assertFalse(result["canSubmit"])
        joined = " ".join(result["blockingErrors"])
        self.assertIn("Kubernetes", joined)
        self.assertIn("95%", joined)

    def test_incorrect_company_or_role_blocks(self):
        message = "Hi Employee One, please refer me for the Accountant role at Globex."
        result = self.service.quality(self.repository.student, self.payload(message))
        self.assertFalse(result["canSubmit"])
        self.assertGreaterEqual(len(result["blockingErrors"]), 2)

    def test_no_job_description_is_not_penalized(self):
        no_jd = self.service.quality(self.repository.student, self.payload(self.clean_message()))
        with_jd = self.service.quality(
            self.repository.student,
            self.payload(self.clean_message(), jobDescription="Build Python services for student users."),
        )
        self.assertEqual(no_jd["score"], with_jd["score"])
        self.assertTrue(no_jd["canSubmit"])
        self.assertIn("absence of a JD did not reduce the score", " ".join(no_jd["limitations"]))

    def test_optional_jd_allows_opening_specific_wording(self):
        message = (
            "Hi Employee One, I’m requesting a referral for the Software Engineer role at Acme. "
            "The listed requirements align with my Python project used by 40 students."
        )
        result = self.service.quality(
            self.repository.student,
            self.payload(message, jobDescription="The listed requirements include Python project experience."),
        )
        self.assertTrue(result["canSubmit"])
        self.assertTrue(any("Job Description context" in item for item in result["passedChecks"]))

    def test_manual_edit_then_recheck_changes_result(self):
        blocked = self.service.quality(
            self.repository.student,
            self.payload("Hi Employee One, as a fellow alumni, please refer me for the Software Engineer role at Acme."),
        )
        clean = self.service.quality(self.repository.student, self.payload(self.clean_message()))
        self.assertFalse(blocked["canSubmit"])
        self.assertTrue(clean["canSubmit"])

    def test_blocking_errors_prevent_submission(self):
        payload = CreateReferralRequest(**self.payload(
            "Hi Employee One, as a fellow alumni, please refer me for the Software Engineer role at Acme."
        ).model_dump())
        with self.assertRaises(ReferralQualityBlocked):
            self.service.create(self.repository.student, payload)
        self.assertFalse(self.repository.requests)

    def test_warnings_do_not_prevent_submission(self):
        payload = CreateReferralRequest(**self.payload(
            "Please review my attached Candidate Trust Card."
        ).model_dump())
        created = self.service.create(self.repository.student, payload)
        self.assertEqual(created["status"], "submitted")


if __name__ == "__main__":
    unittest.main()
