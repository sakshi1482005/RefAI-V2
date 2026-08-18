import time
import logging

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import (
    AuthApiError,
    AuthInvalidCredentialsError,
    AuthSessionMissingError,
)

from app.db.supabase_client import supabase


bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


# Only explicit GoTrue token-validation codes represent an invalid end-user
# credential. A generic 401 from a provider can also mean a misconfigured
# backend API key, so it must remain a service failure rather than logging the
# user out unnecessarily.
INVALID_TOKEN_CODES = {
    "bad_jwt",
    "invalid_credentials",
    "no_authorization",
    "session_not_found",
    "unexpected_audience",
    "user_not_found",
}


# These errors mean Supabase/network temporarily failed.
# They do NOT mean that the user's token is invalid.
RETRYABLE_AUTH_ERRORS = (
    httpx.RemoteProtocolError,
    httpx.ConnectError,
    httpx.ReadError,
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.WriteError,
)


def _get_supabase_user_with_retry(token: str):
    """
    Validate a token with Supabase.

    Temporary network/HTTP transport failures are retried before
    reporting the authentication service as unavailable.
    """
    attempts = 3
    delay = 0.25
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            response = supabase.auth.get_user(token)
            return response.user

        except RETRYABLE_AUTH_ERRORS as exc:
            last_error = exc

            if attempt < attempts - 1:
                time.sleep(delay)
                delay *= 2

    if last_error is not None:
        raise last_error

    return None


def _is_invalid_token_error(exc: Exception) -> bool:
    """Identify explicit provider responses caused by the user's token only."""
    if isinstance(exc, (AuthInvalidCredentialsError, AuthSessionMissingError)):
        return True
    return isinstance(exc, AuthApiError) and exc.code in INVALID_TOKEN_CODES


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
) -> dict:
    """
    Validate the current Supabase access token and return
    the authenticated user's identity.

    401 = missing/invalid/expired token
    503 = Supabase authentication service temporarily unavailable
    """

    # No Authorization: Bearer header
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )

    token = creds.credentials.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )

    try:
        user = _get_supabase_user_with_retry(token)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        return {
            "sub": str(user.id),
            "email": user.email,
            "user_metadata": user.user_metadata or {},
        }

    # Preserve HTTP errors that we intentionally raised above.
    except HTTPException:
        raise

    # Supabase/network temporarily disconnected.
    # This should NOT be reported as an invalid login.
    except RETRYABLE_AUTH_ERRORS as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Authentication service is temporarily unavailable. "
                "Please retry."
            ),
        ) from exc

    # Explicit invalid-token responses are safe to report as authentication
    # failures. Do not classify all provider 401s this way: an invalid backend
    # API key or provider-side outage must not sign a valid user out.
    except Exception as exc:
        if _is_invalid_token_error(exc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from exc

        logger.error(
            "Supabase authentication provider failed error_type=%s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable. Please retry.",
        ) from exc
