import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.services.resume_analysis import ResumeAnalysisUnavailable, run_resume_analysis
from app.models.schemas import MatchScoreRequest, MatchAnalysisResponse

router = APIRouter(prefix="/match", tags=["match"])
logger = logging.getLogger(__name__)


@router.post("/score", response_model=MatchAnalysisResponse)
def score_match(
    payload: MatchScoreRequest,
    user: dict = Depends(get_current_user),
):
    logger.info(
        "Resume analysis route reached user=%s resume_chars=%s job_description_chars=%s",
        user["sub"], len(payload.resumeText), len(payload.jobDescription),
    )
    try:
        result = run_resume_analysis(payload.resumeText, payload.jobDescription)
    except ResumeAnalysisUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The analysis service returned an invalid result. Please try again.") from exc
    logger.info(
        "Resume analysis serialized user=%s status=%s overall=%s matched=%s missing=%s",
        user["sub"], result["analysisStatus"], result["overall"],
        len(result["matchedSkills"]), len(result["missingSkills"]),
    )
    return result
