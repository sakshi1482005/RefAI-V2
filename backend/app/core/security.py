from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.supabase_client import supabase

bearer_scheme = HTTPBearer()


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """Validate the current token with Supabase and return the authenticated identity."""
    token = creds.credentials
    try:
        response = supabase.auth.get_user(token)
        user = response.user
        if not user:
            raise ValueError("Supabase did not return a user")
        return {
            "sub": str(user.id),
            "email": user.email,
            "user_metadata": user.user_metadata or {},
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
