from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
import unittest

from app.models.schemas import CreateReferralRequest
from app.services.referral_requests import ReferralRequestService
from app.services.student_persistence import StudentPersistenceService
from test_referral_requests import FakeRepository


class AnalysisRepository:
    def __init__(self, referral_repository):
        self.rows = {}
        self.referrals = referral_repository

    def save_analysis(self, values):
        existing = next((row for row in self.rows.values() if row["student_id"] == values["student_id"] and row["resume_id"] == values["resume_id"]), None)
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": existing["id"] if existing else str(uuid4()), "created_at": existing["created_at"] if existing else now, "updated_at": now, **values}
        self.rows[row["id"]] = row
        return row

    def latest_analysis(self, student_id):
        rows = [row for row in self.rows.values() if row["student_id"] == student_id]
        return sorted(rows, key=lambda row: row["created_at"], reverse=True)[0] if rows else None

    def get_analysis(self, student_id, analysis_id):
        row = self.rows.get(analysis_id)
        return row if row and row["student_id"] == student_id else None

    def latest_trust_card(self, student_id, analysis_id):
        cards = [card for card in self.referrals.cards.values() if card["student_id"] == student_id and card.get("analysis_id") == analysis_id]
        return cards[-1] if cards else None


class PersistedJourneyTests(unittest.TestCase):
    def test_student_logout_does_not_remove_employee_queue_candidate(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        persistence = StudentPersistenceService(analyses)
        upload = SimpleNamespace(
            resumeId="resume-1", fileName="resume.pdf", chunkCount=3,
            storagePath=f"{database.student}/resume-1.pdf", storageStatus="stored",
            indexed=True, uploadProcessingTimeMs=50, targetRole="Engineer",
            targetCompany="Acme", resumeText="Python API project evidence",
            jobDescription="Build Python APIs",
        )
        analysis = {
            "overall": 78, "roleFit": 82, "proof": 74, "gaps": 20,
            "analysisStatus": "complete", "matchedSkills": ["Python"], "missingSkills": [],
            "missingRequirements": [], "actionPlan": [], "strengths": ["API evidence"],
            "evidence": ["Python API project"], "resumeSectionsUsed": ["Projects"],
            "readinessSummary": "Prepared", "learningRecommendations": [],
            "confidence": 84, "processingTimeMs": 100,
        }
        saved = persistence.save_analysis(database.student, upload, analysis)
        analysis_id = str(saved["analysisId"])
        referrals = ReferralRequestService(database)
        card = referrals.persist_trust_card(database.student, {"trustScore": 80, "overallMatch": 78}, analysis_id)
        request = referrals.create(database.student, CreateReferralRequest(
            employeeId=database.employee, trustCardId=card["id"], targetRole="Engineer",
            targetCompany="Acme", jobDescription="Build Python APIs",
            studentMessage="Please review my persisted Trust Card.",
        ))

        # Simulate logout, browser restart, and Employee login: services are rebuilt,
        # while the database-backed repositories remain the source of truth.
        reloaded_student = StudentPersistenceService(analyses).latest_session(database.student)
        employee_queue = ReferralRequestService(database).employee_queue(database.employee)

        self.assertEqual(reloaded_student["analysisId"], saved["analysisId"])
        self.assertEqual(reloaded_student["trustCard"]["id"], card["id"])
        self.assertEqual(employee_queue[0]["id"], request["id"])
        self.assertEqual(employee_queue[0]["status"], "pending")


if __name__ == "__main__":
    unittest.main()
