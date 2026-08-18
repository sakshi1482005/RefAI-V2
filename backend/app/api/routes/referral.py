from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.models.schemas import ClaimVerificationResponse, ClarificationDraftResponse, CreateReferralRequest, CreditBalanceResponse, CreditLedgerEntryResponse, CreditPurchaseRequest, CreditPurchaseResponse, EmployeeDecisionUpdate, EmployeeDirectoryItem, EmployeeDiscoveryRecommendation, EmployeeDiscoveryRecommendationRequest, EmployeeProfessionalProfile, EmployeeProfessionalProfileUpdate, EmployeeReferralQueueItem, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeReviewCopilotResponse, EmployeeTrustCardView, MoreInformationResponseInput, ProofEntryInput, ProofEntryResponse, ReferralCompatibilityRequest, ReferralCompatibilityResponse, ReferralMessageRequest, ReferralMessageResponse, ReferralQualityRequest, ReferralQualityResponse, ReferralRequestDetail, ReferralRequestSummary, ReferralStatusHistoryEntry, ReferralSubmissionUpdate, TrustCardResponse
from app.services.referral_requests import InvalidReferralTransition, ReferralForbidden, ReferralNotFound, ReferralQualityBlocked, ReferralRequestService, ReferralStorageUnavailable, ReferralUnavailable

router = APIRouter(prefix="/referral", tags=["referral"])
service = ReferralRequestService()


def _raise_referral_error(exc: Exception):
    if isinstance(exc, ReferralForbidden): raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, ReferralNotFound): raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ReferralUnavailable): raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ReferralStorageUnavailable): raise HTTPException(status_code=503, detail="The private resume service is temporarily unavailable. Please try again shortly.") from exc
    if isinstance(exc, ReferralQualityBlocked): raise HTTPException(status_code=422, detail={"message": str(exc), "quality": exc.quality}) from exc
    if isinstance(exc, InvalidReferralTransition): raise HTTPException(status_code=409, detail=str(exc)) from exc
    raise exc


