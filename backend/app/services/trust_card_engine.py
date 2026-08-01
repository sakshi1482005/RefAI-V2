from app.services.groq_client import AIServiceUnavailable, generate_trust_summary
from app.services.requirement_extractor import PRIORITY_WEIGHT, build_gap, extract_requirements, requirement_occurrences
from app.services.trust_score import compute_candidate_trust_score
import re


class InsufficientJobRequirements(ValueError):
    """Raised when a job description contains no meaningful match criteria."""


def _meaningful_tokens(text: str) -> list[str]:
    return [token for token in re.findall(r"[a-z0-9+#.]+", text.lower()) if len(token) > 2]


def _analysis_context(job_description: str, target_role: str | None = None) -> str:
    return "\n".join(part.strip() for part in (target_role or "", job_description) if part.strip())


def compute_match_score(resume_text: str, job_description: str, target_role: str | None = None) -> dict:
    """Compute weighted coverage over canonical phrase-level requirements."""
    requirements = extract_requirements(_analysis_context(job_description, target_role))
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


def build_match_analysis(resume_text: str, job_description: str, target_role: str | None = None) -> dict:
    """Return the score plus the transparent evidence fields used by the UI."""
    started_resume_tokens = _meaningful_tokens(resume_text)
    requirements = extract_requirements(_analysis_context(job_description, target_role))
    if not requirements:
        raise InsufficientJobRequirements(
            "No meaningful skills, tools, practices, experience, degree, or certification requirements were found."
        )
    score = compute_match_score(resume_text, job_description, target_role)
    matched_requirements = [item for item in requirements if requirement_occurrences(resume_text, item) >= 1]
    missing_requirement_items = [item for item in requirements if requirement_occurrences(resume_text, item) == 0]
    matched_skills = [item["requirement"] for item in matched_requirements]
    missing_skills = [item["requirement"] for item in missing_requirement_items]
    missing_requirements = [build_gap(item) for item in missing_requirement_items]
    action_plan = missing_requirements[:5]

    strengths = [
        *([f"Matched requirements include {', '.join(matched_skills[:5])}."] if matched_skills else []),
        f"{score['roleFit']}% of weighted job requirements have supporting resume evidence.",
        f"{score['proof']}% of weighted requirements are reinforced by repeated evidence.",
    ]
    weaknesses = [
        f"{item['requirement']} is a {item['priority']} {item['category']} with no supporting resume evidence."
        for item in missing_requirement_items[:5]
    ]
    if not weaknesses and score["proof"] < score["roleFit"]:
        weaknesses = [
            f"Repeated evidence trails requirement coverage by {score['roleFit'] - score['proof']} percentage points."
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
    score_reasons = [
        f"Role Fit is {score['roleFit']}% because that share of weighted requirements appears in the resume.",
        f"Proof is {score['proof']}% because matched requirements must appear in at least two resume contexts.",
        f"Gap Score is {score['gaps']}% because those weighted requirements have no supporting resume evidence.",
        f"Overall Match is {score['overall']}%, the rounded average of Role Fit and Proof.",
    ]
    ats_guidance = [
        {
            "title": "Use authentic requirement terminology",
            "description": (
                f"Keep the exact terminology for supported requirements such as {', '.join(matched_skills[:3])} in project or experience evidence."
                if matched_skills
                else "No target requirements were matched. Add only terminology that truthfully describes completed work."
            ),
        },
        {
            "title": "Prioritize unsupported requirements",
            "description": (
                f"The highest-priority missing requirements are {', '.join(item['requirement'] for item in missing_requirement_items[:3])}."
                if missing_requirement_items
                else "No requirement gaps were detected; preserve readable headings and measurable evidence."
            ),
        },
    ]
    interview_readiness = {
        "title": "Evidence is ready for interview follow-up" if score["proof"] >= 70 else "Prepare stronger evidence before interviews",
        "description": (
            f"Proof coverage is {score['proof']}%. Prepare concise examples for {', '.join(matched_skills[:3])}."
            if matched_skills
            else f"Proof coverage is {score['proof']}%. Build truthful project or experience evidence for the target requirements."
        ),
    }

    return {
        **score,
        "analysisStatus": "complete",
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills,
        "missingRequirements": missing_requirements,
        "actionPlan": action_plan,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "evidence": evidence,
        "resumeSectionsUsed": resume_sections_used,
        "readinessSummary": readiness_summary,
        "learningRecommendations": learning_recommendations,
        "confidence": confidence,
        "scoreReasons": score_reasons,
        "atsGuidance": ats_guidance,
        "interviewReadiness": interview_readiness,
    }


def build_trust_card(
    candidate_name: str,
    role: str,
    resume_text: str,
    job_description: str,
    similarity_provider=None,
    relevance_source: str = "job_description",
) -> dict:
    analysis = build_match_analysis(resume_text, job_description, role)
    match_score = {key: analysis[key] for key in ("overall", "roleFit", "proof", "gaps")}
    confidence = analysis["confidence"]
    trust_result = compute_candidate_trust_score(
        resume_text,
        job_description,
        role,
        similarity_provider=similarity_provider,
        relevance_source=relevance_source,
    )
    trust_score = trust_result["trustScore"]
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
        "scoreVersion": trust_result["scoreVersion"],
        "referralReadiness": referral_readiness,
        "recommendation": recommendation,
        "strengths": analysis["strengths"],
        "weaknesses": analysis["weaknesses"],
        "missingSkills": analysis["missingSkills"],
        "missingRequirements": analysis["missingRequirements"],
        "actionPlan": analysis["actionPlan"],
        "evidence": analysis["evidence"],
        "riskSignals": risk_signals,
        "scoreFormula": trust_result["scoreFormula"],
        "scoreBreakdown": trust_result["scoreBreakdown"],
        "scoreReasons": analysis["scoreReasons"],
        "aiSummary": summary,
    }
