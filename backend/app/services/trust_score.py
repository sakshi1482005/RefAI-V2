from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Protocol

from app.services.requirement_extractor import classify_job_description, extract_requirements


SCORE_VERSION = "trust-score-v4-vector-relevance"
COMPONENT_WEIGHTS = {
    "roleRequirementMatch": 30,
    "evidenceStrength": 25,
    "projectExperienceRelevance": 20,
    "skillDepth": 15,
    "resumeEvidenceCompleteness": 10,
}
SKILL_CATEGORIES = {
    "programming language", "framework", "database", "cloud platform", "tool",
    "testing technology", "software engineering practice", "collaboration requirement",
}

_MEASURABLE = re.compile(
    r"(?:\b\d+(?:\.\d+)?%|\b\d+\+?\s*(?:users?|clients?|requests?|projects?|"
    r"hours?|days?|weeks?|months?|years?)\b|\b(?:increased|reduced|improved|"
    r"decreased|saved|grew|accelerated|cut)\b[^.\n]{0,50}\b\d+)",
    re.IGNORECASE,
)
_DATE = re.compile(
    r"\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)"
    r"[a-z]*\s+(?:19|20)\d{2}\b",
    re.IGNORECASE,
)
_LINK = re.compile(
    r"\bhttps?://[^\s<>()]+|\b(?:linkedin\.com/in|github\.com)/[a-z0-9_.-]+",
    re.IGNORECASE,
)
_EDUCATION = re.compile(
    r"\b(?:education|bachelor|master|b\.?tech|m\.?tech|b\.?e\.?|b\.?s\.?|"
    r"university|college|degree|certification)\b",
    re.IGNORECASE,
)
_PROJECT = re.compile(r"\b(?:project|projects|built|developed|implemented|created)\b", re.IGNORECASE)
_EXPERIENCE = re.compile(
    r"\b(?:experience|employment|internship|intern|engineer|developer|analyst|worked at)\b",
    re.IGNORECASE,
)
_IMPLEMENTATION = re.compile(r"\b(?:built|developed|implemented|created|designed|deployed|automated|integrated|delivered)\b", re.IGNORECASE)
_CONTRIBUTION = re.compile(r"\b(?:i |my |owned|led|responsible for|contributed|individually|personally)\b", re.IGNORECASE)
_COMPLETION = re.compile(r"\b(?:completed|shipped|launched|deployed|delivered|released|production)\b", re.IGNORECASE)
_COMPLEXITY = re.compile(r"\b(?:scalable|distributed|concurrent|real-time|microservices?|architecture|caching|security|reliability)\b", re.IGNORECASE)
_TECHNOLOGY = re.compile(r"\b(?:python|java|javascript|typescript|react|fastapi|django|flask|sql|postgresql|mongodb|redis|aws|azure|docker|kubernetes|git|api)\b", re.IGNORECASE)


class ResponsibilitySimilarityProvider(Protocol):
    """Integration boundary for a deterministic ChromaDB-backed similarity provider."""

    def score(self, resume_sections: list[str], responsibilities: list[str]) -> float:
        """Return a deterministic percentage from 0 through 100."""


def _round_int(value: float) -> int:
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _clamp_percent(value: float) -> int:
    return max(0, min(100, _round_int(value)))


def _segments(text: str) -> list[str]:
    return [
        segment.strip()
        for segment in re.split(r"[\n\r]+|(?<=[.!?;])\s+|[•●▪]", text)
        if segment.strip()
    ]


def _contains_alias(text: str, alias: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])", text.lower()))


def _matching_segments(resume_text: str, requirement: dict) -> list[str]:
    aliases = requirement.get("aliases") or [requirement["requirement"]]
    return [
        segment for segment in _segments(resume_text)
        if any(_contains_alias(segment, alias) for alias in aliases)
    ]


def _matching_windows(resume_text: str, requirement: dict) -> list[str]:
    aliases = requirement.get("aliases") or [requirement["requirement"]]
    normalized = resume_text.lower()
    windows: list[str] = []
    for alias in aliases:
        for match in re.finditer(
            rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])",
            normalized,
        ):
            line_start = resume_text.rfind("\n", 0, match.start()) + 1
            line_end = resume_text.find("\n", match.end())
            if line_end == -1:
                line_end = len(resume_text)
            context = resume_text[line_start:line_end]
            previous_end = max(0, line_start - 1)
            previous_start = resume_text.rfind("\n", 0, previous_end) + 1
            previous = resume_text[previous_start:previous_end].strip()
            if len(previous.split()) <= 4 and (_PROJECT.search(previous) or _EXPERIENCE.search(previous)):
                context = f"{previous} {context}"
            windows.append(context)
    return windows


