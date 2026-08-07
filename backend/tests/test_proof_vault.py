from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import unittest

from pydantic import ValidationError

from app.models.schemas import ProofEntryInput
from app.services.referral_requests import ReferralForbidden, ReferralNotFound, ReferralRequestService


class ProofRepository:
    def __init__(self):
        self.student, self.other_student, self.employee, self.other_employee = [str(uuid4()) for _ in range(4)]
        self.card_id = str(uuid4())
        self.request_id = str(uuid4())
        self.roles = {self.student: "student", self.other_student: "student", self.employee: "employee", self.other_employee: "employee"}
        self.card = {"id": self.card_id, "student_id": self.student, "analysis_id": "analysis-1", "payload": {"matchedSkills": ["Python"]}}
        self.proofs = {}
        self.request = {"id": self.request_id, "student_id": self.student, "employee_id": self.employee, "trust_card_id": self.card_id}

    def get_role(self, user_id): return self.roles.get(user_id)
    def get_trust_card(self, trust_card_id): return self.card if trust_card_id == self.card_id else None
    def create_proof(self, values):
        now, proof_id = datetime.now(timezone.utc).isoformat(), str(uuid4())
        row = {"id": proof_id, "created_at": now, "updated_at": now, **values}
        self.proofs[proof_id] = row
        return row
    def get_proof(self, proof_id): return self.proofs.get(proof_id)
    def list_proofs(self, trust_card_id): return [row for row in self.proofs.values() if row["trust_card_id"] == trust_card_id]
    def update_proof(self, proof_id, values):
        self.proofs[proof_id].update(values)
        return self.proofs[proof_id]
    def delete_proof(self, proof_id): self.proofs.pop(proof_id, None)
    def get_request(self, request_id): return self.request if request_id == self.request_id else None
    def get_analysis(self, student_id, analysis_id):
        return {"resume_text": "Projects\nBuilt a Python API."} if student_id == self.student and analysis_id == "analysis-1" else None


class ProofVaultTests(unittest.TestCase):
    def setUp(self):
        self.repository = ProofRepository()
        self.service = ReferralRequestService(self.repository)

    def payload(self, **changes):
        values = {
            "trustCardId": self.repository.card_id,
            "proofType": "github_repository",
            "title": "API project",
            "urlOrReference": "https://github.com/student/project",
            "relatedSkillClaim": "Python",
        }
        values.update(changes)
        return ProofEntryInput(**values)

    def test_student_can_create_update_list_and_delete_own_proof(self):
        created = self.service.create_proof(self.repository.student, self.payload())
        self.assertEqual(len(self.service.list_student_proofs(self.repository.student, self.repository.card_id)), 1)
        updated = self.service.update_proof(self.repository.student, str(created["id"]), self.payload(title="Updated project"))
        self.assertEqual(updated["title"], "Updated project")
        self.service.delete_proof(self.repository.student, str(created["id"]))
        self.assertEqual(self.service.list_student_proofs(self.repository.student, self.repository.card_id), [])

    def test_student_cannot_mutate_another_students_proof(self):
        created = self.service.create_proof(self.repository.student, self.payload())
        with self.assertRaises(ReferralForbidden):
            self.service.update_proof(self.repository.other_student, str(created["id"]), self.payload())
        with self.assertRaises(ReferralForbidden):
            self.service.delete_proof(self.repository.other_student, str(created["id"]))

    def test_only_assigned_employee_can_view_referral_proof(self):
        self.service.create_proof(self.repository.student, self.payload())
        self.assertEqual(len(self.service.employee_request_proofs(self.repository.employee, self.repository.request_id)), 1)
        with self.assertRaises(ReferralForbidden):
            self.service.employee_request_proofs(self.repository.other_employee, self.repository.request_id)

    def test_claim_status_endpoints_reuse_student_ownership_and_employee_assignment(self):
        self.service.create_proof(self.repository.student, self.payload())
        self.assertEqual(self.service.student_claim_verifications(self.repository.student, self.repository.card_id)["claims"][0]["status"], "Evidence supported")
        self.assertEqual(self.service.employee_claim_verifications(self.repository.employee, self.repository.request_id)["claims"][0]["status"], "Evidence supported")
        with self.assertRaises(ReferralForbidden):
            self.service.employee_claim_verifications(self.repository.other_employee, self.repository.request_id)

    def test_removed_proof_returns_not_found_for_update(self):
        with self.assertRaises(ReferralNotFound):
            self.service.update_proof(self.repository.student, str(uuid4()), self.payload())

    def test_unsafe_protocols_are_rejected(self):
        for value in ("javascript:alert(1)", "data:text/html,bad", "file:///secret"):
            with self.assertRaises(ValidationError):
                self.payload(urlOrReference=value)

    def test_multiple_proofs_can_share_one_skill(self):
        self.service.create_proof(self.repository.student, self.payload(title="Repository"))
        self.service.create_proof(self.repository.student, self.payload(title="Demo", proofType="live_demo", urlOrReference="https://example.com/demo"))
        self.assertEqual(len(self.service.list_student_proofs(self.repository.student, self.repository.card_id)), 2)


class ProofVaultMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202607310001_proof_vault.sql"
        cls.sql = path.read_text(encoding="utf-8").lower()

    def test_private_owner_crud_and_assigned_employee_read_policies(self):
        self.assertIn("create table if not exists public.proof_entries", self.sql)
        self.assertIn("owner_id uuid not null references public.profiles(id) on delete cascade", self.sql)
        self.assertIn("trust_card_id uuid not null references public.trust_cards(id) on delete cascade", self.sql)
        self.assertIn("alter table public.proof_entries enable row level security", self.sql)
        for operation in ("select", "insert", "update", "delete"):
            self.assertIn(f"for {operation} to authenticated", self.sql)
        self.assertIn("rr.employee_id = auth.uid()", self.sql)
        self.assertIn("rr.trust_card_id = proof_entries.trust_card_id", self.sql)
        self.assertIn("revoke all on public.proof_entries from anon", self.sql)
        self.assertIn("javascript|data|file|vbscript|ftp", self.sql)
        self.assertNotIn("unique (owner_id, related_skill_claim)", self.sql)


if __name__ == "__main__":
    unittest.main()
