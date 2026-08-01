from pathlib import Path
from unittest.mock import patch
import unittest

from pydantic import ValidationError

from app.models.schemas import EmployeeDecisionUpdate
from app.services.referral_requests import InvalidReferralTransition, ReferralForbidden, ReferralRequestService
from test_referral_requests import FakeRepository


class StructuredDecisionTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.service = ReferralRequestService(self.repository)

    def request(self):
        from app.models.schemas import CreateReferralRequest
        return self.service.create(self.repository.student, CreateReferralRequest(
            employeeId=self.repository.employee, trustCardId=self.repository.card_id,
            targetRole="Engineer", targetCompany="Acme", studentMessage="Please review my evidence",
        ))

    def test_approve_stores_structured_reason_public_message_private_note_and_timestamp(self):
        request = self.request()
        result = self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(
            status="approved", reason="strong_evidence", note="Internal follow-up owner: me",
        ))
        self.assertEqual(result["decisionReason"], "strong_evidence")
        self.assertIn("strong supporting evidence", result["decisionMessage"])
        self.assertTrue(result["decisionAt"])
        self.assertEqual(result["employeeNote"], "Internal follow-up owner: me")

    def test_decline_is_respectful_and_explicitly_preserves_trust_score(self):
        request = self.request()
        before = dict(self.repository.cards[self.repository.card_id]["payload"])
        result = self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(
            status="declined", reason="role_mismatch", note="Private calibration note",
        ))
        self.assertIn("does not reduce your Candidate Trust Score", result["decisionMessage"])
        self.assertEqual(self.repository.cards[self.repository.card_id]["payload"], before)

    def test_more_information_requires_editable_manual_question(self):
        request = self.request()
        result = self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(
            status="more_info_requested", reason="clarification_required",
            question="Could you share a concrete testing example?",
        ))
        self.assertIn("Could you share a concrete testing example?", result["decisionMessage"])
        with self.assertRaises(ValidationError):
            EmployeeDecisionUpdate(status="more_info_requested", reason="clarification_required")

    def test_invalid_reason_for_decision_type_is_rejected(self):
        with self.assertRaises(ValidationError):
            EmployeeDecisionUpdate(status="approved", reason="role_mismatch")
        with self.assertRaises(ValidationError):
            EmployeeDecisionUpdate(status="declined", reason="strong_evidence")

    def test_unrelated_employee_and_student_cannot_decide(self):
        request = self.request()
        update = EmployeeDecisionUpdate(status="approved", reason="suitable_profile")
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.other_employee, str(request["id"]), update)
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.student, str(request["id"]), update)

    def test_student_never_receives_private_note_from_request_or_history(self):
        request = self.request(); request_id = str(request["id"])
        self.service.update_status(self.repository.employee, request_id, EmployeeDecisionUpdate(
            status="declined", reason="other", note="Sensitive employee-only note",
        ))
        student_view = self.service.get(self.repository.student, request_id)
        self.assertIsNone(student_view["employeeNote"])
        self.assertNotIn("Sensitive employee-only note", str(self.service.history(self.repository.student, request_id)))
        self.assertEqual(self.service.get(self.repository.employee, request_id)["employeeNote"], "Sensitive employee-only note")

    def test_completed_decision_cannot_be_overwritten(self):
        request = self.request(); request_id = str(request["id"])
        self.service.update_status(self.repository.employee, request_id, EmployeeDecisionUpdate(status="approved", reason="suitable_profile"))
        with self.assertRaises(InvalidReferralTransition):
            self.service.update_status(self.repository.employee, request_id, EmployeeDecisionUpdate(status="declined", reason="other"))

    @patch("app.services.referral_requests.generate_clarification_question")
    def test_ai_clarification_uses_only_saved_missing_evidence_and_remains_advisory(self, generator):
        self.repository.cards[self.repository.card_id]["payload"]["missingRequirements"] = [{"requirement": "Docker deployment evidence"}]
        request = self.request()
        generator.return_value = {"question": "Could you share concrete Docker deployment evidence?", "usedFactId": "missing.1"}
        result = self.service.draft_clarification(self.repository.employee, str(request["id"]))
        self.assertEqual(result["missingEvidence"], ["Docker deployment evidence"])
        self.assertIn("advisory", result["limitation"])
        with self.assertRaises(ReferralForbidden):
            self.service.draft_clarification(self.repository.other_employee, str(request["id"]))


class StructuredDecisionMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202607310002_structured_referral_decisions.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_migration_persists_public_structure_and_isolates_private_notes(self):
        for column in ("decision_reason", "decision_message", "decision_at"):
            self.assertIn(f"add column if not exists {column}", self.sql)
        self.assertIn("create table if not exists public.referral_decision_private_notes", self.sql)
        self.assertIn("employee_id = auth.uid()", self.sql)
        self.assertIn("update public.referral_requests set employee_note = null", self.sql)
        self.assertIn("invalid referral status transition", self.sql)


if __name__ == "__main__":
    unittest.main()
