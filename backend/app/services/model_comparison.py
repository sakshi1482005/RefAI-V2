"""Academic, read-only presentation of existing RefAI model outputs.

This service deliberately does not compare model accuracy or predict outcomes.
It places existing deterministic outputs in a chart/table-friendly shape for
capstone evaluation, with each score retaining its original interpretation.
"""

from __future__ import annotations

from typing import Any

from app.models.schemas import ModelComparisonResponse


COMPARISON_VERSION = "model-comparison-v1"


def _bounded(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    return round(max(0.0, min(100.0, float(value))), 2)


def _trust_components(card: dict[str, Any]) -> list[dict[str, Any]]:
    components = []
    for item in card.get("scoreBreakdown") or []:
        if not isinstance(item, dict):
            continue
        maximum = item.get("maximumScore") if isinstance(item.get("maximumScore"), (int, float)) else item.get("weight")
        components.append({
            "key": str(item.get("key") or "trust_component"),
            "label": str(item.get("label") or "Trust Score component"),
            "value": _bounded(item.get("contribution")),
            "maximumScore": _bounded(maximum) if isinstance(maximum, (int, float)) else None,
            "unit": "points",
            "basis": str(item.get("formulaOrBasis") or item.get("reason") or "Existing deterministic Trust Score v2 component."),
        })
    return components


def build_model_comparison(
    *, trust_card: dict[str, Any], fuzzy_suitability: dict[str, Any],
    semantic_job_match: dict[str, Any], hybrid_intelligence: dict[str, Any],
    target_role: str | None,
) -> ModelComparisonResponse:
    """Shape existing model values for academic comparison without recalculation."""
    fuzzy_inputs = fuzzy_suitability.get("inputValuesUsed") if isinstance(fuzzy_suitability.get("inputValuesUsed"), dict) else {}
    fuzzy_memberships = fuzzy_suitability.get("input_memberships") if isinstance(fuzzy_suitability.get("input_memberships"), dict) else {}
    fuzzy_components = [
        {
            "key": str(key), "label": str(key).replace("_", " ").title(), "value": _bounded(value),
            "maximumScore": 100, "unit": "normalized_input",
            "basis": "Existing normalized input to the deterministic fuzzy rule base.",
        }
        for key, value in fuzzy_inputs.items() if isinstance(value, (int, float))
    ]
    for name, memberships in fuzzy_memberships.items():
        if not isinstance(memberships, dict):
            continue
        for level in ("low", "medium", "high"):
            value = memberships.get(level)
            if isinstance(value, (int, float)):
                fuzzy_components.append({
                    "key": f"{name}_{level}", "label": f"{str(name).replace('_', ' ').title()} · {level.title()}",
                    "value": max(0.0, min(1.0, float(value))), "maximumScore": 1, "unit": "membership",
                    "basis": "Existing Low/Medium/High fuzzy membership degree.",
                })

    semantic_components = [
        {
            "key": "semantic_match_score", "label": "Semantic relevance and required-skill coverage",
            "value": _bounded(semantic_job_match.get("semantic_match_score")), "maximumScore": 100,
            "unit": "points", "basis": "Existing deterministic semantic/vector or lexical relevance output.",
        },
        {
            "key": "matched_skill_count", "label": "Matched skills", "value": float(len(semantic_job_match.get("matched_skills") or [])),
            "maximumScore": None, "unit": "count", "basis": "Count of requirements with saved resume evidence.",
        },
        {
            "key": "missing_skill_count", "label": "Missing skill evidence", "value": float(len(semantic_job_match.get("missing_skills") or [])),
            "maximumScore": None, "unit": "count", "basis": "Count of extracted requirements without saved resume evidence.",
        },
    ]
    hybrid_components = [
        {
            "key": str(item.get("key") or "hybrid_component"), "label": str(item.get("label") or "Hybrid component"),
            "value": _bounded(item.get("contribution")), "maximumScore": _bounded(item.get("weight")), "unit": "points",
            "basis": str(item.get("basis") or "Existing deterministic Hybrid Candidate Intelligence contribution."),
        }
        for item in hybrid_intelligence.get("contribution_breakdown") or [] if isinstance(item, dict)
    ]
    return ModelComparisonResponse(
        comparisonVersion=COMPARISON_VERSION,
        targetRole=target_role or None,
        relevanceSource=semantic_job_match.get("relevance_source") if semantic_job_match.get("relevance_source") in {"job_description", "role_context"} else "role_context",
        models=[
            {
                "key": "trust_score_v2", "label": "Candidate Trust Score v2", "score": _bounded(trust_card.get("trustScore")),
                "algorithmVersion": str(trust_card.get("scoreVersion") or "trust-score-v2"),
                "measures": "Five deterministic components of role requirement match, evidence strength, project and experience relevance, skill depth, and resume evidence completeness.",
                "components": _trust_components(trust_card),
                "limitations": ["This score measures observed resume evidence for the selected opportunity; it is not an ATS score or hiring prediction."],
            },
            {
                "key": "fuzzy_suitability", "label": "Fuzzy Candidate Suitability", "score": _bounded(fuzzy_suitability.get("fuzzy_suitability_score")),
                "algorithmVersion": str(fuzzy_suitability.get("algorithm_version") or "fuzzy-candidate-suitability-v1"),
                "measures": "An academic fuzzy-rule interpretation of normalized skill, relevance, experience, education, evidence, and resume-structure inputs.",
                "components": fuzzy_components,
                "limitations": ["Fuzzy memberships express rule activation, not probability or independent verification."],
            },
            {
                "key": "semantic_job_match", "label": "Semantic Job Match", "score": _bounded(semantic_job_match.get("semantic_match_score")),
                "algorithmVersion": str(semantic_job_match.get("semantic_match_version") or "semantic-job-match-v1"),
                "measures": "Deterministic semantic relevance between saved project/experience evidence and the selected role or Job Description, combined with requirement coverage.",
                "components": semantic_components,
                "limitations": [str(item) for item in semantic_job_match.get("limitations") or []][:4],
            },
            {
                "key": "hybrid_candidate_intelligence", "label": "Hybrid Candidate Intelligence", "score": _bounded(hybrid_intelligence.get("hybrid_score")),
                "algorithmVersion": str(hybrid_intelligence.get("algorithm_version") or "hybrid-candidate-intelligence-v1"),
                "measures": "A separate academic composite of the existing Trust Score v2, Fuzzy Suitability, Semantic Job Match, and claim-evidence verification outputs.",
                "components": hybrid_components,
                "limitations": ["The hybrid score is a transparent academic composite and does not replace Trust Score v2 or predict outcomes."],
            },
        ],
        activatedFuzzyRules=[item for item in fuzzy_suitability.get("activated_rules") or [] if isinstance(item, dict)][:10],
        fuzzyExplanation=str(fuzzy_suitability.get("explanation") or "") or None,
        semanticEvidence=[item for item in semantic_job_match.get("strongest_matching_evidence") or [] if isinstance(item, dict)][:12],
        semanticExplanation=str(semantic_job_match.get("role_relevance_explanation") or "") or None,
        semanticMatchedSkills=[str(item) for item in semantic_job_match.get("matched_skills") or []][:50],
        semanticMissingSkills=[str(item) for item in semantic_job_match.get("missing_skills") or []][:50],
        semanticWeakEvidence=[str(item) for item in semantic_job_match.get("weak_missing_evidence") or []][:12],
        hybridContributions=[item for item in hybrid_intelligence.get("contribution_breakdown") or [] if isinstance(item, dict)][:4],
        hybridExplanation=str(hybrid_intelligence.get("explanation") or "") or None,
        hybridPositiveFactors=[str(item) for item in hybrid_intelligence.get("positive_factors") or []][:8],
        hybridRiskGapFactors=[str(item) for item in hybrid_intelligence.get("risk_gap_factors") or []][:8],
        methodologyNote="Scores are presented side by side because they measure different deterministic aspects of the same saved candidate and opportunity. This response contains no fabricated accuracy, calibration, hiring, or referral-success metric.",
    )
