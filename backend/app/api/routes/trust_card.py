from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.schemas import TrustCardRequest, TrustCardResponse
from app.services.trust_card_engine import build_trust_card

router = APIRouter(prefix="/trust-card", tags=["trust-card"])


@router.post("/generate", response_model=TrustCardResponse)
def generate_trust_card(payload: TrustCardRequest, user: dict = Depends(get_current_user)):
    return build_trust_card(
        candidate_name=payload.candidateName,
        role=payload.role,
        resume_text=payload.resumeText,
        job_description=payload.jobDescription,
    )
