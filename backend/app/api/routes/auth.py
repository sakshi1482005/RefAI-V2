from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.models.schemas import StudentProfile, StudentProfileUpdate
from app.services.student_persistence import StudentPersistenceError, StudentPersistenceService, StudentProfileForbidden

router = APIRouter(prefix="/auth", tags=["auth"])
profile_service = StudentPersistenceService()


@router.get("/me")
def read_current_user(user: dict = Depends(get_current_user)):
    """Sanity-check endpoint: confirms the Supabase token is valid."""
    return {"user_id": user.get("sub"), "email": user.get("email")}


@router.get("/student-profile", response_model=StudentProfile)
def read_student_profile(user: dict = Depends(get_current_user)):
    try:
        return profile_service.get_profile(user["sub"])
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        raise HTTPException(status_code=503, detail="Student education could not be loaded.") from exc


@router.put("/student-profile", response_model=StudentProfile)
def save_student_profile(payload: StudentProfileUpdate, user: dict = Depends(get_current_user)):
    try:
        return profile_service.save_profile(user["sub"], payload)
    except StudentProfileForbidden as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except StudentPersistenceError as exc:
        raise HTTPException(status_code=503, detail="Student education could not be saved.") from exc
