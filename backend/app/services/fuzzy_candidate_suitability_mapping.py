"""Map persisted RefAI evidence to the isolated fuzzy suitability inputs.

This mapping intentionally does not alter, reuse as a replacement for, or write
back to Candidate Trust Score v2.  Each input either comes from an existing
persisted deterministic basis or a documented neutral value where RefAI does
not currently persist a reliable dedicated metric.
"""

from __future__ import annotations

from typing import Any

from app.models.schemas import FuzzyCandidateSuitabilityInput


NEUTRAL_INPUT = 50.0


def _normalized(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and 0 <= value <= 100:
        return float(value)
    return None


def _breakdown_basis(trust_card: dict[str, Any] | None, key: str) -> float | None:
    if not isinstance(trust_card, dict):
        return None
    breakdown = trust_card.get("scoreBreakdown")
    if not isinstance(breakdown, list):
        return None
    for item in breakdown:
        if isinstance(item, dict) and item.get("key") == key:
            return _normalized(item.get("basisPercentage"))
    return None


def _skill_coverage(analysis: dict[str, Any]) -> float | None:
    matched = analysis.get("matchedSkills")
    missing = analysis.get("missingSkills")
    if not isinstance(matched, list) or not isinstance(missing, list):
        return None
    values = {
        str(skill).strip().casefold()
        for skill in [*matched, *missing]
        if isinstance(skill, str) and skill.strip()
    }
    if not values:
        return None
    matched_values = {
        str(skill).strip().casefold()
        for skill in matched
        if isinstance(skill, str) and skill.strip()
    }
    return round(len(values & matched_values) * 100 / len(values), 2)


def _resume_section_coverage(analysis: dict[str, Any]) -> float | None:
    sections = analysis.get("resumeSectionsUsed")
    if not isinstance(sections, list):
        return None
    unique_sections = {
        item.strip().casefold()
        for item in sections
        if isinstance(item, str) and item.strip()
    }
    if not unique_sections:
        return None
    # Four or more identified sections represent complete structural coverage;
    # this is a bounded observable resume-structure signal, not a quality claim.
    return round(min(100, len(unique_sections) * 25), 2)


def _education_completeness(profile: dict[str, Any], trust_card: dict[str, Any] | None) -> float | None:
    card_education = trust_card.get("education") if isinstance(trust_card, dict) else None
    education = card_education if isinstance(card_education, dict) else profile
    fields = ("college", "degree", "branch", "graduationYear")
    present = sum(1 for field in fields if str(education.get(field) or "").strip())
    return round(present * 25, 2) if present else None


def build_fuzzy_suitability_inputs(
    session: dict[str, Any], profile: dict[str, Any],
) -> tuple[FuzzyCandidateSuitabilityInput, dict[str, str]]:
    """Build normalized inputs and safe source notes from the latest saved session."""
    analysis = session.get("analysis") if isinstance(session.get("analysis"), dict) else {}
    trust_card = session.get("trustCard") if isinstance(session.get("trustCard"), dict) else None
    values: dict[str, float] = {}
    sources: dict[str, str] = {}

    mappings = (
        ("skill_match", "roleRequirementMatch", _skill_coverage, "matchedSkills/missingSkills coverage"),
        ("project_relevance", "projectExperienceRelevance", None, None),
        ("evidence_strength", "evidenceStrength", lambda payload: _normalized(payload.get("proof")), "persisted analysis proof signal"),
        ("resume_quality", "resumeEvidenceCompleteness", _resume_section_coverage, "identified resume sections"),
    )
    for input_name, component_key, fallback, fallback_label in mappings:
        value = _breakdown_basis(trust_card, component_key)
        if value is not None:
            values[input_name] = value
            sources[input_name] = f"current Trust Card {component_key}.basisPercentage"
        elif fallback:
            fallback_value = fallback(analysis)
            if fallback_value is not None:
                values[input_name] = fallback_value
                sources[input_name] = fallback_label or "persisted analysis"
                continue
            values[input_name] = NEUTRAL_INPUT
            sources[input_name] = "neutral default (no reliable persisted metric is available)"
        else:
            values[input_name] = NEUTRAL_INPUT
            sources[input_name] = "neutral default (no current Trust Card project-relevance basis is available)"

    education = _education_completeness(profile, trust_card)
    if education is None:
        values["education"] = NEUTRAL_INPUT
        sources["education"] = "neutral default (no persisted education fields are available)"
    else:
        values["education"] = education
        sources["education"] = "persisted student profile or current Trust Card education-field completeness"

    # RefAI has no persisted, stand-alone experience-depth component. Project
    # relevance deliberately combines project and experience evidence, so using
    # it here would double-count and misrepresent the unavailable metric.
    values["experience"] = NEUTRAL_INPUT
    sources["experience"] = "neutral default (RefAI has no dedicated persisted experience metric)"

    return FuzzyCandidateSuitabilityInput(**values), sources
