"""Deterministic learning recommendations from RefAI's existing evidence records.

The engine recommends only requirement evidence gaps from the selected role or
Job Description. Semantic Job Match identifies explicit absent-resume gaps; a
skill merely named in the resume is never treated as demonstrated here unless
claim verification classifies it as
Evidence supported, Verified evidence, Partially supported, or Resume
supported.  The engine never infers candidate experience or promises any
employment, referral, or score outcome.

Ranking formula:
  rank = requirement_priority_weight * 100 + round((100 - current_suitability) / 10)
where critical/important/optional map to 3/2/1.  Ties use skill name.

Potential suitability impact is intentionally a bounded planning estimate,
not a predicted score change:
  min(25, round((100 - current_suitability) * priority_weight / 12, 2))
"""

from __future__ import annotations

from typing import Any

from app.models.schemas import SkillGapRecommendationResponse
from app.services.requirement_extractor import PRIORITY_WEIGHT, build_gap


ALGORITHM_VERSION = "skill-gap-recommendation-v1"
_PRIORITY_LABELS = {"critical": "High", "important": "Medium", "optional": "Low"}
_SUPPORTED_CLAIM_STATUSES = {
    "Evidence supported", "Verified evidence", "Partially supported", "Resume supported",
}


def _normalized(value: object) -> str:
    return " ".join(str(value or "").split()).casefold()


def _bounded_score(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    return max(0.0, min(100.0, float(value)))


def _verified_claim_names(claim_verification: dict[str, Any] | None) -> set[str]:
    claims = claim_verification.get("claims") if isinstance(claim_verification, dict) else []
    if not isinstance(claims, list):
        return set()
    return {
        _normalized(item.get("claim"))
        for item in claims
        if isinstance(item, dict) and str(item.get("status") or "") in _SUPPORTED_CLAIM_STATUSES
    }


def _matches_verified_claim(skill: str, verified_claims: set[str]) -> bool:
    normalized_skill = _normalized(skill)
    return any(normalized_skill and normalized_skill in claim for claim in verified_claims)


def build_skill_gap_recommendations(
    *, requirements: list[dict[str, Any]], semantic_job_match: dict[str, Any],
    fuzzy_suitability: dict[str, Any], claim_verification: dict[str, Any] | None,
) -> SkillGapRecommendationResponse:
    """Rank only known requirement gaps with deterministic, bounded estimates."""
    current_suitability = _bounded_score(fuzzy_suitability.get("fuzzy_suitability_score"))
    suitability_label = str(fuzzy_suitability.get("label") or "Moderate")
    if suitability_label not in {"Low", "Moderate", "High"}:
        suitability_label = "Moderate"

    semantic_missing = {
        _normalized(skill): str(skill).strip()
        for skill in semantic_job_match.get("missing_skills", [])
        if isinstance(skill, str) and skill.strip()
    }
    verified_claims = _verified_claim_names(claim_verification)
    recommendations: list[dict[str, Any]] = []
    for requirement in requirements:
        if not isinstance(requirement, dict):
            continue
        skill = str(requirement.get("requirement") or "").strip()
        priority = str(requirement.get("priority") or "important")
        if not skill or priority not in PRIORITY_WEIGHT:
            continue
        # A verified matching claim means the skill is not truly unsupported,
        # even if another stale artifact reported it missing.
        if _matches_verified_claim(skill, verified_claims):
            continue
        weight = PRIORITY_WEIGHT[priority]
        gap = build_gap(requirement)
        category = str(requirement.get("category") or "skill")
        semantic_gap = _normalized(skill) in semantic_missing
        evidence_basis = (
            "Semantic Job Match found no resume evidence for this requirement; no verified claim overrides that gap."
            if semantic_gap else
            "No verified resume claim supports this requirement. A textual mention alone is not treated as demonstrated evidence."
        )
        impact = min(25.0, round((100.0 - current_suitability) * weight / 12.0, 2))
        rank = weight * 100 + round((100.0 - current_suitability) / 10.0)
        recommendations.append({
            "skill": skill,
            "priority": _PRIORITY_LABELS[priority],
            "reason": (
                f"{skill} is a {priority} {category} requirement for this opportunity, "
                "and no verified resume evidence was found for it."
            ),
            "estimated_suitability_impact": impact,
            "project_improvement": (
                f"{gap['practicalAction']} Then add only truthful implementation evidence, "
                "your individual contribution, and an observable result to the resume."
            ),
            "evidence_basis": evidence_basis,
            "_rank": rank,
        })

    recommendations.sort(key=lambda item: (-item["_rank"], item["skill"].casefold()))
    for order, item in enumerate(recommendations, start=1):
        item["learning_order"] = order
        item.pop("_rank", None)

    limitations = [
        "Estimated suitability impact is a bounded planning estimate, not a guaranteed score change or outcome.",
        "Recommendations use only known role or Job Description requirements and visible resume/claim evidence; they do not infer unrecorded experience.",
        "Completing a learning action does not demonstrate the skill until truthful implementation evidence is added and a new analysis is run.",
    ]
    if semantic_job_match.get("relevance_source") == "role_context":
        limitations.append("No specific Job Description was provided; gaps were evaluated against general expectations for the selected role.")
    if not recommendations:
        limitations.append("No unsupported extracted skill requirements were available for a recommendation.")
    return SkillGapRecommendationResponse(
        algorithm_version=ALGORITHM_VERSION,
        current_suitability_score=current_suitability,
        current_suitability_label=suitability_label,
        missing_skills=[item["skill"] for item in recommendations],
        recommendations=recommendations,
        recommended_learning_order=[item["skill"] for item in recommendations],
        limitations=limitations,
    )
