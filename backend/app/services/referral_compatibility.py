from __future__ import annotations

import re
from typing import Any


SCORE_VERSION = "referral-compatibility-v1"
WEIGHTS = {
    "role_alignment": 35,
    "department_relevance": 25,
    "employee_preferences": 20,
    "candidate_readiness": 15,
    "request_completeness": 5,
}
DEPARTMENT_TERMS = {
    "engineering": {"engineer", "developer", "software", "backend", "frontend", "fullstack", "devops", "cloud", "qa"},
    "data": {"data", "analyst", "analytics", "machine", "learning", "scientist", "ai"},
    "product": {"product", "manager", "program", "strategy"},
    "design": {"design", "designer", "ux", "ui", "research"},
    "marketing": {"marketing", "growth", "content", "brand"},
    "sales": {"sales", "business", "account", "revenue"},
    "finance": {"finance", "financial", "accounting"},
    "human resources": {"human", "resources", "recruiter", "talent", "people"},
}


def _tokens(value: str | None) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9+#.]+", (value or "").lower()) if len(token) > 1}


def _similarity(left: str | None, right: str | None) -> float:
    left_tokens, right_tokens = _tokens(left), _tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def _tier(value: float, maximum: int) -> int:
    if value >= 0.75:
        return maximum
    if value >= 0.45:
        return round(maximum * 0.8)
    if value > 0:
        return round(maximum * 0.55)
    return 0


