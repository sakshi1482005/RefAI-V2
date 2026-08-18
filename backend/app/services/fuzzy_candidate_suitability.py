"""Deterministic, standalone fuzzy inference for academic suitability experiments.

This module deliberately has no dependency on the Candidate Trust Score.  Its
inputs are already-normalized academic signals, and it returns an explainable
Sugeno-style fuzzy result using only the memberships and rules defined below.
"""

from __future__ import annotations

from app.models.schemas import FuzzyCandidateSuitabilityInput, FuzzyCandidateSuitabilityResponse


ALGORITHM_VERSION = "fuzzy-candidate-suitability-v1"
INPUT_NAMES = (
    "skill_match",
    "project_relevance",
    "experience",
    "education",
    "evidence_strength",
    "resume_quality",
)
LABEL_CENTROIDS = {"Low": 0.0, "Moderate": 50.0, "High": 100.0}


def _round(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 4)


def membership_values(value: float) -> dict[str, float]:
    """Return overlapping Low, Medium, and High memberships for a 0–100 input.

    Low is a left shoulder (full through 25, zero at 50); Medium is centered at
    50; High is a right shoulder (zero at 50, full from 75).  The overlap makes
    boundary input changes gradual rather than abruptly categorical.
    """
    low = 1.0 if value <= 25 else (50 - value) / 25 if value < 50 else 0.0
    medium = value / 50 if value < 50 else (100 - value) / 50
    high = 0.0 if value <= 50 else (value - 50) / 25 if value < 75 else 1.0
    return {"Low": _round(low), "Medium": _round(medium), "High": _round(high)}


def _minimum(*values: float) -> float:
    return min(values)


def _maximum(*values: float) -> float:
    return max(values)


def _rule_base(memberships: dict[str, dict[str, float]]) -> list[tuple[str, str, str, float]]:
    """Evaluate transparent fuzzy IF/THEN rules using min for AND and max for OR."""
    value = lambda input_name, level: memberships[input_name][level]
    highest = lambda level: _maximum(*(value(name, level) for name in INPUT_NAMES))
    return [
        ("R1", "IF skill match, project relevance, evidence strength, and resume quality are High THEN suitability is High.", "High", _minimum(value("skill_match", "High"), value("project_relevance", "High"), value("evidence_strength", "High"), value("resume_quality", "High"))),
        ("R2", "IF skill match, project relevance, and experience are High THEN suitability is High.", "High", _minimum(value("skill_match", "High"), value("project_relevance", "High"), value("experience", "High"))),
        ("R3", "IF experience AND education AND resume quality are High THEN suitability is High.", "High", _minimum(value("experience", "High"), value("education", "High"), value("resume_quality", "High"))),
        ("R4", "IF skill match, project relevance, and evidence strength are Medium THEN suitability is Moderate.", "Moderate", _minimum(value("skill_match", "Medium"), value("project_relevance", "Medium"), value("evidence_strength", "Medium"))),
        ("R5", "IF experience, education, and resume quality are Medium THEN suitability is Moderate.", "Moderate", _minimum(value("experience", "Medium"), value("education", "Medium"), value("resume_quality", "Medium"))),
        ("R6", "IF skill match AND project relevance are Low THEN suitability is Low.", "Low", _minimum(value("skill_match", "Low"), value("project_relevance", "Low"))),
        ("R7", "IF evidence strength AND resume quality are Low THEN suitability is Low.", "Low", _minimum(value("evidence_strength", "Low"), value("resume_quality", "Low"))),
        ("R8", "IF project relevance AND experience are Low THEN suitability is Low.", "Low", _minimum(value("project_relevance", "Low"), value("experience", "Low"))),
        ("R9", "IF any input is Medium THEN suitability is Moderate while the profile remains mixed.", "Moderate", highest("Medium")),
        ("R10", "IF the inputs contain both High and Low evidence THEN suitability is Moderate pending balanced evidence.", "Moderate", _minimum(highest("High"), highest("Low"))),
    ]


def _factor(input_name: str, value: float, memberships: dict[str, float]) -> dict:
    ordered = ("High", "Medium", "Low")
    dominant = max(ordered, key=lambda level: memberships[level])
    return {
        "input": input_name,
        "value": round(value, 2),
        "dominant_membership": dominant,
        "membership": memberships[dominant],
    }


def evaluate_fuzzy_candidate_suitability(
    payload: FuzzyCandidateSuitabilityInput,
) -> FuzzyCandidateSuitabilityResponse:
    """Evaluate the isolated fuzzy suitability model without persistence or AI.

    Defuzzification is the activation-weighted average of the explicit Low,
    Moderate, and High singleton consequents (0, 50, and 100).  It is therefore
    repeatable, bounded, and directly traceable to the activated rule list.
    """
    raw_inputs = payload.model_dump()
    memberships = {name: membership_values(float(raw_inputs[name])) for name in INPUT_NAMES}
    activated = [
        {"id": rule_id, "rule": rule, "consequent": consequent, "activation": _round(activation)}
        for rule_id, rule, consequent, activation in _rule_base(memberships)
        if activation > 0
    ]

    weighted_activation = sum(item["activation"] for item in activated)
    # R9/R10 ensure all valid normalized inputs activate at least one rule.
    score = sum(item["activation"] * LABEL_CENTROIDS[item["consequent"]] for item in activated) / weighted_activation
    score = round(max(0.0, min(100.0, score)), 2)
    label = "Low" if score < 40 else "Moderate" if score < 70 else "High"

    factors = [_factor(name, float(raw_inputs[name]), memberships[name]) for name in INPUT_NAMES]
    strongest = sorted(factors, key=lambda item: (-item["value"], item["input"]))[:3]
    weakest = sorted(factors, key=lambda item: (item["value"], item["input"]))[:3]
    strongest_names = ", ".join(item["input"].replace("_", " ") for item in strongest[:2])
    weakest_names = ", ".join(item["input"].replace("_", " ") for item in weakest[:2])
    explanation = (
        f"The deterministic fuzzy rule base produced a {label.lower()} suitability result from "
        f"{len(activated)} activated rule(s). Strongest normalized inputs: {strongest_names}. "
        f"Weakest normalized inputs: {weakest_names}."
    )

    return FuzzyCandidateSuitabilityResponse(
        algorithm_version=ALGORITHM_VERSION,
        fuzzy_suitability_score=score,
        label=label,
        input_memberships={
            name: {"low": values["Low"], "medium": values["Medium"], "high": values["High"]}
            for name, values in memberships.items()
        },
        activated_rules=activated,
        strongest_positive_factors=strongest,
        weakest_factors=weakest,
        explanation=explanation,
    )
