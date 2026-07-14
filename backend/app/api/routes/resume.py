from fastapi import APIRouter, UploadFile, File, Depends

from app.core.security import get_current_user
from app.services.resume_parser import extract_text, chunk_text
from app.services.vector_store import upsert_resume_chunks

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_bytes = await file.read()
    text = extract_text(file.filename, file_bytes)
    chunks = chunk_text(text)
    resume_id = user["sub"]
    upsert_resume_chunks(resume_id, chunks)
    return {"resumeId": resume_id, "chunkCount": len(chunks), "preview": text[:500]}
