from datetime import datetime, timezone
from uuid import uuid4

import unittest

from app.models.schemas import CreateReferralRequest, EmployeeDecisionUpdate, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeTrustCardView
from app.services.referral_requests import InvalidReferralTransition, ReferralForbidden, ReferralRequestService


class FakeRepository:
    def __init__(self):
        self.student, self.other_student, self.employee, self.other_employee = [str(uuid4()) for _ in range(4)]
        self.roles = {self.student: "student", self.other_student: "student", self.employee: "employee", self.other_employee: "employee"}
        self.card_id = str(uuid4())
        self.cards = {self.card_id: {"id": self.card_id, "student_id": self.student, "payload": {"candidateName": "Student", "role": "Engineer", "trustScore": 82, "overallMatch": 79}}}
        self.profile_data = {self.student: {"full_name": "Student One", "college": "RefAI College"}}
        self.auth_metadata = {self.student: {"degree": "B.Tech", "graduation_year": "2026"}}
        self.resumes = {self.student: {"path": f"{self.student}/resume.pdf", "file_name": "resume.pdf"}}
        self.requests, self.history_rows = {}, []

    def get_role(self, user_id): return self.roles.get(user_id)
    def get_trust_card(self, trust_card_id): return self.cards.get(trust_card_id)
    def get_profile(self, student_id): return self.profile_data.get(student_id)
    def get_auth_metadata(self, student_id): return self.auth_metadata.get(student_id, {})
    def find_resume(self, student_id): return self.resumes.get(student_id)
    def sign_resume(self, path, expires_in): return f"https://storage.test/signed/{path}?expires={expires_in}"
    def create_request(self, values):
        now, request_id = datetime.now(timezone.utc).isoformat(), str(uuid4())
        row = {"id": request_id, "employee_note": None, "created_at": now, "updated_at": now, **values}
        self.requests[request_id] = row
        self.history_rows.append({"id": 1, "referral_request_id": request_id, "previous_status": None, "new_status": "pending", "changed_by": values["student_id"], "note": "Referral request created", "created_at": now})
        return row
    def get_request(self, request_id): return self.requests.get(request_id)
    def list_requests(self, field, user_id): return [row for row in self.requests.values() if row[field] == user_id]
    def list_employee_queue(self, employee_id):
        return [{**row, "student": self.profile_data.get(row["student_id"], {}), "trust_card": {"id": card["id"], "trust_score": card["payload"].get("trustScore"), "overall_match": card["payload"].get("overallMatch")} if (card := self.cards.get(row["trust_card_id"])) else {}} for row in self.requests.values() if row["employee_id"] == employee_id]
    def transition(self, actor_id, request_id, status, note):
        row = self.requests[request_id]
        allowed = {"pending": {"under_review", "more_info_requested", "approved", "declined"}, "under_review": {"more_info_requested", "approved", "declined"}, "more_info_requested": {"under_review", "declined"}, "approved": {"referred"}}
        previous = row["status"]
        if status not in allowed.get(previous, set()): raise InvalidReferralTransition("invalid referral status transition")
        row.update(status=status, employee_note=note, updated_at=datetime.now(timezone.utc).isoformat())
        self.history_rows.append({"id": len(self.history_rows) + 1, "referral_request_id": request_id, "previous_status": previous, "new_status": status, "changed_by": actor_id, "note": note, "created_at": row["updated_at"]})
        return row
    def list_history(self, request_id): return [row for row in self.history_rows if row["referral_request_id"] == request_id]
    def persist_trust_card(self, student_id, payload, analysis_id=None):
        card_id = str(uuid4())
        row = {"id": card_id, "student_id": student_id, "analysis_id": analysis_id, "payload": payload}
        self.cards[card_id] = row
        return row
    def list_employees(self):
        return [{"id": self.employee, "full_name": "Employee One", "company": "Acme", "designation": "Engineer"}]


class ReferralRequestTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.service = ReferralRequestService(self.repository)

    def payload(self, student_id=None):
        return CreateReferralRequest(studentId=student_id, employeeId=self.repository.employee, trustCardId=self.repository.card_id, targetRole="Engineer", targetCompany="Acme", jobDescription="Build reliable services", studentMessage="Please review my evidence")

    def create(self): return self.service.create(self.repository.student, self.payload())

    def test_student_can_create_assigned_request(self): self.assertEqual(self.create()["status"], "pending")
    def test_student_cannot_spoof_student_id(self):
        with self.assertRaises(ReferralForbidden): self.service.create(self.repository.student, self.payload(self.repository.other_student))
    def test_assigned_employee_can_read(self):
        request = self.create(); self.assertEqual(self.service.get(self.repository.employee, str(request["id"]))["employeeId"], self.repository.employee)
    def test_other_employee_cannot_read(self):
        request = self.create()
        with self.assertRaises(ReferralForbidden): self.service.get(self.repository.other_employee, str(request["id"]))
    def test_student_can_read_own_request(self):
        request = self.create(); self.assertEqual(self.service.get(self.repository.student, str(request["id"]))["studentId"], self.repository.student)
    def test_student_cannot_decide(self):
        request = self.create()
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.student, str(request["id"]), EmployeeDecisionUpdate(status="approved"))
    def test_employee_cannot_update_unrelated_request(self):
        request = self.create()
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.other_employee, str(request["id"]), EmployeeDecisionUpdate(status="approved"))
    def test_invalid_transition_rejected(self):
        request = self.create(); self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="approved"))
        with self.assertRaises(InvalidReferralTransition): self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="under_review"))
    def test_status_change_appends_history(self):
        request = self.create(); self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="under_review", note="Review started"))
        history = self.service.history(self.repository.employee, str(request["id"]))
        self.assertEqual([(item["previousStatus"], item["newStatus"]) for item in history], [(None, "pending"), ("pending", "under_review")])
    def test_trust_card_access_requires_participation(self):
        request = self.create(); request_id = str(request["id"])
        self.assertEqual(self.service.trust_card_for_request(self.repository.employee, request_id)["id"], self.repository.card_id)
        with self.assertRaises(ReferralForbidden): self.service.trust_card_for_request(self.repository.other_employee, request_id)
    def test_employee_queue_returns_only_assigned_requests(self):
        request = self.create()
        queue = self.service.employee_queue(self.repository.employee)
        self.assertEqual(queue[0]["id"], request["id"])
        self.assertEqual(queue[0]["studentName"], "Student One")
        self.assertEqual((queue[0]["trustScore"], queue[0]["overallMatch"]), (82, 79))
        self.assertTrue(queue[0]["trustCardExists"])
    def test_employee_queue_can_be_empty_and_isolated(self):
        self.assertEqual(self.service.employee_queue(self.repository.employee), [])
        self.create()
        self.assertEqual(self.service.employee_queue(self.repository.other_employee), [])
    def test_student_cannot_access_employee_queue(self):
        self.create()
        with self.assertRaises(ReferralForbidden): self.service.employee_queue(self.repository.student)
    def test_employee_directory_returns_persisted_company(self):
        directory = self.service.employee_directory(self.repository.student)
        self.assertEqual(directory[0]["company"], "Acme")
        self.assertEqual(directory[0]["designation"], "Engineer")
    def test_employee_directory_supports_legacy_company_metadata(self):
        self.repository.list_employees = lambda: [{"id": self.repository.employee, "full_name": "Employee One"}]
        self.repository.auth_metadata[self.repository.employee] = {"company_name": "Legacy Co", "headline": "Senior Engineer"}
        directory = self.service.employee_directory(self.repository.student)
        self.assertEqual(directory[0]["company"], "Legacy Co")
        self.assertEqual(directory[0]["designation"], "Senior Engineer")
    def test_employee_queue_excludes_detail_payloads(self):
        self.create()
        item = self.service.employee_queue(self.repository.employee)[0]
        self.assertNotIn("payload", item)
        self.assertNotIn("resumeText", item)
        self.assertNotIn("trustCard", item)
    def test_assigned_employee_can_retrieve_detail_resume_and_trust_card(self):
        request = self.create(); request_id = str(request["id"])
        detail = self.service.employee_request_detail(self.repository.employee, request_id)
        resume = self.service.employee_resume(self.repository.employee, request_id)
        card = self.service.employee_trust_card(self.repository.employee, request_id)
        self.assertEqual(detail["candidate"]["studentName"], "Student One")
        self.assertTrue(detail["analysisExists"])
        self.assertEqual(resume["requestId"], request["id"])
        self.assertEqual(resume["expiresIn"], 600)
        self.assertTrue(resume["signedUrl"].startswith("https://storage.test/signed/"))
        self.assertEqual(card["trustCardId"], self.repository.card_id)
        EmployeeReferralRequestView.model_validate(detail)
        EmployeeResumeAccess.model_validate(resume)
        EmployeeTrustCardView.model_validate(card)
    def test_unassigned_employee_cannot_retrieve_employee_resources(self):
        request_id = str(self.create()["id"])
        for operation in (self.service.employee_request_detail, self.service.employee_resume, self.service.employee_trust_card):
            with self.assertRaises(ReferralForbidden): operation(self.repository.other_employee, request_id)
    def test_student_cannot_retrieve_employee_resources(self):
        request_id = str(self.create()["id"])
        for operation in (self.service.employee_request_detail, self.service.employee_resume, self.service.employee_trust_card):
            with self.assertRaises(ReferralForbidden): operation(self.repository.student, request_id)
    def test_invalid_employee_request_id_is_not_found(self):
        with self.assertRaises(Exception) as raised: self.service.employee_request_detail(self.repository.employee, str(uuid4()))
        self.assertEqual(raised.exception.__class__.__name__, "ReferralNotFound")
    def test_missing_resume_and_trust_card_are_cleanly_unavailable(self):
        request = self.create(); request_id = str(request["id"])
        self.repository.resumes.clear()
        with self.assertRaises(Exception) as resume_error: self.service.employee_resume(self.repository.employee, request_id)
        self.assertEqual(resume_error.exception.__class__.__name__, "ReferralUnavailable")
        self.repository.cards.clear()
        with self.assertRaises(Exception) as card_error: self.service.employee_trust_card(self.repository.employee, request_id)
        self.assertEqual(card_error.exception.__class__.__name__, "ReferralUnavailable")


if __name__ == "__main__": unittest.main()