def _requirement_matched(resume_text: str, requirement: dict) -> bool:
    return bool(_matching_segments(resume_text, requirement))


def _group_match_percent(resume_text: str, requirements: list[dict]) -> float | None:
    if not requirements:
        return None
    return 100 * sum(_requirement_matched(resume_text, item) for item in requirements) / len(requirements)


def _role_requirement_match(resume_text: str, requirements: list[dict]) -> tuple[int, dict]:
    required = [item for item in requirements if item["priority"] != "optional"]
    preferred = [item for item in requirements if item["priority"] == "optional"]
    required_percent = _group_match_percent(resume_text, required)
    preferred_percent = _group_match_percent(resume_text, preferred)
    if required_percent is None and preferred_percent is None:
        required_percent = preferred_percent = 0.0
    elif required_percent is None:
        required_percent = preferred_percent
    elif preferred_percent is None:
        preferred_percent = required_percent
    percent = required_percent * 0.70 + preferred_percent * 0.30
    required_matched = [item["requirement"] for item in required if _requirement_matched(resume_text, item)]
    preferred_matched = [item["requirement"] for item in preferred if _requirement_matched(resume_text, item)]
    return _clamp_percent(percent), {
        "requiredMatchPercent": _clamp_percent(required_percent),
        "preferredMatchPercent": _clamp_percent(preferred_percent),
        "requiredCount": len(required),
        "preferredCount": len(preferred),
        "requiredMatched": required_matched,
        "requiredMissing": [item["requirement"] for item in required if item["requirement"] not in required_matched],
        "preferredMatched": preferred_matched,
        "preferredMissing": [item["requirement"] for item in preferred if item["requirement"] not in preferred_matched],
        "evidenceSnippets": _requirement_snippets(resume_text, requirements),
    }


def _evidence_tier(resume_text: str, requirement: dict) -> int:
    matches = _matching_segments(resume_text, requirement)
    if not matches:
        return 0
    contexts = _matching_windows(resume_text, requirement)
    in_experience = any(_EXPERIENCE.search(context) for context in contexts)
    in_project = any(_PROJECT.search(context) for context in contexts)
    measurable = any(_MEASURABLE.search(context) for context in contexts)
    if in_experience and measurable:
        return 100
    if (in_project or in_experience) and measurable:
        return 75
    if in_project or in_experience:
        return 50
    return 20


def _evidence_strength(resume_text: str, requirements: list[dict]) -> tuple[int, dict]:
    tiers = {item["requirement"]: _evidence_tier(resume_text, item) for item in requirements}
    percent = sum(tiers.values()) / len(tiers) if tiers else 0
    return _clamp_percent(percent), {
        "requirementTiers": tiers,
        "evidenceSnippets": _requirement_snippets(resume_text, requirements),
    }


def _skill_depth(resume_text: str, target_role: str, requirements: list[dict]) -> tuple[int, dict]:
    role_tokens = {
        token for token in re.findall(r"[a-z0-9+#.]+", target_role.lower())
        if len(token) > 2 and token not in {"engineer", "developer", "associate", "junior", "senior"}
    }
    levels: dict[str, int] = {}
    for requirement in requirements:
        matches = _matching_segments(resume_text, requirement)
        if not matches:
            levels[requirement["requirement"]] = 0
            continue
        demonstrated = any(_PROJECT.search(segment) or _EXPERIENCE.search(segment) for segment in matches)
        repeated = len(matches) >= 2
        role_connected = repeated and (
            any(any(token in segment.lower() for token in role_tokens) for segment in matches)
            or any(_MEASURABLE.search(segment) for segment in matches)
        )
        levels[requirement["requirement"]] = (
            100 if role_connected else 75 if repeated else 50 if demonstrated else 25
        )
    percent = sum(levels.values()) / len(levels) if levels else 0
    return _clamp_percent(percent), {
        "requirementDepth": levels,
        "evidenceSnippets": _requirement_snippets(resume_text, requirements),
    }


def _requirement_snippets(resume_text: str, requirements: list[dict]) -> dict[str, list[str]]:
    return {
        item["requirement"]: [_compact_snippet(segment) for segment in _matching_segments(resume_text, item)[:2]]
        for item in requirements
        if _matching_segments(resume_text, item)
    }