def calculate_referral_compatibility(
    employee: dict[str, Any],
    trust_card: dict[str, Any],
    request: dict[str, Any],
) -> dict[str, Any]:
    positive: list[str] = []
    conflicts: list[str] = []
    improvements: list[str] = []
    limitations = [
        "This score evaluates whether the request appears appropriate for this employee; it does not predict acceptance or hiring.",
        "Compatibility uses only the profile, preferences, Trust Card and request data recorded in RefAI.",
    ]
    target_role = str(request.get("target_role") or "").strip()
    target_company = str(request.get("target_company") or "").strip()
    job_description = str(request.get("job_description") or "").strip()
    message = str(request.get("student_message") or "").strip()

    supported_roles = employee.get("supported_roles") or []
    role_similarity = max((_similarity(target_role, role) for role in supported_roles), default=0.0)
    card_similarity = _similarity(target_role, trust_card.get("role"))
    jd_role_signal = 1.0 if _tokens(target_role) & _tokens(job_description) else 0.0
    role_score = (
        (_tier(role_similarity, 17) if supported_roles else 10)
        + _tier(card_similarity, 12)
        + (6 if jd_role_signal or not job_description else 0)
    )
    role_score = min(35, role_score)
    if role_similarity > 0:
        positive.append("The target role overlaps with roles this employee supports.")
    elif supported_roles:
        conflicts.append("The target role does not clearly match the employee's supported roles.")
        improvements.append("Choose an employee who explicitly supports this role, or clarify the role title.")
    else:
        limitations.append("The employee has not listed supported roles, so role alignment is partly provisional.")
    if card_similarity > 0:
        positive.append("The target role is consistent with the persisted Candidate Trust Card.")
    else:
        conflicts.append("The Trust Card role and referral target are not clearly aligned.")
    if not job_description:
        limitations.append("No Job Description was provided, so compatibility was evaluated from the target role, company, Trust Card and employee preferences.")

    role_context = " ".join((target_role, job_description))
    inferred_departments = {
        department for department, terms in DEPARTMENT_TERMS.items()
        if _tokens(role_context) & terms
    }
    employee_departments = {
        str(value).strip().lower()
        for value in [employee.get("department"), *(employee.get("supported_departments") or [])]
        if value
    }
    department_match = any(
        inferred in employee_department or employee_department in inferred
        for inferred in inferred_departments for employee_department in employee_departments
    )
    if department_match:
        department_score = 25
        positive.append("The employee's department is relevant to the target role.")
    elif not employee_departments or not inferred_departments:
        department_score = 15
        limitations.append("Department relevance is provisional because the role or employee department is not fully classified.")
    else:
        department_score = 5
        conflicts.append("The employee's department is not clearly relevant to this role.")
        improvements.append("Consider an employee in the department most closely related to the target role.")

    preference_score = 0
    supported_companies = employee.get("supported_companies") or []
    company_similarity = max((_similarity(target_company, company) for company in supported_companies), default=0.0)
    if company_similarity > 0:
        preference_score += 8
        positive.append("The target company is included in this employee's supported companies.")
    elif not supported_companies:
        preference_score += 5
        limitations.append("The employee has not listed supported companies, so company preference is provisional.")
    else:
        conflicts.append("The target company is not listed in this employee's supported companies.")
        improvements.append("Choose an employee who supports the target company, or verify the company before sending.")
    preferred_levels = employee.get("preferred_candidate_levels") or []
    accepts_freshers = employee.get("accepts_freshers", True)
    if accepts_freshers and (not preferred_levels or {"student", "fresher"} & set(preferred_levels)):
        preference_score += 6
        positive.append("The employee accepts student or fresher candidates.")
    else:
        conflicts.append("The employee's candidate-level preferences may not include students or freshers.")
    availability = employee.get("availability_status", "accepting")
    if availability == "accepting":
        preference_score += 6
        positive.append("The employee is currently marked as accepting requests.")
    else:
        conflicts.append("The employee is not currently marked as accepting requests.")

    trust_score = int(trust_card.get("trustScore") or 0)
    readiness = trust_card.get("referralReadiness")
    readiness_score = 10 if trust_score >= 75 else 7 if trust_score >= 55 else 3 if trust_score > 0 else 0
    if readiness == "Ready to request referral":
        readiness_score += 5
        positive.append("The Candidate Trust Card is marked ready for a referral request.")
    elif readiness:
        readiness_score += 2
        conflicts.append("The Trust Card recommends additional evidence before referral.")
        improvements.append("Address the highest-priority Trust Card evidence gaps.")
    else:
        limitations.append("Trust Card readiness details were unavailable.")
    readiness_score = min(15, readiness_score)

    completeness_score = 0
    if employee.get("profile_id") or employee.get("id"):
        completeness_score += 1
    else:
        conflicts.append("No employee is selected.")
    if target_company:
        completeness_score += 1
    else:
        conflicts.append("The target company is missing.")
    if target_role:
        completeness_score += 1
    else:
        conflicts.append("The target role is missing.")
    if message:
        completeness_score += 1
    else:
        conflicts.append("The referral request message is missing.")
    if trust_card.get("_available", bool(trust_card)):
        completeness_score += 1
    else:
        conflicts.append("A persisted Candidate Trust Card is not available.")
    if completeness_score == 5:
        positive.append("All required referral request information is present.")
    else:
        improvements.append("Complete every required referral field before sending.")

    components = [
        {"key": "role_alignment", "label": "Role alignment", "score": role_score, "maximumScore": 35},
        {"key": "department_relevance", "label": "Employee department relevance", "score": department_score, "maximumScore": 25},
        {"key": "employee_preferences", "label": "Employee referral preferences", "score": preference_score, "maximumScore": 20},
        {"key": "candidate_readiness", "label": "Candidate readiness", "score": readiness_score, "maximumScore": 15},
        {"key": "request_completeness", "label": "Request completeness", "score": completeness_score, "maximumScore": 5},
    ]
    score = sum(component["score"] for component in components)
    label = "Strong fit" if score >= 80 else "Good fit" if score >= 65 else "Review fit" if score >= 45 else "Low fit"
    return {
        "score": score,
        "maximumScore": 100,
        "label": label,
        "scoreVersion": SCORE_VERSION,
        "positiveFactors": positive,
        "missingOrConflictingFactors": conflicts,
        "limitations": limitations,
        "suggestedImprovements": list(dict.fromkeys(improvements)),
        "components": components,
    }
