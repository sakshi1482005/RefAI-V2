from datetime import datetime, timedelta, timezone
import unittest

from app.services.employee_reliability import WEIGHTS, calculate_employee_reliability


NOW = datetime(2026, 7, 30, 12, 0, tzinfo=timezone.utc)


def profile(**overrides):
    return {
        "profile_id": "employee-1",
        "company": "Acme",
        "designation": "Engineer",
        "department": "Engineering",
        "years_experience": 4,
        "verified_employee": True,
        "linkedin_url": "https://linkedin.com/in/employee",
        "availability_status": "accepting",
        "updated_at": NOW.isoformat(),
        **overrides,
    }


def request(status, *, days_ago=4, note=None, request_id="request-1"):
    created = NOW - timedelta(days=days_ago)
    return {
        "id": request_id,
        "employee_id": "employee-1",
        "status": status,
        "employee_note": note,
        "created_at": created.isoformat(),
        "updated_at": NOW.isoformat(),
    }


def response_event(request_id="request-1", hours_after=24, days_ago=4, status="declined", note=None):
    created = NOW - timedelta(days=days_ago) + timedelta(hours=hours_after)
    return {
        "referral_request_id": request_id,
        "changed_by": "employee-1",
        "new_status": status,
        "note": note,
        "created_at": created.isoformat(),
    }


class EmployeeReliabilityTests(unittest.TestCase):
    def test_weights_are_exact_and_components_reconcile(self):
        self.assertEqual(WEIGHTS, {
            "response_consistency": 30,
            "referral_completion": 25,
            "profile_verification": 20,
            "decision_transparency": 15,
            "platform_activity": 10,
        })
        card = calculate_employee_reliability(profile(), [], [], now=NOW)
        self.assertEqual(card["score"], sum(metric["score"] for metric in card["metrics"]))
        self.assertEqual(sum(metric["maximumScore"] for metric in card["metrics"]), 100)

    def test_responsible_decline_is_a_response_and_does_not_reduce_completion(self):
        decline = request("declined", note="The role needs production Java evidence.")
        card = calculate_employee_reliability(
            profile(), [decline],
            [response_event(note=decline["employee_note"])],
            now=NOW,
        )
        metrics = {metric["key"]: metric for metric in card["metrics"]}
        self.assertEqual(metrics["response_consistency"]["score"], 30)
        self.assertEqual(metrics["referral_completion"]["score"], 18)
        self.assertEqual(metrics["decision_transparency"]["score"], 15)
        self.assertIn("Responsible declines are excluded", metrics["referral_completion"]["evidence"][1])

    def test_silence_after_seven_days_is_penalized(self):
        card = calculate_employee_reliability(profile(), [request("pending", days_ago=10)], [], now=NOW)
        metric = {item["key"]: item for item in card["metrics"]}["response_consistency"]
        self.assertEqual(metric["score"], 0)
        self.assertIn("1 request(s) remained unanswered", metric["evidence"][1])

    def test_completed_referral_receives_full_completion_credit(self):
        completed = request("referred", note="Referral submitted.")
        card = calculate_employee_reliability(
            profile(), [completed],
            [response_event(status="approved", note="Accepted.")],
            now=NOW,
        )
        metric = {item["key"]: item for item in card["metrics"]}["referral_completion"]
        self.assertEqual(metric["score"], 25)
        self.assertEqual(card["completedReferrals"], 1)

    def test_new_employee_is_provisional_not_treated_as_silent(self):
        card = calculate_employee_reliability(profile(verified_employee=False), [], [], now=NOW)
        metrics = {item["key"]: item for item in card["metrics"]}
        self.assertTrue(card["isProvisional"])
        self.assertEqual(metrics["response_consistency"]["score"], 21)
        self.assertEqual(metrics["referral_completion"]["score"], 18)
        self.assertEqual(metrics["decision_transparency"]["score"], 10)
        self.assertEqual(card["requestsReviewed"], 0)


if __name__ == "__main__":
    unittest.main()