def _compact_snippet(value: str, maximum: int = 180) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    return compact if len(compact) <= maximum else f"{compact[:maximum - 1].rstrip()}…"


def lexical_responsibility_relevance(resume_sections: list[str], responsibilities: list[str]) -> float:
    """Deterministic fallback used until a ChromaDB provider is injected."""
    if not resume_sections or not responsibilities:
        return 0.0
    stop = {
        "and", "the", "with", "for", "from", "that", "this", "will", "your", "you",
        "are", "our", "into", "using", "work", "team", "role",
    }

    def tokens(value: str) -> set[str]:
        return {
            token for token in re.findall(r"[a-z0-9+#.]+", value.lower())
            if len(token) > 2 and token not in stop
        }

    section_tokens = [tokens(section) for section in resume_sections]
    scores: list[float] = []
    for responsibility in responsibilities:
        expected = tokens(responsibility)
        if not expected:
            continue
        best = max((len(expected & actual) / len(expected) for actual in section_tokens), default=0)
        scores.append(best * 100)
    return sum(scores) / len(scores) if scores else 0.0


def _meaningful_project_experience_sections(resume_text: str) -> list[str]:
    sections: list[str] = []
    active_section = False
    for raw_line in resume_text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip(" •●▪\t")
        if not line:
            continue
        heading = line.rstrip(":").lower()
        if heading in {"projects", "project", "experience", "work experience", "internships", "internship", "employment"}:
            active_section = True
            continue
        if len(line.split()) <= 4 and re.fullmatch(r"[A-Za-z &/]+:?", line):
            active_section = False
        meaningful = (
            active_section
            or _PROJECT.search(line)
            or _EXPERIENCE.search(line)
        ) and len(line.split()) >= 5
        if meaningful and line not in sections:
            sections.append(_compact_snippet(line, 320))
    return sections[:20]


def _observable_relevance_evidence(evidence_sections: list[str]) -> tuple[int, dict[str, bool]]:
    combined = "\n".join(evidence_sections)
    factors = {
        "implementation": bool(_IMPLEMENTATION.search(combined)),
        "individualContribution": bool(_CONTRIBUTION.search(combined)),
        "completion": bool(_COMPLETION.search(combined)),
        "measurableOutcome": bool(_MEASURABLE.search(combined)),
        "explicitComplexity": bool(_COMPLEXITY.search(combined)),
        "technologies": bool(_TECHNOLOGY.search(combined)),
        "responsibilityLanguage": bool(re.search(r"\b(?:maintained|managed|reviewed|supported|troubleshot|collaborated|analyzed)\b", combined, re.IGNORECASE)),
    }
    weights = {
        "implementation": 25, "individualContribution": 15, "completion": 10,
        "measurableOutcome": 20, "explicitComplexity": 10, "technologies": 10,
        "responsibilityLanguage": 10,
    }
    return sum(weights[key] for key, present in factors.items() if present), factors


