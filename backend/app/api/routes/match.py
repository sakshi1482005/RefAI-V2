from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.services.trust_card_engine import compute_match_score

router = APIRouter(prefix="/match", tags=["match"])


@router.post("/score")
def score_match(
    resume_text: str,
    job_description: str,
    user: dict = Depends(get_current_user),
):
    return compute_match_score(resume_text, job_description)
