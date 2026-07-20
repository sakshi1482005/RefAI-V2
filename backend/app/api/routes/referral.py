from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.schemas import CreateReferralRequest, EmployeeDecisionUpdate, EmployeeDirectoryItem, EmployeeReferralQueueItem, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeTrustCardView, ReferralMessageRequest, ReferralMessageResponse, ReferralRequestDetail, ReferralRequestSummary, ReferralStatusHistoryEntry, TrustCardResponse
from app.services.groq_client import AIServiceUnavailable, generate_referral_message
from app.services.referral_requests import InvalidReferralTransition, ReferralForbidden, ReferralNotFound, ReferralRequestService, ReferralUnavailable

router = APIRouter(prefix="/referral", tags=["referral"])
service = ReferralRequestService()


def _raise_referral_error(exc: Exception):
    if isinstance(exc, ReferralForbidden): raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, ReferralNotFound): raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ReferralUnavailable): raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, InvalidReferralTransition): raise HTTPException(status_code=409, detail=str(exc)) from exc
    raise exc


@router.post("/requests", response_model=ReferralRequestDetail, status_code=201)
def create_request(payload: CreateReferralRequest, user: dict = Depends(get_current_user)):
    try: return service.create(user["sub"], payload)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests", response_model=list[ReferralRequestSummary])
def list_requests(user: dict = Depends(get_current_user)):
    try: return service.list(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employees", response_model=list[EmployeeDirectoryItem])
def employee_directory(user: dict = Depends(get_current_user)):
    try: return service.employee_directory(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/queue", response_model=list[EmployeeReferralQueueItem])
def employee_queue(user: dict = Depends(get_current_user)):
    try: return service.employee_queue(user["sub"])
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}", response_model=EmployeeReferralRequestView)
def employee_request_detail(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_request_detail(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/resume", response_model=EmployeeResumeAccess)
def employee_request_resume(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_resume(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/employee/requests/{request_id}/trust-card", response_model=EmployeeTrustCardView)
def employee_request_trust_card(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.employee_trust_card(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}", response_model=ReferralRequestDetail)
def get_request(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.get(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}/history", response_model=list[ReferralStatusHistoryEntry])
def request_history(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.history(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.get("/requests/{request_id}/trust-card", response_model=TrustCardResponse)
def request_trust_card(request_id: str, user: dict = Depends(get_current_user)):
    try: return service.trust_card_for_request(user["sub"], request_id)
    except Exception as exc: _raise_referral_error(exc)


@router.patch("/requests/{request_id}/decision", response_model=ReferralRequestDetail)
def update_decision(request_id: str, payload: EmployeeDecisionUpdate, user: dict = Depends(get_current_user)):
    try: return service.update_status(user["sub"], request_id, payload)
    except Exception as exc: _raise_referral_error(exc)


@router.post("/message", response_model=ReferralMessageResponse)
def create_referral_message(payload: ReferralMessageRequest, user: dict = Depends(get_current_user)):
    if service.repository.get_role(user["sub"]) != "employee":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee access is required for referral-message generation.")
    try:
        message = generate_referral_message(payload.candidateName, payload.role, payload.trustSummary)
    except AIServiceUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The AI message service is not configured.") from exc
    return {"message": message}
