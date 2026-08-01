from __future__ import annotations

from datetime import datetime
from typing import Any

MEANINGFUL_RESPONSE_STATUSES = {"more_info_requested", "approved", "declined"}


def calculate_average_response_time(requests: list[dict[str, Any]], history: list[dict[str, Any]]) -> dict[str, Any]:
    """Use submission to the first persisted meaningful employee response."""
    submitted_at = {
        str(item["id"]): datetime.fromisoformat(str(item["created_at"]).replace("Z", "+00:00"))
        for item in requests if item.get("id") and item.get("created_at")
    }
    first_responses: dict[str, datetime] = {}
    for event in history:
        request_id = str(event.get("referral_request_id") or "")
        if request_id not in submitted_at or event.get("new_status") not in MEANINGFUL_RESPONSE_STATUSES or not event.get("created_at"):
            continue
        occurred_at = datetime.fromisoformat(str(event["created_at"]).replace("Z", "+00:00"))
        if request_id not in first_responses or occurred_at < first_responses[request_id]:
            first_responses[request_id] = occurred_at
    durations = [max(0.0, (response_at - submitted_at[request_id]).total_seconds() / 3600) for request_id, response_at in first_responses.items()]
    if not durations:
        return {"averageResponseTimeValue": None, "averageResponseTimeUnit": "hours", "respondedRequestCount": 0, "responseTimeAvailable": False}
    return {"averageResponseTimeValue": round(sum(durations) / len(durations), 1), "averageResponseTimeUnit": "hours", "respondedRequestCount": len(durations), "responseTimeAvailable": True}