def _project_experience_relevance(
    resume_text: str,
    comparison_contexts: list[str],
    provider: ResponsibilitySimilarityProvider | None,
    relevance_source: str,
) -> tuple[int, dict]:
    evidence_sections = _meaningful_project_experience_sections(resume_text)
    evidence_percent, evidence_factors = _observable_relevance_evidence(evidence_sections)
    semantic_matches: list[dict] = []
    fallback_limitation = None
    method = "deterministic_lexical_v1"
    if not evidence_sections:
        semantic_percent = 0.0
        fallback_limitation = "No meaningful project or experience descriptions were available for semantic comparison."
    elif not comparison_contexts:
        semantic_percent = 0.0
        fallback_limitation = "No usable responsibility or role-expectation text was available; semantic relevance received no credit."
    elif provider is None:
        semantic_percent = lexical_responsibility_relevance(evidence_sections, comparison_contexts)
        fallback_limitation = "ChromaDB was not configured for this calculation; deterministic lexical relevance was used."
    else:
        try:
            if hasattr(provider, "compare"):
                vector_result = provider.compare(evidence_sections, comparison_contexts)
                semantic_percent = float(vector_result["score"])
                semantic_matches = vector_result.get("matches", [])
                normalization = vector_result.get("normalization")
            else:
                semantic_percent = provider.score(evidence_sections, comparison_contexts)
                normalization = "Provider returned an already normalized percentage."
            method = provider.__class__.__name__
        except Exception as exc:
            semantic_percent = lexical_responsibility_relevance(evidence_sections, comparison_contexts)
            fallback_limitation = f"Vector comparison was unavailable ({exc.__class__.__name__}); deterministic lexical relevance was used."
            normalization = "Vector normalization was unavailable because the deterministic fallback was used."
    semantic_percent = max(0.0, min(100.0, semantic_percent))
    combined = semantic_percent * 0.60 + evidence_percent * 0.40
    if not evidence_factors["implementation"]:
        combined = min(combined, 60)
    elif not any((
        evidence_factors["individualContribution"],
        evidence_factors["completion"],
        evidence_factors["measurableOutcome"],
    )):
        combined = min(combined, 85)
    responsibility_scores = {
        context: lexical_responsibility_relevance(evidence_sections, [context])
        for context in comparison_contexts
    }
    limitations = []
    if relevance_source == "role_context":
        limitations.append(
            "Project relevance was evaluated against general expectations for the selected role because no specific job description was provided."
        )
    if fallback_limitation:
        limitations.append(fallback_limitation)
    if not limitations:
        limitations.append(
            "Semantic similarity identifies related wording but does not verify implementation or outcomes; observable evidence factors gate the awarded score."
        )
    return _clamp_percent(combined), {
        "method": method,
        "relevanceSource": relevance_source,
        "responsibilityCount": len(comparison_contexts),
        "evidenceSectionCount": len(evidence_sections),
        "responsibilities": comparison_contexts[:5],
        "evidenceSections": [_compact_snippet(section) for section in evidence_sections[:5]],
        "matchedResponsibilities": [
            context for context, score in responsibility_scores.items() if score > 0
        ][:5],
        "missingResponsibilities": [
            context for context, score in responsibility_scores.items() if score == 0
        ][:5],
        "normalizedSemanticSimilarity": _clamp_percent(semantic_percent),
        "deterministicEvidencePercent": evidence_percent,
        "deterministicEvidenceFactors": evidence_factors,
        "semanticWeightPercent": 60,
        "deterministicWeightPercent": 40,
        "semanticMatches": semantic_matches[:5],
        "normalization": locals().get("normalization", "Lexical token-overlap percentage, clamped to 0–100."),
        "fallbackLimitation": fallback_limitation,
        "limitation": " ".join(limitations),
    }


def _has_chronology(text: str) -> bool:
    years = [int(year) for year in re.findall(r"\b((?:19|20)\d{2})\b", text)]
    return len(years) >= 2 and all(1900 <= year <= 2200 for year in years)


def _has_date_contradiction(text: str) -> bool:
    ranges = re.findall(r"\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b", text)
    return any(int(start) > int(end) for start, end in ranges)


def _resume_evidence_completeness(resume_text: str) -> tuple[int, dict]:
    signals = {
        "dates": 20 if _DATE.search(resume_text) else 0,
        "educationDetails": 15 if _EDUCATION.search(resume_text) else 0,
        "projectDescriptions": 20 if any(
            _PROJECT.search(segment) and len(segment.split()) >= 6 for segment in _segments(resume_text)
        ) else 0,
        "validLinks": 10 if _LINK.search(resume_text) else 0,
        "chronology": 10 if _has_chronology(resume_text) else 0,
        "quantifiedEvidence": 15 if _MEASURABLE.search(resume_text) else 0,
        "consistency": 10 if resume_text.strip() and not _has_date_contradiction(resume_text) else 0,
    }
    return sum(signals.values()), {"observableSignals": signals}


