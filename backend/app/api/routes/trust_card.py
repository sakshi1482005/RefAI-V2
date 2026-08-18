from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import logging
from time import perf_counter
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.schemas import PublicTrustPassport, TrustCardRequest, TrustCardResponse, TrustPassportCreate, TrustPassportStatus
from app.services.analysis_reliability import assess_analysis_reliability
from app.services.referral_requests import ReferralError, ReferralForbidden, ReferralRequestService
from app.services.student_persistence import (
    StudentAnalysisNotFound,
    StudentPersistenceError,
    StudentPersistenceService,
    StudentProfileForbidden,
)
from app.services.trust_card_cache import (
    build_trust_card_input_metadata,
    is_current_trust_card,
    persisted_trust_card_response,
)
from app.services.trust_card_engine import InsufficientJobRequirements, build_trust_card
from app.services.trust_passport import PassportError, PassportForbidden, PassportNotFound, TrustPassportService


router = APIRouter(prefix="/trust-card", tags=["trust-card"])
referral_service = ReferralRequestService()
persistence_service = StudentPersistenceService()
passport_service = TrustPassportService()
logger = logging.getLogger(__name__)


def _timing(request_id: str, stage: str, started_at: float, input_key: str | None = None) -> None:
    logger.debug(
        "trust_card_timing request_id=%s stage=%s duration_ms=%s input_key=%s",
        request_id,
        stage,
        round((perf_counter() - started_at) * 1000),
        input_key[:12] if input_key else "pending",
    )


def _timed_call(request_id: str, stage: str, callback, *args):
    started_at = perf_counter()
    try:
        return callback(*args)
    finally:
        _timing(request_id, stage, started_at)


def _load_analysis_and_card(student_id: str, analysis_id: str, request_id: str):
    with ThreadPoolExecutor(max_workers=2) as executor:
        analysis_future = executor.submit(
            _timed_call, request_id, "analysis_loading", persistence_service.get_analysis, student_id, analysis_id,
        )
        card_future = executor.submit(
            _timed_call, request_id, "persisted_card_lookup", persistence_service.latest_trust_card, student_id, analysis_id,
        )
        return analysis_future.result(), card_future.result()


def _persisted_response(card: dict) -> dict:
    response = persisted_trust_card_response(card)
    response.setdefault("education", {"college": None, "degree": None, "branch": None, "graduationYear": None})
    return response


def _passport_error(exc: Exception):
    if isinstance(exc, PassportForbidden): raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, PassportNotFound): raise HTTPException(status_code=404, detail="Trust Passport is unavailable") from exc
    if isinstance(exc, PassportError): raise HTTPException(status_code=422, detail=str(exc)) from exc
    logger.exception("Trust Passport request failed error_type=%s", type(exc).__name__)
    raise HTTPException(status_code=503, detail="Trust Passport is temporarily unavailable. Please retry.") from exc


@router.get("/passport", response_model=TrustPassportStatus)
def passport_status(trustCardId: UUID, user: dict = Depends(get_current_user)):
    try: return passport_service.status(user["sub"], str(trustCardId))
    except Exception as exc: _passport_error(exc)


@router.post("/passport", response_model=TrustPassportStatus, status_code=201)
def create_passport(payload: TrustPassportCreate, user: dict = Depends(get_current_user)):
    try: return passport_service.create(user["sub"], str(payload.trustCardId), payload.visibility, payload.expiresInDays)
    except Exception as exc: _passport_error(exc)


@router.delete("/passport/{trust_card_id}", status_code=204)
def revoke_passport(trust_card_id: UUID, user: dict = Depends(get_current_user)):
    try: passport_service.revoke(user["sub"], str(trust_card_id))
    except Exception as exc: _passport_error(exc)


@router.get("/passport/public/{token}", response_model=PublicTrustPassport)
def public_passport(token: str):
    if len(token) < 32 or len(token) > 200:
        raise HTTPException(status_code=404, detail="Trust Passport is unavailable")
    try: return passport_service.public(token)
    except Exception as exc: _passport_error(exc)


@router.get("/current", response_model=TrustCardResponse)
def current_trust_card(analysisId: UUID, user: dict = Depends(get_current_user)):
    request_id = str(uuid4())
    total_started = perf_counter()
    input_key = None
    _timing(request_id, "authorization", total_started)
    try:
        try:
            analysis, card = _load_analysis_and_card(user["sub"], str(analysisId), request_id)
        except StudentAnalysisNotFound as exc:
            raise HTTPException(status_code=404, detail="Persisted resume analysis was not found.") from exc
        except StudentPersistenceError as exc:
            logger.exception("Trust Card persisted lookup failed request_id=%s", request_id)
            raise HTTPException(status_code=503, detail="The saved Trust Card could not be loaded. Please retry.") from exc
        metadata = build_trust_card_input_metadata(analysis)
        input_key = metadata["inputKey"]
        if not is_current_trust_card(card, analysis):
            raise HTTPException(status_code=404, detail="No valid persisted Trust Card is available for this analysis.")
        return _persisted_response(card)
    finally:
        _timing(request_id, "total", total_started, input_key)


