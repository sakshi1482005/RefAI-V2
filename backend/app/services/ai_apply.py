from __future__ import annotations

import hashlib
import json
import logging
from collections import Counter
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import settings
from app.db.supabase_client import supabase
from app.models.schemas import AIApplyGoalRequest, AIApplySubmissionRequest, CreateReferralRequest
from app.services.referral_compatibility import calculate_referral_compatibility
from app.services.referral_requests import ReferralRequestService
from app.services.trust_card_cache import is_current_trust_card
from app.services.vector_store import ChromaProjectRelevanceProvider


MATCH_VERSION = "ai-apply-matching-v1"
TERMINAL_DUPLICATE_EXEMPT_STATUSES = {"withdrawn", "expired"}
logger = logging.getLogger(__name__)


class AIApplyError(Exception):
    pass


class AIApplyForbidden(AIApplyError):
    pass


class AIApplyUnavailable(AIApplyError):
    pass


class AIApplyNotFound(AIApplyError):
    pass


class AIApplySubmissionError(AIApplyError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class AIApplyRepository(Protocol):
    def get_role(self, user_id: str) -> str | None: ...
    def latest_analysis(self, student_id: str) -> dict[str, Any] | None: ...
    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...
    def list_student_requests(self, student_id: str) -> list[dict[str, Any]]: ...
    def find_goal(self, student_id: str, idempotency_key: str) -> dict[str, Any] | None: ...
    def create_goal(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def latest_goal(self, student_id: str) -> dict[str, Any] | None: ...
    def find_run(self, goal_id: str, match_version: str, input_key: str) -> dict[str, Any] | None: ...
    def latest_run(self, goal_id: str) -> dict[str, Any] | None: ...
    def create_run(self, values: dict[str, Any], matches: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]: ...
    def list_matches(self, run_id: str) -> list[dict[str, Any]]: ...
    def submission_context(self, student_id: str, match_id: str) -> dict[str, Any] | None: ...
    def allowance(self, student_id: str) -> dict[str, Any]: ...
    def submit_match(self, values: dict[str, Any]) -> dict[str, Any]: ...


class SupabaseAIApplyRepository:
    def get_role(self, user_id: str) -> str | None:
        rows = supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute().data or []
        return rows[0].get("role") if rows else None

    def latest_analysis(self, student_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("resume_analyses").select("*")
            .eq("student_id", student_id).order("updated_at", desc=True).limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("trust_cards").select("*")
            .eq("student_id", student_id).eq("analysis_id", analysis_id)
            .order("created_at", desc=True).limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def list_student_requests(self, student_id: str) -> list[dict[str, Any]]:
        return (
            supabase.table("referral_requests")
            .select("employee_id,target_role,target_company,status")
            .eq("student_id", student_id).execute().data or []
        )

    def find_goal(self, student_id: str, idempotency_key: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("ai_apply_goals").select("*")
            .eq("student_id", student_id).eq("idempotency_key", idempotency_key)
            .limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def create_goal(self, values: dict[str, Any]) -> dict[str, Any]:
        try:
            rows = supabase.table("ai_apply_goals").insert(values).execute().data or []
        except Exception:
            existing = self.find_goal(str(values["student_id"]), str(values["idempotency_key"]))
            if existing:
                return existing
            raise
        if not rows:
            raise AIApplyError("The AI Apply goal could not be saved")
        return rows[0]

    def latest_goal(self, student_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("ai_apply_goals").select("*")
            .eq("student_id", student_id).order("created_at", desc=True).limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def find_run(self, goal_id: str, match_version: str, input_key: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("ai_apply_match_runs").select("*")
            .eq("goal_id", goal_id).eq("match_version", match_version).eq("input_key", input_key)
            .limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def latest_run(self, goal_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("ai_apply_match_runs").select("*")
            .eq("goal_id", goal_id).order("created_at", desc=True).limit(1).execute().data or []
        )
        return rows[0] if rows else None

    def create_run(self, values: dict[str, Any], matches: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        result = supabase.rpc("persist_ai_apply_match_run", {
            "p_student_id": values["student_id"], "p_goal_id": values["goal_id"],
            "p_match_version": values["match_version"], "p_input_key": values["input_key"],
            "p_minimum_compatibility": values["minimum_compatibility"],
            "p_requested_match_count": values["requested_match_count"],
            "p_eligible_employee_count": values["eligible_employee_count"],
            "p_excluded_employee_count": values["excluded_employee_count"],
            "p_vector_status": values["vector_status"], "p_limitations": values["limitations"],
            "p_matches": matches, "p_exclusion_reasons": values.get("exclusion_reasons") or [],
        }).execute().data
        if not isinstance(result, dict) or not isinstance(result.get("run"), dict):
            raise AIApplyError("The complete AI Apply match snapshot could not be saved")
        return result["run"], result.get("matches") or []

    def list_matches(self, run_id: str) -> list[dict[str, Any]]:
        return (
            supabase.table("ai_apply_matches").select("*")
            .eq("match_run_id", run_id).order("rank").execute().data or []
        )

    def submission_context(self, student_id: str, match_id: str) -> dict[str, Any] | None:
        matches = (
            supabase.table("ai_apply_matches").select("*")
            .eq("id", match_id).eq("student_id", student_id).limit(1).execute().data or []
        )
        if not matches:
            return None
        match = matches[0]
        runs = (
            supabase.table("ai_apply_match_runs").select("*")
            .eq("id", match["match_run_id"]).eq("student_id", student_id).limit(1).execute().data or []
        )
        if not runs:
            return None
        goals = (
            supabase.table("ai_apply_goals").select("*")
            .eq("id", runs[0]["goal_id"]).eq("student_id", student_id).limit(1).execute().data or []
        )
        if not goals:
            return None
        analyses = (
            supabase.table("resume_analyses").select("id,student_id,target_role,target_company,job_description,used_general_role_expectations")
            .eq("id", goals[0]["analysis_id"]).eq("student_id", student_id).limit(1).execute().data or []
        )
        return {"match": match, "run": runs[0], "goal": goals[0], "analysis": analyses[0] if analyses else None}

    def allowance(self, student_id: str) -> dict[str, Any]:
        result = supabase.rpc("get_ai_apply_allowance_as", {
            "p_student_id": student_id,
            "p_weekly_cap": max(0, settings.ai_apply_weekly_request_cap),
            "p_initial_credit_balance": max(0, settings.ai_apply_initial_credit_balance),
            "p_minimum_threshold": max(0, min(100, settings.ai_apply_default_min_compatibility)),
        }).execute().data
        if not isinstance(result, dict):
            raise AIApplyError("AI Apply allowance is temporarily unavailable")
        return result

    def submit_match(self, values: dict[str, Any]) -> dict[str, Any]:
        result = supabase.rpc("submit_ai_apply_match_as", values).execute().data
        if not isinstance(result, dict):
            raise AIApplyError("The AI Apply referral request could not be created")
        return result


class SemanticEmployeeMatcher:
    """Small adapter around RefAI's existing ChromaDB embedding collection."""

    def similarity(self, context_id: str, employee_context: str, goal_context: str) -> float:
        result = ChromaProjectRelevanceProvider(context_id).compare([employee_context], [goal_context])
        return round(float(result["score"]), 2)


def _normalized(value: Any) -> str:
    return " ".join(str(value or "").split()).casefold()


def _overlaps(target: str, values: list[str]) -> bool:
    clean_target = _normalized(target)
    if not clean_target:
        return True
    return any(clean_target in _normalized(value) or _normalized(value) in clean_target for value in values if _normalized(value))


def _input_key(student_id: str, analysis: dict[str, Any], card: dict[str, Any], payload: AIApplyGoalRequest, minimum: int) -> str:
    card_payload = card.get("payload") or {}
    source = {
        "student": student_id,
        "analysis": str(analysis["id"]),
        "trustCard": str(card["id"]),
        "trustScoreVersion": card_payload.get("scoreVersion"),
        "trustCardInputKey": card_payload.get("inputKey"),
        "role": _normalized(payload.targetRole),
        "company": _normalized(payload.targetCompany),
        "department": _normalized(payload.preferredDepartment),
        "timeline": payload.timeline,
        "location": _normalized(payload.location),
        "workMode": payload.workMode,
        "minimum": minimum,
        "count": payload.numberOfMatches,
        "matchVersion": MATCH_VERSION,
    }
    return hashlib.sha256(json.dumps(source, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _employee_for_score(employee: dict[str, Any]) -> dict[str, Any]:
    return {
        "profile_id": employee["id"],
        "company": employee.get("company"),
        "designation": employee.get("designation"),
        "department": employee.get("department"),
        "supported_companies": employee.get("supportedCompanies") or [],
        "supported_roles": employee.get("supportedRoles") or [],
        "supported_departments": employee.get("supportedDepartments") or [],
        "accepts_freshers": employee.get("acceptsFreshers", True),
        "preferred_candidate_levels": employee.get("preferredCandidateLevels") or [],
        "availability_status": "accepting" if employee.get("acceptingRequests") else "unavailable",
    }


@dataclass(frozen=True)
class EligibilityResult:
    eligible: bool
    reason: str | None = None


class AIApplyService:
    def __init__(
        self,
        repository: AIApplyRepository | None = None,
        directory_service: Any | None = None,
        semantic_matcher: Any | None = None,
    ):
        self.repository = repository or SupabaseAIApplyRepository()
        self.directory_service = directory_service or ReferralRequestService()
        self.semantic_matcher = semantic_matcher or SemanticEmployeeMatcher()

    def _require_student(self, actor_id: str) -> None:
        if self.repository.get_role(actor_id) != "student":
            raise AIApplyForbidden("Student access is required")

    def _analysis_and_card(self, actor_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        analysis = self.repository.latest_analysis(actor_id)
        if not analysis:
            raise AIApplyUnavailable("Complete a resume analysis before creating an AI Apply goal")
        card = self.repository.latest_trust_card(actor_id, str(analysis["id"]))
        if not card or not is_current_trust_card(card, analysis):
            raise AIApplyUnavailable("Generate a current Candidate Trust Card before creating an AI Apply goal")
        return analysis, card

    @staticmethod
    def _duplicate_keys(rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
        return {
            (str(row.get("employee_id")), _normalized(row.get("target_role")), _normalized(row.get("target_company")))
            for row in rows if str(row.get("status")) not in TERMINAL_DUPLICATE_EXEMPT_STATUSES
        }

    @staticmethod
    def _eligibility(employee: dict[str, Any], payload: AIApplyGoalRequest, duplicate_keys: set[tuple[str, str, str]]) -> EligibilityResult:
        if not employee.get("aiApplyOptIn", True):
            return EligibilityResult(False, "Employee opted out of AI Apply matching")
        if not employee.get("acceptingRequests"):
            return EligibilityResult(False, "Employee is inactive, unavailable, or at request capacity")
        if not employee.get("acceptsFreshers", True):
            return EligibilityResult(False, "Employee preferences do not currently accept freshers or students")
        levels = {_normalized(item) for item in employee.get("preferredCandidateLevels") or []}
        if levels and not levels.intersection({"student", "fresher", "entry_level"}):
            return EligibilityResult(False, "Employee candidate-level preferences conflict with this student goal")
        supported_roles = employee.get("supportedRoles") or []
        if supported_roles and not _overlaps(payload.targetRole, supported_roles):
            return EligibilityResult(False, "Target role conflicts with the employee's supported roles")
        company_options = [employee.get("company"), *(employee.get("supportedCompanies") or [])]
        if company_options and not _overlaps(payload.targetCompany, [str(item) for item in company_options if item]):
            return EligibilityResult(False, "Target company conflicts with the employee's company preferences")
        department_options = [employee.get("department"), *(employee.get("supportedDepartments") or [])]
        if payload.preferredDepartment and department_options and not _overlaps(
            payload.preferredDepartment, [str(item) for item in department_options if item],
        ):
            return EligibilityResult(False, "Preferred department conflicts with the employee's supported departments")
        duplicate = (str(employee["id"]), _normalized(payload.targetRole), _normalized(payload.targetCompany))
        if duplicate in duplicate_keys:
            return EligibilityResult(False, "A referral request for this employee and opportunity already exists")
        return EligibilityResult(True)

    @staticmethod
    def _goal_context(payload: AIApplyGoalRequest, card_payload: dict[str, Any]) -> str:
        skills = card_payload.get("matchedSkills") or []
        return " | ".join(filter(None, [
            f"Target role: {payload.targetRole}",
            f"Target company: {payload.targetCompany}",
            f"Preferred department: {payload.preferredDepartment}" if payload.preferredDepartment else None,
            f"Location: {payload.location}" if payload.location else None,
            f"Work mode: {payload.workMode}" if payload.workMode else None,
            f"Resume-backed skills: {', '.join(map(str, skills[:10]))}" if skills else None,
        ]))

    @staticmethod
    def _employee_context(employee: dict[str, Any]) -> str:
        return " | ".join(filter(None, [
            f"Company: {employee.get('company')}" if employee.get("company") else None,
            f"Designation: {employee.get('designation')}" if employee.get("designation") else None,
            f"Department: {employee.get('department')}" if employee.get("department") else None,
            f"Supported roles: {', '.join(employee.get('supportedRoles') or [])}" if employee.get("supportedRoles") else None,
            f"Supported departments: {', '.join(employee.get('supportedDepartments') or [])}" if employee.get("supportedDepartments") else None,
        ]))

    @staticmethod
    def _goal_response(goal: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": goal["id"], "analysisId": goal["analysis_id"], "trustCardId": goal["trust_card_id"],
            "targetRole": goal["target_role"], "targetCompany": goal["target_company"],
            "preferredDepartment": goal.get("preferred_department"), "timeline": goal.get("timeline"),
            "location": goal.get("location"), "workMode": goal.get("work_mode"),
            "minimumCompatibility": goal["minimum_compatibility"],
            "numberOfMatches": goal["requested_match_count"], "createdAt": goal["created_at"],
        }

    def _response(self, goal: dict[str, Any], run: dict[str, Any], matches: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "id": run["id"], "goal": self._goal_response(goal), "matchVersion": run["match_version"],
            "inputKey": run["input_key"], "vectorStatus": run["vector_status"],
            "eligibleEmployeeCount": run["eligible_employee_count"],
            "excludedEmployeeCount": run["excluded_employee_count"],
            "exclusionReasons": run.get("exclusion_reasons") or [],
            "limitations": run.get("limitations") or [], "createdAt": run["created_at"],
            "matches": [{
                "id": row["id"], "rank": row["rank"], "employee": row["employee_snapshot"],
                "compatibility": row["compatibility_snapshot"],
                "semanticSimilarity": float(row["semantic_similarity"]) if row.get("semantic_similarity") is not None else None,
                "rankingScore": float(row["ranking_score"]), "relevanceSource": row["relevance_source"],
                "reason": row["reason_snapshot"],
                "referralRequestId": row.get("referral_request_id"),
            } for row in matches],
        }

    def latest(self, actor_id: str) -> dict[str, Any]:
        self._require_student(actor_id)
        goal = self.repository.latest_goal(actor_id)
        if not goal:
            raise AIApplyNotFound("No saved AI Apply goal is available")
        run = self.repository.latest_run(str(goal["id"]))
        if not run:
            raise AIApplyNotFound("This AI Apply goal does not have a completed match run")
        return self._response(goal, run, self.repository.list_matches(str(run["id"])))

    def allowance(self, actor_id: str) -> dict[str, Any]:
        self._require_student(actor_id)
        return self.repository.allowance(actor_id)

    def submit(self, actor_id: str, payload: AIApplySubmissionRequest) -> dict[str, Any]:
        self._require_student(actor_id)
        context = self.repository.submission_context(actor_id, str(payload.matchId))
        if not context:
            raise AIApplySubmissionError("no_eligible_employee", "This AI Apply match is unavailable or does not belong to you")
        match, goal = context["match"], context["goal"]
        analysis = context.get("analysis") or {}
        same_opportunity = (
            _normalized(analysis.get("target_role")) == _normalized(goal.get("target_role"))
            and _normalized(analysis.get("target_company")) == _normalized(goal.get("target_company"))
        )
        job_description = (
            str(analysis.get("job_description") or "")
            if same_opportunity and not analysis.get("used_general_role_expectations") else ""
        )
        request = CreateReferralRequest(
            employeeId=match["employee_id"], trustCardId=goal["trust_card_id"],
            targetRole=goal["target_role"], targetCompany=goal["target_company"],
            jobDescription=job_description, studentMessage=payload.studentMessage,
        )
        referral_service = self.directory_service
        quality = referral_service.quality(actor_id, request)
        if not quality["canSubmit"]:
            raise AIApplySubmissionError(
                "factual_integrity", "Remove unsupported or incorrect factual claims before submitting this request",
            )
        compatibility = referral_service.compatibility(actor_id, request)
        threshold = max(0, min(100, settings.ai_apply_default_min_compatibility))
        if int(compatibility["score"]) < threshold:
            raise AIApplySubmissionError(
                "compatibility_below_threshold", "This request is below the current AI Apply compatibility threshold",
            )
        safe_key = hashlib.sha256(payload.idempotencyKey.encode()).hexdigest()[:12]
        logger.info(
            "AI Apply submission attempt student=%s match=%s idempotency=%s score=%s threshold=%s",
            actor_id, payload.matchId, safe_key, compatibility["score"], threshold,
        )
        result = self.repository.submit_match({
            "p_student_id": actor_id, "p_match_id": str(payload.matchId),
            "p_idempotency_key": payload.idempotencyKey,
            "p_student_message": payload.studentMessage, "p_job_description": job_description,
            "p_compatibility_score": compatibility["score"],
            "p_compatibility_label": compatibility["label"],
            "p_compatibility_version": compatibility["scoreVersion"],
            "p_compatibility_payload": compatibility,
            "p_minimum_threshold": threshold,
            "p_weekly_cap": max(0, settings.ai_apply_weekly_request_cap),
            "p_initial_credit_balance": max(0, settings.ai_apply_initial_credit_balance),
            "p_rate_limit_count": max(1, settings.ai_apply_submission_rate_limit),
            "p_rate_window_seconds": max(60, settings.ai_apply_submission_rate_window_seconds),
        })
        if not result.get("ok"):
            raise AIApplySubmissionError(
                str(result.get("errorCode") or "no_eligible_employee"),
                str(result.get("message") or "This AI Apply request could not be created"),
            )
        result.pop("ok", None)
        return result

    def create(self, actor_id: str, payload: AIApplyGoalRequest) -> dict[str, Any]:
        self._require_student(actor_id)
        analysis, card = self._analysis_and_card(actor_id)
        minimum = payload.minimumCompatibility if payload.minimumCompatibility is not None else settings.ai_apply_default_min_compatibility
        minimum = max(0, min(100, int(minimum)))
        requested = min(payload.numberOfMatches, max(1, settings.ai_apply_max_matches), 10)
        input_key = _input_key(actor_id, analysis, card, payload, minimum)

        goal = self.repository.find_goal(actor_id, payload.idempotencyKey)
        if goal:
            run = self.repository.find_run(str(goal["id"]), MATCH_VERSION, input_key)
            if run:
                return self._response(goal, run, self.repository.list_matches(str(run["id"])))
            stored_goal_matches = (
                _normalized(goal.get("target_role")) == _normalized(payload.targetRole)
                and _normalized(goal.get("target_company")) == _normalized(payload.targetCompany)
                and _normalized(goal.get("preferred_department")) == _normalized(payload.preferredDepartment)
                and goal.get("timeline") == payload.timeline
                and _normalized(goal.get("location")) == _normalized(payload.location)
                and goal.get("work_mode") == payload.workMode
                and int(goal.get("minimum_compatibility", minimum)) == minimum
                and int(goal.get("requested_match_count", requested)) == requested
            )
            if not stored_goal_matches:
                raise AIApplyError("This idempotency key was already used for a different AI Apply goal")
        else:
            goal = self.repository.create_goal({
                "student_id": actor_id, "analysis_id": analysis["id"], "trust_card_id": card["id"],
                "target_role": payload.targetRole, "target_company": payload.targetCompany,
                "preferred_department": payload.preferredDepartment, "timeline": payload.timeline,
                "location": payload.location, "work_mode": payload.workMode,
                "minimum_compatibility": minimum, "requested_match_count": requested,
                "idempotency_key": payload.idempotencyKey,
            })

        employees = self.directory_service.employee_directory(actor_id)
        duplicate_keys = self._duplicate_keys(self.repository.list_student_requests(actor_id))
        eligible: list[dict[str, Any]] = []
        excluded_reasons: list[str] = []
        for employee in employees:
            eligibility = self._eligibility(employee, payload, duplicate_keys)
            if eligibility.eligible:
                eligible.append(employee)
            elif eligibility.reason:
                excluded_reasons.append(eligibility.reason)

        card_payload = card.get("payload") or {}
        goal_context = self._goal_context(payload, card_payload)
        same_opportunity = (
            _normalized(analysis.get("target_role")) == _normalized(payload.targetRole)
            and _normalized(analysis.get("target_company")) == _normalized(payload.targetCompany)
        )
        job_description = (
            str(analysis.get("job_description") or "")
            if same_opportunity and not analysis.get("used_general_role_expectations") else ""
        )
        ranked: list[dict[str, Any]] = []
        vector_successes = 0
        vector_failures = 0
        for employee in eligible:
            compatibility = calculate_referral_compatibility(
                _employee_for_score(employee), {**card_payload, "_available": True}, {
                    "target_role": payload.targetRole, "target_company": payload.targetCompany,
                    "job_description": job_description, "student_message": "",
                },
            )
            if compatibility["score"] < minimum:
                excluded_reasons.append("Employee compatibility was below the selected minimum")
                continue
            semantic: float | None = None
            employee_context = self._employee_context(employee)
            if employee_context and goal_context:
                try:
                    semantic = self.semantic_matcher.similarity(
                        f"ai-apply-{actor_id}-{goal['id']}-{employee['id']}", employee_context, goal_context,
                    )
                    vector_successes += 1
                except Exception:
                    vector_failures += 1
            else:
                vector_failures += 1
            ranking_score = round(
                compatibility["score"] * 0.95 + semantic * 0.05 if semantic is not None else compatibility["score"], 2,
            )
            semantic_basis = (
                "ChromaDB compared the goal context with the employee's approved directory roles, company and departments. "
                "The normalized cosine similarity contributes 5% to ranking only."
                if semantic is not None else
                "Vector matching was unavailable; ranking used the existing deterministic compatibility score only."
            )
            ranked.append({
                "employee": employee, "compatibility": compatibility, "semantic": semantic,
                "ranking_score": ranking_score, "semantic_basis": semantic_basis,
            })

        ranked.sort(key=lambda item: (-item["ranking_score"], -item["compatibility"]["score"], _normalized(item["employee"].get("name"))))
        selected = ranked[:requested]
        if not eligible:
            vector_status = "not_used"
        elif vector_successes and not vector_failures:
            vector_status = "available"
        elif vector_successes:
            vector_status = "partial"
        else:
            vector_status = "unavailable"
        limitations = [
            "AI Apply ranks appropriate employees for student review; it does not predict acceptance or hiring.",
            "No referral request was created or sent by this match run.",
        ]
        if vector_status in {"partial", "unavailable"}:
            limitations.append("ChromaDB was unavailable for some or all candidates; deterministic compatibility remained the ranking fallback.")
        if not selected:
            limitations.append("No eligible employee met the selected deterministic compatibility threshold.")

        match_rows = []
        for index, item in enumerate(selected, start=1):
            employee = item["employee"]
            compatibility = item["compatibility"]
            reason = {
                "positiveFactors": compatibility["positiveFactors"][:5],
                "cautions": compatibility["missingOrConflictingFactors"][:5],
                "semanticBasis": item["semantic_basis"],
                "limitations": compatibility["limitations"],
            }
            employee_snapshot = {
                "id": employee["id"], "name": employee.get("name") or "Employee",
                "company": employee.get("company"), "designation": employee.get("designation"),
                "department": employee.get("department"),
                "supportedRoles": employee.get("supportedRoles") or [],
                "supportedDepartments": employee.get("supportedDepartments") or [],
                "availability": "accepting",
            }
            match_rows.append({
                "student_id": actor_id, "employee_id": employee["id"], "rank": index,
                "compatibility_score": compatibility["score"], "compatibility_label": compatibility["label"],
                "compatibility_version": compatibility["scoreVersion"],
                "semantic_similarity": item["semantic"], "ranking_score": item["ranking_score"],
                "relevance_source": "goal_context" if item["semantic"] is not None else "deterministic_fallback",
                "compatibility_snapshot": compatibility, "reason_snapshot": reason,
                "employee_snapshot": employee_snapshot,
            })

        run, stored_matches = self.repository.create_run({
            "goal_id": goal["id"], "student_id": actor_id, "match_version": MATCH_VERSION,
            "input_key": input_key, "minimum_compatibility": minimum,
            "requested_match_count": requested, "eligible_employee_count": len(ranked),
            "excluded_employee_count": len(employees) - len(ranked), "vector_status": vector_status,
            "limitations": limitations,
            "exclusion_reasons": [
                {"reason": reason, "count": count}
                for reason, count in sorted(Counter(excluded_reasons).items())
            ],
        }, match_rows)
        return self._response(goal, run, stored_matches)
