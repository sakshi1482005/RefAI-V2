from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


WEIGHTS = {
    "response_consistency": 30,
    "referral_completion": 25,
    "profile_verification": 20,
    "decision_transparency": 15,
    "platform_activity": 10,
}
SILENCE_AFTER_HOURS = 168
TIMELY_RESPONSE_HOURS = 72


def _time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _tier(ratio: float, maximum: int) -> int:
    if ratio >= 0.9:
        return maximum
    if ratio >= 0.75:
        return round(maximum * 0.85)
    if ratio >= 0.5:
        return round(maximum * 0.65)
    if ratio > 0:
        return round(maximum * 0.4)
    return 0


def _metric(key: str, label: str, score: int, basis: str, evidence: list[str], limitations: list[str]) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "score": max(0, min(WEIGHTS[key], score)),
        "maximumScore": WEIGHTS[key],
        "basis": basis,
        "evidence": evidence,
        "limitations": limitations,
    }


def calculate_employee_reliability(
    profile: dict[str, Any],
    requests: list[dict[str, Any]],
    history: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    employee_id = str(profile.get("profile_id") or profile.get("id") or "")
    employee_events = [row for row in history if str(row.get("changed_by")) == employee_id]
    events_by_request: dict[str, list[dict[str, Any]]] = {}
    for event in employee_events:
        events_by_request.setdefault(str(event.get("referral_request_id")), []).append(event)

    response_hours: list[float] = []
    reviewed = 0
    silent = 0
    for request in requests:
        request_id = str(request.get("id"))
        created = _time(request.get("created_at"))
        events = sorted(events_by_request.get(request_id, []), key=lambda row: _time(row.get("created_at")) or current_time)
        if events:
            reviewed += 1
            first_response = _time(events[0].get("created_at"))
            if created and first_response:
                response_hours.append(max(0.0, (first_response - created).total_seconds() / 3600))
        elif request.get("status") != "pending":
            reviewed += 1
        elif created and (current_time - created).total_seconds() / 3600 >= SILENCE_AFTER_HOURS:
            silent += 1

    actionable = reviewed + silent
    if actionable == 0:
        response_score = 21
        response_basis = "Provisional neutral score; no mature requests are available to measure response consistency."
        response_evidence = ["No overdue unanswered requests were found."]
        response_limitations = ["More referral history is needed before response consistency can be established."]
    else:
        response_rate = reviewed / actionable
        consistency_points = _tier(response_rate, 21)
        timely_ratio = sum(hours <= TIMELY_RESPONSE_HOURS for hours in response_hours) / len(response_hours) if response_hours else 0
        timing_points = _tier(timely_ratio, 9) if response_hours else (6 if reviewed else 0)
        response_score = consistency_points + timing_points
        response_basis = "70% response coverage and 30% timely first responses, using discrete tiers."
        response_evidence = [f"{reviewed} request(s) received an employee response.", f"{silent} request(s) remained unanswered beyond 7 days."]
        response_limitations = [] if response_hours else ["Precise response timing was unavailable for one or more reviewed requests."]

    accepted = [row for row in requests if row.get("status") in {"approved", "referred"}]
    completed = [row for row in requests if row.get("status") == "referred"]
    if not accepted:
        completion_score = 18
        completion_basis = "Provisional neutral score; no accepted referrals have reached a completion opportunity."
        completion_limitations = ["Declined requests are excluded and do not reduce this metric."]
    else:
        completion_score = _tier(len(completed) / len(accepted), 25)
        completion_basis = "Completed referrals divided by accepted referrals, using discrete tiers."
        completion_limitations = ["The platform records referral completion, not the employer's hiring outcome."]
    completion_evidence = [f"{len(completed)} completed referral(s) from {len(accepted)} accepted request(s).", "Responsible declines are excluded from the completion denominator."]

    links = [profile.get("linkedin_url"), profile.get("company_profile_url"), profile.get("portfolio_url")]
    verification_score = (
        (10 if profile.get("verified_employee") else 0)
        + (3 if profile.get("company") else 0)
        + (2 if profile.get("designation") else 0)
        + (2 if profile.get("department") else 0)
        + (1 if profile.get("years_experience") is not None else 0)
        + min(2, sum(bool(link) for link in links))
    )
    verification_evidence = [
        "Employee verification confirmed." if profile.get("verified_employee") else "Employee verification has not been confirmed.",
        f"{sum(bool(value) for value in (profile.get('company'), profile.get('designation'), profile.get('department')))} of 3 core professional fields are present.",
        f"{sum(bool(link) for link in links)} professional link(s) supplied.",
    ]
    verification_limitations = [] if profile.get("verified_employee") else ["Profile completeness is not equivalent to employer verification."]

    decisions = [row for row in requests if row.get("status") in {"approved", "declined", "referred"}]
    def useful_note(row: dict[str, Any]) -> bool:
        note = str(row.get("decision_message") or row.get("decision_reason") or row.get("employee_note") or "").strip()
        return len(note) >= 10 and len(note.split()) >= 2

    clear_decisions = [row for row in decisions if useful_note(row)]
    responsible_declines = [row for row in requests if row.get("status") == "declined" and useful_note(row)]
    if not decisions:
        transparency_score = 10
        transparency_basis = "Provisional neutral score; no completed decisions are available to assess feedback clarity."
        transparency_limitations = ["More completed decisions are needed to establish transparency."]
    else:
        transparency_score = _tier(len(clear_decisions) / len(decisions), 15)
        transparency_basis = "Share of completed decisions with a recorded explanation, using discrete tiers."
        transparency_limitations = ["Only recorded notes can be evaluated; note usefulness is not inferred by AI."]
    transparency_evidence = [f"{len(clear_decisions)} of {len(decisions)} completed decision(s) include feedback.", f"{len(responsible_declines)} responsible decline(s) include a reason and receive full decision credit."]

    last_event = max((_time(row.get("created_at")) for row in employee_events), default=None)
    profile_updated = _time(profile.get("updated_at"))
    last_activity = max((value for value in (last_event, profile_updated) if value), default=None)
    availability_status = profile.get("availability_status")
    availability_configured = availability_status in {"accepting", "paused", "unavailable"}
    active_count = sum(row.get("status") in {"pending", "under_review", "more_info_requested"} for row in requests)
    maximum_active = int(profile.get("max_active_requests", 5))
    availability_accurate = availability_configured and (
        availability_status != "accepting" or (maximum_active > 0 and active_count < maximum_active)
    )
    if last_activity:
        age_days = max(0, (current_time - last_activity).days)
        recency_points = 6 if age_days <= 30 else 4 if age_days <= 90 else 2 if age_days <= 180 else 0
    else:
        age_days = None
        recency_points = 0
    activity_score = recency_points + (4 if availability_accurate else 0)
    activity_basis = "Recent profile or referral activity (60%) plus an explicit availability setting (40%)."
    activity_evidence = [
        f"Last recorded activity was {age_days} day(s) ago." if age_days is not None else "No dated activity was available.",
        f"Availability is set to {profile.get('availability_status', 'unknown')} and is {'consistent' if availability_accurate else 'not consistent'} with active capacity.",
    ]
    activity_limitations = ["Activity measures platform use and availability maintenance, not employee popularity."]

    metrics = [
        _metric("response_consistency", "Response Consistency", response_score, response_basis, response_evidence, response_limitations),
        _metric("referral_completion", "Referral Completion", completion_score, completion_basis, completion_evidence, completion_limitations),
        _metric("profile_verification", "Profile Verification", verification_score, "Administrator verification plus observable professional-profile completeness.", verification_evidence, verification_limitations),
        _metric("decision_transparency", "Decision Transparency", transparency_score, transparency_basis, transparency_evidence, transparency_limitations),
        _metric("platform_activity", "Platform Activity", activity_score, activity_basis, activity_evidence, activity_limitations),
    ]
    total = sum(metric["score"] for metric in metrics)
    label = "Excellent" if total >= 85 else "Strong" if total >= 70 else "Verified" if profile.get("verified_employee") else "Building history"
    average_hours = round(sum(response_hours) / len(response_hours)) if response_hours else None
    return {
        "label": label,
        "score": total,
        "maximumScore": 100,
        "isProvisional": len(requests) < 3,
        "averageResponseHours": average_hours,
        "requestsReviewed": reviewed,
        "completedReferrals": len(completed),
        "metrics": metrics,
        "limitations": ["Reliability reflects activity recorded in RefAI only."] + (["Limited history: this card is provisional."] if len(requests) < 3 else []),
    }
