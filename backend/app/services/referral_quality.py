from __future__ import annotations

import re
from typing import Any

QUALITY_SCORE_VERSION = "referral-message-quality-v1"

_TOKEN = re.compile(r"[a-z0-9+#.]+")
_NUMBER = re.compile(r"\b\d+(?:\.\d+)?%?\b")
_CLAIM_VERBS = re.compile(
    r"\b(built|created|developed|designed|implemented|led|managed|improved|"
    r"increased|reduced|achieved|delivered|worked|interned|launched)\b",
    re.I,
)
_CONNECTION = re.compile(
    r"\b(alumni|same college|same university|shared connection|mutual connection|"
    r"connected through|know you from|fellow graduate)\b",
    re.I,
)
_COMPANY_FAMILIARITY = re.compile(
    r"\b(I know (?:the )?company|familiar with (?:your|the) company|"
    r"understand (?:your|the) company culture|long admired|follow your work|"
    r"worked with your team)\b",
    re.I,
)
_UNPROFESSIONAL = re.compile(r"\b(guarantee|definitely hire|100% fit|pls|bro|dude|urgent!!!)\b", re.I)
_SKILLS = {
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "node", "fastapi", "django", "flask", "spring", "sql", "postgresql",
    "mongodb", "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "c++", "c#", "golang", "rust", "machine learning", "tensorflow", "pytorch",
}
_STOP = {
    "the", "and", "for", "with", "that", "this", "from", "your", "role",
    "company", "request", "referral", "please", "review", "candidate", "trust",
    "card", "have", "has", "using", "used", "into", "their", "would", "could",
}


def _text_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for child in value for item in _text_values(child)]
    if isinstance(value, dict):
        return [item for child in value.values() for item in _text_values(child)]
    return []


def _tokens(value: str) -> set[str]:
    return {token for token in _TOKEN.findall(value.lower()) if len(token) > 2 and token not in _STOP}


def _contains(value: str, expected: str) -> bool:
    return expected.strip().lower() in value.lower()


def _component(key: str, label: str, score: int, maximum: int, basis: str) -> dict[str, Any]:
    return {
        "key": key, "label": label, "score": score, "maximumScore": maximum,
        "status": "passed" if score == maximum else "warning",
        "basis": basis,
    }


