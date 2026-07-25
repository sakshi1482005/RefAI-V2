import logging

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.schemas import TrustCardRequest, TrustCardResponse
from app.services.trust_card_engine import InsufficientJobRequirements, build_trust_card
from app.services.referral_requests import ReferralError, ReferralForbidden, ReferralRequestService
from app.services.student_persistence import (
    StudentAnalysisNotFound,
    StudentPersistenceError,
    StudentPersistenceService,
    StudentProfileForbidden,
)
from fastapi import HTTPException, status

router = APIRouter(prefix="/trust-card", tags=["trust-card"])
referral_service = ReferralRequestService()
persistence_service = StudentPersistenceService()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=TrustCardResponse)
def generate_trust_card(payload: TrustCardRequest, user: dict = Depends(get_current_user)):
    student_id = user["sub"]
    logger.info("Trust Card generation reached for student=%s analysis=%s", student_id, payload.analysisId)
    if payload.analysisId:
        try:
            analysis = persistence_service.get_analysis(student_id, str(payload.analysisId))
        except StudentAnalysisNotFound as exc:
            raise HTTPException(status_code=404, detail="Persisted resume analysis was not found.") from exc
        except StudentPersistenceError as exc:
            logger.exception("Trust Card analysis lookup failed for student=%s", student_id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The saved resume analysis could not be loaded. Please retry.",
            ) from exc
        candidate_name = payload.candidateName or "Candidate"
        role = analysis["target_role"]
        resume_text = analysis["resume_text"]
        job_description = analysis["job_description"]
        analysis_id = str(payload.analysisId)
    elif all((payload.candidateName, payload.role, payload.resumeText, payload.jobDescription)):
        candidate_name, role = payload.candidateName, payload.role
        resume_text, job_description = payload.resumeText, payload.jobDescription
        analysis_id = None
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A persisted analysis ID is required.")
    try:
        result = build_trust_card(
            candidate_name=candidate_name,
            role=role,
            resume_text=resume_text,
            job_description=job_description,
        )
    except InsufficientJobRequirements as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The saved job description has no specific requirements. Rerun resume analysis with a fuller job description.",
        ) from exc

    try:
        education = persistence_service.get_education(student_id)
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except Exception:
        # Education is optional Trust Card context. A temporary profile read failure
        # must not discard an otherwise valid, persisted resume analysis.
        logger.exception("Optional Trust Card education lookup failed for student=%s", student_id)
        education = {"college": None, "degree": None, "branch": None, "graduationYear": None}
    result = {**result, "education": education}

    try:
        stored = referral_service.persist_trust_card(student_id, result, analysis_id)
    except ReferralForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
    except ReferralError as exc:
        logger.exception("Trust Card persistence failed for student=%s analysis=%s", student_id, analysis_id)
        raise HTTPException(status_code=503, detail="The Trust Card could not be saved. Please retry.") from exc
    except Exception as exc:
        logger.exception("Unexpected Trust Card persistence failure for student=%s analysis=%s", student_id, analysis_id)
        raise HTTPException(status_code=503, detail="The Trust Card could not be saved. Please retry.") from exc
    logger.info("Trust Card persisted for student=%s analysis=%s card=%s", student_id, analysis_id, stored["id"])
    return {"id": stored["id"], **result}
