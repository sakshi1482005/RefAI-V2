from datetime import datetime, timedelta, timezone
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import trust_card
from app.core.security import get_current_user
from app.main import app
from app.services.trust_passport import PassportForbidden, PassportNotFound, TrustPassportService


class Repository:
    def __init__(self):
        self.card = {"id": "card-1", "student_id": "student-1", "payload": {
            "candidateName": "Ada Candidate", "role": "Backend Engineer", "trustScore": 82,
            "scoreVersion": "trust-score-v2", "matchedSkills": ["Python", "FastAPI"],
            "analysisReliability": {"label": "High reliability", "basis": "Resume parsed", "limitations": "No JD"},
            "scoreBreakdown": [{"evidenceItems": [
                {"status": "Resume supported", "factLabel": "Built a FastAPI service", "snippet": "private resume text"},
                {"status": "Self-declared", "factLabel": "Leadership"},
            ]}],
        }, "created_at": "2026-08-11T00:00:00+00:00"}
        self.row = None; self.events = []; self.accesses = 0
    def get_role(self, user_id): return "student" if user_id == "student-1" else "employee"
    def get_owned_card(self, user_id, card_id): return self.card if user_id == "student-1" and card_id == self.card["id"] else None
    def get_active(self, user_id, card_id): return self.row if self.row and self.row.get("revoked_at") is None else None
    def revoke_active(self, user_id, card_id):
        if self.row: self.row.update({"enabled": False, "revoked_at": datetime.now(timezone.utc).isoformat()})
    def create(self, values):
        self.row = {"id": "passport-1", "created_at": datetime.now(timezone.utc).isoformat(), "access_count": 0, "revoked_at": None, "trust_card": self.card, **values}
        return self.row
    def get_public(self, token_hash): return self.row if self.row and self.row["token_hash"] == token_hash else None
    def record_event(self, passport_id, event, actor_id=None): self.events.append((passport_id, event, actor_id))
    def mark_access(self, passport_id): self.accesses += 1


class TrustPassportTests(TestCase):
    def setUp(self): self.repo = Repository(); self.service = TrustPassportService(self.repo)

    @patch("app.services.trust_passport.secrets.token_urlsafe", return_value="a" * 43)
    def test_owner_can_create_only_allowlisted_public_projection(self, _token):
        issued = self.service.create("student-1", "card-1", ["role", "scores", "evidence", "reliability"], 30)
        public = self.service.public(issued["shareToken"])
        self.assertEqual(public["targetRole"], "Backend Engineer")
        self.assertEqual(public["trustScore"], 82)
        self.assertEqual(public["verifiedEvidenceCount"], 1)
        self.assertNotIn("candidateName", public)
        self.assertNotIn("private resume text", str(public))
        self.assertNotIn("student_id", public)
        self.assertEqual(self.repo.accesses, 1)
        self.assertIn(("passport-1", "accessed", None), self.repo.events)

    def test_non_owner_cannot_manage_passport(self):
        with self.assertRaises(PassportForbidden): self.service.create("employee-1", "card-1", ["role"], 30)

    @patch("app.services.trust_passport.secrets.token_urlsafe", return_value="b" * 43)
    def test_revoked_link_cannot_be_read(self, _token):
        issued = self.service.create("student-1", "card-1", ["role"], 30)
        self.service.revoke("student-1", "card-1")
        with self.assertRaises(PassportNotFound): self.service.public(issued["shareToken"])

    @patch("app.services.trust_passport.secrets.token_urlsafe", return_value="c" * 43)
    def test_expired_link_cannot_be_read(self, _token):
        issued = self.service.create("student-1", "card-1", ["role"], 1)
        self.repo.row["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        with self.assertRaises(PassportNotFound): self.service.public(issued["shareToken"])

    @patch("app.services.trust_passport.secrets.token_urlsafe", side_effect=["d" * 43, "e" * 43])
    def test_regeneration_revokes_previous_token(self, _tokens):
        first = self.service.create("student-1", "card-1", ["role"], 30)
        second = self.service.create("student-1", "card-1", ["scores"], 30)
        with self.assertRaises(PassportNotFound): self.service.public(first["shareToken"])
        self.assertEqual(self.service.public(second["shareToken"])["trustScore"], 82)


class TrustPassportRouteTests(TestCase):
    def setUp(self):
        self.client = TestClient(app); self.card_id = str(uuid4())
        self.original = trust_card.passport_service
        self.repo = Repository(); self.repo.card["id"] = self.card_id
        self.service = TrustPassportService(self.repo)
        trust_card.passport_service = self.service
        app.dependency_overrides[get_current_user] = lambda: {"sub": "student-1"}

    def tearDown(self):
        trust_card.passport_service = self.original
        app.dependency_overrides.clear()

    def test_public_route_has_no_auth_requirement_and_owner_route_requires_student(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "employee-1"}
        denied = self.client.post("/trust-card/passport", json={"trustCardId": self.card_id, "visibility": ["role"]})
        self.assertEqual(denied.status_code, 403)
        unavailable = self.client.get("/trust-card/passport/public/short")
        self.assertEqual(unavailable.status_code, 404)