def calculate_referral_message_quality(
    *,
    message: str,
    target_company: str,
    target_role: str,
    employee: dict[str, Any],
    trust_card: dict[str, Any],
    student_profile: dict[str, Any] | None = None,
    resume_text: str = "",
    job_description: str = "",
    verified_shared_connection: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the deterministic, non-generative referral message quality result."""
    clean = " ".join(message.split())
    lowered = clean.lower()
    words = clean.split()
    employee_name = str(employee.get("name") or employee.get("full_name") or "").strip()
    employee_profile = employee.get("profile") or employee
    card_payload = trust_card.get("payload") or trust_card
    sources = "\n".join(
        [
            *_text_values(student_profile or {}),
            *_text_values(card_payload),
            resume_text,
            job_description,
        ]
    )
    source_lower = sources.lower()
    source_tokens = _tokens(sources)
    message_tokens = _tokens(clean)

    passed: list[str] = []
    warnings: list[str] = []
    blocking: list[str] = []
    edits: list[str] = []

    # Opportunity and recipient accuracy — 25 points.
    accuracy = 0
    if employee_name and _contains(clean, employee_name):
        accuracy += 8
        passed.append("Selected employee’s name is used correctly.")
    else:
        accuracy += 4
        warnings.append("The selected employee’s name is not used.")
        edits.append(f"Address {employee_name} by name." if employee_name else "Address the selected employee by name.")
    greeting = re.search(r"^\s*(?:hi|hello|dear)\s+([A-Z][A-Za-z'-]+)", message)
    if greeting and employee_name and greeting.group(1).lower() not in employee_name.lower():
        blocking.append("The message addresses a different employee.")

    if _contains(clean, target_company):
        accuracy += 9
        passed.append("Target company is stated correctly.")
    else:
        accuracy += 4
        warnings.append("The target company is not stated.")
        edits.append(f"Name {target_company} as the target company.")
    company_claim = re.search(r"\b(?:at|with)\s+([A-Z][A-Za-z0-9&.' -]{1,60})(?:[.,]|$)", message)
    if company_claim and target_company.lower() not in company_claim.group(1).lower():
        blocking.append("The message names a company that does not match the selected target company.")

    if _contains(clean, target_role):
        accuracy += 8
        passed.append("Target role is stated correctly.")
    else:
        accuracy += 4
        warnings.append("The target role is not stated exactly.")
        edits.append(f"Use the selected role name: {target_role}.")
    role_claim = re.search(r"\bfor (?:the )?(.{2,80}?)\s+(?:role|position)\b", message, re.I)
    if role_claim:
        claimed = _tokens(role_claim.group(1))
        expected = _tokens(target_role)
        generic_reference = role_claim.group(1).strip().lower() in {"this", "selected", "target", "the selected", "the target"}
        if expected and claimed and not generic_reference and not (claimed & expected):
            blocking.append("The message names a role that does not match the selected target role.")

    # Resume/Trust Card evidence — 30 points.
    evidence_score = 8
    passed.append("The owned Candidate Trust Card is attached to the referral request.")
    claim_sentences = [
        sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", clean)
        if _CLAIM_VERBS.search(sentence)
    ]
    supported_claims = 0
    for sentence in claim_sentences:
        claim_tokens = _tokens(sentence)
        overlap = claim_tokens & source_tokens
        if len(overlap) >= 2:
            supported_claims += 1
        else:
            blocking.append(f"Unsupported experience or project claim: “{sentence[:140]}”")
    if supported_claims:
        evidence_score += 12
        passed.append("Relevant project or experience evidence is mentioned.")
    else:
        warnings.append("No specific supported project or experience is mentioned.")
        edits.append("Add one concise project or experience fact from the resume or Trust Card.")
    unsupported_skills = sorted(
        skill for skill in _SKILLS
        if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", lowered) and skill not in source_lower
    )
    if unsupported_skills:
        blocking.append(f"Unsupported skill claim(s): {', '.join(unsupported_skills)}.")
    message_numbers = set(_NUMBER.findall(clean))
    source_numbers = set(_NUMBER.findall(sources))
    unsupported_numbers = sorted(message_numbers - source_numbers)
    if unsupported_numbers:
        blocking.append(f"Unsupported achievement or metric(s): {', '.join(unsupported_numbers)}.")
    if not claim_sentences and not unsupported_skills and not unsupported_numbers:
        evidence_score += 10
        passed.append("No unsupported factual claims were detected.")
    elif not blocking:
        evidence_score += 10
        passed.append("All detected factual claims have observable support.")
    else:
        edits.append("Remove or replace every unsupported claim with resume or Trust Card evidence.")

    # Factual integrity — 20 points.
    integrity = 20
    shared_verified = bool(
        verified_shared_connection
        and verified_shared_connection.get("verified")
        and verified_shared_connection.get("safe_summary")
    )
    if _CONNECTION.search(clean) and not shared_verified:
        integrity -= 8
        blocking.append("The shared or alumni connection is not backed by verified stored data.")
        edits.append("Remove the shared-connection wording.")
    else:
        passed.append("No unverified shared connection is claimed.")
    if _COMPANY_FAMILIARITY.search(clean):
        integrity -= 6
        blocking.append("The message invents personal familiarity with the company or employee.")
        edits.append("Remove unsupported company-familiarity wording.")
    else:
        passed.append("No invented company familiarity was detected.")
    if not job_description.strip() and re.search(r"\b(specific opening|listed requirements|job description says|this opening requires)\b", clean, re.I):
        integrity -= 6
        blocking.append("The message claims opening-specific knowledge without a Job Description.")
        edits.append("Use general role-focused wording because no Job Description is available.")
    elif job_description.strip():
        passed.append("Job Description context is available for opening-specific wording.")
    else:
        passed.append("No opening-specific claim is made without a Job Description.")

    # Employee preferences — 15 points.
    preference_score = 0
    preferred_length = employee_profile.get("preferred_message_length", "concise")
    maximum_words = {"concise": 80, "standard": 120, "detailed": 160}.get(preferred_length, 120)
    if len(words) <= maximum_words:
        preference_score += 8
        passed.append(f"Message length fits the employee’s {preferred_length} preference.")
    else:
        warnings.append(f"Message exceeds the employee’s {preferred_length} preference of {maximum_words} words.")
        edits.append(f"Shorten the message to {maximum_words} words or fewer.")
    expectations = employee_profile.get("minimum_evidence_expectations") or []
    available = {
        "resume": bool(resume_text.strip()),
        "trust_card": bool(trust_card),
        "project_evidence": "project" in source_lower,
        "quantified_outcomes": bool(_NUMBER.search(sources)),
        "education_details": bool(student_profile and any(student_profile.get(key) for key in ("college", "degree", "branch", "graduation_year"))),
        "portfolio_links": bool(student_profile and student_profile.get("portfolio")),
    }
    missing_expectations = [item for item in expectations if not available.get(item, False)]
    if not missing_expectations:
        preference_score += 7
        passed.append("Essential employee evidence preferences are met.")
    else:
        warnings.append(f"Employee evidence preference(s) not available: {', '.join(missing_expectations)}.")
        edits.append("Review the employee’s evidence guidelines before sending.")

    # Professional clarity — 10 points.
    clarity = 0
    if not _UNPROFESSIONAL.search(clean):
        clarity += 5
        passed.append("Tone is professional and avoids certainty claims.")
    else:
        warnings.append("Wording is informal, urgent, or implies certainty.")
        edits.append("Use professional wording without guarantees or hiring claims.")
    if len(words) <= 120 and len(clean) >= 20:
        clarity += 5
        passed.append("Message is concise and readable.")
    else:
        warnings.append("Message should be clear and no longer than 120 words.")
        edits.append("Keep the final request between 20 characters and 120 words.")

    components = [
        _component("opportunity_accuracy", "Recipient and opportunity accuracy", accuracy, 25, "Employee name, target company, and target role."),
        _component("evidence_grounding", "Resume and Trust Card grounding", evidence_score, 30, "Attached Trust Card, supported evidence, skills, and metrics."),
        _component("factual_integrity", "Factual integrity", max(0, integrity), 20, "Verified connections, company familiarity, and JD-specific wording."),
        _component("employee_preferences", "Employee preference fit", preference_score, 15, "Preferred length and minimum evidence expectations."),
        _component("professional_clarity", "Professional clarity", clarity, 10, "Professional tone, readability, and concision."),
    ]
    score = sum(component["score"] for component in components)
    label = "Excellent" if score >= 90 else "Strong" if score >= 75 else "Needs review" if score >= 55 else "Weak"
    return {
        "score": score,
        "maximumScore": 100,
        "label": label,
        "scoreVersion": QUALITY_SCORE_VERSION,
        "passedChecks": list(dict.fromkeys(passed)),
        "warnings": list(dict.fromkeys(warnings)),
        "blockingErrors": list(dict.fromkeys(blocking)),
        "recommendedEdits": list(dict.fromkeys(edits)),
        "checks": components,
        "canSubmit": not blocking,
        "limitations": [
            "This deterministic checker evaluates observable text and stored evidence; it does not verify real-world truth beyond RefAI’s stored sources.",
            *([] if job_description.strip() else ["No Job Description was provided; absence of a JD did not reduce the score."]),
        ],
    }
