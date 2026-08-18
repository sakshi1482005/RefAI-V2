"""Deterministic semantic job matching on top of RefAI's existing vector store."""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from hashlib import sha256
import json
import re
from typing import Any

from app.models.schemas import SemanticJobMatchResponse
from app.services.requirement_extractor import (
    classify_job_description,
    extract_requirements,
    general_expectations_for_role,
)
from app.services.trust_score import (
    _matching_segments,
    _meaningful_project_experience_sections,
    _sectioned_resume_records,
    lexical_responsibility_relevance,
)
from app.services.vector_store import ChromaProjectRelevanceProvider


SEMANTIC_JOB_MATCH_VERSION = "semantic-job-match-v1"
_CACHE_LIMIT = 128
_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()


def clear_semantic_job_match_cache() -> None:
    """Test and process-lifecycle helper; cached entries are never persisted as scores."""
    _cache.clear()


def _normalized(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _input_key(
    *, analysis_id: str, analysis_version: str | None, resume_text: str,
    target_role: str, job_description: str | None, relevance_source: str,
) -> str:
    material = {
        "analysisId": analysis_id,
        "analysisVersion": analysis_version or "",
        "resumeHash": sha256(resume_text.strip().encode("utf-8")).hexdigest(),
        "role": _normalized(target_role),
        "jobDescriptionHash": sha256((job_description or "").strip().encode("utf-8")).hexdigest(),
        "relevanceSource": relevance_source,
        "version": SEMANTIC_JOB_MATCH_VERSION,
    }
    return sha256(json.dumps(material, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _contexts(target_role: str, job_description: str | None) -> tuple[list[dict[str, Any]], list[str], str]:
    explicit_job_description = bool(job_description and job_description.strip())
    source = "job_description" if explicit_job_description else "role_context"
    source_text = job_description.strip() if explicit_job_description else general_expectations_for_role(target_role)
    requirements = extract_requirements(source_text)
    classification = classify_job_description(source_text)
    required_skills = classification["requiredSkills"]
    contexts = [f"Selected role: {target_role.strip()}"]
    contexts.extend(classification["responsibilities"])
    contexts.extend(f"Required skill: {skill}" for skill in required_skills)
    return requirements, list(dict.fromkeys(contexts)), source


def _required_skills(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    skill_categories = {
        "programming language", "framework", "database", "cloud platform", "tool",
        "testing technology", "software engineering practice", "collaboration requirement",
    }
    return [
        item for item in requirements
        if item.get("category") in skill_categories and item.get("priority") != "optional"
    ]


def _skill_evidence(resume_text: str, requirements: list[dict[str, Any]]) -> tuple[list[str], list[str], list[dict[str, Any]]]:
    matched: list[str] = []
    missing: list[str] = []
    evidence: list[dict[str, Any]] = []
    for requirement in requirements:
        label = str(requirement["requirement"])
        snippets = _matching_segments(resume_text, requirement)
        if not snippets:
            missing.append(label)
            continue
        matched.append(label)
        evidence.append({
            "resume_evidence": " ".join(snippets[0].split())[:320],
            "compared_to": f"Required skill: {label}",
            "match_type": "required_skill",
            "normalized_similarity": None,
        })
    return matched, missing, evidence


def _semantic_result(
    evidence_sections: list[str], contexts: list[str], context_id: str,
    provider: Any | None,
) -> tuple[float, list[dict[str, Any]], list[str]]:
    if not evidence_sections:
        return 0.0, [], ["No meaningful resume evidence was available for semantic comparison."]
    if not contexts:
        return 0.0, [], ["No usable role or job-description comparison context was available."]
    provider = provider or ChromaProjectRelevanceProvider(context_id)
    try:
        result = provider.compare(evidence_sections, contexts)
        matches = [
            {
                "resume_evidence": str(item["resumeEvidence"])[:320],
                "compared_to": str(item["comparisonContext"])[:500],
                "match_type": "semantic",
                "normalized_similarity": round(float(item["normalizedSemanticSimilarity"]), 2),
            }
            for item in result.get("matches", [])
            if item.get("resumeEvidence") and item.get("comparisonContext")
        ]
        return max(0.0, min(100.0, float(result["score"]))), matches, []
    except Exception as exc:
        lexical = lexical_responsibility_relevance(evidence_sections, contexts)
        return max(0.0, min(100.0, lexical)), [], [
            f"Vector comparison was unavailable ({exc.__class__.__name__}); deterministic lexical relevance was used."
        ]


def build_semantic_job_match(
    *, resume_text: str, target_role: str, job_description: str | None,
    analysis_id: str, analysis_version: str | None = None, vector_provider: Any | None = None,
) -> SemanticJobMatchResponse:
    """Return a deterministic semantic job match; no LLM participates in scoring."""
    requirements, contexts, relevance_source = _contexts(target_role, job_description)
    input_key = _input_key(
        analysis_id=analysis_id, analysis_version=analysis_version, resume_text=resume_text,
        target_role=target_role, job_description=job_description, relevance_source=relevance_source,
    )
    # Injected providers are for isolated tests and should not read/process cache entries.
    if vector_provider is None and input_key in _cache:
        cached = deepcopy(_cache[input_key])
        cached["cache_status"] = "hit"
        return SemanticJobMatchResponse.model_validate(cached)

    required_skills = _required_skills(requirements)
    matched_skills, missing_skills, direct_evidence = _skill_evidence(resume_text, required_skills)
    evidence_sections = _meaningful_project_experience_sections(resume_text)
    if not evidence_sections:
        evidence_sections = [record["snippet"] for record in _sectioned_resume_records(resume_text)[:20]]
    semantic_score, semantic_evidence, limitations = _semantic_result(
        evidence_sections, contexts, analysis_id, vector_provider,
    )
    skill_coverage = (len(matched_skills) * 100 / len(required_skills)) if required_skills else 0.0
    if not required_skills:
        limitations.append("No extractable required skills were available; the score uses role and responsibility relevance only.")
        score = semantic_score
    else:
        score = semantic_score * 0.65 + skill_coverage * 0.35
    score = round(max(0.0, min(100.0, score)), 2)

    evidence = sorted(
        semantic_evidence,
        key=lambda item: item["normalized_similarity"] if item["normalized_similarity"] is not None else -1,
        reverse=True,
    )[:4]
    evidence.extend(direct_evidence[: max(0, 5 - len(evidence))])
    weak_evidence = [f"No resume evidence matched required skill: {skill}." for skill in missing_skills]
    if not evidence_sections:
        weak_evidence.append("No meaningful project, experience, or extracted resume evidence was available.")
    if relevance_source == "role_context":
        limitations.append(
            "No specific Job Description was provided. Relevance was evaluated against general expectations for the selected role."
        )
    explanation = (
        f"Semantic Job Match compares saved resume evidence with the selected role"
        f"{' and the provided Job Description' if relevance_source == 'job_description' else ''}, "
        f"then combines {round(semantic_score, 2)} semantic relevance with {round(skill_coverage, 2)} required-skill coverage."
    )
    result = SemanticJobMatchResponse(
        semantic_match_version=SEMANTIC_JOB_MATCH_VERSION,
        semantic_match_score=score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        strongest_matching_evidence=evidence,
        weak_missing_evidence=weak_evidence[:8],
        role_relevance_explanation=explanation,
        relevance_source=relevance_source,
        cache_status="miss",
        limitations=limitations,
    )
    if vector_provider is None:
        _cache[input_key] = result.model_dump()
        _cache.move_to_end(input_key)
        while len(_cache) > _CACHE_LIMIT:
            _cache.popitem(last=False)
    return result
