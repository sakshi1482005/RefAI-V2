from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
def read_current_user(user: dict = Depends(get_current_user)):
    """Sanity-check endpoint: confirms the Supabase token is valid."""
    return {"user_id": user.get("sub"), "email": user.get("email")}
