from __future__ import annotations

from typing import Any

from app.models.schemas import FuzzyCandidateSuitabilityInput
from app.services.fuzzy_candidate_suitability import evaluate_fuzzy_candidate_suitability
from app.services.hybrid_candidate_intelligence import build_hybrid_candidate_intelligence


SIMULATOR_VERSION = "smart-improvement-simulator-v1"
SIMULATION_VERSION = "hybrid-improvement-simulation-v1"
_PRIORITY_GAIN = {"High": 12.0, "Medium": 8.0, "Low": 4.0}


def _components(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item.get("key")): item for item in payload.get("scoreBreakdown") or [] if item.get("key")}


def build_improvement_simulator(
    current: dict[str, Any],
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    current_components = _components(current)
    current_score = int(current.get("trustScore") or sum(int(item.get("score") or 0) for item in current_components.values()))
    suggestions = []
    for component in current_components.values():
        score = max(0, int(component.get("score") or 0))
        maximum = max(score, int(component.get("maximumScore") or component.get("weight") or 0))
        available = maximum - score
        declared = int(component.get("potentialImprovementPoints") or available)
        potential = min(available, max(0, declared))
        if potential <= 0:
            continue
        missing = [str(item) for item in component.get("evidenceMissing") or [] if str(item).strip()]
        action = str(component.get("improvementAction") or "Add truthful, specific evidence for an observable gap.").strip()
        suggestions.append({
            "componentKey": component["key"],
            "affectedComponent": component.get("label") or component["key"],
            "missingEvidence": missing[:3] or ["The component has remaining evidence capacity, but the saved analysis did not identify a more specific gap."],
            "recommendedAction": action,
            "maximumPotentialPoints": potential,
            "limitation": (
                f"At most {potential} additional point{'s' if potential != 1 else ''} remain in this component. "
                "Actual changes require truthful, relevant evidence and a new deterministic analysis; wording or keyword repetition alone earns no credit."
            ),
        })
    suggestions.sort(key=lambda item: (-item["maximumPotentialPoints"], item["affectedComponent"]))

    comparison = None
    comparison_limitation = "No earlier analysis with the same target role, company, and score version was available."
    if previous and previous.get("scoreVersion") == current.get("scoreVersion"):
        previous_components = _components(previous)
        deltas = []
        for key, component in current_components.items():
            old = previous_components.get(key)
            if not old:
                continue
            current_points, previous_points = int(component.get("score") or 0), int(old.get("score") or 0)
            current_evidence = [str(item) for item in component.get("evidenceFound") or []]
            previous_evidence = [str(item) for item in old.get("evidenceFound") or []]
            added = [item for item in current_evidence if item not in previous_evidence]
            removed = [item for item in previous_evidence if item not in current_evidence]
            causes = [*added[:3], *[f"No longer observed: {item}" for item in removed[:3]]]
            if not causes and current_points != previous_points:
                causes = ["The deterministic evidence tier or component basis changed; no new standalone evidence snippet was recorded."]
            deltas.append({
                "componentKey": key, "component": component.get("label") or key,
                "previousScore": previous_points, "currentScore": current_points,
                "delta": current_points - previous_points, "evidenceCausingChange": causes,
            })
        previous_score = int(previous.get("trustScore") or sum(int(item.get("score") or 0) for item in previous_components.values()))
        comparison = {
            "previousScore": previous_score, "currentScore": current_score,
            "delta": current_score - previous_score, "componentDeltas": deltas,
            "scoreVersion": current.get("scoreVersion"),
        }
        comparison_limitation = "Comparison uses the same target role, company, and deterministic score version; it does not prove that one edit alone caused the change."

    return {
        "simulatorVersion": SIMULATOR_VERSION,
        "scoreVersion": current.get("scoreVersion") or "legacy-unversioned",
        "currentScore": current_score,
        "maximumScore": 100,
        "suggestions": suggestions,
        "totalMaximumPotentialPoints": min(max(0, 100 - current_score), sum(item["maximumPotentialPoints"] for item in suggestions)),
        "comparison": comparison,
        "limitations": [
            "Potential points are upper bounds, never guaranteed score gains.",
            "Only truthful, observable resume evidence should be added; keyword stuffing and unsupported claims receive no recommendation.",
            comparison_limitation,
        ],
    }


def attach_intelligence_snapshot(
    result: dict[str, Any], *, fuzzy_suitability: dict[str, Any],
    semantic_job_match: dict[str, Any], hybrid_intelligence: dict[str, Any],
    recommendations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Extend the existing response without changing its Trust Score baseline."""
    return {
        **result,
        "intelligenceSnapshot": {
            "fuzzySuitabilityScore": round(float(fuzzy_suitability["fuzzy_suitability_score"]), 2),
            "semanticJobMatchScore": round(float(semantic_job_match["semantic_match_score"]), 2),
            "hybridScore": round(float(hybrid_intelligence["hybrid_score"]), 2),
            "algorithmVersion": hybrid_intelligence["algorithm_version"],
            "availableSkillScenarios": [
                {"skill": str(item["skill"]), "priority": str(item["priority"])}
                for item in (recommendations or [])[:10]
                if item.get("skill") and item.get("priority") in {"High", "Medium", "Low"}
            ],
        },
        "simulation": None,
        "limitations": [
            *result["limitations"],
            "Hybrid intelligence values are separate academic signals. They do not change Candidate Trust Score v2 or predict hiring or referral outcomes.",
        ],
    }


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def simulate_hypothetical_improvements(
    result: dict[str, Any], *, fuzzy_suitability: dict[str, Any],
    semantic_job_match: dict[str, Any], hybrid_intelligence: dict[str, Any],
    trust_card: dict[str, Any], claim_verification: dict[str, Any],
    recommendations: list[dict[str, Any]], selected_skills: list[str],
    add_project_evidence: bool,
) -> dict[str, Any]:
    """Return an in-memory academic estimate; no persisted candidate data is mutated.

    Each selected validated skill scenario increases hypothetical semantic
    relevance by 12/8/4 points for High/Medium/Low priority respectively,
    capped at 25 total. It increases fuzzy skill match by the same capped
    amount and fuzzy evidence strength by half that amount, capped at 12. A
    hypothetical project-evidence scenario adds 10 to project relevance and 5
    to evidence strength. The existing fuzzy and hybrid engines then
    deterministically recompute their outputs. Trust Score v2 is not changed.
    """
    available = {" ".join(str(item.get("skill") or "").split()).casefold(): item for item in recommendations}
    normalized_selected = [" ".join(skill.split()).casefold() for skill in selected_skills]
    unknown = [skill for skill in selected_skills if " ".join(skill.split()).casefold() not in available]
    if unknown:
        raise ValueError("Selected skill evidence must be an available recommendation.")

    selected = [available[skill] for skill in normalized_selected]
    skill_gain = min(20.0, sum(_PRIORITY_GAIN.get(str(item.get("priority")), 4.0) for item in selected))
    semantic_gain = min(25.0, skill_gain + (10.0 if add_project_evidence else 0.0))
    evidence_gain = min(12.0, skill_gain / 2 + (5.0 if add_project_evidence else 0.0))
    inputs = dict(fuzzy_suitability.get("inputValuesUsed") or {})
    if not inputs:
        raise ValueError("Current fuzzy suitability inputs are unavailable for simulation.")
    simulated_inputs = {
        **inputs,
        "skill_match": _clamp(float(inputs["skill_match"]) + skill_gain),
        "evidence_strength": _clamp(float(inputs["evidence_strength"]) + evidence_gain),
        "project_relevance": _clamp(float(inputs["project_relevance"]) + (10.0 if add_project_evidence else 0.0)),
    }
    simulated_fuzzy = evaluate_fuzzy_candidate_suitability(FuzzyCandidateSuitabilityInput(**simulated_inputs)).model_dump()
    simulated_semantic = {
        **semantic_job_match,
        "semantic_match_score": _clamp(float(semantic_job_match["semantic_match_score"]) + semantic_gain),
    }
    simulated_hybrid = build_hybrid_candidate_intelligence(
        trust_card=trust_card, fuzzy_suitability=simulated_fuzzy,
        semantic_job_match=simulated_semantic, claim_verification=claim_verification,
    ).model_dump()
    current_hybrid = round(float(hybrid_intelligence["hybrid_score"]), 2)
    simulated_hybrid_score = round(float(simulated_hybrid["hybrid_score"]), 2)
    changed = [
        {
            "key": "fuzzy_suitability", "label": "Fuzzy Candidate Suitability",
            "currentScore": round(float(fuzzy_suitability["fuzzy_suitability_score"]), 2),
            "simulatedScore": round(float(simulated_fuzzy["fuzzy_suitability_score"]), 2),
            "difference": round(float(simulated_fuzzy["fuzzy_suitability_score"]) - float(fuzzy_suitability["fuzzy_suitability_score"]), 2),
            "whyChanged": "The scenario adds hypothetical, truthful skill and/or project evidence to existing fuzzy inputs.",
        },
        {
            "key": "semantic_job_match", "label": "Semantic Job Match",
            "currentScore": round(float(semantic_job_match["semantic_match_score"]), 2),
            "simulatedScore": round(float(simulated_semantic["semantic_match_score"]), 2),
            "difference": round(float(simulated_semantic["semantic_match_score"]) - float(semantic_job_match["semantic_match_score"]), 2),
            "whyChanged": "The scenario assumes the selected requirement is later supported by relevant implementation evidence.",
        },
        {
            "key": "hybrid_intelligence", "label": "Hybrid Candidate Intelligence",
            "currentScore": current_hybrid, "simulatedScore": simulated_hybrid_score,
            "difference": round(simulated_hybrid_score - current_hybrid, 2),
            "whyChanged": "Hybrid Candidate Intelligence recombines the simulated fuzzy and semantic values; Candidate Trust Score v2 is unchanged.",
        },
    ]
    why = [
        *[f"Simulation assumes truthful implementation evidence for {item['skill']}." for item in selected],
        *( ["Simulation assumes an added project description that explains implementation, individual contribution, and an observable result."] if add_project_evidence else [] ),
    ]
    return {
        **attach_intelligence_snapshot(result, fuzzy_suitability=fuzzy_suitability, semantic_job_match=semantic_job_match, hybrid_intelligence=hybrid_intelligence, recommendations=recommendations),
        "simulation": {
            "isSimulation": True,
            "currentScore": current_hybrid,
            "simulatedScore": simulated_hybrid_score,
            "difference": round(simulated_hybrid_score - current_hybrid, 2),
            "affectedComponents": [item for item in changed if item["difference"] != 0],
            "whyScoreChanged": why,
            "limitations": [
                "This is an estimate only. It does not modify the resume, profile, Trust Score v2, or persisted evidence.",
                "A future result requires truthful implementation evidence and a new analysis; learning intent, keyword additions, or unsupported claims earn no automatic credit.",
                "The simulation does not guarantee a score increase, referral, interview, or employment outcome.",
            ],
        },
    }
