import logging
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status

from app.core.security import get_current_user
from app.services.resume_parser import extract_text, chunk_text
from app.services.vector_store import upsert_resume_chunks
from app.services.resume_storage import ResumeStorageUnavailable, store_resume
from app.models.schemas import CandidateIntelligenceResponse, FuzzyCandidateSuitabilityAnalysisResponse, HybridCandidateIntelligenceResponse, HypotheticalImprovementRequest, ImprovementSimulatorResponse, MatchAnalysisResponse, MatchScoreRequest, ModelComparisonResponse, PersistedAnalysisSessionResponse, ResumeUploadResponse, SemanticJobMatchResponse, SkillGapRecommendationResponse
from app.services.resume_analysis import ResumeAnalysisInputError, ResumeAnalysisUnavailable, run_resume_analysis
from app.services.student_persistence import StudentAnalysisNotFound, StudentPersistenceError, StudentPersistenceService
from app.services.requirement_extractor import classify_job_description, extract_requirements, general_expectations_for_role
from app.services.analysis_reliability import assess_analysis_reliability
from app.services.fuzzy_candidate_suitability import evaluate_fuzzy_candidate_suitability
from app.services.fuzzy_candidate_suitability_mapping import build_fuzzy_suitability_inputs
from app.services.semantic_job_match import build_semantic_job_match
from app.services.hybrid_candidate_intelligence import build_hybrid_candidate_intelligence
from app.services.skill_gap_recommendations import build_skill_gap_recommendations
from app.services.improvement_simulator import attach_intelligence_snapshot, simulate_hypothetical_improvements
from app.services.model_comparison import build_model_comparison
from app.services.candidate_intelligence_cache import (
    candidate_intelligence_cache_key,
    get_or_build_candidate_intelligence,
)
from app.services.referral_requests import ReferralRequestService
from app.services.student_persistence import StudentProfileForbidden

router = APIRouter(prefix="/resume", tags=["resume"])
MAX_RESUME_BYTES = 10 * 1024 * 1024
MAX_ANALYSIS_TEXT_CHARS = 200_000
logger = logging.getLogger(__name__)
persistence_service = StudentPersistenceService()
referral_service = ReferralRequestService()


@router.post("/analyze", response_model=MatchAnalysisResponse)
def analyze_resume(payload: MatchScoreRequest, user: dict = Depends(get_current_user)):
    logger.info(
        "Resume analysis route reached user=%s resume_chars=%s job_description_chars=%s",
        user["sub"], len(payload.resumeText), len(payload.jobDescription),
    )
    try:
        used_general_expectations = not bool(payload.jobDescription)
        effective_job_description = payload.jobDescription or general_expectations_for_role(payload.targetRole)
        result = {
            **run_resume_analysis(payload.resumeText, effective_job_description, payload.targetRole),
            "jobDescriptionClassification": classify_job_description(effective_job_description),
            "usedGeneralRoleExpectations": used_general_expectations,
        }
        result["analysisReliability"] = assess_analysis_reliability(
            payload.resumeText,
            result,
            payload.jobDescription or None,
            parsing_success=True,
        )
        return persistence_service.save_analysis(
            user["sub"], payload, result, effective_job_description=effective_job_description
        )
    except ResumeAnalysisInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Add a fuller job description with specific skills, tools, responsibilities, or experience requirements.",
        ) from exc
    except ResumeAnalysisUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The analysis service returned an invalid result. Please try again.",
        ) from exc
    except StudentPersistenceError as exc:
        logger.exception("Resume analysis persistence failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The analysis completed but could not be saved. Please retry.") from exc


