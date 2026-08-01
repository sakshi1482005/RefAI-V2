from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from app.db.supabase_client import supabase
from app.models.schemas import CreateReferralRequest, EmployeeDecisionUpdate, EmployeeProfessionalProfileUpdate, ProofEntryInput, ReferralCompatibilityRequest, ReferralMessageRequest, ReferralQualityRequest, ReferralSubmissionUpdate
from app.services.employee_reliability import calculate_employee_reliability
from app.services.employee_review_copilot import build_employee_review_copilot
from app.services.groq_client import AIServiceUnavailable, generate_clarification_question, generate_employee_review_summary, generate_referral_message
from app.services.referral_compatibility import calculate_referral_compatibility
from app.services.referral_quality import calculate_referral_message_quality
from app.services.resume_storage import SIGNED_RESUME_TTL_SECONDS, create_resume_signed_url, find_latest_student_resume
from app.services.claim_verification import build_claim_verifications
from app.services.notifications import create_notification
from app.services.employee_response_time import calculate_average_response_time

EMPLOYEE_PROFILE_COLUMNS = (
    "profile_id,company,designation,supported_companies,supported_roles,"
    "supported_departments,accepts_freshers,minimum_evidence_expectations,"
    "max_active_requests,availability_status,preferred_candidate_levels,"
    "preferred_message_length,referral_guidelines,decline_reason_codes,"
    "referral_categories,department,years_experience,verified_employee,"
    "linkedin_url,company_profile_url,portfolio_url,updated_at"
)
ACTIVE_REFERRAL_STATUSES = ["submitted", "pending", "under_review", "more_info_requested"]


class ReferralError(Exception): pass
class ReferralForbidden(ReferralError): pass
class ReferralNotFound(ReferralError): pass
class ReferralUnavailable(ReferralError): pass
class ReferralQualityBlocked(ReferralError):
    def __init__(self, quality: dict[str, Any]):
        super().__init__("Blocking factual-integrity errors must be resolved before submission")
        self.quality = quality
class InvalidReferralTransition(ReferralError): pass


def _camel(row: dict[str, Any]) -> dict[str, Any]:
    mapping = {
        "student_id": "studentId", "employee_id": "employeeId", "trust_card_id": "trustCardId",
        "target_role": "targetRole", "target_company": "targetCompany", "job_description": "jobDescription",
        "student_message": "studentMessage", "employee_note": "employeeNote", "created_at": "createdAt",
        "updated_at": "updatedAt", "referral_request_id": "referralRequestId", "previous_status": "previousStatus",
        "new_status": "newStatus", "changed_by": "changedBy",
        "compatibility_score": "compatibilityScore", "compatibility_label": "compatibilityLabel",
        "compatibility_version": "compatibilityVersion", "compatibility_payload": "compatibility",
        "owner_id": "ownerId", "proof_type": "proofType", "url_or_reference": "urlOrReference",
        "related_project": "relatedProject", "related_skill_claim": "relatedSkillClaim",
        "decision_reason": "decisionReason", "decision_message": "decisionMessage", "decision_at": "decisionAt",
        "referral_date": "referralDate", "referral_confirmation_number": "referralConfirmationNumber",
        "referral_note_to_student": "referralNoteToStudent", "referral_submitted_at": "referralSubmittedAt",
        "referral_submitted_by": "referralSubmittedBy", "event_type": "eventType",
    }
    return {mapping.get(key, key): value for key, value in row.items()}


