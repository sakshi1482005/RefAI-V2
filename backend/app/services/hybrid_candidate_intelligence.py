"""Academic, deterministic composite of existing RefAI candidate-intelligence signals.

This module is deliberately separate from Candidate Trust Score v2.  It never
mutates, replaces, or feeds back into Trust Score v2, referral compatibility,
or a hiring decision.  All numeric values are composed from existing
deterministic services.

Mathematical formula (all component inputs are bounded to 0..100):

    hybrid_score = round(
        0.40 * trust_score_v2
      + 0.25 * fuzzy_suitability
      + 0.25 * semantic_job_match
      + 0.10 * claim_evidence_verification,
      2,
    )

Claim/evidence verification maps deterministic statuses to visible support
levels: Evidence supported/Verified evidence=100, Partially supported/Resume
supported=65, Self-declared=35, Needs clarification=20.  With no significant
claims to assess it uses an explicit neutral 50, rather than inventing a
claim-quality conclusion.
"""

from __future__ import annotations

from typing import Any

from app.models.schemas import HybridCandidateIntelligenceResponse


ALGORITHM_VERSION = "hybrid-candidate-intelligence-v1"
WEIGHTS = {
    "trust_score_v2": 40,
    "fuzzy_suitability": 25,
    "semantic_job_match": 25,
    "claim_evidence_verification": 10,
}
_STATUS_VALUES = {
    "Evidence supported": 100.0,
    "Verified evidence": 100.0,
    "Partially supported": 65.0,
    "Resume supported": 65.0,
    "Self-declared": 35.0,
    "Needs clarification": 20.0,
}


def _bounded(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    return max(0.0, min(100.0, float(value)))


def claim_evidence_score(claim_verification: dict[str, Any] | None) -> tuple[float, str, list[str], list[str]]:
    """Reduce existing deterministic claim statuses to a transparent 0..100 signal."""
    claims = claim_verification.get("claims") if isinstance(claim_verification, dict) else None
    if not isinstance(claims, list) or not claims:
        return (
            50.0,
            "No significant claims were available for verification; a neutral claim-evidence value was used.",
            [],
            ["No significant claim-verification records were available."],
        )

    values: list[float] = []
    positives: list[str] = []
    risks: list[str] = []
    for claim in claims:
        if not isinstance(claim, dict):
            continue
        status = str(claim.get("status") or "Needs clarification")
        value = _STATUS_VALUES.get(status, _STATUS_VALUES["Needs clarification"])
        values.append(value)
        text = str(claim.get("claim") or "A resume claim").strip()
        if value >= 65:
            positives.append(f"{text[:180]} — {status}.")
        else:
            risks.append(f"{text[:180]} — {status}.")
    if not values:
        return 50.0, "No usable claim-verification records were available; a neutral value was used.", [], ["Claim-verification records were incomplete."]
    return round(sum(values) / len(values), 2), "Average of deterministic claim-verification status values.", positives[:3], risks[:4]


def _label(score: float) -> str:
    return "Low" if score < 40 else "Moderate" if score < 70 else "High"


def build_hybrid_candidate_intelligence(
    *, trust_card: dict[str, Any], fuzzy_suitability: dict[str, Any],
    semantic_job_match: dict[str, Any], claim_verification: dict[str, Any] | None,
) -> HybridCandidateIntelligenceResponse:
    """Compose existing outputs without delegating numeric work to an LLM."""
    trust_score = _bounded(trust_card.get("trustScore"))
    fuzzy_score = _bounded(fuzzy_suitability.get("fuzzy_suitability_score"))
    semantic_score = _bounded(semantic_job_match.get("semantic_match_score"))
    claim_score, claim_basis, claim_positives, claim_risks = claim_evidence_score(claim_verification)
    scores = {
        "trust_score_v2": trust_score,
        "fuzzy_suitability": fuzzy_score,
        "semantic_job_match": semantic_score,
        "claim_evidence_verification": claim_score,
    }
    contributions = {key: round(score * WEIGHTS[key] / 100, 2) for key, score in scores.items()}
    hybrid_score = round(sum(contributions.values()), 2)
    label = _label(hybrid_score)

    semantic_limitations = semantic_job_match.get("limitations")
    semantic_limitation = "; ".join(str(item) for item in semantic_limitations[:2]) if isinstance(semantic_limitations, list) else None
    fuzzy_sources = fuzzy_suitability.get("inputSources")
    fuzzy_limitation = None
    if isinstance(fuzzy_sources, dict):
        neutral_inputs = [name.replace("_", " ") for name, source in fuzzy_sources.items() if "neutral default" in str(source)]
        if neutral_inputs:
            fuzzy_limitation = f"Neutral defaults were used for: {', '.join(neutral_inputs)}."

    breakdown = [
        {"key": "trust_score_v2", "label": "Candidate Trust Score v2", "score": trust_score, "weight": 40, "contribution": contributions["trust_score_v2"], "basis": "Existing deterministic five-component Candidate Trust Score v2.", "limitation": None},
        {"key": "fuzzy_suitability", "label": "Fuzzy Candidate Suitability", "score": fuzzy_score, "weight": 25, "contribution": contributions["fuzzy_suitability"], "basis": "Existing deterministic fuzzy rule base evaluated from persisted RefAI evidence.", "limitation": fuzzy_limitation},
        {"key": "semantic_job_match", "label": "Semantic Job Match", "score": semantic_score, "weight": 25, "contribution": contributions["semantic_job_match"], "basis": "Existing deterministic vector or lexical relevance and required-skill coverage.", "limitation": semantic_limitation},
        {"key": "claim_evidence_verification", "label": "Claim & Evidence Verification", "score": claim_score, "weight": 10, "contribution": contributions["claim_evidence_verification"], "basis": claim_basis, "limitation": "Claim statuses identify visible support only; they do not independently verify external facts."},
    ]

    positive_factors = list(dict.fromkeys([
        *[str(item) for item in semantic_job_match.get("matched_skills", [])[:3]],
        *[str(item) for item in fuzzy_suitability.get("strongest_positive_factors", [])[:2] if isinstance(item, str)],
        *claim_positives,
    ]))[:6]
    # Fuzzy factors are structured dictionaries, so make only safe visible labels.
    for factor in fuzzy_suitability.get("strongest_positive_factors", []):
        if isinstance(factor, dict) and float(factor.get("value") or 0) >= 70:
            positive_factors.append(f"Strong {str(factor.get('input') or '').replace('_', ' ')} evidence.")
    risk_gap_factors = list(dict.fromkeys([
        *[f"Missing required skill evidence: {item}." for item in semantic_job_match.get("missing_skills", [])[:3]],
        *[str(item) for item in semantic_job_match.get("weak_missing_evidence", [])[:2]],
        *claim_risks,
    ]))[:7]

    explanation = (
        f"Hybrid Candidate Intelligence v1 is a separate academic composite with a {label.lower()} result. "
        "It combines existing deterministic candidate signals: 40% Trust Score v2, 25% Fuzzy Candidate Suitability, "
        "25% Semantic Job Match, and 10% Claim & Evidence Verification. It is not a hiring prediction or decision."
    )
    return HybridCandidateIntelligenceResponse(
        algorithm_version=ALGORITHM_VERSION,
        hybrid_score=hybrid_score,
        label=label,
        component_scores=scores,
        contribution_breakdown=breakdown,
        positive_factors=positive_factors[:6],
        risk_gap_factors=risk_gap_factors,
        explanation=explanation,
    )
