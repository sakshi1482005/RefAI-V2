from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Callable

from app.services.groq_client import AIServiceUnavailable
from app.services.requirement_extractor import extract_requirements, general_expectations_for_role, requirement_occurrences

COPILOT_VERSION = "employee-review-copilot-v1"
_INJECTION = re.compile(
    r"(ignore (?:all |any )?(?:previous|prior|system)|system prompt|developer message|"
    r"reveal (?:the )?prompt|bypass grounding|auto[- ]?(?:approve|reject)|"
    r"fabricate|pretend (?:that|you)|do not follow)", re.I,
)
_FORBIDDEN = re.compile(
    r"(hiring probability|success probability|acceptance probability|confidence of success|"
    r"will succeed|will get hired|definitely (?:refer|approve|reject)|"
    r"should definitely receive|auto[- ]?(?:approve|reject))", re.I,
)
_NUMBER = re.compile(r"\b\d+(?:\.\d+)?%?\b")


def _stable_cache_value(value: Any) -> Any:
    """Normalize only for a non-reversible Copilot input fingerprint."""
    if isinstance(value, dict):
        return {str(key): _stable_cache_value(item) for key, item in sorted(value.items(), key=lambda item: str(item[0]))}
    if isinstance(value, list):
        return [_stable_cache_value(item) for item in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def build_employee_review_copilot_input_key(
    *,
    employee_id: str,
    request: dict[str, Any],
    trust_card: dict[str, Any],
    analysis: dict[str, Any] | None,
    verified_profile: dict[str, Any],
    proofs: list[dict[str, Any]],
) -> str:
    """Return a user-scoped, opaque key for exactly the Copilot grounding inputs.

    The fingerprint is persisted instead of the underlying candidate content. Any
    relevant request, analysis, Trust Card, profile, or Proof Vault change creates
    a new key and therefore a new Copilot result on the next explicit request.
    """
    snapshot = {
        "copilotVersion": COPILOT_VERSION,
        "employeeId": employee_id,
        "request": {
            "id": request.get("id"),
            "targetRole": request.get("target_role"),
            "targetCompany": request.get("target_company"),
            "jobDescription": request.get("job_description"),
            "studentResponse": request.get("student_response"),
            "updatedAt": request.get("updated_at"),
        },
        "trustCard": {
            "id": trust_card.get("id"),
            "analysisId": trust_card.get("analysis_id"),
            "updatedAt": trust_card.get("updated_at"),
            "scoreVersion": (trust_card.get("payload") or {}).get("scoreVersion"),
            "payload": trust_card.get("payload") or {},
        },
        "analysis": {
            "id": (analysis or {}).get("id"),
            "updatedAt": (analysis or {}).get("updated_at"),
            "resumeTextDigest": hashlib.sha256(str((analysis or {}).get("resume_text") or "").encode("utf-8")).hexdigest(),
        },
        "verifiedProfile": verified_profile,
        "proofState": proofs,
    }
    serialized = json.dumps(_stable_cache_value(snapshot), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _flatten_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for child in value for item in _flatten_strings(child)]
    if isinstance(value, dict):
        return [item for child in value.values() for item in _flatten_strings(child)]
    return []


def _safe_text(value: Any, limit: int = 280) -> tuple[str | None, bool]:
    clean = " ".join(str(value or "").split())
    if not clean:
        return None, False
    if _INJECTION.search(clean):
        return None, True
    return clean[:limit], False


def _statement(text: str, evidence_type: str, fact_ids: list[str]) -> dict[str, Any]:
    return {"text": text, "evidenceType": evidence_type, "factIds": fact_ids}


def _fallback(
    facts: list[dict[str, str]],
    required: list[dict],
    matched: list[str],
    target_role: str,
    has_jd: bool,
) -> dict[str, Any]:
    evidence = [fact for fact in facts if fact["sourceType"] in {"resume", "trust_card", "proof_vault"}]
    missing = [item["requirement"] for item in required if item["requirement"] not in matched]
    why = (
        [_statement(f"{evidence[0]['value']} This may be relevant to the selected {target_role} role.", "inferred_relevance", [evidence[0]["id"]])]
        if evidence else
        [_statement(f"Role-relevant evidence was not demonstrated in the available sources for {target_role}.", "missing_evidence", [])]
    )
    strengths = [
        _statement(fact["value"], "demonstrated_evidence", [fact["id"]])
        for fact in evidence[:3]
    ]
    concerns = [
        _statement(f"{item} was not demonstrated in the available evidence.", "missing_evidence", [])
        for item in missing[:4]
    ]
    if not concerns and not evidence:
        concerns.append(_statement("Specific project or experience evidence was not demonstrated.", "missing_evidence", []))
    verification = [
        _statement(f"Manually verify: {item}.", "manual_verification", [])
        for item in (missing[:3] or ["the candidate’s individual contribution and measurable outcomes"])
    ]
    questions = [
        f"Can you describe your individual contribution to the evidence shown for {target_role}?",
        "Which result can you support with a concrete example or artifact?",
    ]
    return {
        "whyCandidateMayFit": why,
        "evidenceBackedStrengths": strengths,
        "concernsOrMissingEvidence": concerns,
        "pointsRequiringManualVerification": verification,
        "usefulQuestions": questions,
        "suggestedReviewPriority": "Evidence gaps first" if missing or not evidence else "Standard review",
        "narrative": "Manual review recommended. The summary distinguishes demonstrated evidence from items that were not demonstrated.",
        "usedFallback": True,
        "hasJobDescription": has_jd,
    }


def build_employee_review_copilot(
    *,
    request: dict[str, Any],
    trust_card: dict[str, Any],
    resume_text: str,
    verified_profile: dict[str, Any],
    generator: Callable[[list[dict[str, str]], dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    payload = trust_card.get("payload") or {}
    target_role = str(request.get("target_role") or "").strip()
    target_company = str(request.get("target_company") or "").strip()
    job_description = str(request.get("job_description") or "").strip()
    has_jd = bool(job_description)
    role_context = job_description if has_jd else general_expectations_for_role(target_role)
    requirements = extract_requirements(role_context)
    matched = [
        item["requirement"] for item in requirements
        if requirement_occurrences(resume_text, item) > 0
    ]

    facts: list[dict[str, str]] = []
    filtered_injection = bool(
        _INJECTION.search(resume_text)
        or _INJECTION.search(job_description)
        or any(_INJECTION.search(text) for text in _flatten_strings(payload))
        or any(_INJECTION.search(text) for text in _flatten_strings(verified_profile))
    )

    def add(identifier: str, source: str, value: Any, limit: int = 280):
        nonlocal filtered_injection
        text, rejected = _safe_text(value, limit)
        filtered_injection = filtered_injection or rejected
        if text:
            facts.append({"id": identifier, "sourceType": source, "value": text})

    add("request.role", "target_context", target_role, 160)
    add("request.company", "target_context", target_company, 160)
    if has_jd:
        for index, item in enumerate(requirements[:8]):
            add(f"jd.requirement.{index + 1}", "job_description", item["requirement"], 160)
    else:
        add("role.general_expectations", "role_context", role_context, 600)

    for index, item in enumerate((payload.get("evidence") or [])[:5]):
        add(f"trust.evidence.{index + 1}", "trust_card", item)
    for index, item in enumerate((payload.get("strengths") or [])[:4]):
        add(f"trust.strength.{index + 1}", "trust_card", item)
    for index, component in enumerate((payload.get("scoreBreakdown") or [])[:5]):
        details = component.get("evidenceFound") or component.get("details", {}).get("matches") or []
        for child_index, item in enumerate(_flatten_strings(details)[:2]):
            add(f"proof.{index + 1}.{child_index + 1}", "proof_vault", item)

    resume_candidates = [
        line for line in re.split(r"[\r\n]+|(?<=[.!?])\s+", resume_text)
        if len(line.split()) >= 5 and re.search(r"\b(project|experience|intern|built|developed|implemented|led|improved|created)\b", line, re.I)
    ]
    for index, line in enumerate(resume_candidates[:4]):
        add(f"resume.snippet.{index + 1}", "resume", line)
    for key in ("college", "degree", "branch", "graduation_year"):
        add(f"profile.{key}", "verified_profile", verified_profile.get(key), 120)

    context = {
        "targetRole": target_role,
        "targetCompany": target_company,
        "hasJobDescription": has_jd,
        "matchedCoreRequirements": len(matched),
        "totalCoreRequirements": len(requirements),
        "matchedRequirementNames": matched,
    }
    result = None
    try:
        result = generator(facts, context)
        allowed_ids = {fact["id"] for fact in facts}
        required_lists = (
            "whyCandidateMayFit", "evidenceBackedStrengths",
            "concernsOrMissingEvidence", "pointsRequiringManualVerification",
        )
        if not isinstance(result, dict) or not all(isinstance(result.get(key), list) for key in required_lists):
            raise AIServiceUnavailable("Copilot returned an invalid structure")
        if not isinstance(result.get("usefulQuestions"), list) or not isinstance(result.get("narrative"), str):
            raise AIServiceUnavailable("Copilot returned incomplete output")
        if result.get("suggestedReviewPriority") not in {
            "Standard review", "Evidence gaps first", "Verify core evidence first",
        } or not all(isinstance(question, str) for question in result["usefulQuestions"]):
            raise AIServiceUnavailable("Copilot returned an invalid advisory priority or question")
        text_values = _flatten_strings(result)
        if any(_FORBIDDEN.search(text) for text in text_values):
            raise AIServiceUnavailable("Copilot returned prohibited decision or probability language")
        for key in required_lists:
            for item in result[key]:
                if (
                    not isinstance(item, dict)
                    or not isinstance(item.get("text"), str)
                    or item.get("evidenceType") not in {
                        "demonstrated_evidence", "inferred_relevance",
                        "missing_evidence", "manual_verification",
                    }
                    or not isinstance(item.get("factIds"), list)
                    or any(fact_id not in allowed_ids for fact_id in item["factIds"])
                ):
                    raise AIServiceUnavailable("Copilot returned invalid grounding references")
                if item["evidenceType"] in {"demonstrated_evidence", "inferred_relevance"}:
                    if not item["factIds"]:
                        raise AIServiceUnavailable("Copilot returned an uncited evidence statement")
                    cited = " ".join(
                        fact["value"] for fact in facts if fact["id"] in item["factIds"]
                    ).lower()
                    statement = item["text"].lower()
                    statement_requirements = extract_requirements(statement)
                    if any(req["requirement"].lower() not in cited for req in statement_requirements):
                        raise AIServiceUnavailable("Copilot introduced an unsupported requirement")
                    if set(_NUMBER.findall(statement)) - set(_NUMBER.findall(cited)):
                        raise AIServiceUnavailable("Copilot introduced an unsupported metric")
                    statement_tokens = {
                        token for token in re.findall(r"[a-z0-9+#.]+", statement)
                        if len(token) > 3
                    }
                    cited_tokens = {
                        token for token in re.findall(r"[a-z0-9+#.]+", cited)
                        if len(token) > 3
                    }
                    if len(statement_tokens & cited_tokens) < 2:
                        raise AIServiceUnavailable("Copilot evidence statement is not grounded")
        result["usedFallback"] = False
        result["hasJobDescription"] = has_jd
    except (AIServiceUnavailable, TimeoutError, ValueError, TypeError):
        result = _fallback(facts, requirements, matched, target_role, has_jd)

    limitations = []
    if not has_jd:
        limitations.append("No specific Job Description was provided. The summary is based on general expectations for the selected role.")
    if filtered_injection:
        limitations.append("Instruction-like text embedded in candidate-provided content was excluded from Copilot grounding.")
    if not any(fact["sourceType"] == "proof_vault" for fact in facts):
        limitations.append("No separate structured Proof Vault evidence was available beyond the persisted Trust Card evidence.")
    limitations.append("This is advisory only. Manual review is required; the Copilot does not approve or reject referral requests.")

    return {
        **result,
        "matchedCoreRequirementsCount": len(matched),
        "totalCoreRequirementsCount": len(requirements),
        "scoreVersion": COPILOT_VERSION,
        "groundingSources": sorted({fact["sourceType"] for fact in facts}),
        "limitations": limitations,
    }
