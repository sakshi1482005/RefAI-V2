import unittest
from tests.test_referral_requests import FakeRepository
from app.services.referral_requests import ReferralRequestService

class CreditPurchaseTests(unittest.TestCase):
    def setUp(self): self.repo = FakeRepository(); self.service = ReferralRequestService(self.repo)
    def test_server_resolves_plan_and_records_one_idempotent_purchase(self):
        first = self.service.purchase_credits(self.repo.student, "boost", "purchase-key-1")
        second = self.service.purchase_credits(self.repo.student, "boost", "purchase-key-1")
        self.assertEqual(first["purchasedCredits"], 25); self.assertEqual(second["balance"], 35)
    def test_unknown_plan_is_rejected(self):
        with self.assertRaises(Exception): self.service.purchase_credits(self.repo.student, "free", "purchase-key-2")