class ReferralRepository(Protocol):
    def get_role(self, user_id: str) -> str | None: ...
    def get_trust_card(self, trust_card_id: str) -> dict[str, Any] | None: ...
    def get_profile(self, student_id: str) -> dict[str, Any] | None: ...
    def get_auth_metadata(self, student_id: str) -> dict[str, Any]: ...
    def get_student_education(self, student_id: str) -> dict[str, Any] | None: ...
    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...
    def get_verified_shared_connection(self, student_id: str, employee_id: str) -> dict[str, Any] | None: ...
    def find_resume(self, student_id: str) -> dict[str, Any] | None: ...
    def sign_resume(self, path: str, expires_in: int) -> str: ...
    def create_request(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def get_request(self, request_id: str) -> dict[str, Any] | None: ...
    def list_requests(self, field: str, user_id: str) -> list[dict[str, Any]]: ...
    def list_employee_queue(self, employee_id: str) -> list[dict[str, Any]]: ...
    def transition(self, actor_id: str, request_id: str, status: str, reason: str, decision_message: str, private_note: str | None) -> dict[str, Any]: ...
    def mark_referral_submitted(self, actor_id: str, request_id: str, values: dict[str, Any]) -> dict[str, Any]: ...
    def get_private_decision_note(self, request_id: str, employee_id: str) -> str | None: ...
    def list_history(self, request_id: str) -> list[dict[str, Any]]: ...
    def record_employee_viewed(self, actor_id: str, request_id: str) -> bool: ...
    def employee_response_time_data(self, employee_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]: ...
    def persist_trust_card(self, student_id: str, payload: dict[str, Any], analysis_id: str | None = None) -> dict[str, Any]: ...
    def list_employees(self) -> list[dict[str, Any]]: ...
    def get_employee_profile(self, profile_id: str) -> dict[str, Any] | None: ...
    def upsert_employee_profile(self, profile_id: str, values: dict[str, Any]) -> dict[str, Any]: ...
    def active_request_counts(self, employee_ids: list[str]) -> dict[str, int]: ...
    def referral_activity(self, employee_ids: list[str]) -> dict[str, dict[str, list[dict[str, Any]]]]: ...
    def create_proof(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def get_proof(self, proof_id: str) -> dict[str, Any] | None: ...
    def list_proofs(self, trust_card_id: str) -> list[dict[str, Any]]: ...
    def update_proof(self, proof_id: str, values: dict[str, Any]) -> dict[str, Any]: ...
    def delete_proof(self, proof_id: str) -> None: ...


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

    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("resume_analyses").select("id,student_id,resume_text")
            .eq("id", analysis_id).eq("student_id", student_id).limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def get_verified_shared_connection(self, student_id: str, employee_id: str) -> dict[str, Any] | None:
        # RefAI currently has no verified-connections table. Keep this explicit
        # boundary closed until a stored, independently verified source exists.
        return None

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
        query = "id,student_id,employee_id,trust_card_id,target_role,target_company,status,created_at,updated_at,student:profiles!referral_requests_student_id_fkey(full_name),trust_card:trust_cards!referral_requests_trust_card_id_fkey(id,trust_score:payload->trustScore,overall_match:payload->overallMatch)"
        return supabase.table("referral_requests").select(query).eq("employee_id", employee_id).order("created_at", desc=True).execute().data or []

    def transition(self, actor_id: str, request_id: str, status: str, reason: str, decision_message: str, private_note: str | None) -> dict[str, Any]:
        try:
            rows = supabase.rpc("transition_structured_referral_decision_as", {
                "p_actor_id": actor_id, "p_request_id": request_id, "p_new_status": status,
                "p_reason": reason, "p_decision_message": decision_message, "p_private_note": private_note,
            }).execute().data
        except Exception as exc:
            if "invalid referral status transition" in str(exc): raise InvalidReferralTransition(str(exc)) from exc
            raise
        if isinstance(rows, list): rows = rows[0] if rows else None
        if not rows: raise ReferralNotFound("Referral request not found")
        return rows

    def mark_referral_submitted(self, actor_id: str, request_id: str, values: dict[str, Any]) -> dict[str, Any]:
        try:
            rows = supabase.rpc("mark_referral_submitted_as", {
                "p_actor_id": actor_id, "p_request_id": request_id,
                "p_referral_date": values.get("referral_date"),
                "p_confirmation_number": values.get("confirmation_number"),
                "p_note_to_student": values.get("note_to_student"),
            }).execute().data
        except Exception as exc:
            if "invalid referral status transition" in str(exc): raise InvalidReferralTransition(str(exc)) from exc
            raise
        if isinstance(rows, list): rows = rows[0] if rows else None
        if not rows: raise ReferralNotFound("Referral request not found")
        return rows

    def get_private_decision_note(self, request_id: str, employee_id: str) -> str | None:
        rows = (
            supabase.table("referral_decision_private_notes").select("note")
            .eq("referral_request_id", request_id).eq("employee_id", employee_id)
            .order("created_at", desc=True).limit(1).execute().data or []
        )
        return rows[0]["note"] if rows else None

    def list_history(self, request_id: str) -> list[dict[str, Any]]:
        return supabase.table("referral_status_history").select("*").eq("referral_request_id", request_id).order("created_at").execute().data or []

    def record_employee_viewed(self, actor_id: str, request_id: str) -> bool:
        result = supabase.rpc("record_referral_employee_viewed_as", {"p_actor_id": actor_id, "p_request_id": request_id}).execute().data
        return bool(result)

    def employee_response_time_data(self, employee_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        requests = supabase.table("referral_requests").select("id,created_at").eq("employee_id", employee_id).execute().data or []
        if not requests: return [], []
        request_ids = [str(item["id"]) for item in requests]
        history = supabase.table("referral_status_history").select("referral_request_id,new_status,created_at,event_type").in_("referral_request_id", request_ids).execute().data or []
        return requests, history

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
        employee_profiles = supabase.table("employee_profiles").select(EMPLOYEE_PROFILE_COLUMNS).in_("profile_id", profile_ids).execute().data or []
        details_by_profile = {str(details["profile_id"]): details for details in employee_profiles}
        return [{**profile, **details_by_profile.get(str(profile["id"]), {})} for profile in profiles]

    def get_employee_profile(self, profile_id: str) -> dict[str, Any] | None:
        rows = supabase.table("employee_profiles").select(EMPLOYEE_PROFILE_COLUMNS).eq("profile_id", profile_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def upsert_employee_profile(self, profile_id: str, values: dict[str, Any]) -> dict[str, Any]:
        rows = supabase.table("employee_profiles").upsert(
            {"profile_id": profile_id, **values},
            on_conflict="profile_id",
        ).execute().data or []
        if not rows: raise ReferralError("Professional profile was not saved")
        return rows[0]

    def active_request_counts(self, employee_ids: list[str]) -> dict[str, int]:
        if not employee_ids:
            return {}
        rows = (
            supabase.table("referral_requests")
            .select("employee_id")
            .in_("employee_id", employee_ids)
            .in_("status", ACTIVE_REFERRAL_STATUSES)
            .execute().data or []
        )
        counts = {employee_id: 0 for employee_id in employee_ids}
        for row in rows:
            employee_id = str(row["employee_id"])
            counts[employee_id] = counts.get(employee_id, 0) + 1
        return counts

    def referral_activity(self, employee_ids: list[str]) -> dict[str, dict[str, list[dict[str, Any]]]]:
        activity = {employee_id: {"requests": [], "history": []} for employee_id in employee_ids}
        if not employee_ids:
            return activity
        requests = (
            supabase.table("referral_requests")
            .select("id,employee_id,status,employee_note,decision_reason,decision_message,created_at,updated_at")
            .in_("employee_id", employee_ids)
            .execute().data or []
        )
        request_to_employee: dict[str, str] = {}
        for row in requests:
            employee_id = str(row["employee_id"])
            activity.setdefault(employee_id, {"requests": [], "history": []})["requests"].append(row)
            request_to_employee[str(row["id"])] = employee_id
        if request_to_employee:
            history = (
                supabase.table("referral_status_history")
                .select("referral_request_id,changed_by,new_status,note,created_at")
                .in_("referral_request_id", list(request_to_employee))
                .execute().data or []
            )
            for row in history:
                employee_id = request_to_employee.get(str(row["referral_request_id"]))
                if employee_id:
                    activity[employee_id]["history"].append(row)
        return activity

    def create_proof(self, values: dict[str, Any]) -> dict[str, Any]:
        rows = supabase.table("proof_entries").insert(values).execute().data or []
        if not rows: raise ReferralError("Evidence entry was not saved")
        return rows[0]

    def get_proof(self, proof_id: str) -> dict[str, Any] | None:
        rows = supabase.table("proof_entries").select("*").eq("id", proof_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def list_proofs(self, trust_card_id: str) -> list[dict[str, Any]]:
        return supabase.table("proof_entries").select("*").eq("trust_card_id", trust_card_id).order("created_at", desc=True).execute().data or []

    def update_proof(self, proof_id: str, values: dict[str, Any]) -> dict[str, Any]:
        rows = supabase.table("proof_entries").update(values).eq("id", proof_id).execute().data or []
        if not rows: raise ReferralNotFound("Evidence entry was removed or not found")
        return rows[0]

    def delete_proof(self, proof_id: str) -> None:
        supabase.table("proof_entries").delete().eq("id", proof_id).execute()


class ReferralRequestService:
    def __init__(self, repository: ReferralRepository | None = None, notifier=None):
        self.repository = repository or SupabaseReferralRepository()
        self.notify = create_notification if repository is None else (notifier or (lambda **_: None))

    def _role(self, user_id: str) -> str:
        role = self.repository.get_role(user_id)
        if role not in {"student", "employee"}: raise ReferralForbidden("A protected profile role is required")
        return role

    @staticmethod
    def _proof_values(payload: ProofEntryInput) -> dict[str, Any]:
        return {
            "trust_card_id": str(payload.trustCardId), "proof_type": payload.proofType,
            "title": payload.title, "url_or_reference": payload.urlOrReference,
            "related_project": payload.relatedProject,
            "related_skill_claim": payload.relatedSkillClaim,
            "description": payload.description,
        }

    def _owned_trust_card(self, actor_id: str, trust_card_id: str) -> dict[str, Any]:
        if self._role(actor_id) != "student": raise ReferralForbidden("Student access is required")
        card = self.repository.get_trust_card(trust_card_id)
        if not card or str(card.get("student_id")) != actor_id:
            raise ReferralForbidden("The Trust Card does not belong to this student")
        return card

    def list_student_proofs(self, actor_id: str, trust_card_id: str) -> list[dict[str, Any]]:
        self._owned_trust_card(actor_id, trust_card_id)
        return [_camel(row) for row in self.repository.list_proofs(trust_card_id) if str(row.get("owner_id")) == actor_id]

    def create_proof(self, actor_id: str, payload: ProofEntryInput) -> dict[str, Any]:
        self._owned_trust_card(actor_id, str(payload.trustCardId))
        return _camel(self.repository.create_proof({"owner_id": actor_id, **self._proof_values(payload)}))

    def update_proof(self, actor_id: str, proof_id: str, payload: ProofEntryInput) -> dict[str, Any]:
        self._owned_trust_card(actor_id, str(payload.trustCardId))
        proof = self.repository.get_proof(proof_id)
        if not proof: raise ReferralNotFound("Evidence entry was removed or not found")
        if str(proof.get("owner_id")) != actor_id: raise ReferralForbidden("Evidence entry access denied")
        return _camel(self.repository.update_proof(proof_id, self._proof_values(payload)))

    def delete_proof(self, actor_id: str, proof_id: str) -> None:
        if self._role(actor_id) != "student": raise ReferralForbidden("Student access is required")
        proof = self.repository.get_proof(proof_id)
        if not proof: raise ReferralNotFound("Evidence entry was already removed or not found")
        if str(proof.get("owner_id")) != actor_id: raise ReferralForbidden("Evidence entry access denied")
        self.repository.delete_proof(proof_id)

    def employee_request_proofs(self, actor_id: str, request_id: str) -> list[dict[str, Any]]:
        row = self._assigned_employee_request(actor_id, request_id)
        if not row.get("trust_card_id"): return []
        return [
            _camel(proof) for proof in self.repository.list_proofs(str(row["trust_card_id"]))
            if str(proof.get("owner_id")) == str(row["student_id"])
        ]

    def _claim_verifications(self, card: dict[str, Any]) -> dict[str, Any]:
        analysis = (
            self.repository.get_analysis(str(card["student_id"]), str(card["analysis_id"]))
            if card.get("analysis_id") else None
        )
        proofs = self.repository.list_proofs(str(card["id"]))
        return build_claim_verifications(
            card.get("payload") or {}, str((analysis or {}).get("resume_text") or ""), proofs,
        )

    def student_claim_verifications(self, actor_id: str, trust_card_id: str) -> dict[str, Any]:
        card = self._owned_trust_card(actor_id, trust_card_id)
        return self._claim_verifications(card)

    def employee_claim_verifications(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        if not card: raise ReferralUnavailable("No persisted Trust Card is available for this referral request")
        return self._claim_verifications(card)

    def _student_education(self, student_id: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        education = self.repository.get_student_education(student_id)
        # Auth metadata is compatibility-only for users who have no canonical
        # student_profiles row yet. It never overrides a persisted profile.
        source = education if education is not None else (
            metadata if metadata is not None else self.repository.get_auth_metadata(student_id)
        )
        return {
            "college": source.get("college") or None,
            "degree": source.get("degree") or None,
            "branch": source.get("branch") or None,
            "graduationYear": source.get("graduation_year") or None,
        }

    def _compatibility_context(self, actor_id: str, payload: ReferralCompatibilityRequest | CreateReferralRequest) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        if self._role(actor_id) != "student": raise ReferralForbidden("Student access is required")
        employee_id = str(payload.employeeId)
        if self.repository.get_role(employee_id) != "employee": raise ReferralError("The selected recipient is not an employee")
        employee_profile = {"profile_id": employee_id, **(self.repository.get_employee_profile(employee_id) or {})}
        card = self.repository.get_trust_card(str(payload.trustCardId))
        if not card or str(card.get("student_id")) != actor_id: raise ReferralForbidden("The Trust Card does not belong to this student")
        request = {
            "target_role": payload.targetRole.strip(),
            "target_company": payload.targetCompany.strip(),
            "job_description": payload.jobDescription.strip(),
            "student_message": payload.studentMessage.strip(),
        }
        return employee_profile, card, request

    def compatibility(self, actor_id: str, payload: ReferralCompatibilityRequest) -> dict[str, Any]:
        employee_profile, card, request = self._compatibility_context(actor_id, payload)
        return calculate_referral_compatibility(employee_profile, {**(card.get("payload") or {}), "_available": True}, request)

    def quality(self, actor_id: str, payload: ReferralQualityRequest | CreateReferralRequest) -> dict[str, Any]:
        if self._role(actor_id) != "student":
            raise ReferralForbidden("Student access is required")
        employee_id = str(payload.employeeId)
        if self.repository.get_role(employee_id) != "employee":
            raise ReferralNotFound("The selected employee is not discoverable")
        employee_profile = self.repository.get_employee_profile(employee_id) or {}
        employee_public = self.repository.get_profile(employee_id) or {}
        card = self.repository.get_trust_card(str(payload.trustCardId))
        if not card or str(card.get("student_id")) != actor_id:
            raise ReferralForbidden("The Trust Card does not belong to this student")
        student = {
            **(self.repository.get_profile(actor_id) or {}),
            **(self.repository.get_student_education(actor_id) or {}),
        }
        analysis = (
            self.repository.get_analysis(actor_id, str(card["analysis_id"]))
            if card.get("analysis_id") else None
        )
        shared = self.repository.get_verified_shared_connection(actor_id, employee_id)
        return calculate_referral_message_quality(
            message=payload.studentMessage.strip(),
            target_company=payload.targetCompany.strip(),
            target_role=payload.targetRole.strip(),
            employee={
                "name": employee_public.get("full_name"),
                "profile": employee_profile,
            },
            trust_card=card,
            student_profile=student,
            resume_text=str((analysis or {}).get("resume_text") or ""),
            job_description=payload.jobDescription.strip(),
            verified_shared_connection=shared,
        )

    @staticmethod
    def _concise_message(message: str, maximum_words: int = 120) -> str:
        words = message.strip().split()
        if not words:
            raise AIServiceUnavailable("The AI service returned an empty response")
        return " ".join(words[:maximum_words])

    @staticmethod
    def _fallback_message(candidate_name: str, company: str, role: str, evidence: str | None, follow_up: bool) -> str:
        opening = "I’m following up on my referral request" if follow_up else "I’m reaching out to request a referral"
        message = f"{opening} for the {role} role at {company}."
        if evidence:
            message += f" My resume and Candidate Trust Card highlight {evidence}."
        message += " I’d appreciate your review, and I’m happy to share any additional evidence that would be useful. Thank you for your time."
        if candidate_name:
            message += f" — {candidate_name}"
        return ReferralRequestService._concise_message(message)

    def generate_message(self, actor_id: str, payload: ReferralMessageRequest) -> dict[str, Any]:
        if self._role(actor_id) != "student":
            raise ReferralForbidden("Student access is required for referral-message generation")

        employee_id = str(payload.employeeId)
        if self.repository.get_role(employee_id) != "employee":
            raise ReferralNotFound("The selected employee is not discoverable")
        employee_profile = self.repository.get_employee_profile(employee_id) or {}
        employee_public = self.repository.get_profile(employee_id) or {}

        card = self.repository.get_trust_card(str(payload.trustCardId))
        if not card or str(card.get("student_id")) != actor_id:
            raise ReferralForbidden("The Trust Card does not belong to this student")

        draft = None
        if payload.referralRequestId:
            draft = self.repository.get_request(str(payload.referralRequestId))
            if not draft or str(draft.get("student_id")) != actor_id:
                raise ReferralForbidden("The referral draft does not belong to this student")
            if str(draft.get("employee_id")) != employee_id:
                raise ReferralForbidden("The referral draft belongs to a different employee")

        shared = self.repository.get_verified_shared_connection(actor_id, employee_id)
        alumni_available = bool(shared and shared.get("verified") and shared.get("safe_summary"))
        follow_up_available = bool(draft and draft.get("student_message"))
        if payload.tone == "alumni_connection" and not alumni_available:
            raise ReferralForbidden("A verified alumni connection is required for this tone")
        if payload.tone == "follow_up" and not follow_up_available:
            raise ReferralForbidden("A previous owned referral interaction is required for follow-up")

        student = self.repository.get_profile(actor_id) or {}
        card_payload = card.get("payload") or {}
        analysis = None
        if card.get("analysis_id"):
            analysis = self.repository.get_analysis(actor_id, str(card["analysis_id"]))

        facts: list[dict[str, str]] = []
        def add_fact(identifier: str, source: str, value: Any, limit: int = 500):
            clean = " ".join(str(value or "").split())
            if clean:
                facts.append({"id": identifier, "sourceType": source, "value": clean[:limit]})

        add_fact("student.name", "profile", student.get("full_name"), 120)
        add_fact("opportunity.company", "profile", payload.targetCompany, 200)
        add_fact("opportunity.role", "profile", payload.targetRole, 200)
        if payload.jobDescription.strip():
            add_fact("opportunity.job_description", "job_description", payload.jobDescription, 1200)
        add_fact("employee.name", "employee_directory", employee_public.get("full_name"), 120)
        add_fact("employee.company", "employee_directory", employee_profile.get("company"), 200)
        add_fact("employee.designation", "employee_directory", employee_profile.get("designation"), 200)
        for index, item in enumerate((card_payload.get("evidence") or [])[:4]):
            add_fact(f"trust_card.evidence.{index + 1}", "trust_card", item, 300)
        for index, item in enumerate((card_payload.get("matchedSkills") or [])[:6]):
            add_fact(f"trust_card.skill.{index + 1}", "trust_card", item, 100)
        if analysis:
            add_fact("resume.evidence_text", "resume", analysis.get("resume_text"), 1200)
        if alumni_available:
            add_fact("shared.connection", "verified_shared_data", shared["safe_summary"], 240)
        if draft:
            add_fact("referral_draft.message", "referral_draft", draft.get("student_message"), 500)

        evidence_facts = [fact for fact in facts if fact["sourceType"] in {"resume", "trust_card"}]
        if payload.action == "add_strongest_project" and not evidence_facts:
            raise ReferralError("No supported resume evidence is available to add")

        omitted = []
        limitations = []
        if not payload.jobDescription.strip():
            omitted.append("Specific Job Description")
            limitations.append("No specific Job Description was available; the message is a general role-focused referral request.")
        if not alumni_available:
            omitted.append("Verified shared or alumni connection")
        if not evidence_facts:
            omitted.append("Resume-backed project or experience evidence")
            limitations.append("No concise resume evidence was available for a specific achievement claim.")

        current = payload.currentMessage.strip()
        if payload.action in {"shorter", "more_formal", "remove_weak_claims"} and not current:
            raise ReferralError("Generate or enter a message before applying this edit")

        used_fallback = False
        used_facts = facts
        try:
            generated = generate_referral_message(facts, payload.tone, payload.action, current)
            if isinstance(generated, dict):
                message = generated["message"]
                used_ids = set(generated["usedFactIds"])
                used_facts = [fact for fact in facts if fact["id"] in used_ids]
            else:  # Compatibility for existing injected/test clients.
                message = generated
            message = self._concise_message(message)
        except (AIServiceUnavailable, TimeoutError, ValueError):
            used_fallback = True
            strongest = evidence_facts[0]["value"] if evidence_facts else None
            message = self._fallback_message(
                str(student.get("full_name") or ""), payload.targetCompany.strip(),
                payload.targetRole.strip(), strongest, payload.tone == "follow_up",
            )
            limitations.append("Groq was unavailable or returned invalid output; a deterministic template was used.")

        return {
            "message": message,
            "usedFacts": used_facts,
            "omittedOrUnavailableFacts": omitted,
            "groundingLimitations": limitations,
            "usedFallback": used_fallback,
            "wordCount": len(message.split()),
            "alumniConnectionAvailable": alumni_available,
            "followUpAvailable": follow_up_available,
        }

    def create(self, actor_id: str, payload: CreateReferralRequest) -> dict[str, Any]:
        if payload.studentId and str(payload.studentId) != actor_id: raise ReferralForbidden("Students may only create their own requests")
        employee_profile, card, request_values = self._compatibility_context(actor_id, payload)
        employee_id = str(payload.employeeId)
        availability = employee_profile.get("availability_status", "accepting")
        maximum = int(employee_profile.get("max_active_requests", 5))
        active = self.repository.active_request_counts([employee_id]).get(employee_id, 0)
        if availability != "accepting" or maximum <= 0:
            raise ReferralUnavailable("This employee is not currently accepting referral requests")
        if active >= maximum:
            raise ReferralUnavailable("This employee has reached their active referral request limit")
        quality = self.quality(actor_id, payload)
        if not quality["canSubmit"]:
            raise ReferralQualityBlocked(quality)
        compatibility = calculate_referral_compatibility(employee_profile, {**(card.get("payload") or {}), "_available": True}, request_values)
        row = self.repository.create_request({
            "student_id": actor_id, "employee_id": str(payload.employeeId), "trust_card_id": str(payload.trustCardId),
            **request_values,
            "compatibility_score": compatibility["score"],
            "compatibility_label": compatibility["label"],
            "compatibility_version": compatibility["scoreVersion"],
            "compatibility_payload": compatibility,
            "status": "submitted",
        })
        return _camel(row)

    def get(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        role = self._role(actor_id)
        owner_field = "student_id" if role == "student" else "employee_id"
        if str(row[owner_field]) != actor_id: raise ReferralForbidden("Referral request access denied")
        result = _camel(row)
        if role == "student":
            result["employeeNote"] = None
        else:
            result["employeeNote"] = self.repository.get_private_decision_note(request_id, actor_id)
        return result

    def list(self, actor_id: str) -> list[dict[str, Any]]:
        role = self._role(actor_id)
        field = "student_id" if role == "student" else "employee_id"
        return [_camel(row) for row in self.repository.list_requests(field, actor_id)]

    def employee_queue(self, actor_id: str) -> list[dict[str, Any]]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        items = []
        for row in self.repository.list_employee_queue(actor_id):
            row = dict(row)
            student = row.pop("student", None) or {}
            card = row.pop("trust_card", None) or {}
            education = self._student_education(str(row["student_id"]))
            items.append({
                **_camel(row), "candidateId": row["student_id"], "studentName": student.get("full_name"),
                "college": education.get("college"), "trustScore": card.get("trust_score"),
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
            "analysisReliability": payload.get("analysisReliability"),
            "missingRequirements": payload.get("missingRequirements"), "strengths": payload.get("strengths"),
            "evidence": payload.get("evidence"),
            "readinessSummary": payload.get("readinessSummary") or payload.get("referralReadiness"),
        }

    def employee_request_detail(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        record_viewed = getattr(self.repository, "record_employee_viewed", None)
        if callable(record_viewed): record_viewed(actor_id, request_id)
        self.notify(
            recipient_id=str(row["student_id"]), event_type="employee_viewed_request",
            event_key=f"employee_viewed_request:{request_id}", title="Your referral request was viewed",
            body="The assigned employee opened your referral request for review.",
            target_url="/dashboard#referral-requests", referral_request_id=request_id,
        )
        profile = self.repository.get_profile(str(row["student_id"])) or {}
        metadata = self.repository.get_auth_metadata(str(row["student_id"]))
        education = self._student_education(str(row["student_id"]), metadata)
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        payload = (card or {}).get("payload") or {}
        analysis = self._analysis_from_payload(payload)
        resume = self.repository.find_resume(str(row["student_id"]))
        graduation_year = education.get("graduationYear")
        return {
            "id": row["id"], "status": row["status"], "targetRole": row["target_role"],
            "targetCompany": row["target_company"], "studentMessage": row.get("student_message") or "",
            "employeeNote": self.repository.get_private_decision_note(request_id, actor_id),
            "decisionReason": row.get("decision_reason"), "decisionMessage": row.get("decision_message"),
            "decisionAt": row.get("decision_at"),
            "referralDate": row.get("referral_date"),
            "referralConfirmationNumber": row.get("referral_confirmation_number"),
            "referralNoteToStudent": row.get("referral_note_to_student"),
            "referralSubmittedAt": row.get("referral_submitted_at"),
            "referralSubmittedBy": row.get("referral_submitted_by"),
            "compatibility": row.get("compatibility_payload"),
            "createdAt": row["created_at"], "updatedAt": row["updated_at"],
            "candidate": {
                "studentId": row["student_id"],
                "studentName": profile.get("full_name") or metadata.get("full_name") or metadata.get("name"),
                "college": education.get("college"),
                "degree": education.get("degree"),
                # Supabase stores graduation_year as an integer, while the employee
                # review contract deliberately renders it as display text.
                "graduationYear": str(graduation_year) if graduation_year is not None else None,
                "profilePhotoUrl": profile.get("profile_photo_url") or profile.get("avatar_url") or metadata.get("avatar_url"),
            },
            "analysis": analysis, "resumeExists": bool(resume), "trustCardExists": bool(card),
            "analysisExists": analysis is not None,
        }

    def employee_review_copilot(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        if not card:
            raise ReferralUnavailable("No persisted Trust Card is available for this referral request")
        analysis = (
            self.repository.get_analysis(str(row["student_id"]), str(card["analysis_id"]))
            if card.get("analysis_id") else None
        )
        education = self.repository.get_student_education(str(row["student_id"])) or {}
        return build_employee_review_copilot(
            request=row,
            trust_card=card,
            resume_text=str((analysis or {}).get("resume_text") or ""),
            verified_profile=education,
            generator=generate_employee_review_summary,
        )

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
            "trustScore": payload.get("trustScore"), "scoreVersion": payload.get("scoreVersion"),
            "overallMatch": payload.get("overallMatch"),
            "roleFit": payload.get("roleFit"), "proofScore": payload.get("proofScore"),
            "gapScore": payload.get("gapScore"), "confidence": payload.get("confidence"),
            "analysisReliability": payload.get("analysisReliability"),
            "matchedSkills": payload.get("matchedSkills"), "missingRequirements": payload.get("missingRequirements"),
            "strengths": payload.get("strengths"), "evidence": payload.get("evidence"),
            "readiness": payload.get("referralReadiness"), "recommendation": payload.get("recommendation"),
            "summary": payload.get("aiSummary"), "riskSignals": payload.get("riskSignals"),
            "scoreFormula": payload.get("scoreFormula"), "scoreBreakdown": payload.get("scoreBreakdown"),
            "generatedAt": card.get("created_at"),
            "education": self._student_education(str(row["student_id"]), metadata),
        }

    @staticmethod
    def _student_decision_message(status: str, reason: str, question: str | None = None) -> str:
        approve = {
            "suitable_profile": "The employee found your profile suitable for this referral opportunity.",
            "strong_evidence": "The employee found strong supporting evidence in your submitted materials.",
            "relevant_role_alignment": "The employee found your experience relevant to the target role.",
            "will_refer_externally": "The employee approved the request and plans to continue the referral outside RefAI.",
            "additional_details_required_first": "The employee is open to the referral and may need additional details before completing it.",
        }
        decline = {
            "role_mismatch": "The employee could not support this request because the current role alignment was not close enough.",
            "insufficient_evidence": "The employee could not support this request because the available evidence was not sufficient for their referral process.",
            "not_accepting_referrals": "The employee is not currently accepting referral requests.",
            "job_closed": "The employee indicated that this opportunity is closed or no longer available.",
            "unable_to_verify_experience": "The employee could not confirm enough experience evidence to proceed with this referral.",
            "other": "The employee is unable to support this referral request at this time.",
        }
        if status == "approved": return approve[reason]
        if status == "declined":
            return decline[reason] + " This decline does not reduce your Candidate Trust Score."
        return f"The employee requested more information: {question}"

    def draft_clarification(self, actor_id: str, request_id: str) -> dict[str, Any]:
        row = self._assigned_employee_request(actor_id, request_id)
        card = self.repository.get_trust_card(str(row["trust_card_id"])) if row.get("trust_card_id") else None
        if not card: raise ReferralUnavailable("No persisted Trust Card is available for clarification drafting")
        payload = card.get("payload") or {}
        raw_missing = payload.get("missingRequirements") or payload.get("missingSkills") or []
        missing = []
        for index, item in enumerate(raw_missing[:5]):
            value = item.get("requirement") if isinstance(item, dict) else item
            clean = " ".join(str(value or "").split())[:160]
            if clean: missing.append({"id": f"missing.{index + 1}", "value": clean})
        if not missing: raise ReferralUnavailable("No structured missing evidence is available for a clarification draft")
        fallback = f"Could you share a concrete project or experience example that demonstrates {missing[0]['value']}?"
        used_fallback = False
        question = fallback
        try:
            generated = generate_clarification_question(missing)
            used = next(item for item in missing if item["id"] == generated["usedFactId"])
            candidate = " ".join(generated["question"].split())
            significant = [token.lower() for token in used["value"].split() if len(token) >= 4]
            if len(candidate.split()) > 45 or not any(token in candidate.lower() for token in significant):
                raise AIServiceUnavailable("Clarification wording was not grounded")
            question = candidate
        except (AIServiceUnavailable, TimeoutError, ValueError, StopIteration):
            used_fallback = True
        return {
            "question": question, "missingEvidence": [item["value"] for item in missing],
            "usedFallback": used_fallback,
            "limitation": "The draft uses only saved missing-evidence labels. It is advisory and must be reviewed and edited by the employee.",
        }

    def update_status(self, actor_id: str, request_id: str, update: EmployeeDecisionUpdate) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        if str(row["employee_id"]) != actor_id: raise ReferralForbidden("This request is assigned to another employee")
        message = self._student_decision_message(update.status, update.reason, update.question)
        result = _camel(self.repository.transition(actor_id, request_id, update.status, update.reason, message, update.note))
        result["employeeNote"] = update.note
        event = {
            "more_info_requested": ("more_information_requested", "More information requested"),
            "approved": ("request_approved", "Approved for referral"),
            "declined": ("request_declined", "Referral request declined"),
        }[update.status]
        self.notify(
            recipient_id=str(row["student_id"]), event_type=event[0],
            event_key=f"{event[0]}:{request_id}:{result.get('decisionAt') or result.get('updatedAt')}",
            title=event[1], body=message, target_url="/dashboard#referral-requests",
            referral_request_id=request_id,
        )
        return result

    def mark_referral_submitted(self, actor_id: str, request_id: str, update: ReferralSubmissionUpdate) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_request(request_id)
        if not row: raise ReferralNotFound("Referral request not found")
        if str(row["employee_id"]) != actor_id: raise ReferralForbidden("This request is assigned to another employee")
        self.repository.mark_referral_submitted(actor_id, request_id, {
            "referral_date": update.referralDate.isoformat() if update.referralDate else None,
            "confirmation_number": update.confirmationNumber,
            "note_to_student": update.noteToStudent,
        })
        self.notify(
            recipient_id=str(row["student_id"]), event_type="referral_submitted",
            event_key=f"referral_submitted:{request_id}", title="Referral submitted",
            body=update.noteToStudent or "Your referral was submitted. Monitor your email or application portal for next steps.",
            target_url="/dashboard#referral-requests", referral_request_id=request_id,
        )
        return self.employee_request_detail(actor_id, request_id)

    def history(self, actor_id: str, request_id: str) -> list[dict[str, Any]]:
        self.get(actor_id, request_id)
        role = self._role(actor_id)
        items = [_camel(row) for row in self.repository.list_history(request_id)]
        if role == "student":
            for item in items: item["note"] = None
        return items

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
        rows = self.repository.list_employees()
        employee_ids = [str(row["id"]) for row in rows]
        counts = self.repository.active_request_counts(employee_ids)
        activity = self.repository.referral_activity(employee_ids)
        employees = []
        for row in rows:
            metadata = self.repository.get_auth_metadata(str(row["id"]))
            employee_id = str(row["id"])
            active_count = counts.get(employee_id, 0)
            max_active = int(row.get("max_active_requests", 5))
            accepting = row.get("availability_status", "accepting") == "accepting" and max_active > active_count
            employee_activity = activity.get(employee_id, {"requests": [], "history": []})
            reliability = calculate_employee_reliability(row, employee_activity["requests"], employee_activity["history"])
            employees.append({
                "id": row["id"],
                "name": row.get("full_name") or "Employee",
                "photoUrl": metadata.get("avatar_url") or metadata.get("picture"),
                "company": row.get("company") or metadata.get("company") or metadata.get("company_name") or metadata.get("preferred_company"),
                "designation": row.get("designation") or metadata.get("designation") or metadata.get("job_title") or metadata.get("headline"),
                "department": row.get("department"),
                "yearsExperience": row.get("years_experience"),
                "verifiedEmployee": row.get("verified_employee", False),
                "linkedinUrl": row.get("linkedin_url"),
                "companyProfileUrl": row.get("company_profile_url"),
                "portfolioUrl": row.get("portfolio_url"),
                "supportedCompanies": row.get("supported_companies") or [],
                "supportedRoles": row.get("supported_roles") or [],
                "supportedDepartments": row.get("supported_departments") or [],
                "acceptsFreshers": row.get("accepts_freshers", True),
                "minimumEvidenceExpectations": row.get("minimum_evidence_expectations") or [],
                "preferredCandidateLevels": row.get("preferred_candidate_levels") or [],
                "preferredMessageLength": row.get("preferred_message_length", "concise"),
                "referralGuidelines": row.get("referral_guidelines"),
                "referralCategories": row.get("referral_categories") or [],
                "acceptingRequests": accepting,
                "activeRequestCount": active_count,
                "maxActiveRequests": max_active,
                "reliability": reliability,
            })
        return employees

    @staticmethod
    def _employee_profile_payload(profile_id: str, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "profileId": profile_id,
            "company": row.get("company"),
            "designation": row.get("designation"),
            "department": row.get("department"),
            "yearsExperience": row.get("years_experience"),
            "verifiedEmployee": row.get("verified_employee", False),
            "linkedinUrl": row.get("linkedin_url"),
            "companyProfileUrl": row.get("company_profile_url"),
            "portfolioUrl": row.get("portfolio_url"),
            "supportedCompanies": row.get("supported_companies") or [],
            "supportedRoles": row.get("supported_roles") or [],
            "supportedDepartments": row.get("supported_departments") or [],
            "acceptsFreshers": row.get("accepts_freshers", True),
            "minimumEvidenceExpectations": row.get("minimum_evidence_expectations") or [],
            "maxActiveRequests": row.get("max_active_requests", 5),
            "availabilityStatus": row.get("availability_status", "accepting"),
            "preferredCandidateLevels": row.get("preferred_candidate_levels") or ["student", "fresher"],
            "preferredMessageLength": row.get("preferred_message_length", "concise"),
            "referralGuidelines": row.get("referral_guidelines"),
            "declineReasonCodes": row.get("decline_reason_codes") or [],
            "referralCategories": row.get("referral_categories") or [],
        }

    def employee_profile(self, actor_id: str) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        row = self.repository.get_employee_profile(actor_id) or {}
        response_data = getattr(self.repository, "employee_response_time_data", None)
        requests, history = response_data(actor_id) if callable(response_data) else ([], [])
        return {**self._employee_profile_payload(actor_id, row), **calculate_average_response_time(requests, history)}

    def save_employee_profile(self, actor_id: str, update: EmployeeProfessionalProfileUpdate) -> dict[str, Any]:
        if self._role(actor_id) != "employee": raise ReferralForbidden("Employee access is required")
        company = update.company.strip()
        if not company: raise ReferralError("Company name is required")
        designation = update.designation.strip() if update.designation and update.designation.strip() else None
        guidelines = update.referralGuidelines.strip() if update.referralGuidelines and update.referralGuidelines.strip() else None
        previous = self.repository.get_employee_profile(actor_id) or {}
        row = self.repository.upsert_employee_profile(actor_id, {
            "company": company,
            "designation": designation,
            "department": update.department.strip() if update.department and update.department.strip() else None,
            "years_experience": update.yearsExperience,
            "linkedin_url": update.linkedinUrl,
            "company_profile_url": update.companyProfileUrl,
            "portfolio_url": update.portfolioUrl,
            "supported_companies": update.supportedCompanies,
            "supported_roles": update.supportedRoles,
            "supported_departments": update.supportedDepartments,
            "accepts_freshers": update.acceptsFreshers,
            "minimum_evidence_expectations": update.minimumEvidenceExpectations,
            "max_active_requests": update.maxActiveRequests,
            "availability_status": update.availabilityStatus,
            "preferred_candidate_levels": update.preferredCandidateLevels,
            "preferred_message_length": update.preferredMessageLength,
            "referral_guidelines": guidelines,
            "decline_reason_codes": update.declineReasonCodes,
            "referral_categories": update.referralCategories,
        })
        if previous.get("availability_status", "accepting") == "accepting" and update.availabilityStatus != "accepting":
            employee = self.repository.get_profile(actor_id) or {}
            employee_name = employee.get("full_name") or "The assigned employee"
            for request in self.repository.list_requests("employee_id", actor_id):
                if request.get("status") not in ACTIVE_REFERRAL_STATUSES: continue
                request_id = str(request["id"])
                self.notify(
                    recipient_id=str(request["student_id"]), event_type="employee_stopped_accepting",
                    event_key=f"employee_stopped_accepting:{request_id}:{row.get('updated_at')}",
                    title="Employee availability changed",
                    body=f"{employee_name} is not currently accepting new referral requests. Your existing request remains visible.",
                    target_url="/dashboard#referral-requests", referral_request_id=request_id,
                )
        response_data = getattr(self.repository, "employee_response_time_data", None)
        requests, history = response_data(actor_id) if callable(response_data) else ([], [])
        return {**self._employee_profile_payload(actor_id, row), **calculate_average_response_time(requests, history)}
