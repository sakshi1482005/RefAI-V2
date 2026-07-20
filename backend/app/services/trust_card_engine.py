from app.services.groq_client import AIServiceUnavailable, generate_trust_summary
from app.services.requirement_extractor import PRIORITY_WEIGHT, build_gap, extract_requirements, requirement_occurrences
import re


class InsufficientJobRequirements(ValueError):
    """Raised when a job description contains no meaningful match criteria."""


def _meaningful_tokens(text: str) -> list[str]:
    return [token for token in re.findall(r"[a-z0-9+#.]+", text.lower()) if len(token) > 2]


def compute_match_score(resume_text: str, job_description: str) -> dict:
    """Compute weighted coverage over canonical phrase-level requirements."""
    requirements = extract_requirements(job_description)
    if not resume_text.strip() or not requirements:
        return {"overall": 0, "roleFit": 0, "proof": 0, "gaps": 100}
    total_weight = sum(PRIORITY_WEIGHT[item["priority"]] for item in requirements)
    role_fit = round(100 * sum(PRIORITY_WEIGHT[item["priority"]] for item in requirements if requirement_occurrences(resume_text, item) >= 1) / total_weight)
    proof = round(100 * sum(PRIORITY_WEIGHT[item["priority"]] for item in requirements if requirement_occurrences(resume_text, item) >= 2) / total_weight)
    overall = round((role_fit + proof) / 2)

    return {
        "overall": overall,
        "roleFit": role_fit,
        "proof": proof,
        "gaps": max(0, 100 - role_fit),
    }


def build_match_analysis(resume_text: str, job_description: str) -> dict:
    """Return the score plus the transparent evidence fields used by the UI."""
    started_resume_tokens = _meaningful_tokens(resume_text)
    requirements = extract_requirements(job_description)
    if not requirements:
        raise InsufficientJobRequirements(
            "No meaningful skills, tools, practices, experience, degree, or certification requirements were found."
        )
    score = compute_match_score(resume_text, job_description)
    matched_requirements = [item for item in requirements if requirement_occurrences(resume_text, item) >= 1]
    missing_requirement_items = [item for item in requirements if requirement_occurrences(resume_text, item) == 0]
    matched_skills = [item["requirement"] for item in matched_requirements]
    missing_skills = [item["requirement"] for item in missing_requirement_items]
    missing_requirements = [build_gap(item) for item in missing_requirement_items]
    action_plan = missing_requirements[:5]

    strengths = [
        f"{score['roleFit']}% of weighted job requirements have supporting resume evidence.",
        f"{score['proof']}% of weighted requirements are reinforced by repeated evidence.",
    ]
    section_names = ["Summary", "Experience", "Projects", "Skills", "Education", "Certifications"]
    resume_sections_used = [section for section in section_names if re.search(rf"\b{section}\b", resume_text, re.IGNORECASE)]
    if not resume_sections_used:
        resume_sections_used = ["Extracted resume text"]
    evidence = [
        f"{item['requirement']} is supported in the extracted resume ({requirement_occurrences(resume_text, item)} occurrence(s))."
        for item in matched_requirements[:10]
    ]
    readiness_summary = (
        f"Overall match is {score['overall']}%, based on {score['roleFit']}% weighted requirement coverage "
        f"and {score['proof']}% repeated evidence. "
        + ("The current evidence meets the 60% Trust Card readiness threshold."
           if score["overall"] >= 60
           else "More role-aligned evidence is recommended before referral outreach.")
    )
    learning_recommendations = [item["practicalAction"] for item in action_plan]
    if not learning_recommendations:
        learning_recommendations = ["Preserve the matched requirements and keep their supporting outcomes measurable."]
    input_coverage = min(1.0, len(started_resume_tokens) / 300) * 20
    requirement_coverage = min(1.0, len(requirements) / 8) * 20
    confidence = round(min(95, 55 + input_coverage + requirement_coverage))

    return {
        **score,
        "analysisStatus": "complete",
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills,
        "missingRequirements": missing_requirements,
        "actionPlan": action_plan,
        "strengths": strengths,
        "evidence": evidence,
        "resumeSectionsUsed": resume_sections_used,
        "readinessSummary": readiness_summary,
        "learningRecommendations": learning_recommendations,
        "confidence": confidence,
    }


