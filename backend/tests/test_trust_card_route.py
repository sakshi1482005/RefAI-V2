from uuid import uuid4
import unittest

from fastapi.testclient import TestClient

from app.api.routes import trust_card
from app.core.security import get_current_user
from app.main import app
from app.services.referral_requests import ReferralError
from app.services.student_persistence import StudentAnalysisNotFound, StudentPersistenceError
from app.services.trust_card_cache import build_trust_card_input_metadata


def generated_card():
    return {
        "candidateName": "Student One",
        "role": "Software Engineer",
        "overallMatch": 78,
        "roleFit": 80,
        "proofScore": 76,
        "gapScore": 22,
        "confidence": 84,
        "trustScore": 79,
        "scoreVersion": "trust-score-v2",
        "referralReadiness": "Ready to request referral",
        "recommendation": "Ready for referral",
        "strengths": ["Python project evidence"],
        "weaknesses": ["AWS evidence is missing"],
        "missingSkills": ["AWS"],
        "missingRequirements": [],
        "actionPlan": [],
        "evidence": ["Built a Python API"],
        "riskSignals": ["Cloud evidence is missing"],
        "scoreFormula": "weighted deterministic formula",
        "scoreBreakdown": [{
            "key": "match",
            "label": "Overall Match",
            "weight": 20,
            "score": 78,
            "maximumScore": 20,
            "basisPercentage": 78,
            "contribution": 15.6,
            "reason": "Resume evidence matches the target role.",
            "details": {},
            "evidenceItems": [{
                "id": "EV-ROUTE0001", "status": "Resume supported",
                "factLabel": "Python API project", "snippet": "Built a Python API",
                "resumeSection": "Projects",
                "whyItAffectsScore": "This line supports the deterministic evidence tier.",
                "sourceType": "resume",
            }],
            "formulaOrBasis": "Weighted requirement coverage.",
            "evidenceFound": ["Python project evidence"],
            "evidenceMissing": [],
            "improvementAction": "Preserve the project evidence.",
            "potentialImprovementPoints": 4,
            "limitation": "Lexical evidence only.",
        }],
        "scoreReasons": ["Overall Match is derived from Role Fit and Proof."],
        "aiSummary": "The candidate has relevant project evidence.",
    }


class PersistenceStub:
    def __init__(self, analysis_id, missing=False, unavailable=False, education_unavailable=False, existing_card=None):
        self.analysis_id = analysis_id
        self.missing = missing
        self.unavailable = unavailable
        self.education_unavailable = education_unavailable
        self.existing_card = existing_card
        self.analysis = {
            "id": analysis_id,
            "target_role": "Software Engineer",
            "target_company": "RefAI",
            "resume_text": "Python API project evidence",
            "job_description": "Build Python APIs and deploy services with AWS",
            "analysis_payload": {},
        }

    def get_analysis(self, student_id, analysis_id):
        if self.unavailable:
            raise StudentPersistenceError("database unavailable")
        if self.missing or analysis_id != self.analysis_id:
            raise StudentAnalysisNotFound("not found")
        return self.analysis

    def latest_trust_card(self, student_id, analysis_id):
        return self.existing_card if analysis_id == self.analysis_id else None

    def get_education(self, student_id):
        if self.education_unavailable:
            raise StudentPersistenceError("profile unavailable")
        return {"college": "RefAI College", "degree": "B.Tech", "branch": "CS", "graduationYear": 2028}


class ReferralStub:
    def __init__(self, fail=False):
        self.fail = fail
        self.saved = None
        self.save_count = 0

    def persist_trust_card(self, student_id, payload, analysis_id):
        if self.fail:
            raise ReferralError("database write failed")
        self.saved = (student_id, payload, analysis_id)
        self.save_count += 1
        return {"id": str(uuid4())}


class TrustCardRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.student_id = str(uuid4())
        self.analysis_id = str(uuid4())
        app.dependency_overrides[get_current_user] = lambda: {"sub": self.student_id}
        self.original_persistence = trust_card.persistence_service
        self.original_referral = trust_card.referral_service
        self.original_builder = trust_card.build_trust_card
        self.build_calls = 0
        def build(**_):
            self.build_calls += 1
            return generated_card()
        trust_card.build_trust_card = build

    def tearDown(self):
        app.dependency_overrides.clear()
        trust_card.persistence_service = self.original_persistence
        trust_card.referral_service = self.original_referral
        trust_card.build_trust_card = self.original_builder

    def test_authenticated_student_generates_and_persists_complete_card(self):
        persistence = PersistenceStub(self.analysis_id)
        referral = ReferralStub()
        trust_card.persistence_service = persistence
        trust_card.referral_service = referral

        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id, "candidateName": "Student One"},
            headers={"Authorization": "Bearer test"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["trustScore"], 79)
        self.assertEqual(response.json()["scoreBreakdown"][0]["evidenceItems"][0]["resumeSection"], "Projects")
        self.assertEqual(response.json()["education"]["college"], "RefAI College")
        self.assertEqual(referral.saved[0], self.student_id)
        self.assertEqual(referral.saved[2], self.analysis_id)

    def test_missing_analysis_is_not_reported_as_connectivity_failure(self):
        trust_card.persistence_service = PersistenceStub(self.analysis_id, missing=True)
        trust_card.referral_service = ReferralStub()
        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Persisted resume analysis was not found.")

    def test_analysis_database_failure_returns_safe_service_error(self):
        trust_card.persistence_service = PersistenceStub(self.analysis_id, unavailable=True)
        trust_card.referral_service = ReferralStub()
        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("could not be loaded", response.json()["detail"])

    def test_save_failure_returns_json_instead_of_crashing(self):
        trust_card.persistence_service = PersistenceStub(self.analysis_id)
        trust_card.referral_service = ReferralStub(fail=True)
        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "The Trust Card could not be saved. Please retry.")

    def test_optional_education_failure_does_not_discard_generated_card(self):
        trust_card.persistence_service = PersistenceStub(self.analysis_id, education_unavailable=True)
        trust_card.referral_service = ReferralStub()
        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["education"]["college"])

    def test_valid_persisted_card_is_returned_without_regeneration(self):
        persistence = PersistenceStub(self.analysis_id)
        card_payload = {
            **generated_card(),
            **build_trust_card_input_metadata(persistence.analysis),
            "education": {"college": "Saved College", "degree": None, "branch": None, "graduationYear": None},
        }
        persistence.existing_card = {"id": str(uuid4()), "payload": card_payload}
        referral = ReferralStub()
        trust_card.persistence_service = persistence
        trust_card.referral_service = referral

        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id, "candidateName": "Student One"},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["inputKey"], card_payload["inputKey"])
        self.assertEqual(self.build_calls, 0)
        self.assertEqual(referral.save_count, 0)

        current = self.client.get(
            f"/trust-card/current?analysisId={self.analysis_id}",
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(current.status_code, 200)
        self.assertEqual(self.build_calls, 0)

    def test_explicit_regeneration_rebuilds_a_valid_persisted_card(self):
        persistence = PersistenceStub(self.analysis_id)
        persistence.existing_card = {
            "id": str(uuid4()),
            "payload": {**generated_card(), **build_trust_card_input_metadata(persistence.analysis)},
        }
        referral = ReferralStub()
        trust_card.persistence_service = persistence
        trust_card.referral_service = referral
        response = self.client.post(
            "/trust-card/generate",
            json={"analysisId": self.analysis_id, "candidateName": "Student One", "forceRegenerate": True},
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.build_calls, 1)
        self.assertEqual(referral.save_count, 1)

    def test_another_student_cannot_read_the_persisted_card(self):
        owner_id = self.student_id
        persistence = PersistenceStub(self.analysis_id)
        persistence.existing_card = {
            "id": str(uuid4()),
            "payload": {**generated_card(), **build_trust_card_input_metadata(persistence.analysis)},
        }
        original_get_analysis = persistence.get_analysis
        def owner_scoped(student_id, analysis_id):
            if student_id != owner_id:
                raise StudentAnalysisNotFound("not found")
            return original_get_analysis(student_id, analysis_id)
        persistence.get_analysis = owner_scoped
        trust_card.persistence_service = persistence
        app.dependency_overrides[get_current_user] = lambda: {"sub": str(uuid4())}
        response = self.client.get(
            f"/trust-card/current?analysisId={self.analysis_id}",
            headers={"Authorization": "Bearer test"},
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
