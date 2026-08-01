from __future__ import annotations

import re
from typing import Any


STATUS_VERSION = "claim-verification-v1"
_DEMONSTRATION = re.compile(
    r"\b(?:built|developed|implemented|created|designed|deployed|automated|"
    r"integrated|delivered|maintained|managed|used|worked|intern|experience|project)\b",
    re.IGNORECASE,
)


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9+#.]+", value.lower()))


def _contains_claim(text: str, claim: str) -> bool:
    normalized_text, normalized_claim = _normalize(text), _normalize(claim)
    return bool(normalized_claim) and f" {normalized_claim} " in f" {normalized_text} "


def _resume_segments(resume_text: str, claim: str) -> list[str]:
    return [
        segment.strip() for segment in re.split(r"[\r\n]+|(?<=[.!?;])\s+|[•●▪]", resume_text)
        if segment.strip() and _contains_claim(segment, claim)
    ][:3]


def build_claim_verifications(
    trust_card_payload: dict[str, Any],
    resume_text: str,
    proofs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Classify claims from observable persisted facts; this does not verify external documents."""
    matched = [str(item).strip() for item in trust_card_payload.get("matchedSkills") or [] if str(item).strip()]
    missing = {
        _normalize(str(item.get("requirement") if isinstance(item, dict) else item))
        for item in (trust_card_payload.get("missingRequirements") or trust_card_payload.get("missingSkills") or [])
    }
    proof_claims = [str(item.get("related_skill_claim") or "").strip() for item in proofs]
    claims: list[str] = []
    for claim in [*matched, *proof_claims]:
        if claim and _normalize(claim) not in {_normalize(existing) for existing in claims}:
            claims.append(claim)

    results = []
    for claim in claims:
        normalized = _normalize(claim)
        linked = [proof for proof in proofs if _normalize(str(proof.get("related_skill_claim") or "")) == normalized]
        segments = _resume_segments(resume_text, claim)
        demonstrated = any(_DEMONSTRATION.search(segment) for segment in segments)
        inconsistent = normalized in missing and (normalized in {_normalize(item) for item in matched} or bool(segments))

        if inconsistent:
            status = "Needs clarification"
            reason = "This claim appears in both supported and missing-evidence signals on the saved Trust Card."
        elif linked:
            status = "Verified evidence"
            reason = f"{len(linked)} student-supplied Proof Vault entr{'y' if len(linked) == 1 else 'ies'} directly link{'s' if len(linked) == 1 else ''} to this claim. External content was not independently verified."
        elif demonstrated:
            status = "Resume supported"
            reason = "The resume connects this claim to a project, experience, responsibility, or implementation statement."
        elif segments or normalized in {_normalize(item) for item in matched}:
            status = "Self-declared"
            reason = "The claim is listed in the resume or Trust Card but lacks demonstrated resume context or linked Proof Vault evidence."
        else:
            status = "Needs clarification"
            reason = "The available saved evidence does not clearly establish how this claim was demonstrated."

        results.append({
            "claim": claim,
            "status": status,
            "reason": reason,
            "resumeEvidence": segments[:2],
            "proofEvidence": [{
                "id": str(item["id"]), "title": item["title"],
                "proofType": item["proof_type"], "urlOrReference": item["url_or_reference"],
            } for item in linked],
        })

    return {
        "statusVersion": STATUS_VERSION,
        "claims": results,
        "limitation": (
            "Statuses describe support in student-provided resume and Proof Vault records. "
            "RefAI does not independently verify external links, documents, ownership, or claim accuracy."
        ),
    }
