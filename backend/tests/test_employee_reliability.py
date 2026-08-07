from datetime import datetime, timedelta, timezone
import unittest

from app.services.employee_reliability import WEIGHTS, calculate_employee_reliability, calculate_employee_reliability_badge


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
    @staticmethod
    def reviewed_history(*, response_hours=24, days_ago=(10, 8, 4)):
        requests = [request("declined", days_ago=age, note="A clear role-alignment reason.", request_id=f"request-{index}") for index, age in enumerate(days_ago)]
        history = [response_event(request_id=item["id"], hours_after=response_hours, days_ago=age, note=item["employee_note"]) for item, age in zip(requests, days_ago)]
        return requests, history

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

    def test_new_employee_receives_neutral_new_referrer_badge(self):
        badge = calculate_employee_reliability_badge(profile(), [], [], now=NOW)
        self.assertEqual(badge["badgeType"], "new_referrer")
        self.assertEqual(badge["label"], "New Referrer")
        self.assertEqual(badge["relevantCounts"]["meaningfulResponses"], 0)

    def test_reliable_employee_badge_requires_timely_transparent_recent_responses(self):
        requests, history = self.reviewed_history()
        badge = calculate_employee_reliability_badge(profile(), requests, history, now=NOW)
        self.assertEqual(badge["badgeType"], "reliable_referrer")
        self.assertEqual(badge["relevantCounts"]["meaningfulResponses"], 3)
        self.assertEqual(badge["relevantCounts"]["overdueUnansweredRequests"], 0)

    def test_delayed_responses_do_not_receive_reliable_badge(self):
        requests, history = self.reviewed_history(response_hours=120, days_ago=(12, 10, 8))
        badge = calculate_employee_reliability_badge(profile(), requests, history, now=NOW)
        self.assertEqual(badge["badgeType"], "verified_referrer")

    def test_insufficient_history_remains_new_even_when_profile_is_verified(self):
        requests, history = self.reviewed_history(days_ago=(8, 4))
        badge = calculate_employee_reliability_badge(profile(), requests, history, now=NOW)
        self.assertEqual(badge["badgeType"], "new_referrer")

    def test_badge_changes_when_recent_month_activity_ages_out(self):
        requests, history = self.reviewed_history(days_ago=(25, 20, 15))
        current = calculate_employee_reliability_badge(profile(), requests, history, now=NOW)
        later = calculate_employee_reliability_badge(profile(), requests, history, now=NOW + timedelta(days=31))
        self.assertEqual(current["badgeType"], "reliable_referrer")
        self.assertEqual(later["badgeType"], "verified_referrer")
        self.assertEqual(later["relevantCounts"]["recentMeaningfulResponses"], 0)

    def test_employee_viewed_event_is_not_a_meaningful_response(self):
        pending = request("pending", days_ago=10)
        viewed = response_event(status="pending", note=None)
        viewed["event_type"] = "employee_viewed"
        card = calculate_employee_reliability(profile(), [pending], [viewed], now=NOW)
        self.assertEqual(card["requestsReviewed"], 0)
        self.assertIn("1 request(s) remained unanswered", card["metrics"][0]["evidence"][1])


if __name__ == "__main__":
    unittest.main()
