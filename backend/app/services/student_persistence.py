from __future__ import annotations

from typing import Any, Protocol

from app.db.supabase_client import supabase
from app.services.trust_card_engine import build_match_analysis


class StudentPersistenceError(Exception):
    pass


class StudentAnalysisNotFound(StudentPersistenceError):
    pass


class StudentProfileForbidden(StudentPersistenceError):
    pass


class StudentPersistenceRepository(Protocol):
    def save_analysis(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def latest_analysis(self, student_id: str) -> dict[str, Any] | None: ...
    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...
    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...
    def get_role(self, user_id: str) -> str | None: ...
    def get_auth_metadata(self, user_id: str) -> dict[str, Any]: ...
    def get_student_education(self, student_id: str) -> dict[str, Any] | None: ...
    def upsert_student_education(self, student_id: str, values: dict[str, Any]) -> dict[str, Any]: ...


class SupabaseStudentPersistenceRepository:
    def get_role(self, user_id: str) -> str | None:
        rows = supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute().data or []
        return rows[0].get("role") if rows else None

    def get_auth_metadata(self, user_id: str) -> dict[str, Any]:
        try:
            response = supabase.auth.admin.get_user_by_id(user_id)
            return (response.user.user_metadata or {}) if response.user else {}
        except Exception:
            return {}

    def get_student_education(self, student_id: str) -> dict[str, Any] | None:
        try:
            rows = (
                supabase.table("student_profiles")
                .select("profile_id,college,degree,branch,graduation_year,preferred_role,preferred_company,skills,bio,linkedin,github,portfolio")
                .eq("profile_id", student_id).limit(1).execute().data or []
            )
        except Exception as exc:
            raise StudentPersistenceError("Student profile database read failed") from exc
        return rows[0] if rows else None

    def upsert_student_education(self, student_id: str, values: dict[str, Any]) -> dict[str, Any]:
        payload = {"profile_id": student_id, **values}
        try:
            rows = supabase.table("student_profiles").upsert(payload, on_conflict="profile_id").execute().data or []
        except Exception as exc:
            raise StudentPersistenceError("Student profile database write failed") from exc
        if not rows: raise StudentPersistenceError("Student education was not persisted")
        return rows[0]

    def save_analysis(self, values: dict[str, Any]) -> dict[str, Any]:
        try:
            rows = (
                supabase.table("resume_analyses")
                .upsert(values, on_conflict="student_id,resume_id")
                .execute().data or []
            )
        except Exception as exc:
            raise StudentPersistenceError("Resume analysis database write failed") from exc
        if not rows:
            raise StudentPersistenceError("Resume analysis was not persisted")
        return rows[0]

    def latest_analysis(self, student_id: str) -> dict[str, Any] | None:
        try:
            rows = (
                supabase.table("resume_analyses").select("*")
                .eq("student_id", student_id).order("updated_at", desc=True).limit(1)
                .execute().data or []
            )
        except Exception as exc:
            raise StudentPersistenceError("Latest resume analysis database read failed") from exc
        return rows[0] if rows else None

    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        try:
            rows = (
                supabase.table("resume_analyses").select("*")
                .eq("id", analysis_id).eq("student_id", student_id).limit(1)
                .execute().data or []
            )
        except Exception as exc:
            raise StudentPersistenceError("Resume analysis database read failed") from exc
        return rows[0] if rows else None

    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        try:
            rows = (
                supabase.table("trust_cards").select("*")
                .eq("student_id", student_id).eq("analysis_id", analysis_id)
                .order("created_at", desc=True).limit(1).execute().data or []
            )
        except Exception as exc:
            raise StudentPersistenceError("Trust Card database read failed") from exc
        return rows[0] if rows else None


class StudentPersistenceService:
    def __init__(self, repository: StudentPersistenceRepository | None = None):
        self.repository = repository or SupabaseStudentPersistenceRepository()

    def save_analysis(self, student_id: str, request: Any, result: dict[str, Any]) -> dict[str, Any]:
        context = (
            request.resumeId, request.fileName, request.chunkCount, request.storageStatus,
            request.indexed, request.uploadProcessingTimeMs, request.targetRole, request.targetCompany,
        )
        if not all(value is not None for value in context):
            raise StudentPersistenceError("Resume analysis persistence context is incomplete")
        row = self.repository.save_analysis({
            "student_id": student_id,
            "resume_id": request.resumeId,
            "file_name": request.fileName,
            "storage_path": request.storagePath,
            "storage_status": request.storageStatus,
            "resume_text": request.resumeText,
            "target_role": request.targetRole.strip(),
            "target_company": request.targetCompany.strip(),
            "job_description": request.jobDescription,
            "upload_payload": {
                "resumeId": request.resumeId, "fileName": request.fileName,
                "chunkCount": request.chunkCount, "preview": request.resumeText,
                "extractionStatus": "complete", "analysisStatus": "pending",
                "storagePath": request.storagePath, "storageStatus": request.storageStatus,
                "indexed": request.indexed, "processingTimeMs": request.uploadProcessingTimeMs,
            },
            "analysis_payload": result,
        })
        return {**result, "analysisId": row["id"]}

    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any]:
        row = self.repository.get_analysis(student_id, analysis_id)
        if not row:
            raise StudentAnalysisNotFound("Persisted resume analysis was not found")
        return row

    @staticmethod
    def _education(row: dict[str, Any] | None, metadata: dict[str, Any]) -> dict[str, Any]:
        row = row or {}
        return {
            "college": row.get("college") or metadata.get("college") or None,
            "degree": row.get("degree") or metadata.get("degree") or None,
            "branch": row.get("branch") or metadata.get("branch") or None,
            "graduationYear": row.get("graduation_year") or metadata.get("graduation_year") or None,
        }

    @classmethod
    def _profile(cls, row: dict[str, Any] | None, metadata: dict[str, Any]) -> dict[str, Any]:
        row = row or {}
        metadata_skills = metadata.get("skills")
        if not isinstance(metadata_skills, list):
            metadata_skills = [item.strip() for item in str(metadata_skills or "").split(",") if item.strip()]
        return {
            **cls._education(row, metadata),
            "preferredRole": row.get("preferred_role") or metadata.get("preferred_role") or None,
            "preferredCompany": row.get("preferred_company") or metadata.get("preferred_company") or None,
            "skills": row.get("skills") if isinstance(row.get("skills"), list) else metadata_skills,
            "bio": row.get("bio") or metadata.get("bio") or None,
            "linkedinUrl": row.get("linkedin") or metadata.get("linkedin_url") or None,
            "githubUrl": row.get("github") or metadata.get("github_url") or None,
            "portfolioUrl": row.get("portfolio") or metadata.get("portfolio_url") or None,
        }

    def get_profile(self, student_id: str) -> dict[str, Any]:
        if self.repository.get_role(student_id) != "student": raise StudentProfileForbidden("Student access is required")
        return self._profile(self.repository.get_student_education(student_id), self.repository.get_auth_metadata(student_id))

    def save_profile(self, student_id: str, update: Any) -> dict[str, Any]:
        if self.repository.get_role(student_id) != "student": raise StudentProfileForbidden("Student access is required")
        clean = lambda value: value.strip() if isinstance(value, str) and value.strip() else None
        values = {
            "college": clean(update.college),
            "degree": clean(update.degree),
            "branch": clean(update.branch),
            "graduation_year": update.graduationYear or None,
            "preferred_role": clean(update.preferredRole),
            "preferred_company": clean(update.preferredCompany),
            "skills": [skill.strip() for skill in update.skills if skill.strip()],
            "bio": clean(update.bio),
            "linkedin": clean(update.linkedinUrl),
            "github": clean(update.githubUrl),
            "portfolio": clean(update.portfolioUrl),
        }
        row = self.repository.upsert_student_education(student_id, values)
        return self._profile(row, self.repository.get_auth_metadata(student_id))

    def get_education(self, student_id: str) -> dict[str, Any]:
        if self.repository.get_role(student_id) != "student": raise StudentProfileForbidden("Student access is required")
        return self._education(self.repository.get_student_education(student_id), self.repository.get_auth_metadata(student_id))

    def save_education(self, student_id: str, update: Any) -> dict[str, Any]:
        if self.repository.get_role(student_id) != "student": raise StudentProfileForbidden("Student access is required")
        clean = lambda value: value.strip() if isinstance(value, str) and value.strip() else None
        values = {
            "college": clean(update.college),
            "degree": clean(update.degree),
            "branch": clean(update.branch),
            "graduation_year": update.graduationYear or None,
        }
        row = self.repository.upsert_student_education(student_id, values)
        return self._education(row, self.repository.get_auth_metadata(student_id))

    def latest_session(self, student_id: str) -> dict[str, Any] | None:
        row = self.repository.latest_analysis(student_id)
        if not row:
            return None
        analysis = row["analysis_payload"]
        required_dynamic_fields = {"weaknesses", "scoreReasons", "atsGuidance", "interviewReadiness"}
        if not required_dynamic_fields.issubset(analysis):
            dynamic = build_match_analysis(
                row["resume_text"], row["job_description"], row.get("target_role"),
            )
            analysis = {
                **analysis,
                **{field: dynamic[field] for field in required_dynamic_fields},
            }
        card = self.repository.latest_trust_card(student_id, str(row["id"]))
        trust_card = None
        if card:
            payload = {
                **card["payload"],
                "weaknesses": card["payload"].get("weaknesses", analysis["weaknesses"]),
                "scoreReasons": card["payload"].get("scoreReasons", analysis["scoreReasons"]),
            }
            education = payload.get("education") or {
                "college": None, "degree": None, "branch": None, "graduationYear": None,
            }
            try:
                education = self.get_education(student_id)
            except Exception:
                # The generated card remains readable if optional profile enrichment
                # is temporarily unavailable.
                pass
            trust_card = {"id": card["id"], **payload, "education": education}
        return {
            "analysisId": row["id"], "upload": row["upload_payload"],
            "matchScore": {key: analysis[key] for key in ("overall", "roleFit", "proof", "gaps")},
            "analysis": {**analysis, "analysisId": row["id"]},
            "trustCard": trust_card,
            "jobDescription": row["job_description"], "role": row["target_role"],
            "company": row["target_company"], "analyzedAt": row["updated_at"],
            "processingTimeMs": row["upload_payload"]["processingTimeMs"] + analysis["processingTimeMs"],
        }
