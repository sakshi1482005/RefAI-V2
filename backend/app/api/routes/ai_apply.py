from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.schemas import AIApplyAllowanceResponse, AIApplyGoalRequest, AIApplyMatchRunResponse, AIApplySubmissionRequest, AIApplySubmissionResponse
from app.services.ai_apply import AIApplyError, AIApplyForbidden, AIApplyNotFound, AIApplyService, AIApplySubmissionError, AIApplyUnavailable


router = APIRouter(prefix="/ai-apply", tags=["ai-apply"])
service = AIApplyService()


def _raise_ai_apply_error(exc: Exception) -> None:
    if isinstance(exc, AIApplyForbidden):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, AIApplyNotFound):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, AIApplyUnavailable):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, AIApplySubmissionError):
        code_status = {
            "weekly_cap_reached": status.HTTP_429_TOO_MANY_REQUESTS,
            "rate_limited": status.HTTP_429_TOO_MANY_REQUESTS,
            "no_credit": status.HTTP_402_PAYMENT_REQUIRED,
            "factual_integrity": status.HTTP_422_UNPROCESSABLE_ENTITY,
        }.get(exc.code, status.HTTP_409_CONFLICT)
        raise HTTPException(status_code=code_status, detail=str(exc), headers={"X-RefAI-Error-Code": exc.code}) from exc
    if isinstance(exc, AIApplyError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise exc


@router.post("/goals", response_model=AIApplyMatchRunResponse, status_code=status.HTTP_201_CREATED)
def create_goal(payload: AIApplyGoalRequest, user: dict = Depends(get_current_user)):
    try:
        return service.create(user["sub"], payload)
    except Exception as exc:
        _raise_ai_apply_error(exc)


@router.get("/goals/latest", response_model=AIApplyMatchRunResponse)
def latest_goal(user: dict = Depends(get_current_user)):
    try:
        return service.latest(user["sub"])
    except Exception as exc:
        _raise_ai_apply_error(exc)


@router.get("/allowance", response_model=AIApplyAllowanceResponse)
def allowance(user: dict = Depends(get_current_user)):
    try:
        return service.allowance(user["sub"])
    except Exception as exc:
        _raise_ai_apply_error(exc)


@router.post("/requests", response_model=AIApplySubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_match(payload: AIApplySubmissionRequest, user: dict = Depends(get_current_user)):
    try:
        return service.submit(user["sub"], payload)
    except Exception as exc:
        _raise_ai_apply_error(exc)
