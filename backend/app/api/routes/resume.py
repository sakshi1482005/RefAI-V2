import logging
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status

from app.core.security import get_current_user
from app.services.resume_parser import extract_text, chunk_text
from app.services.vector_store import upsert_resume_chunks
from app.services.resume_storage import store_resume
from app.models.schemas import MatchAnalysisResponse, MatchScoreRequest, PersistedAnalysisSessionResponse, ResumeUploadResponse
from app.services.resume_analysis import ResumeAnalysisInputError, ResumeAnalysisUnavailable, run_resume_analysis
from app.services.student_persistence import StudentPersistenceError, StudentPersistenceService

router = APIRouter(prefix="/resume", tags=["resume"])
MAX_RESUME_BYTES = 10 * 1024 * 1024
MAX_ANALYSIS_TEXT_CHARS = 200_000
logger = logging.getLogger(__name__)
persistence_service = StudentPersistenceService()


@router.post("/analyze", response_model=MatchAnalysisResponse)
def analyze_resume(payload: MatchScoreRequest, user: dict = Depends(get_current_user)):
    logger.info(
        "Resume analysis route reached user=%s resume_chars=%s job_description_chars=%s",
        user["sub"], len(payload.resumeText), len(payload.jobDescription),
    )
    try:
        result = run_resume_analysis(payload.resumeText, payload.jobDescription, payload.targetRole)
        return persistence_service.save_analysis(user["sub"], payload, result)
    except ResumeAnalysisInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Add a fuller job description with specific skills, tools, responsibilities, or experience requirements.",
        ) from exc
    except ResumeAnalysisUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The analysis service returned an invalid result. Please try again.",
        ) from exc
    except StudentPersistenceError as exc:
        logger.exception("Resume analysis persistence failed user=%s", user["sub"])
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The analysis completed but could not be saved. Please retry.") from exc


@router.get("/analysis/latest", response_model=PersistedAnalysisSessionResponse)
def latest_analysis(user: dict = Depends(get_current_user)):
    try:
        result = persistence_service.latest_session(user["sub"])
    except StudentPersistenceError as exc:
        logger.exception("Latest resume analysis read failed user=%s", user["sub"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The saved resume analysis could not be loaded. Please retry.",
        ) from exc
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No persisted resume analysis is available.")
    return result


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    started_at = perf_counter()
    file_bytes = await file.read()
    filename = file.filename or ""
    logger.info("Resume upload route reached user=%s filename=%s bytes=%s", user["sub"], filename, len(file_bytes))
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PDF resume.")
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded PDF is empty.")
    if len(file_bytes) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The PDF must be smaller than 10 MB.")
    try:
        text = extract_text(filename, file_bytes).strip()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The PDF could not be read.") from exc
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No readable text was found in the PDF.")
    chunks = chunk_text(text)
    logger.info("Resume extraction complete user=%s filename=%s characters=%s chunks=%s", user["sub"], filename, len(text), len(chunks))
    resume_id = uuid4().hex
    storage_path, storage_status = store_resume(user["sub"], resume_id, file_bytes)
    if storage_status != "stored" or not storage_path:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your resume could not be saved to private storage. Check the Storage configuration and retry.",
        )
    indexed = True
    try:
        upsert_resume_chunks(f"{user['sub']}-{resume_id}", chunks)
    except Exception:
        indexed = False
        logger.exception("Resume vector indexing failed for user=%s resume=%s", user["sub"], resume_id)

    response = {
        "resumeId": resume_id,
        "fileName": filename,
        "chunkCount": len(chunks),
        "preview": text[:MAX_ANALYSIS_TEXT_CHARS],
        "extractionStatus": "complete",
        "analysisStatus": "pending",
        "storagePath": storage_path,
        "storageStatus": storage_status,
        "indexed": indexed,
        "processingTimeMs": round((perf_counter() - started_at) * 1000),
    }
    logger.info(
        "Resume response serialized user=%s resume=%s extraction=%s storage=%s indexed=%s",
        user["sub"], resume_id, response["extractionStatus"], storage_status, indexed,
    )
    return response
