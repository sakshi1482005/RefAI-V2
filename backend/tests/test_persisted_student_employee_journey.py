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

    def analysis_history(self, student_id):
        rows = [row for row in self.rows.values() if row["student_id"] == student_id]
        return sorted(rows, key=lambda row: row["created_at"], reverse=True)

    def get_role(self, user_id): return self.referrals.get_role(user_id)
    def get_auth_metadata(self, user_id): return self.referrals.get_auth_metadata(user_id)
    def get_student_education(self, student_id): return self.referrals.get_student_education(student_id)
    def upsert_student_education(self, student_id, values):
        row = {"profile_id": student_id, **values}
        self.referrals.student_education[student_id] = row
        return row


class PersistedJourneyTests(unittest.TestCase):
    def test_improvement_simulator_compares_only_same_opportunity_and_score_version(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        definitions = [
            ("roleRequirementMatch", "Role Requirement Match", 30),
            ("evidenceStrength", "Evidence Strength", 25),
            ("projectExperienceRelevance", "Project and Experience Relevance", 20),
            ("skillDepth", "Skill Depth", 15),
            ("resumeEvidenceCompleteness", "Resume Evidence Completeness", 10),
        ]
        def payload(scores, version="trust-score-v4"):
            return {"trustScore": sum(scores), "scoreVersion": version, "scoreBreakdown": [
                {"key": key, "label": label, "score": score, "maximumScore": maximum,
                 "potentialImprovementPoints": maximum - score, "evidenceMissing": [f"Missing {label}"],
                 "evidenceFound": [f"Evidence {label}"], "improvementAction": f"Add truthful {label} evidence."}
                for (key, label, maximum), score in zip(definitions, scores)
            ]}
        old_id, wrong_id, current_id = [str(uuid4()) for _ in range(3)]
        base = {"student_id": database.student, "target_role": "Backend Engineer", "target_company": "Acme"}
        analyses.rows[old_id] = {"id": old_id, "created_at": "2026-01-01T00:00:00Z", **base}
        analyses.rows[wrong_id] = {"id": wrong_id, "created_at": "2026-02-01T00:00:00Z", **base, "target_company": "Other Co"}
        analyses.rows[current_id] = {"id": current_id, "created_at": "2026-03-01T00:00:00Z", **base}
        database.cards = {
            "old": {"id": "old", "student_id": database.student, "analysis_id": old_id, "payload": payload((18, 12, 8, 6, 6))},
            "wrong": {"id": "wrong", "student_id": database.student, "analysis_id": wrong_id, "payload": payload((30, 25, 20, 15, 10))},
            "current": {"id": "current", "student_id": database.student, "analysis_id": current_id, "payload": payload((22, 17, 12, 8, 7))},
        }
        result = StudentPersistenceService(analyses).improvement_simulator(database.student)
        self.assertEqual(result["comparison"]["previousScore"], 50)
        self.assertEqual(result["comparison"]["currentScore"], 66)

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

    def test_real_job_description_and_analysis_context_are_persisted(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        job = "Python and FastAPI are required. Build and maintain REST APIs with unit tests and collaborate with product teams."
        request = SimpleNamespace(
            resumeId="resume-jd", fileName="resume.pdf", chunkCount=2,
            storagePath=f"{database.student}/resume-jd.pdf", storageStatus="stored",
            indexed=True, uploadProcessingTimeMs=10, targetRole="Backend Engineer",
            targetCompany="RefAI", resumeText="Python FastAPI project", jobDescription=job,
        )
        result = {
            "processingTimeMs": 20,
            "jobDescriptionClassification": {
                "requiredSkills": ["Python", "FastAPI"], "preferredSkills": [],
                "responsibilities": ["Build and maintain REST APIs with unit tests"],
                "experienceExpectations": [], "educationOrCertificationExpectations": [],
            },
            "usedGeneralRoleExpectations": False,
        }
        StudentPersistenceService(analyses).save_analysis(database.student, request, result)
        row = next(iter(analyses.rows.values()))
        self.assertEqual(row["job_description"], job)
        self.assertFalse(row["used_general_role_expectations"])
        self.assertEqual(row["job_description_classification"]["requiredSkills"], ["Python", "FastAPI"])

    def test_general_role_context_is_persisted_for_downstream_features(self):
        database = FakeRepository()
        analyses = AnalysisRepository(database)
        request = SimpleNamespace(
            resumeId="resume-general", fileName="resume.pdf", chunkCount=2,
            storagePath=f"{database.student}/resume-general.pdf", storageStatus="stored",
            indexed=True, uploadProcessingTimeMs=10, targetRole="Backend Engineer",
            targetCompany="RefAI", resumeText="Python API project", jobDescription="",
        )
        context = "General expectations for an early-career Backend Engineer role include REST APIs, SQL, unit testing, debugging and troubleshooting."
        result = {
            "processingTimeMs": 20, "jobDescriptionClassification": {
                "requiredSkills": ["REST APIs", "SQL"], "preferredSkills": [],
                "responsibilities": [], "experienceExpectations": [],
                "educationOrCertificationExpectations": [],
            }, "usedGeneralRoleExpectations": True,
        }
        StudentPersistenceService(analyses).save_analysis(
            database.student, request, result, effective_job_description=context,
        )
        row = next(iter(analyses.rows.values()))
        self.assertEqual(row["job_description"], context)
        self.assertTrue(row["used_general_role_expectations"])

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
        self.assertEqual(employee_queue[0]["status"], "submitted")


if __name__ == "__main__":
    unittest.main()
