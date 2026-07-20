from __future__ import annotations

from typing import Any, Protocol

from app.db.supabase_client import supabase


class StudentPersistenceError(Exception):
    pass


class StudentPersistenceRepository(Protocol):
    def save_analysis(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def latest_analysis(self, student_id: str) -> dict[str, Any] | None: ...
    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...
    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None: ...


class SupabaseStudentPersistenceRepository:
    def save_analysis(self, values: dict[str, Any]) -> dict[str, Any]:
        rows = (
            supabase.table("resume_analyses")
            .upsert(values, on_conflict="student_id,resume_id")
            .execute().data or []
        )
        if not rows:
            raise StudentPersistenceError("Resume analysis was not persisted")
        return rows[0]

    def latest_analysis(self, student_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("resume_analyses").select("*")
            .eq("student_id", student_id).order("created_at", desc=True).limit(1)
            .execute().data or []
        )
        return rows[0] if rows else None

    def get_analysis(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("resume_analyses").select("*")
            .eq("id", analysis_id).eq("student_id", student_id).limit(1)
            .execute().data or []
        )
        return rows[0] if rows else None

    def latest_trust_card(self, student_id: str, analysis_id: str) -> dict[str, Any] | None:
        rows = (
            supabase.table("trust_cards").select("*")
            .eq("student_id", student_id).eq("analysis_id", analysis_id)
            .order("created_at", desc=True).limit(1).execute().data or []
        )
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
            return result
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
            raise StudentPersistenceError("Persisted resume analysis was not found")
        return row

    def latest_session(self, student_id: str) -> dict[str, Any] | None:
        row = self.repository.latest_analysis(student_id)
        if not row:
            return None
        analysis = row["analysis_payload"]
        card = self.repository.latest_trust_card(student_id, str(row["id"]))
        return {
            "analysisId": row["id"], "upload": row["upload_payload"],
            "matchScore": {key: analysis[key] for key in ("overall", "roleFit", "proof", "gaps")},
            "analysis": {**analysis, "analysisId": row["id"]},
            "trustCard": ({"id": card["id"], **card["payload"]} if card else None),
            "jobDescription": row["job_description"], "role": row["target_role"],
            "company": row["target_company"], "analyzedAt": row["updated_at"],
            "processingTimeMs": row["upload_payload"]["processingTimeMs"] + analysis["processingTimeMs"],
        }
