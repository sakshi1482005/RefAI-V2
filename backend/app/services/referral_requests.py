from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from app.db.supabase_client import supabase
from app.models.schemas import CreateReferralRequest, EmployeeDecisionUpdate, EmployeeProfessionalProfileUpdate
from app.services.resume_storage import SIGNED_RESUME_TTL_SECONDS, create_resume_signed_url, find_latest_student_resume


class ReferralError(Exception): pass
class ReferralForbidden(ReferralError): pass
class ReferralNotFound(ReferralError): pass
class ReferralUnavailable(ReferralError): pass
class InvalidReferralTransition(ReferralError): pass


def _camel(row: dict[str, Any]) -> dict[str, Any]:
    mapping = {
        "student_id": "studentId", "employee_id": "employeeId", "trust_card_id": "trustCardId",
        "target_role": "targetRole", "target_company": "targetCompany", "job_description": "jobDescription",
        "student_message": "studentMessage", "employee_note": "employeeNote", "created_at": "createdAt",
        "updated_at": "updatedAt", "referral_request_id": "referralRequestId", "previous_status": "previousStatus",
        "new_status": "newStatus", "changed_by": "changedBy",
    }
    return {mapping.get(key, key): value for key, value in row.items()}


class ReferralRepository(Protocol):
    def get_role(self, user_id: str) -> str | None: ...
    def get_trust_card(self, trust_card_id: str) -> dict[str, Any] | None: ...
    def get_profile(self, student_id: str) -> dict[str, Any] | None: ...
    def get_auth_metadata(self, student_id: str) -> dict[str, Any]: ...
    def get_student_education(self, student_id: str) -> dict[str, Any] | None: ...
    def find_resume(self, student_id: str) -> dict[str, Any] | None: ...
    def sign_resume(self, path: str, expires_in: int) -> str: ...
    def create_request(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def get_request(self, request_id: str) -> dict[str, Any] | None: ...
    def list_requests(self, field: str, user_id: str) -> list[dict[str, Any]]: ...
    def list_employee_queue(self, employee_id: str) -> list[dict[str, Any]]: ...
    def transition(self, actor_id: str, request_id: str, status: str, note: str | None) -> dict[str, Any]: ...
    def list_history(self, request_id: str) -> list[dict[str, Any]]: ...
    def persist_trust_card(self, student_id: str, payload: dict[str, Any], analysis_id: str | None = None) -> dict[str, Any]: ...
    def list_employees(self) -> list[dict[str, Any]]: ...
    def get_employee_profile(self, profile_id: str) -> dict[str, Any] | None: ...
    def upsert_employee_profile(self, profile_id: str, company: str, designation: str | None) -> dict[str, Any]: ...


class SupabaseReferralRepository:
    def get_role(self, user_id: str) -> str | None:
        rows = supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute().data or []
        return rows[0]["role"] if rows else None

    def get_trust_card(self, trust_card_id: str) -> dict[str, Any] | None:
        rows = supabase.table("trust_cards").select("*").eq("id", trust_card_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def get_profile(self, student_id: str) -> dict[str, Any] | None:
        rows = supabase.table("profiles").select("*").eq("id", student_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def get_auth_metadata(self, student_id: str) -> dict[str, Any]:
        try:
            response = supabase.auth.admin.get_user_by_id(student_id)
            user = response.user
            return (user.user_metadata or {}) if user else {}
        except Exception:
            return {}

    def get_student_education(self, student_id: str) -> dict[str, Any] | None:
        try:
            rows = supabase.table("student_profiles").select("profile_id,college,degree,branch,graduation_year").eq("profile_id", student_id).limit(1).execute().data or []
        except Exception as exc:
            if "student_profiles.branch" not in str(exc) or "does not exist" not in str(exc): raise
            rows = supabase.table("student_profiles").select("profile_id,college,degree,graduation_year").eq("profile_id", student_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def find_resume(self, student_id: str) -> dict[str, Any] | None:
        return find_latest_student_resume(student_id)

    def sign_resume(self, path: str, expires_in: int) -> str:
        return create_resume_signed_url(path, expires_in)

    def create_request(self, values: dict[str, Any]) -> dict[str, Any]:
        rows = supabase.table("referral_requests").insert(values).execute().data or []
        if not rows: raise ReferralError("Referral request was not persisted")
        return rows[0]

    def get_request(self, request_id: str) -> dict[str, Any] | None:
        rows = supabase.table("referral_requests").select("*").eq("id", request_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def list_requests(self, field: str, user_id: str) -> list[dict[str, Any]]:
        return supabase.table("referral_requests").select("*").eq(field, user_id).order("created_at", desc=True).execute().data or []

    def list_employee_queue(self, employee_id: str) -> list[dict[str, Any]]:
        # Select only the two score keys needed by the queue. The complete Trust Card
        # payload (and any resume-derived evidence it contains) stays out of this query.
        query = "id,student_id,employee_id,trust_card_id,target_role,target_company,status,created_at,updated_at,student:profiles!referral_requests_student_id_fkey(full_name,college),trust_card:trust_cards!referral_requests_trust_card_id_fkey(id,trust_score:payload->trustScore,overall_match:payload->overallMatch)"
        return supabase.table("referral_requests").select(query).eq("employee_id", employee_id).order("created_at", desc=True).execute().data or []

    def transition(self, actor_id: str, request_id: str, status: str, note: str | None) -> dict[str, Any]:
        try:
            rows = supabase.rpc("transition_referral_request_as", {"p_actor_id": actor_id, "p_request_id": request_id, "p_new_status": status, "p_note": note}).execute().data
        except Exception as exc:
            if "invalid referral status transition" in str(exc): raise InvalidReferralTransition(str(exc)) from exc
            raise
        if isinstance(rows, list): rows = rows[0] if rows else None
        if not rows: raise ReferralNotFound("Referral request not found")
        return rows

    def list_history(self, request_id: str) -> list[dict[str, Any]]:
        return supabase.table("referral_status_history").select("*").eq("referral_request_id", request_id).order("created_at").execute().data or []

    def persist_trust_card(self, student_id: str, payload: dict[str, Any], analysis_id: str | None = None) -> dict[str, Any]:
        values = {"student_id": student_id, "payload": payload, "analysis_id": analysis_id}
        query = supabase.table("trust_cards")
        try:
            rows = (query.upsert(values, on_conflict="analysis_id").execute().data if analysis_id else query.insert(values).execute().data) or []
        except Exception as exc:
            raise ReferralError("Trust Card database write failed") from exc
        if not rows: raise ReferralError("Trust Card was not persisted")
        return rows[0]

    def list_employees(self) -> list[dict[str, Any]]:
        profiles = supabase.table("profiles").select("id,full_name").eq("role", "employee").order("full_name").execute().data or []
        if not profiles:
            return []
        profile_ids = [str(profile["id"]) for profile in profiles]
        employee_profiles = supabase.table("employee_profiles").select("profile_id,company,designation").in_("profile_id", profile_ids).execute().data or []
        details_by_profile = {str(details["profile_id"]): details for details in employee_profiles}
        return [{**profile, **details_by_profile.get(str(profile["id"]), {})} for profile in profiles]

    def get_employee_profile(self, profile_id: str) -> dict[str, Any] | None:
        rows = supabase.table("employee_profiles").select("profile_id,company,designation").eq("profile_id", profile_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def upsert_employee_profile(self, profile_id: str, company: str, designation: str | None) -> dict[str, Any]:
        rows = supabase.table("employee_profiles").upsert(
            {"profile_id": profile_id, "company": company, "designation": designation},
            on_conflict="profile_id",
        ).execute().data or []
        if not rows: raise ReferralError("Professional profile was not saved")
        return rows[0]


class ReferralRequestService:
    def __init__(self, repository: ReferralRepository | None = None): self.repository = repository or SupabaseReferralRepository()

    def _role(self, user_id: str) -> str:
        role = self.repository.get_role(user_id)
        if role not in {"student", "employee"}: raise ReferralForbidden("A protected profile role is required")
        return role

    def _student_education(self, student_id: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        education = self.repository.get_student_education(student_id) or {}
        metadata = metadata if metadata is not None else self.repository.get_auth_metadata(student_id)
        return {
            "college": education.get("college") or metadata.get("college") or None,
            "degree": education.get("degree") or metadata.get("degree") or None,
            "branch": education.get("branch") or metadata.get("branch") or None,
            "graduationYear": education.get("graduation_year") or metadata.get("graduation_year") or None,
        }

    def create(self, actor_id: str, payload: CreateReferralRequest) -> dict[str, Any]:
        if self._role(actor_id) != "student": raise ReferralForbidden("Student access is required")
        if payload.studentId and str(payload.studentId) != actor_id: raise ReferralForbidden("Students may only create their own requests")
        if self.repository.get_role(str(payload.employeeId)) != "employee": raise ReferralError("The selected recipient is not an employee")
        card = self.repository.get_trust_card(str(payload.trustCardId))
        if not card or str(card.get("student_id")) != actor_id: raise ReferralForbidden("The Trust Card does not belong to this student")
        row = self.repository.create_request({
            "student_id": actor_id, "employee_id": str(payload.employeeId), "trust_card_id": str(payload.trustCardId),
            "target_role": payload.targetRole.strip(), "target_company": payload.targetCompany.strip(),
            "job_description": payload.jobDescription.strip(), "student_message": payload.studentMessage.strip(), "status": "pending",
        })
        return _camel(row)

    def get(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        role = self._role(actor_id)
        owner_field = "student_id" if role == "student" else "employee_id"
        if str(row[owner_field]) != actor_id: raise ReferralForbidden("Referral request access denied")
        return _camel(row)

    def list(self, actor_id: str) -> list[dict[str, Any]]:
        role = self._role(actor_id)
        field = "student_id" if role == "student" else "employee_id"
        return [_camel(row) for row in self.repository.list_requests(field, actor_id)]

    def employee_queue(self, actor_id: str) -> list[dict[str, Any]]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        items = []
        for row in self.repository.list_employee_queue(actor_id):
            student = row.pop("student", None) or {}
            card = row.pop("trust_card", None) or {}
            items.append({
                **_camel(row), "candidateId": row["student_id"], "studentName": student.get("full_name"),
                "college": student.get("college"), "trustScore": card.get("trust_score"),
                "overallMatch": card.get("overall_match"), "resumeExists": bool(card), "trustCardExists": bool(card),
            })
        return items

    def _assigned_employee_request(self, actor_id: str, request_id: str) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        if str(row.get("employee_id")) != actor_id: raise ReferralForbidden("Referral request access denied")
        return row

    @staticmethod
    def _analysis_from_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
        analysis_keys = ("overallMatch", "roleFit", "proofScore", "gapScore", "confidence")
        if not any(payload.get(key) is not None for key in analysis_keys): return None
        return {
            "overallMatch": payload.get("overallMatch"), "roleFit": payload.get("roleFit"),
            "proofScore": payload.get("proofScore"), "gapScore": payload.get("gapScore"),
            "confidence": payload.get("confidence"), "matchedSkills": payload.get("matchedSkills"),
            "missingRequirements": payload.get("missingRequirements"), "strengths": payload.get("strengths"),
            "evidence": payload.get("evidence"),
            "readinessSummary": payload.get("readinessSummary") or payload.get("referralReadiness"),
        }

    def employee_request_detail(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        profile = self.repository.get_profile(str(row["student_id"])) or {}
        metadata = self.repository.get_auth_metadata(str(row["student_id"]))
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        payload = (card or {}).get("payload") or {}
        analysis = self._analysis_from_payload(payload)
        resume = self.repository.find_resume(str(row["student_id"]))
        return {
            "id": row["id"], "status": row["status"], "targetRole": row["target_role"],
            "targetCompany": row["target_company"], "studentMessage": row.get("student_message") or "",
            "createdAt": row["created_at"], "updatedAt": row["updated_at"],
            "candidate": {
                "studentId": row["student_id"],
                "studentName": profile.get("full_name") or metadata.get("full_name") or metadata.get("name"),
                "college": profile.get("college") or metadata.get("college"),
                "degree": profile.get("degree") or metadata.get("degree"),
                "graduationYear": profile.get("graduation_year") or metadata.get("graduation_year"),
                "profilePhotoUrl": profile.get("profile_photo_url") or profile.get("avatar_url") or metadata.get("avatar_url"),
            },
            "analysis": analysis, "resumeExists": bool(resume), "trustCardExists": bool(card),
            "analysisExists": analysis is not None,
        }

    def employee_resume(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        resume = self.repository.find_resume(str(row["student_id"]))
        if not resume: raise ReferralUnavailable("No stored resume is available for this referral request")
        try: signed_url = self.repository.sign_resume(resume["path"], SIGNED_RESUME_TTL_SECONDS)
        except Exception as exc: raise ReferralUnavailable("The private resume could not be opened") from exc
        return {"requestId": row["id"], "fileName": resume["file_name"], "signedUrl": signed_url, "expiresIn": SIGNED_RESUME_TTL_SECONDS}

    def employee_trust_card(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        if not card: raise ReferralUnavailable("No persisted Trust Card is available for this referral request")
        profile = self.repository.get_profile(str(row["student_id"])) or {}
        metadata = self.repository.get_auth_metadata(str(row["student_id"]))
        payload = card.get("payload") or {}
        return {
            "requestId": row["id"], "trustCardId": card["id"],
            "studentName": profile.get("full_name") or metadata.get("full_name") or metadata.get("name"),
            "targetRole": row["target_role"], "targetCompany": row["target_company"],
            "trustScore": payload.get("trustScore"), "overallMatch": payload.get("overallMatch"),
            "roleFit": payload.get("roleFit"), "proofScore": payload.get("proofScore"),
            "gapScore": payload.get("gapScore"), "confidence": payload.get("confidence"),
            "matchedSkills": payload.get("matchedSkills"), "missingRequirements": payload.get("missingRequirements"),
            "strengths": payload.get("strengths"), "evidence": payload.get("evidence"),
            "readiness": payload.get("referralReadiness"), "recommendation": payload.get("recommendation"),
            "summary": payload.get("aiSummary"), "riskSignals": payload.get("riskSignals"),
            "scoreFormula": payload.get("scoreFormula"), "scoreBreakdown": payload.get("scoreBreakdown"),
            "generatedAt": card.get("created_at"),
            "education": self._student_education(str(row["student_id"]), metadata),
        }

    def update_status(self, actor_id: str, request_id: str, update: EmployeeDecisionUpdate) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        if str(row["employee_id"]) != actor_id: raise ReferralForbidden("This request is assigned to another employee")
        if update.status == "pending": raise InvalidReferralTransition("A decision cannot return to pending")
        return _camel(self.repository.transition(actor_id, request_id, update.status, update.note))

    def history(self, actor_id: str, request_id: str) -> list[dict[str, Any]]:
        self.get(actor_id, request_id)
        return [_camel(row) for row in self.repository.list_history(request_id)]

    def trust_card_for_request(self, actor_id: str, request_id: str) -> dict[str, Any]:
        request = self.repository.get_request(request_id)
        if not request: raise ReferralNotFound("Referral request not found")
        role = self._role(actor_id)
        field = "student_id" if role == "student" else "employee_id"
        if str(request[field]) != actor_id: raise ReferralForbidden("Trust Card access denied")
        card = self.repository.get_trust_card(str(request["trust_card_id"]))
        if not card: raise ReferralNotFound("Trust Card not found")
        return {"id": card["id"], **card["payload"], "education": self._student_education(str(request["student_id"]))}

    def persist_trust_card(self, student_id: str, payload: dict[str, Any], analysis_id: str | None = None) -> dict[str, Any]:
        if self._role(student_id) != "student": raise ReferralForbidden("Student access is required")
        return self.repository.persist_trust_card(student_id, payload, analysis_id)

    def employee_directory(self, actor_id: str) -> list[dict[str, Any]]:
        if self._role(actor_id) != "student": raise ReferralForbidden("Student access is required")
        employees = []
        for row in self.repository.list_employees():
            metadata = self.repository.get_auth_metadata(str(row["id"])) if not row.get("company") or not row.get("designation") else {}
            employees.append({
                "id": row["id"],
                "name": row.get("full_name") or "Employee",
                "company": row.get("company") or metadata.get("company") or metadata.get("company_name") or metadata.get("preferred_company"),
                "designation": row.get("designation") or metadata.get("designation") or metadata.get("job_title") or metadata.get("headline"),
            })
        return employees

    def employee_profile(self, actor_id: str) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_employee_profile(actor_id) or {}
        return {
            "profileId": actor_id,
            "company": row.get("company"),
            "designation": row.get("designation"),
        }

    def save_employee_profile(self, actor_id: str, update: EmployeeProfessionalProfileUpdate) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        company = update.company.strip()
        if not company: raise ReferralError("Company name is required")
        designation = update.designation.strip() if update.designation and update.designation.strip() else None
        row = self.repository.upsert_employee_profile(actor_id, company, designation)
        return {
            "profileId": actor_id,
            "company": row.get("company"),
            "designation": row.get("designation"),
        }