@router.post("/requests", response_model=ReferralRequestDetail, status_code=201)
def create_request(payload: CreateReferralRequest, user: dict = Depends(get_current_user)):
    try: return service.create(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/compatibility", response_model=ReferralCompatibilityResponse)
def referral_compatibility(payload: ReferralCompatibilityRequest, user: dict = Depends(get_current_user)):
    try: return service.compatibility(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/quality", response_model=ReferralQualityResponse)
def referral_quality(payload: ReferralQualityRequest, user: dict = Depends(get_current_user)):
    try: return service.quality(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests", response_model=list[ReferralRequestSummary])
def list_requests(user: dict = Depends(get_current_user)):
    try: return service.list(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employees", response_model=list[EmployeeDirectoryItem])
def employee_directory(user: dict = Depends(get_current_user)):
    try: return service.employee_directory(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.post("/employees/recommendations", response_model=list[EmployeeDiscoveryRecommendation])
def employee_recommendations(payload: EmployeeDiscoveryRecommendationRequest, user: dict = Depends(get_current_user)):
    try: return service.employee_recommendations(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/queue", response_model=list[EmployeeReferralQueueItem])
def employee_queue(user: dict = Depends(get_current_user)):
    try: return service.employee_queue(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/profile", response_model=EmployeeProfessionalProfile)
def employee_profile(user: dict = Depends(get_current_user)):
    try: return service.employee_profile(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.put("/employee/profile", response_model=EmployeeProfessionalProfile)
def save_employee_profile(payload: EmployeeProfessionalProfileUpdate, user: dict = Depends(get_current_user)):
    try: return service.save_employee_profile(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}", response_model=EmployeeReferralRequestView)
def employee_request_detail(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_request_detail(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/employee/requests/{request_id}/copilot", response_model=EmployeeReviewCopilotResponse)
def employee_review_copilot(request_id: str, refresh: bool = False, user: dict = Depends(get_current_user)):
    try: return service.employee_review_copilot(user["sub"], request_id, refresh=refresh)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/employee/requests/{request_id}/clarification-draft", response_model=ClarificationDraftResponse)
def employee_clarification_draft(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.draft_clarification(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/resume", response_model=EmployeeResumeAccess)
def employee_request_resume(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_resume(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/trust-card", response_model=EmployeeTrustCardView)
def employee_request_trust_card(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_trust_card(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/proofs", response_model=list[ProofEntryResponse])
def employee_request_proofs(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_request_proofs(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/claim-verifications", response_model=ClaimVerificationResponse)
def employee_claim_verifications(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_claim_verifications(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/proofs", response_model=list[ProofEntryResponse])
def list_proofs(trust_card_id: str, user: dict = Depends(get_current_user)):
    try: return service.list_student_proofs(user["sub"], trust_card_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/proofs/claim-verifications", response_model=ClaimVerificationResponse)
def student_claim_verifications(trust_card_id: str, user: dict = Depends(get_current_user)):
    try: return service.student_claim_verifications(user["sub"], trust_card_id)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/proofs", response_model=ProofEntryResponse, status_code=201)
def create_proof(payload: ProofEntryInput, user: dict = Depends(get_current_user)):
    try: return service.create_proof(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.put("/proofs/{proof_id}", response_model=ProofEntryResponse)
def update_proof(proof_id: str, payload: ProofEntryInput, user: dict = Depends(get_current_user)):
    try: return service.update_proof(user["sub"], proof_id, payload)
    except Exception as exc: _raise_referral_error(exc)


@router.delete("/proofs/{proof_id}", status_code=204)
def delete_proof(proof_id: str, user: dict = Depends(get_current_user)):
    try: service.delete_proof(user["sub"], proof_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}", response_model=ReferralRequestDetail)
def get_request(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.get(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}/history", response_model=list[ReferralStatusHistoryEntry])
def request_history(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.history(user["sub"], request_id) or []
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}/trust-card", response_model=TrustCardResponse)
def request_trust_card(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.trust_card_for_request(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.patch("/requests/{request_id}/decision", response_model=ReferralRequestDetail)
def update_decision(request_id: str, payload: EmployeeDecisionUpdate, user: dict = Depends(get_current_user)):
    try: return service.update_status(user["sub"], request_id, payload)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/requests/{request_id}/more-information-response", response_model=ReferralRequestDetail)
def respond_to_more_information(request_id: str, payload: MoreInformationResponseInput, user: dict = Depends(get_current_user)):
    try: return service.respond_to_more_information(user["sub"], request_id, payload)
    except Exception as exc: _raise_referral_error(exc)


@router.patch("/employee/requests/{request_id}/referral-submission", response_model=EmployeeReferralRequestView)
def mark_referral_submitted(request_id: str, payload: ReferralSubmissionUpdate, user: dict = Depends(get_current_user)):
    try: return service.mark_referral_submitted(user["sub"], request_id, payload)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/message", response_model=ReferralMessageResponse)
def create_referral_message(payload: ReferralMessageRequest, user: dict = Depends(get_current_user)):
    try:
        return service.generate_message(user["sub"], payload)
    except Exception as exc:
        _raise_referral_error(exc)

@router.get("/credits", response_model=CreditBalanceResponse)
def credit_balance(user: dict = Depends(get_current_user)):
    try: return service.credits(user["sub"])
    except Exception as exc: _raise_referral_error(exc)

@router.get("/credits/history", response_model=list[CreditLedgerEntryResponse])
def credit_history(user: dict = Depends(get_current_user)):
    try: return service.credit_history(user["sub"])
    except Exception as exc: _raise_referral_error(exc)

@router.post("/credits/purchase", response_model=CreditPurchaseResponse)
def purchase_credits(payload: CreditPurchaseRequest, user: dict = Depends(get_current_user)):
    try: return service.purchase_credits(user["sub"], payload.plan, payload.idempotencyKey)
    except Exception as exc: _raise_referral_error(exc)
