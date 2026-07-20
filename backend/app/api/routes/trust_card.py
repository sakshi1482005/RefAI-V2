from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.schemas import TrustCardRequest, TrustCardResponse
from app.services.trust_card_engine import InsufficientJobRequirements, build_trust_card
from app.services.referral_requests import ReferralRequestService, ReferralError
from app.services.student_persistence import StudentPersistenceError, StudentPersistenceService
from fastapi import HTTPException, status

router = APIRouter(prefix="/trust-card", tags=["trust-card"])
referral_service = ReferralRequestService()
persistence_service = StudentPersistenceService()


@router.post("/generate", response_model=TrustCardResponse)
def generate_trust_card(payload: TrustCardRequest, user: dict = Depends(get_current_user)):
    if payload.analysisId:
        try:
            analysis = persistence_service.get_analysis(user["sub"], str(payload.analysisId))
        except StudentPersistenceError as exc:
            raise HTTPException(status_code=404, detail="Persisted resume analysis was not found.") from exc
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
        stored = referral_service.persist_trust_card(user["sub"], result, analysis_id)
    except ReferralError as exc:
        raise HTTPException(status_code=503, detail="The Trust Card could not be saved. Please retry.") from exc
    return {"id": stored["id"], **result}
