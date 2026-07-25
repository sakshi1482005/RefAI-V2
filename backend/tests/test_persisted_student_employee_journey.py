from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
import unittest

from app.models.schemas import CreateReferralRequest
from app.services.referral_requests import ReferralRequestService
from app.services.student_persistence import StudentPersistenceError, StudentPersistenceService
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

    def get_role(self, user_id): return self.referrals.get_role(user_id)
    def get_auth_metadata(self, user_id): return self.referrals.get_auth_metadata(user_id)
    def get_student_education(self, student_id): return self.referrals.get_student_education(student_id)
    def upsert_student_education(self, student_id, values):
        row = {"profile_id": student_id, **values}
        self.referrals.student_education[student_id] = row
        return row


class PersistedJourneyTests(unittest.TestCase):
    def test_analysis_success_requires_complete_persistence_context(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        incomplete = SimpleNamespace(
            resumeId=None, fileName=None, chunkCount=None, storagePath=None,
            storageStatus=None, indexed=None, uploadProcessingTimeMs=None,
            targetRole=None, targetCompany=None, resumeText="resume",
            jobDescription="job",
        )
        with self.assertRaises(StudentPersistenceError):
            StudentPersistenceService(analyses).save_analysis(database.student, incomplete, {})

    def test_latest_analysis_without_trust_card_does_not_require_profile_data(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        persistence = StudentPersistenceService(analyses)
        upload = SimpleNamespace(
            resumeId="resume-no-card", fileName="resume.pdf", chunkCount=2,
            storagePath=f"{database.student}/resume-no-card.pdf", storageStatus="stored",
            indexed=True, uploadProcessingTimeMs=20, targetRole="Engineer",
            targetCompany="Acme", resumeText="Python API project",
            jobDescription="Build Python APIs",
        )
        analysis = {
            "overall": 75, "roleFit": 80, "proof": 70, "gaps": 20,
            "analysisStatus": "complete", "matchedSkills": ["Python"], "missingSkills": [],
            "missingRequirements": [], "actionPlan": [], "strengths": ["Python evidence"],
            "evidence": ["Python API"], "resumeSectionsUsed": ["Projects"],
            "readinessSummary": "Prepared", "learningRecommendations": [],
            "confidence": 82, "processingTimeMs": 80,
        }
        saved = persistence.save_analysis(database.student, upload, analysis)
        analyses.get_student_education = lambda _: (_ for _ in ()).throw(AssertionError("Profile lookup was not expected"))
        latest = persistence.latest_session(database.student)
        self.assertEqual(str(latest["analysisId"]), str(saved["analysisId"]))
        self.assertEqual(latest["matchScore"]["overall"], 75)

    def test_complete_student_profile_upsert_is_reloaded_after_refresh(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        update = SimpleNamespace(
            college="RefAI College", degree="B.Tech", branch="Computer Science",
            graduationYear="2028", preferredRole="Software Engineer",
            preferredCompany="RefAI", skills=["Python", "React"], bio="Student builder",
            linkedinUrl="https://linkedin.com/in/student",
            githubUrl="https://github.com/student",
            portfolioUrl="https://student.example",
        )
        saved = StudentPersistenceService(analyses).save_profile(database.student, update)
        reloaded = StudentPersistenceService(analyses).get_profile(database.student)
        self.assertEqual(saved, reloaded)
        self.assertEqual(reloaded["college"], "RefAI College")
        self.assertEqual(reloaded["skills"], ["Python", "React"])
        self.assertEqual(reloaded["preferredRole"], "Software Engineer")
        self.assertEqual(list(database.student_education), [database.student])

    def test_student_education_upsert_is_reloaded_from_profile_id(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        education = SimpleNamespace(college="RefAI College", degree="B.Tech", branch="Computer Science", graduationYear="2027")
        saved = StudentPersistenceService(analyses).save_education(database.student, education)
        reloaded = StudentPersistenceService(analyses).get_education(database.student)
        self.assertEqual(saved, reloaded)
        self.assertEqual(reloaded["branch"], "Computer Science")
        self.assertEqual(list(database.student_education), [database.student])

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