@router.post("/generate", response_model=TrustCardResponse)
def generate_trust_card(payload: TrustCardRequest, user: dict = Depends(get_current_user)):
    request_id = str(uuid4())
    total_started = perf_counter()
    input_key = None
    _timing(request_id, "authorization", total_started)
    try:
        analysis = None
        existing_card = None
        if payload.analysisId:
            try:
                analysis, existing_card = _load_analysis_and_card(user["sub"], str(payload.analysisId), request_id)
            except StudentAnalysisNotFound as exc:
                raise HTTPException(status_code=404, detail="Persisted resume analysis was not found.") from exc
            except StudentPersistenceError as exc:
                logger.exception("Trust Card analysis lookup failed request_id=%s", request_id)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="The saved resume analysis could not be loaded. Please retry.",
                ) from exc
            metadata = build_trust_card_input_metadata(analysis)
            input_key = metadata["inputKey"]
            if not payload.forceRegenerate and is_current_trust_card(existing_card, analysis):
                logger.debug("trust_card_cache request_id=%s result=hit input_key=%s", request_id, input_key[:12])
                return _persisted_response(existing_card)
            logger.debug("trust_card_cache request_id=%s result=miss input_key=%s", request_id, input_key[:12])
            candidate_name = payload.candidateName or "Candidate"
            role = analysis["target_role"]
            resume_text = analysis["resume_text"]
            job_description = analysis["job_description"]
            analysis_id = str(payload.analysisId)
            relevance_source = "role_context" if analysis.get("used_general_role_expectations") else "job_description"
            analysis_payload = analysis.get("analysis_payload") or {}
            reliability = analysis_payload.get("analysisReliability") or assess_analysis_reliability(
                resume_text,
                analysis_payload,
                None if analysis.get("used_general_role_expectations") else job_description,
            )
        elif all((payload.candidateName, payload.role, payload.resumeText, payload.jobDescription)):
            candidate_name, role = payload.candidateName, payload.role
            resume_text, job_description = payload.resumeText, payload.jobDescription
            analysis_id = None
            reliability = None
            relevance_source = "job_description"
            metadata = {}
        else:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A persisted analysis ID is required.")

        def stage_callback(stage: str, duration_seconds: float) -> None:
            logger.debug(
                "trust_card_timing request_id=%s stage=%s duration_ms=%s input_key=%s",
                request_id, stage, round(duration_seconds * 1000), input_key[:12] if input_key else "direct",
            )

        # Chroma is only needed for an actual rebuild. Saved-card reads return
        # above without importing the vector/embedding runtime at all.
        from app.services.vector_store import ChromaProjectRelevanceProvider
        similarity_provider = ChromaProjectRelevanceProvider(
            f"{user['sub']}-{analysis_id or 'direct'}",
            timing_callback=stage_callback,
        )
        with ThreadPoolExecutor(max_workers=2) as executor:
            build_future = executor.submit(
                build_trust_card,
                candidate_name=candidate_name,
                role=role,
                resume_text=resume_text,
                job_description=job_description,
                similarity_provider=similarity_provider,
                relevance_source=relevance_source,
                timing_callback=stage_callback,
            )
            education_future = executor.submit(
                _timed_call, request_id, "profile_loading", persistence_service.get_education, user["sub"],
            )
            try:
                result = build_future.result()
            except InsufficientJobRequirements as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="The saved job description has no specific requirements. Rerun resume analysis with a fuller job description.",
                ) from exc
            try:
                education = education_future.result()
            except StudentProfileForbidden as exc:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
            except Exception:
                logger.exception("Optional Trust Card education lookup failed request_id=%s", request_id)
                education = {"college": None, "degree": None, "branch": None, "graduationYear": None}

        if reliability is None:
            reliability = assess_analysis_reliability(resume_text, result, job_description)
        result = {
            **result,
            "analysisReliability": reliability,
            "education": education,
            **metadata,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        persistence_started = perf_counter()
        try:
            stored = referral_service.persist_trust_card(user["sub"], result, analysis_id)
        except ReferralForbidden as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access is required.") from exc
        except ReferralError as exc:
            logger.exception("Trust Card persistence failed request_id=%s", request_id)
            raise HTTPException(status_code=503, detail="The Trust Card could not be saved. Please retry.") from exc
        except Exception as exc:
            logger.exception("Unexpected Trust Card persistence failure request_id=%s", request_id)
            raise HTTPException(status_code=503, detail="The Trust Card could not be saved. Please retry.") from exc
        finally:
            _timing(request_id, "persistence", persistence_started, input_key)
        return {"id": stored["id"], **result}
    finally:
        _timing(request_id, "total", total_started, input_key)
