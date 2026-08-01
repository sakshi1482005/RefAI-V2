from datetime import datetime, timedelta, timezone
import unittest
from app.services.employee_response_time import calculate_average_response_time

class EmployeeResponseTimeTests(unittest.TestCase):
    def setUp(self): self.base = datetime(2026, 7, 1, tzinfo=timezone.utc)
    def request(self, request_id, offset=0): return {"id": request_id, "created_at": (self.base + timedelta(hours=offset)).isoformat()}
    def event(self, request_id, status, hours): return {"referral_request_id": request_id, "new_status": status, "created_at": (self.base + timedelta(hours=hours)).isoformat()}
    def test_no_responded_requests(self):
        self.assertEqual(calculate_average_response_time([self.request("a")], []), {"averageResponseTimeValue": None, "averageResponseTimeUnit": "hours", "respondedRequestCount": 0, "responseTimeAvailable": False})
    def test_one_responded_request(self):
        result = calculate_average_response_time([self.request("a")], [self.event("a", "approved", 17)])
        self.assertEqual((result["averageResponseTimeValue"], result["respondedRequestCount"]), (17.0, 1))
    def test_multiple_responses_use_first_event_once(self):
        result = calculate_average_response_time([self.request("a"), self.request("b")], [self.event("a", "approved", 20), self.event("a", "declined", 30), self.event("b", "more_info_requested", 10)])
        self.assertEqual((result["averageResponseTimeValue"], result["respondedRequestCount"]), (15.0, 2))
    def test_view_and_pending_requests_are_excluded(self):
        result = calculate_average_response_time([self.request("a"), self.request("b")], [self.event("a", "submitted", 2), self.event("b", "under_review", 3)])
        self.assertFalse(result["responseTimeAvailable"])

if __name__ == "__main__": unittest.main()