def compute_candidate_trust_score(
    resume_text: str,
    job_description: str,
    target_role: str,
    similarity_provider: ResponsibilitySimilarityProvider | None = None,
    relevance_source: str = "job_description",
) -> dict:
    """Single source of truth for the versioned Candidate Trust Score."""
    requirements = extract_requirements(job_description)
    skill_requirements = [
        requirement for requirement in requirements
        if requirement["category"] in SKILL_CATEGORIES
    ]
    classification = classify_job_description(job_description)
    comparison_contexts = [
        *classification["responsibilities"],
        f"Selected role: {target_role}",
    ]
    project_relevance = _project_experience_relevance(
        resume_text, comparison_contexts, similarity_provider, relevance_source
    )
    if relevance_source == "job_description" and not classification["responsibilities"]:
        score, details = project_relevance
        context_limitation = (
            "No usable JD responsibility text was extracted; relevance used the selected role "
            "plus deterministic project and experience evidence."
        )
        details = {
            **details,
            "limitation": f"{context_limitation} {details['limitation']}",
            "fallbackLimitation": context_limitation,
        }
        project_relevance = (score, details)
    component_values = {
        "roleRequirementMatch": _role_requirement_match(resume_text, requirements),
        "evidenceStrength": _evidence_strength(resume_text, skill_requirements),
        "projectExperienceRelevance": project_relevance,
        "skillDepth": _skill_depth(resume_text, target_role, skill_requirements),
        "resumeEvidenceCompleteness": _resume_evidence_completeness(resume_text),
    }
    labels = {
        "roleRequirementMatch": "Role Requirement Match",
        "evidenceStrength": "Evidence Strength",
        "projectExperienceRelevance": "Project and Experience Relevance",
        "skillDepth": "Skill Depth",
        "resumeEvidenceCompleteness": "Resume Evidence Completeness",
    }
    breakdown = []
    for key, weight in COMPONENT_WEIGHTS.items():
        basis_percentage, details = component_values[key]
        contribution = _round_int(basis_percentage * weight / 100)
        if key == "projectExperienceRelevance":
            details = {
                **details,
                "awardedContributionPoints": contribution,
                "maximumContributionPoints": weight,
            }
        explanation = _component_explanation(key, basis_percentage, contribution, weight, details)
        breakdown.append({
            "key": key,
            "label": labels[key],
            "weight": weight,
            "score": contribution,
            "maximumScore": weight,
            "basisPercentage": basis_percentage,
            "contribution": contribution,
            "reason": _component_reason(key, basis_percentage, details),
            "details": details,
            **explanation,
        })
    overall = sum(item["contribution"] for item in breakdown)
    return {
        "scoreVersion": SCORE_VERSION,
        "trustScore": overall,
        "scoreBreakdown": breakdown,
        "scoreFormula": (
            "Role Requirement Match 30 + Evidence Strength 25 + "
            "Project and Experience Relevance 20 + Skill Depth 15 + "
            "Resume Evidence Completeness 10"
        ),
    }


def _component_reason(key: str, score: int, details: dict) -> str:
    if key == "roleRequirementMatch":
        return (
            f"{details['requiredMatchPercent']}% required and "
            f"{details['preferredMatchPercent']}% preferred requirement coverage."
        )
    if key == "evidenceStrength":
        return f"Evidence tiers across {len(details['requirementTiers'])} extracted requirements."
    if key == "projectExperienceRelevance":
        return (
            f"{details['method']} relevance against {details['responsibilityCount']} "
            f"{'JD and role contexts' if details['relevanceSource'] == 'job_description' else 'general role contexts'}."
        )
    if key == "skillDepth":
        return f"Depth tiers across {len(details['requirementDepth'])} target requirements."
    return f"{score}% of observable resume evidence-completeness signals are present."


