from __future__ import annotations

from typing import Any


SIMULATOR_VERSION = "smart-improvement-simulator-v1"


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
