from __future__ import annotations

import re

from app.services.requirement_extractor import classify_job_description, extract_requirements


def assess_analysis_reliability(
    resume_text: str,
    analysis: dict,
    job_description: str | None,
    *,
    parsing_success: bool = True,
) -> dict:
    """Classify observable analysis support without producing a probability."""
    resume_words = len(resume_text.split())
    readable_ratio = (
        len(re.findall(r"[A-Za-z0-9]", resume_text)) / max(1, len(resume_text))
    )
    evidence_count = len([
        item for item in analysis.get("evidence", [])
        if isinstance(item, str) and item.strip()
    ])
    section_count = len({
        item.strip().lower() for item in analysis.get("resumeSectionsUsed", [])
        if isinstance(item, str) and item.strip()
    })
    explicit_job_description = bool(job_description and job_description.strip())

    if not parsing_success or resume_words < 25 or readable_ratio < 0.45:
        label = "Low reliability"
    else:
        resume_support = (
            2
            + (1 if resume_words >= 80 else 0)
            + (1 if resume_words >= 180 else 0)
            + (1 if section_count >= 2 else 0)
            + (1 if evidence_count >= 2 else 0)
            + (1 if evidence_count >= 4 else 0)
        )
        if explicit_job_description:
            requirements = extract_requirements(job_description or "")
            classification = classify_job_description(job_description or "")
            jd_words = len((job_description or "").split())
            jd_support = (
                (1 if len(requirements) >= 2 else 0)
                + (1 if len(requirements) >= 5 else 0)
                + (1 if jd_words >= 60 else 0)
                + (1 if classification["responsibilities"] else 0)
            )
            total = resume_support + jd_support
            label = "High reliability" if total >= 9 else "Medium reliability" if total >= 5 else "Low reliability"
        else:
            label = "High reliability" if resume_support >= 6 else "Medium reliability" if resume_support >= 4 else "Low reliability"

    if explicit_job_description:
        requirement_count = len(extract_requirements(job_description or ""))
        basis = (
            f"Resume parsing {'succeeded' if parsing_success else 'was incomplete'} with "
            f"{resume_words} readable words, {section_count} identified sections, "
            f"{evidence_count} evidence-backed claims, and {requirement_count} extracted JD requirements."
        )
        limitations = (
            "Reliability reflects input coverage and observable evidence, not claim verification or hiring outcomes. "
            "Short or unspecific job descriptions can limit requirement-level comparison."
        )
    else:
        basis = (
            f"Resume parsing {'succeeded' if parsing_success else 'was incomplete'} with "
            f"{resume_words} readable words, {section_count} identified sections, and "
            f"{evidence_count} evidence-backed claims."
        )
        limitations = (
            "No Job Description was provided. Reliability is assessed from resume evidence alone, "
            "and the analysis uses general expectations for the selected role."
        )
    return {"label": label, "basis": basis, "limitations": limitations}
