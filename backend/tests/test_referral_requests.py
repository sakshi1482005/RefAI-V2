from datetime import date, datetime, timezone
from uuid import uuid4

import unittest
from pydantic import ValidationError

from app.models.schemas import CreateReferralRequest, EmployeeDecisionUpdate, EmployeeProfessionalProfileUpdate, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeTrustCardView, ReferralCompatibilityRequest, ReferralMessageRequest, ReferralRequestDetail, ReferralSubmissionUpdate
from app.services.referral_requests import InvalidReferralTransition, ReferralForbidden, ReferralRequestService, SupabaseReferralRepository


class FakeRepository:
    def __init__(self):
        self.student, self.other_student, self.employee, self.other_employee = [str(uuid4()) for _ in range(4)]
        self.roles = {self.student: "student", self.other_student: "student", self.employee: "employee", self.other_employee: "employee"}
        self.card_id = str(uuid4())
        self.analysis_id = str(uuid4())
        self.cards = {self.card_id: {"id": self.card_id, "student_id": self.student, "analysis_id": self.analysis_id, "payload": {"candidateName": "Student", "role": "Engineer", "trustScore": 82, "overallMatch": 79, "evidence": ["Built a Python project used by 40 students."]}}}
        self.profile_data = {self.student: {"full_name": "Student One", "college": "RefAI College"}, self.employee: {"full_name": "Employee One", "email": "private@acme.test"}}
        self.analyses = {self.analysis_id: {"id": self.analysis_id, "student_id": self.student, "resume_text": "Project: Built a Python service used by 40 students."}}
        self.shared_connections = {}
        self.auth_metadata = {self.student: {"degree": "B.Tech", "graduation_year": "2026"}}
        self.student_education = {self.student: {"profile_id": self.student, "college": "RefAI College", "degree": "B.Tech", "branch": "Computer Science", "graduation_year": "2026"}}
        self.employee_profiles = {self.employee: {
            "profile_id": self.employee, "company": "Acme", "designation": "Engineer",
            "availability_status": "accepting", "max_active_requests": 5,
            "accepts_freshers": True, "supported_roles": ["Software Engineer"],
            "verified_employee": True, "department": "Engineering",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
        self.resumes = {self.student: {"path": f"{self.student}/resume.pdf", "file_name": "resume.pdf"}}
        self.requests, self.history_rows = {}, []
        self.private_notes = {}

    def get_role(self, user_id): return self.roles.get(user_id)
    def get_trust_card(self, trust_card_id): return self.cards.get(trust_card_id)
    def get_profile(self, student_id): return self.profile_data.get(student_id)
    def get_auth_metadata(self, student_id): return self.auth_metadata.get(student_id, {})
    def get_student_education(self, student_id): return self.student_education.get(student_id)
    def get_analysis(self, student_id, analysis_id):
        row = self.analyses.get(analysis_id)
        return row if row and row["student_id"] == student_id else None
    def get_verified_shared_connection(self, student_id, employee_id): return self.shared_connections.get((student_id, employee_id))
    def find_resume(self, student_id): return self.resumes.get(student_id)
    def sign_resume(self, path, expires_in): return f"https://storage.test/signed/{path}?expires={expires_in}"
    def create_request(self, values):
        now, request_id = datetime.now(timezone.utc).isoformat(), str(uuid4())
        row = {"id": request_id, "employee_note": None, "created_at": now, "updated_at": now, **values}
        self.requests[request_id] = row
        self.history_rows.append({"id": 1, "referral_request_id": request_id, "previous_status": None, "new_status": values["status"], "changed_by": values["student_id"], "note": "Referral request created", "created_at": now})
        return row
    def get_request(self, request_id): return self.requests.get(request_id)
    def list_requests(self, field, user_id): return [row for row in self.requests.values() if row[field] == user_id]
    def list_employee_queue(self, employee_id):
        return [{**row, "student": self.profile_data.get(row["student_id"], {}), "trust_card": {"id": card["id"], "trust_score": card["payload"].get("trustScore"), "overall_match": card["payload"].get("overallMatch")} if (card := self.cards.get(row["trust_card_id"])) else {}} for row in self.requests.values() if row["employee_id"] == employee_id]
    def transition(self, actor_id, request_id, status, reason, decision_message, private_note):
        row = self.requests[request_id]
        allowed = {"submitted": {"under_review", "more_info_requested", "approved", "declined"}, "pending": {"under_review", "more_info_requested", "approved", "declined"}, "under_review": {"more_info_requested", "approved", "declined"}, "more_info_requested": {"under_review", "declined"}}
        previous = row["status"]
        if status not in allowed.get(previous, set()): raise InvalidReferralTransition("invalid referral status transition")
        row.update(status=status, employee_note=None, decision_reason=reason, decision_message=decision_message, decision_at=datetime.now(timezone.utc).isoformat(), updated_at=datetime.now(timezone.utc).isoformat())
        if private_note: self.private_notes[(request_id, actor_id)] = private_note
        self.history_rows.append({"id": len(self.history_rows) + 1, "referral_request_id": request_id, "previous_status": previous, "new_status": status, "changed_by": actor_id, "note": None, "decision_reason": reason, "decision_message": decision_message, "created_at": row["updated_at"]})
        return row
    def mark_referral_submitted(self, actor_id, request_id, values):
        row = self.requests[request_id]
        if row["employee_id"] != actor_id: raise ReferralForbidden("This request is assigned to another employee")
        if row["status"] != "approved": raise InvalidReferralTransition("invalid referral status transition")
        previous = row["status"]
        now = datetime.now(timezone.utc).isoformat()
        row.update(
            status="referred", referral_date=values.get("referral_date") or date.today().isoformat(),
            referral_confirmation_number=values.get("confirmation_number"),
            referral_note_to_student=values.get("note_to_student"),
            referral_submitted_at=now, referral_submitted_by=actor_id, updated_at=now,
        )
        self.history_rows.append({"id": len(self.history_rows) + 1, "referral_request_id": request_id, "previous_status": previous, "new_status": "referred", "changed_by": actor_id, "note": values.get("note_to_student"), "created_at": now})
        return row
    def get_private_decision_note(self, request_id, employee_id): return self.private_notes.get((request_id, employee_id))
    def list_history(self, request_id): return [row for row in self.history_rows if row["referral_request_id"] == request_id]
    def record_employee_viewed(self, actor_id, request_id):
        row = self.requests[request_id]
        if row["employee_id"] != actor_id: raise ReferralForbidden("Referral request access denied")
        if any(item.get("event_type") == "employee_viewed" and item["referral_request_id"] == request_id for item in self.history_rows): return False
        self.history_rows.append({"id": len(self.history_rows) + 1, "referral_request_id": request_id, "previous_status": row["status"], "new_status": row["status"], "changed_by": actor_id, "note": None, "event_type": "employee_viewed", "created_at": datetime.now(timezone.utc).isoformat()})
        return True
    def employee_response_time_data(self, employee_id):
        requests = [{"id": row["id"], "created_at": row["created_at"]} for row in self.requests.values() if row["employee_id"] == employee_id]
        history = [event for event in self.history_rows if any(request["id"] == event["referral_request_id"] and request["employee_id"] == employee_id for request in self.requests.values())]
        return requests, history
    def persist_trust_card(self, student_id, payload, analysis_id=None):
        card_id = str(uuid4())
        row = {"id": card_id, "student_id": student_id, "analysis_id": analysis_id, "payload": payload}
        self.cards[card_id] = row
        return row
    def list_employees(self):
        return [{"id": self.employee, "full_name": "Employee One", **self.employee_profiles.get(self.employee, {})}]
    def get_employee_profile(self, profile_id): return self.employee_profiles.get(profile_id)
    def upsert_employee_profile(self, profile_id, values):
        row = {"profile_id": profile_id, **values}
        self.employee_profiles[profile_id] = row
        return row
    def active_request_counts(self, employee_ids):
        active = {"submitted", "pending", "under_review", "more_info_requested"}
        return {employee_id: sum(1 for row in self.requests.values() if row["employee_id"] == employee_id and row["status"] in active) for employee_id in employee_ids}
    def referral_activity(self, employee_ids):
        return {
            employee_id: {
                "requests": [row for row in self.requests.values() if row["employee_id"] == employee_id],
                "history": [event for event in self.history_rows if any(request["id"] == event["referral_request_id"] and request["employee_id"] == employee_id for request in self.requests.values())],
            }
            for employee_id in employee_ids
        }


class ReferralRequestTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeRepository()
        self.service = ReferralRequestService(self.repository)

    def payload(self, student_id=None):
        return CreateReferralRequest(studentId=student_id, employeeId=self.repository.employee, trustCardId=self.repository.card_id, targetRole="Engineer", targetCompany="Acme", jobDescription="Build reliable services", studentMessage="Please review my evidence")

    def create(self): return self.service.create(self.repository.student, self.payload())

    def test_student_can_create_assigned_request(self):
        created = self.create()
        self.assertEqual(created["status"], "submitted")
        self.assertEqual(created["employeeCompanySnapshot"], "Acme")
        self.assertEqual(self.repository.requests[str(created["id"])]["employee_company_snapshot"], "Acme")
        ReferralRequestDetail.model_validate(created)
    def test_compatibility_is_calculated_before_create_and_persisted(self):
        self.repository.employee_profiles[self.repository.employee].update(
            department="Engineering",
            supported_departments=["Engineering"],
            referral_categories=["full_time"],
            preferred_candidate_levels=["student", "fresher"],
        )
        payload = ReferralCompatibilityRequest(
            employeeId=self.repository.employee,
            trustCardId=self.repository.card_id,
            targetRole="Software Engineer",
            targetCompany="Acme",
            jobDescription="Software engineer building reliable backend services.",
            studentMessage="Please review my project evidence for this role.",
        )
        preview = self.service.compatibility(self.repository.student, payload)
        created = self.service.create(self.repository.student, CreateReferralRequest(**payload.model_dump()))
        stored = self.repository.requests[str(created["id"])]
        self.assertEqual(stored["compatibility_score"], preview["score"])
        self.assertEqual(stored["compatibility_payload"]["scoreVersion"], "referral-compatibility-v1")
        self.assertNotIn("job_id", stored)
        self.assertNotIn("referral_category", stored)

    def test_compatibility_rejects_unowned_trust_card(self):
        payload = ReferralCompatibilityRequest(
            employeeId=self.repository.employee,
            trustCardId=self.repository.card_id,
            targetRole="Engineer",
            targetCompany="Acme",
            studentMessage="Please review this request.",
        )
        with self.assertRaises(ReferralForbidden):
            self.service.compatibility(self.repository.other_student, payload)
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
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.student, str(request["id"]), EmployeeDecisionUpdate(status="approved", reason="suitable_profile"))
    def test_employee_cannot_update_unrelated_request(self):
        request = self.create()
        with self.assertRaises(ReferralForbidden): self.service.update_status(self.repository.other_employee, str(request["id"]), EmployeeDecisionUpdate(status="approved", reason="suitable_profile"))
    def test_invalid_transition_rejected(self):
        request = self.create(); self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="approved", reason="suitable_profile"))
        with self.assertRaises(InvalidReferralTransition): self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="declined", reason="role_mismatch"))
    def test_status_change_appends_history(self):
        request = self.create(); self.service.update_status(self.repository.employee, str(request["id"]), EmployeeDecisionUpdate(status="more_info_requested", reason="clarification_required", question="Please share testing evidence.", note="Review started"))
        history = self.service.history(self.repository.employee, str(request["id"]))
        self.assertEqual([(item["previousStatus"], item["newStatus"]) for item in history], [(None, "submitted"), ("submitted", "more_info_requested")])

    def test_request_history_is_empty_when_no_events_exist(self):
        request = self.create()
        self.repository.history_rows.clear()
        self.assertEqual(self.service.history(self.repository.student, str(request["id"])), [])

    def test_employee_profile_directory_falls_back_only_for_missing_optional_columns(self):
        calls = []

        def primary():
            calls.append("primary")
            raise RuntimeError("Could not find the 'ai_apply_opt_in' column of 'employee_profiles' in the schema cache")

        def fallback():
            calls.append("fallback")
            return type("Response", (), {"data": [{"profile_id": self.repository.employee, "company": "Acme"}]})()

        rows = SupabaseReferralRepository._employee_profile_select(primary, fallback)
        self.assertEqual(calls, ["primary", "fallback"])
        self.assertEqual(rows[0]["company"], "Acme")
    def test_completed_decision_is_retrievable_after_service_refresh(self):
        request = self.create()
        request_id = str(request["id"])
        self.service.update_status(
            self.repository.employee,
            request_id,
            EmployeeDecisionUpdate(status="approved", reason="strong_evidence", note="Evidence verified"),
        )
        refreshed = ReferralRequestService(self.repository).employee_request_detail(self.repository.employee, request_id)
        self.assertEqual(refreshed["status"], "approved")
        self.assertEqual(refreshed["employeeNote"], "Evidence verified")
        self.assertEqual(refreshed["decisionReason"], "strong_evidence")
        with self.assertRaises(ReferralForbidden):
            ReferralRequestService(self.repository).employee_request_detail(self.repository.other_employee, request_id)
    def test_employee_viewed_is_persisted_once_on_repeated_open(self):
        request_id = str(self.create()["id"])
        self.service.employee_request_detail(self.repository.employee, request_id)
        self.service.employee_request_detail(self.repository.employee, request_id)
        viewed = [event for event in self.service.history(self.repository.student, request_id) if event.get("eventType") == "employee_viewed"]
        self.assertEqual(len(viewed), 1)
        self.assertEqual(viewed[0]["changedBy"], self.repository.employee)

    def test_employee_viewed_rejects_unassigned_employee(self):
        request_id = str(self.create()["id"])
        with self.assertRaises(ReferralForbidden):
            self.service.employee_request_detail(self.repository.other_employee, request_id)
        self.assertFalse(any(event.get("event_type") == "employee_viewed" for event in self.repository.history_rows))

    def test_approved_referral_can_be_marked_submitted_and_survives_refresh(self):
        request = self.create(); request_id = str(request["id"])
        self.service.update_status(self.repository.employee, request_id, EmployeeDecisionUpdate(status="approved", reason="suitable_profile"))
        submitted = self.service.mark_referral_submitted(self.repository.employee, request_id, ReferralSubmissionUpdate(
            referralDate=date.today(), confirmationNumber="REF-123", noteToStudent="The referral was submitted. Watch your email for next steps.",
        ))
        self.assertEqual(submitted["status"], "referred")
        self.assertEqual(submitted["referralConfirmationNumber"], "REF-123")
        refreshed = ReferralRequestService(self.repository).employee_request_detail(self.repository.employee, request_id)
        self.assertEqual(refreshed["status"], "referred")
        self.assertEqual(refreshed["referralNoteToStudent"], "The referral was submitted. Watch your email for next steps.")
        self.assertEqual([event["newStatus"] for event in self.service.history(self.repository.employee, request_id)][-1], "referred")
    def test_referral_submission_rejects_unassigned_employee_and_duplicate_transition(self):
        request = self.create(); request_id = str(request["id"])
        self.service.update_status(self.repository.employee, request_id, EmployeeDecisionUpdate(status="approved", reason="strong_evidence"))
        with self.assertRaises(ReferralForbidden):
            self.service.mark_referral_submitted(self.repository.other_employee, request_id, ReferralSubmissionUpdate())
        self.service.mark_referral_submitted(self.repository.employee, request_id, ReferralSubmissionUpdate())
        with self.assertRaises(InvalidReferralTransition):
            self.service.mark_referral_submitted(self.repository.employee, request_id, ReferralSubmissionUpdate())
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
        self.assertTrue(directory[0]["acceptingRequests"])
        self.assertEqual(directory[0]["supportedRoles"], ["Software Engineer"])
        self.assertEqual(directory[0]["reliabilityBadge"]["badgeType"], "new_referrer")
        self.assertEqual(directory[0]["reliabilityBadge"]["relevantCounts"]["meaningfulResponses"], 0)
        self.assertNotIn("metrics", directory[0]["reliabilityBadge"])
    def test_canonical_company_wins_over_conflicting_auth_metadata(self):
        self.repository.employee_profiles[self.repository.employee]["company"] = "  Canonical   Company  "
        self.repository.auth_metadata[self.repository.employee] = {"company_name": "Stale Metadata Company"}
        directory = self.service.employee_directory(self.repository.student)
        profile = self.service.employee_profile(self.repository.employee)
        self.assertEqual(directory[0]["company"], "Canonical Company")
        self.assertEqual(profile["company"], "Canonical Company")
    def test_employee_directory_supports_legacy_company_metadata(self):
        self.repository.list_employees = lambda: [{"id": self.repository.employee, "full_name": "Employee One"}]
        self.repository.employee_profiles.clear()
        self.repository.auth_metadata[self.repository.employee] = {"company_name": "  Legacy   Co  ", "headline": "Senior Engineer"}
        directory = self.service.employee_directory(self.repository.student)
        self.assertEqual(directory[0]["company"], "Legacy Co")
        self.assertEqual(directory[0]["designation"], "Senior Engineer")
        self.assertEqual(self.service.employee_profile(self.repository.employee)["company"], "Legacy Co")
    def test_student_preferred_company_is_not_used_as_employee_employer(self):
        self.repository.employee_profiles.clear()
        self.repository.auth_metadata[self.repository.employee] = {"preferred_company": "Not An Employer"}
        self.assertIsNone(self.service.employee_directory(self.repository.student)[0]["company"])
        self.assertIsNone(self.service.employee_profile(self.repository.employee)["company"])
    def test_employee_can_upsert_professional_profile_and_directory_uses_it(self):
        saved = self.service.save_employee_profile(self.repository.employee, EmployeeProfessionalProfileUpdate(company="  RefAI   Labs  ", designation="  Staff Engineer  "))
        self.assertEqual((saved["company"], saved["designation"]), ("RefAI Labs", "Staff Engineer"))
        loaded = self.service.employee_profile(self.repository.employee)
        self.assertEqual((loaded["company"], loaded["designation"]), (saved["company"], saved["designation"]))
        self.assertEqual(loaded["reliabilityBadge"]["badgeType"], "new_referrer")
        directory = self.service.employee_directory(self.repository.student)
        self.assertEqual((directory[0]["company"], directory[0]["designation"]), ("RefAI Labs", "Staff Engineer"))
        self.assertEqual(len(self.repository.employee_profiles), 1)
    def test_employee_company_rejects_whitespace_only_input(self):
        with self.assertRaises(ValidationError):
            EmployeeProfessionalProfileUpdate(company="   \t  ")
    def test_referral_company_snapshot_does_not_change_after_profile_update(self):
        created = self.create()
        self.service.save_employee_profile(
            self.repository.employee,
            EmployeeProfessionalProfileUpdate(company="New Employer"),
        )
        refreshed = self.service.get(self.repository.student, str(created["id"]))
        self.assertEqual(refreshed["employeeCompanySnapshot"], "Acme")
    def test_employee_preferences_are_structured_and_persisted(self):
        saved = self.service.save_employee_profile(self.repository.employee, EmployeeProfessionalProfileUpdate(
            company="Acme",
            supportedCompanies=["Acme"],
            supportedRoles=["Backend Engineer"],
            supportedDepartments=["Engineering"],
            minimumEvidenceExpectations=["resume", "project_evidence"],
            preferredCandidateLevels=["student", "fresher"],
            referralCategories=["internship", "full_time"],
            declineReasonCodes=["insufficient_evidence", "role_mismatch"],
            availabilityStatus="paused",
            maxActiveRequests=3,
            referralGuidelines="Share a concise project summary.",
        ))
        self.assertEqual(saved["supportedRoles"], ["Backend Engineer"])
        self.assertEqual(saved["availabilityStatus"], "paused")
        directory = self.service.employee_directory(self.repository.student)[0]
        self.assertFalse(directory["acceptingRequests"])
        self.assertNotIn("declineReasonCodes", directory)

    def test_unavailable_or_at_capacity_employee_cannot_receive_request(self):
        self.repository.employee_profiles[self.repository.employee]["availability_status"] = "unavailable"
        with self.assertRaises(Exception) as unavailable:
            self.create()
        self.assertEqual(unavailable.exception.__class__.__name__, "ReferralUnavailable")
        self.repository.employee_profiles[self.repository.employee].update(availability_status="accepting", max_active_requests=1)
        self.create()
        with self.assertRaises(Exception) as capacity:
            self.create()
        self.assertEqual(capacity.exception.__class__.__name__, "ReferralUnavailable")
    def test_student_cannot_edit_employee_professional_profile(self):
        with self.assertRaises(ReferralForbidden):
            self.service.save_employee_profile(self.repository.student, EmployeeProfessionalProfileUpdate(company="Wrong Company"))
    def test_employee_directory_returns_no_company_only_when_none_is_saved(self):
        self.repository.employee_profiles.clear()
        self.repository.auth_metadata[self.repository.employee] = {}
        self.assertIsNone(self.service.employee_directory(self.repository.student)[0]["company"])
    def test_employee_queue_excludes_detail_payloads(self):
        self.create()
        item = self.service.employee_queue(self.repository.employee)[0]
        self.assertNotIn("payload", item)
        self.assertNotIn("resumeText", item)
        self.assertNotIn("trustCard", item)
    def test_assigned_employee_can_retrieve_detail_resume_and_trust_card(self):
        request = self.create(); request_id = str(request["id"])
        self.repository.student_education[self.repository.student]["graduation_year"] = 2026
        detail = self.service.employee_request_detail(self.repository.employee, request_id)
        resume = self.service.employee_resume(self.repository.employee, request_id)
        card = self.service.employee_trust_card(self.repository.employee, request_id)
        self.assertEqual(detail["candidate"]["studentName"], "Student One")
        self.assertEqual(detail["analysis"]["trustScore"], 82)
        self.assertEqual(detail["candidate"]["college"], "RefAI College")
        self.assertEqual(detail["candidate"]["degree"], "B.Tech")
        self.assertEqual(detail["candidate"]["graduationYear"], "2026")
        EmployeeReferralRequestView.model_validate(detail)
        self.assertTrue(detail["analysisExists"])
        self.assertEqual(resume["requestId"], request["id"])
        self.assertEqual(resume["expiresIn"], 600)
        self.assertTrue(resume["signedUrl"].startswith("https://storage.test/signed/"))
        self.assertEqual(card["trustCardId"], self.repository.card_id)
        self.assertEqual(card["education"]["branch"], "Computer Science")
        EmployeeReferralRequestView.model_validate(detail)
        EmployeeResumeAccess.model_validate(resume)
        EmployeeTrustCardView.model_validate(card)
    def test_legacy_employee_review_without_trust_score_remains_valid(self):
        request = self.create(); request_id = str(request["id"])
        self.repository.cards[self.repository.card_id]["payload"].pop("trustScore", None)
        detail = self.service.employee_request_detail(self.repository.employee, request_id)
        self.assertIsNone(detail["analysis"]["trustScore"])
        EmployeeReferralRequestView.model_validate(detail)
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
