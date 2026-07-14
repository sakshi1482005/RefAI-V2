from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.schemas import ReferralMessageRequest, ReferralMessageResponse
from app.services.groq_client import generate_referral_message

router = APIRouter(prefix="/referral", tags=["referral"])


@router.post("/message", response_model=ReferralMessageResponse)
def create_referral_message(payload: ReferralMessageRequest, user: dict = Depends(get_current_user)):
    message = generate_referral_message(payload.candidateName, payload.role, payload.trustSummary)
    return {"message": message}