def build_trust_card(candidate_name: str, role: str, resume_text: str, job_description: str) -> dict:
    analysis = build_match_analysis(resume_text, job_description)
    match_score = {key: analysis[key] for key in ("overall", "roleFit", "proof", "gaps")}
    confidence = analysis["confidence"]
    completeness = round(100 * sum(bool(value.strip()) for value in (candidate_name, role, resume_text, job_description)) / 4)
    gap_resilience = max(0, 100 - match_score["gaps"])

    # Trust Score is deterministic and is never an alias for Overall Match.
    # Formula: 30% Overall Match + 25% Role Fit + 15% Proof/Evidence
    #          + 15% Analysis Confidence + 10% Required-field Completeness
    #          + 5% Gap Resilience (100 - Gap Score).
    factor_specs = [
        ("overallMatch", "Overall Match", 30, match_score["overall"], "Combined role alignment and repeated evidence."),
        ("roleFit", "Role Fit", 25, match_score["roleFit"], "Meaningful job requirements represented in the resume."),
        ("proofScore", "Proof Score", 15, match_score["proof"], "Matched requirements reinforced by repeated resume evidence."),
        ("confidence", "Analysis Confidence", 15, confidence, "Confidence based on resume and job-description input coverage."),
        ("completeness", "Required-field Completeness", 10, completeness, "Candidate, role, resume, and job description inputs supplied."),
        ("gapResilience", "Gap Resilience", 5, gap_resilience, "Inverse of the missing-requirement Gap Score."),
    ]
    score_breakdown = [
        {"key": key, "label": label, "weight": weight, "score": score, "contribution": round(score * weight / 100, 2), "reason": reason}
        for key, label, weight, score, reason in factor_specs
    ]
    trust_score = round(sum(factor["contribution"] for factor in score_breakdown))
    if trust_score >= 75:
        referral_readiness = "Ready to request referral"
        recommendation = "Ready for referral"
    elif trust_score >= 55:
        referral_readiness = "Improve before requesting"
        recommendation = "Review before referring"
    else:
        referral_readiness = "Not ready yet"
        recommendation = "Not ready yet"

    try:
        summary = generate_trust_summary(resume_text, job_description, match_score)
    except AIServiceUnavailable:
        summary = (
            f"The structured analysis calculated {match_score['roleFit']}% Role Fit and "
            f"{match_score['proof']}% Proof. The optional AI narrative summary is temporarily "
            "unavailable; review the returned strengths, evidence, missing skills, and action plan."
        )
    risk_signals = [f"Missing requirement: {skill}" for skill in analysis["missingSkills"][:5]]
    if not risk_signals:
        risk_signals = ["No major requirement gaps were identified by the lexical analysis."]
    return {
        "candidateName": candidate_name,
        "role": role,
        "overallMatch": match_score["overall"],
        "roleFit": match_score["roleFit"],
        "proofScore": match_score["proof"],
        "gapScore": match_score["gaps"],
        "confidence": confidence,
        "trustScore": trust_score,
        "referralReadiness": referral_readiness,
        "recommendation": recommendation,
        "strengths": analysis["strengths"],
        "missingSkills": analysis["missingSkills"],
        "missingRequirements": analysis["missingRequirements"],
        "actionPlan": analysis["actionPlan"],
        "evidence": analysis["evidence"],
        "riskSignals": risk_signals,
        "scoreFormula": "30% Overall Match + 25% Role Fit + 15% Proof Score + 15% Confidence + 10% Completeness + 5% Gap Resilience",
        "scoreBreakdown": score_breakdown,
        "aiSummary": summary,
    }