@router.get("/analysis/latest", response_model=PersistedAnalysisSessionResponse)
def latest_analysis(user: dict = Depends(get_current_user)):
    try:
        result = persistence_service.latest_session(user["sub"])
    except StudentPersistenceError as exc:
        logger.exception("Latest resume analysis read failed user=%s", user["sub"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The saved resume analysis could not be loaded. Please retry.",
        ) from exc
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.")
    return result


def _load_improvement_intelligence(student_id: str) -> dict:
    """Load current student-owned inputs shared by simulator read and simulation routes."""
    session = persistence_service.latest_session(student_id)
    if not session:
        raise StudentAnalysisNotFound("Persisted resume analysis was not found")
    trust_card = session.get("trustCard")
    if not isinstance(trust_card, dict) or not trust_card.get("id"):
        raise StudentAnalysisNotFound("Generate a current Trust Card before using the improvement simulator")
    cache_key = candidate_intelligence_cache_key(student_id, session)

    def build() -> dict:
        profile = persistence_service.get_profile(student_id)
        analysis = persistence_service.get_analysis(student_id, str(session["analysisId"]))
        fuzzy_inputs, fuzzy_sources = build_fuzzy_suitability_inputs(session, profile)
        fuzzy_result = evaluate_fuzzy_candidate_suitability(fuzzy_inputs).model_dump()
        fuzzy_result["inputValuesUsed"] = fuzzy_inputs.model_dump()
        fuzzy_result["inputSources"] = fuzzy_sources
        job_description = None if analysis.get("used_general_role_expectations") else str(analysis.get("job_description") or "")
        semantic_result = build_semantic_job_match(
            resume_text=str(analysis.get("resume_text") or ""),
            target_role=str(analysis.get("target_role") or session.get("role") or ""),
            job_description=job_description,
            analysis_id=str(analysis["id"]),
            analysis_version=str(analysis.get("updated_at") or analysis.get("created_at") or ""),
        ).model_dump()
        claim_verification = referral_service.student_claim_verifications(student_id, str(trust_card["id"]))
        hybrid_result = build_hybrid_candidate_intelligence(
            trust_card=trust_card, fuzzy_suitability=fuzzy_result,
            semantic_job_match=semantic_result, claim_verification=claim_verification,
        ).model_dump()
        effective_description = job_description or general_expectations_for_role(str(analysis.get("target_role") or session.get("role") or ""))
        skill_gaps = build_skill_gap_recommendations(
            requirements=extract_requirements(effective_description), semantic_job_match=semantic_result,
            fuzzy_suitability=fuzzy_result, claim_verification=claim_verification,
        ).model_dump()
        return {
            "trust_card": trust_card, "fuzzy": fuzzy_result, "semantic": semantic_result,
            "hybrid": hybrid_result, "claims": claim_verification,
            "skill_gaps": skill_gaps, "recommendations": skill_gaps["recommendations"],
            "target_role": str(analysis.get("target_role") or session.get("role") or "") or None,
        }

    context, cache_hit = get_or_build_candidate_intelligence(cache_key, build)
    logger.debug("candidate_intelligence_context cache=%s", "hit" if cache_hit else "miss")
    return context


@router.get("/analysis/candidate-intelligence", response_model=CandidateIntelligenceResponse)
def candidate_intelligence(user: dict = Depends(get_current_user)):
    """Return real current academic signals in one student-scoped dashboard read."""
    try:
        context = _load_improvement_intelligence(user["sub"])
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        logger.exception("Candidate intelligence persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Candidate intelligence could not be loaded. Please retry.") from exc
    except Exception as exc:
        logger.exception("Candidate intelligence derivation failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Candidate intelligence is temporarily unavailable. Please retry.") from exc

    card = context["trust_card"]
    return {
        "trustScore": card.get("trustScore") or 0,
        "trustScoreVersion": card.get("scoreVersion"),
        "trustScoreBreakdown": card.get("scoreBreakdown") or [],
        "hybrid": context["hybrid"],
        "fuzzy": {**context["fuzzy"], "inputValuesUsed": context["fuzzy"].get("inputValuesUsed"), "inputSources": context["fuzzy"].get("inputSources")},
        "semantic": context["semantic"],
        "skillGaps": context["skill_gaps"],
    }


@router.get("/analysis/model-comparison", response_model=ModelComparisonResponse)
def model_comparison(user: dict = Depends(get_current_user)):
    """Return a read-only academic comparison of current deterministic outputs."""
    try:
        context = _load_improvement_intelligence(user["sub"])
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        logger.exception("Model comparison persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model comparison could not be loaded. Please retry.") from exc
    except Exception as exc:
        logger.exception("Model comparison derivation failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model comparison is temporarily unavailable. Please retry.") from exc
    return build_model_comparison(
        trust_card=context["trust_card"], fuzzy_suitability=context["fuzzy"],
        semantic_job_match=context["semantic"], hybrid_intelligence=context["hybrid"],
        target_role=context["target_role"],
    )


@router.get("/analysis/improvement-simulator", response_model=ImprovementSimulatorResponse)
def improvement_simulator(user: dict = Depends(get_current_user)):
    try:
        baseline = persistence_service.improvement_simulator(user["sub"])
        context = _load_improvement_intelligence(user["sub"])
        return attach_intelligence_snapshot(
            baseline, fuzzy_suitability=context["fuzzy"], semantic_job_match=context["semantic"],
            hybrid_intelligence=context["hybrid"], recommendations=context["recommendations"],
        )
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The improvement simulator could not load saved analyses.") from exc
    except Exception as exc:
        logger.exception("Improvement simulator load failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The improvement simulator is temporarily unavailable. Please retry.") from exc


@router.post("/analysis/improvement-simulator/simulate", response_model=ImprovementSimulatorResponse)
def simulate_improvement(payload: HypotheticalImprovementRequest, user: dict = Depends(get_current_user)):
    """Estimate selected evidence improvements without mutating any persisted record."""
    try:
        baseline = persistence_service.improvement_simulator(user["sub"])
        context = _load_improvement_intelligence(user["sub"])
        return simulate_hypothetical_improvements(
            baseline, fuzzy_suitability=context["fuzzy"], semantic_job_match=context["semantic"],
            hybrid_intelligence=context["hybrid"], trust_card=context["trust_card"],
            claim_verification=context["claims"], recommendations=context["recommendations"],
            selected_skills=payload.skillEvidence, add_project_evidence=payload.addProjectEvidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        logger.exception("Improvement simulation persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The improvement simulator could not load saved analyses.") from exc
    except Exception as exc:
        logger.exception("Improvement simulation failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The improvement estimate is temporarily unavailable. Please retry.") from exc


@router.get("/analysis/fuzzy-suitability", response_model=FuzzyCandidateSuitabilityAnalysisResponse)
def fuzzy_candidate_suitability(user: dict = Depends(get_current_user)):
    """Evaluate the separate academic fuzzy model from this student's saved data."""
    try:
        profile = persistence_service.get_profile(user["sub"])
        session = persistence_service.latest_session(user["sub"])
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentPersistenceError as exc:
        logger.exception("Fuzzy suitability persisted data read failed user=%s", user["sub"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The saved analysis could not be loaded. Please retry.",
        ) from exc

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No persisted resume analysis is available.",
        )

    inputs, sources = build_fuzzy_suitability_inputs(session, profile)
    result = evaluate_fuzzy_candidate_suitability(inputs)
    return {
        **result.model_dump(),
        "inputValuesUsed": inputs,
        "inputSources": sources,
    }


@router.get("/analysis/semantic-job-match", response_model=SemanticJobMatchResponse)
def semantic_job_match(user: dict = Depends(get_current_user)):
    """Compare the latest saved resume evidence against its persisted opportunity."""
    try:
        # get_profile is the existing persisted role guard for student-only data.
        persistence_service.get_profile(user["sub"])
        session = persistence_service.latest_session(user["sub"])
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.")
        analysis = persistence_service.get_analysis(user["sub"], str(session["analysisId"]))
    except HTTPException:
        raise
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.") from exc
    except StudentPersistenceError as exc:
        logger.exception("Semantic job match persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The saved analysis could not be loaded. Please retry.") from exc

    return build_semantic_job_match(
        resume_text=str(analysis.get("resume_text") or ""),
        target_role=str(analysis.get("target_role") or session.get("role") or ""),
        job_description=None if analysis.get("used_general_role_expectations") else str(analysis.get("job_description") or ""),
        analysis_id=str(analysis["id"]),
        analysis_version=str(analysis.get("updated_at") or analysis.get("created_at") or ""),
    )


@router.get("/analysis/hybrid-candidate-intelligence", response_model=HybridCandidateIntelligenceResponse)
def hybrid_candidate_intelligence(user: dict = Depends(get_current_user)):
    """Return the separate academic composite from current, student-owned evidence."""
    try:
        profile = persistence_service.get_profile(user["sub"])
        session = persistence_service.latest_session(user["sub"])
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.")
        trust_card = session.get("trustCard")
        if not isinstance(trust_card, dict) or not trust_card.get("id"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generate a current Trust Card before using Hybrid Candidate Intelligence.")
        analysis = persistence_service.get_analysis(user["sub"], str(session["analysisId"]))
        fuzzy_inputs, fuzzy_sources = build_fuzzy_suitability_inputs(session, profile)
        fuzzy_result = evaluate_fuzzy_candidate_suitability(fuzzy_inputs).model_dump()
        fuzzy_result["inputSources"] = fuzzy_sources
        semantic_result = build_semantic_job_match(
            resume_text=str(analysis.get("resume_text") or ""),
            target_role=str(analysis.get("target_role") or session.get("role") or ""),
            job_description=None if analysis.get("used_general_role_expectations") else str(analysis.get("job_description") or ""),
            analysis_id=str(analysis["id"]),
            analysis_version=str(analysis.get("updated_at") or analysis.get("created_at") or ""),
        ).model_dump()
        claim_verification = referral_service.student_claim_verifications(user["sub"], str(trust_card["id"]))
    except HTTPException:
        raise
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.") from exc
    except StudentPersistenceError as exc:
        logger.exception("Hybrid candidate intelligence persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The saved analysis could not be loaded. Please retry.") from exc

    return build_hybrid_candidate_intelligence(
        trust_card=trust_card,
        fuzzy_suitability=fuzzy_result,
        semantic_job_match=semantic_result,
        claim_verification=claim_verification,
    )


@router.get("/analysis/skill-gap-recommendations", response_model=SkillGapRecommendationResponse)
def skill_gap_recommendations(user: dict = Depends(get_current_user)):
    """Return a deterministic learning order for unsupported role requirements."""
    try:
        profile = persistence_service.get_profile(user["sub"])
        session = persistence_service.latest_session(user["sub"])
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.")
        trust_card = session.get("trustCard")
        if not isinstance(trust_card, dict) or not trust_card.get("id"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generate a current Trust Card before using skill-gap recommendations.")
        analysis = persistence_service.get_analysis(user["sub"], str(session["analysisId"]))
        fuzzy_inputs, fuzzy_sources = build_fuzzy_suitability_inputs(session, profile)
        fuzzy_result = evaluate_fuzzy_candidate_suitability(fuzzy_inputs).model_dump()
        fuzzy_result["inputSources"] = fuzzy_sources
        job_description = None if analysis.get("used_general_role_expectations") else str(analysis.get("job_description") or "")
        semantic_result = build_semantic_job_match(
            resume_text=str(analysis.get("resume_text") or ""),
            target_role=str(analysis.get("target_role") or session.get("role") or ""),
            job_description=job_description,
            analysis_id=str(analysis["id"]),
            analysis_version=str(analysis.get("updated_at") or analysis.get("created_at") or ""),
        ).model_dump()
        effective_description = job_description or general_expectations_for_role(str(analysis.get("target_role") or session.get("role") or ""))
        # The extractor retains priority/category metadata required for deterministic ranking.
        raw_requirements = extract_requirements(effective_description)
        claim_verification = referral_service.student_claim_verifications(user["sub"], str(trust_card["id"]))
    except HTTPException:
        raise
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except StudentAnalysisNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.") from exc
    except StudentPersistenceError as exc:
        logger.exception("Skill-gap recommendations persisted data read failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The saved analysis could not be loaded. Please retry.") from exc

    return build_skill_gap_recommendations(
        requirements=raw_requirements,
        semantic_job_match=semantic_result,
        fuzzy_suitability=fuzzy_result,
        claim_verification=claim_verification,
    )


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    started_at = perf_counter()
    file_bytes = await file.read()
    filename = file.filename or ""
    logger.info("Resume upload route reached user=%s filename=%s bytes=%s", user["sub"], filename, len(file_bytes))
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PDF resume.")
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded PDF is empty.")
    if len(file_bytes) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The PDF must be smaller than 10 MB.")
    try:
        text = extract_text(filename, file_bytes).strip()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The PDF could not be read.") from exc
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No readable text was found in the PDF.")
    chunks = chunk_text(text)
    logger.info("Resume extraction complete user=%s filename=%s characters=%s chunks=%s", user["sub"], filename, len(text), len(chunks))
    resume_id = uuid4().hex
    try:
        storage_path, storage_status = store_resume(user["sub"], resume_id, file_bytes)
    except ResumeStorageUnavailable as exc:
        logger.warning("Private resume Storage upload unavailable user=%s resume=%s", user["sub"], resume_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Private resume storage is temporarily unavailable. Please try again shortly.",
        ) from exc
    if storage_status != "stored" or not storage_path:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Private resume storage is temporarily unavailable. Please try again shortly.",
        )
    indexed = True
    try:
        upsert_resume_chunks(f"{user['sub']}-{resume_id}", chunks)
    except Exception:
        indexed = False
        logger.exception("Resume vector indexing failed for user=%s resume=%s", user["sub"], resume_id)

    response = {
        "resumeId": resume_id,
        "fileName": filename,
        "chunkCount": len(chunks),
        "preview": text[:MAX_ANALYSIS_TEXT_CHARS],
        "extractionStatus": "complete",
        "analysisStatus": "pending",
        "storagePath": storage_path,
        "storageStatus": storage_status,
        "indexed": indexed,
        "processingTimeMs": round((perf_counter() - started_at) * 1000),
    }
    logger.info(
        "Resume response serialized user=%s resume=%s extraction=%s storage=%s indexed=%s",
        user["sub"], resume_id, response["extractionStatus"], storage_status, indexed,
    )
    return response