def _component_explanation(
    key: str,
    basis_percentage: int,
    contribution: int,
    maximum_score: int,
    details: dict,
) -> dict:
    potential = maximum_score - contribution
    snippets = details.get("evidenceSnippets", {})
    if key == "roleRequirementMatch":
        found = [
            f"{kind}: {requirement}"
            for kind, values in (
                ("Required match", details["requiredMatched"]),
                ("Preferred match", details["preferredMatched"]),
            )
            for requirement in values
        ]
        found.extend(
            f"Resume: {snippet}" for values in snippets.values() for snippet in values[:1]
        )
        missing = [
            f"{kind}: {requirement}"
            for kind, values in (
                ("Required evidence missing", details["requiredMissing"]),
                ("Preferred evidence missing", details["preferredMissing"]),
            )
            for requirement in values
        ]
        return {
            "formulaOrBasis": (
                f"({details['requiredMatchPercent']}% required × 70%) + "
                f"({details['preferredMatchPercent']}% preferred × 30%) = "
                f"{basis_percentage}%; weighted to {contribution}/{maximum_score}."
            ),
            "evidenceFound": found[:8],
            "evidenceMissing": missing[:8],
            "improvementAction": (
                "Add truthful resume evidence for the highest-priority missing required JD item."
                if missing else "Keep each matched JD requirement attached to specific resume evidence."
            ),
            "potentialImprovementPoints": potential,
            "limitation": "Lexical requirement matching recognizes the maintained requirement catalog and aliases; it may miss equivalent wording.",
        }
    if key == "evidenceStrength":
        tiers = details["requirementTiers"]
        found = [
            f"{requirement}: {tier}% evidence tier"
            for requirement, tier in tiers.items() if tier > 0
        ]
        found.extend(
            f"Resume: {snippet}" for values in snippets.values() for snippet in values[:1]
        )
        missing = [f"No supporting resume evidence for {requirement}." for requirement, tier in tiers.items() if tier == 0]
        return {
            "formulaOrBasis": (
                "Average deterministic skill evidence tier: listed 20%, used in a project 50%, "
                "clear result 75%, internship/work with measurable impact 100%; "
                f"{basis_percentage}% weighted to {contribution}/{maximum_score}."
            ),
            "evidenceFound": found[:8],
            "evidenceMissing": missing[:8],
            "improvementAction": (
                "Connect one matched skill to a truthful project or work result with a measurable outcome."
                if potential else "Preserve the measurable work evidence attached to each matched skill."
            ),
            "potentialImprovementPoints": potential,
            "limitation": "Tier detection uses observable wording and section context; it does not verify that a claimed outcome occurred.",
        }
    if key == "projectExperienceRelevance":
        evidence_sections = details["evidenceSections"]
        matched_responsibilities = details["matchedResponsibilities"]
        missing_responsibilities = details["missingResponsibilities"]
        return {
            "formulaOrBasis": (
                f"60% normalized semantic similarity ({details['normalizedSemanticSimilarity']}%) + "
                f"40% deterministic evidence ({details['deterministicEvidencePercent']}%), using "
                f"{details['method']} across {details['evidenceSectionCount']} resume evidence sections "
                f"and {details['responsibilityCount']} comparison contexts; "
                f"{basis_percentage}% weighted to {contribution}/{maximum_score}."
            ),
            "evidenceFound": (
                [f"{'JD responsibility' if details['relevanceSource'] == 'job_description' else 'Role expectation'} with observable overlap: {item}" for item in matched_responsibilities]
                + [f"Resume: {item}" for item in evidence_sections]
            )[:8],
            "evidenceMissing": [
                f"No comparable project or experience wording found for {'JD responsibility' if details['relevanceSource'] == 'job_description' else 'role expectation'}: {item}"
                for item in missing_responsibilities
            ],
            "improvementAction": (
                "Add a truthful project or experience bullet that directly demonstrates one uncovered JD responsibility."
                if potential else "Keep responsibility-aligned project and experience descriptions specific."
            ),
            "potentialImprovementPoints": potential,
            "limitation": details["limitation"],
        }
    if key == "skillDepth":
        levels = details["requirementDepth"]
        found = [f"{requirement}: {level}% depth tier" for requirement, level in levels.items() if level > 0]
        found.extend(f"Resume: {snippet}" for values in snippets.values() for snippet in values[:1])
        missing = [f"No observable depth for {requirement}." for requirement, level in levels.items() if level == 0]
        return {
            "formulaOrBasis": (
                "Average deterministic depth tier: mentioned once 25%, demonstrated 50%, "
                "repeated across evidence 75%, clearly role-connected 100%; "
                f"{basis_percentage}% weighted to {contribution}/{maximum_score}."
            ),
            "evidenceFound": found[:8],
            "evidenceMissing": missing[:8],
            "improvementAction": (
                "Demonstrate a target skill in another truthful role-relevant project or experience."
                if potential else "Keep repeated target-skill evidence connected to the role."
            ),
            "potentialImprovementPoints": potential,
            "limitation": "Repeated mentions indicate documented depth, not independently assessed proficiency.",
        }
    signals = details["observableSignals"]
    names = {
        "dates": "Dates", "educationDetails": "Education details",
        "projectDescriptions": "Project descriptions", "validLinks": "Structurally valid links",
        "chronology": "Chronology", "quantifiedEvidence": "Quantified evidence",
        "consistency": "No detected date-range contradiction",
    }
    found = [f"{names[name]}: present ({points} completeness points)." for name, points in signals.items() if points]
    missing = [f"{names[name]}: not observed." for name, points in signals.items() if not points]
    return {
        "formulaOrBasis": (
            "Observable resume signals: dates 20%, education 15%, project descriptions 20%, "
            "valid links 10%, chronology 10%, quantified evidence 15%, consistency 10%; "
            f"{basis_percentage}% weighted to {contribution}/{maximum_score}."
        ),
        "evidenceFound": found,
        "evidenceMissing": missing,
        "improvementAction": (
            f"Add or correct the first missing observable signal: {missing[0].removesuffix(' not observed.')}"
            if missing else "Keep dates, links, chronology, and quantified evidence internally consistent."
        ),
        "potentialImprovementPoints": potential,
        "limitation": "Completeness checks structure and internal signals only; it does not judge candidate honesty or verify external links.",
    }
