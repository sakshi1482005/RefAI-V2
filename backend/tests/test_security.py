import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from gotrue.errors import AuthApiError, AuthRetryableError

from app.core import security


def credentials(token: str = "test-token"):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class AuthenticationErrorHandlingTests(unittest.TestCase):
    def test_missing_token_is_401(self):
        with self.assertRaises(HTTPException) as raised:
            security.get_current_user(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_provider_reports_no_user_as_401(self):
        with patch.object(security.supabase.auth, "get_user", return_value=SimpleNamespace(user=None)):
            with self.assertRaises(HTTPException) as raised:
                security.get_current_user(credentials())
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Invalid or expired token")

    def test_explicit_invalid_jwt_is_401(self):
        invalid_token = AuthApiError("JWT is invalid", 401, "bad_jwt")
        with patch.object(security.supabase.auth, "get_user", side_effect=invalid_token):
            with self.assertRaises(HTTPException) as raised:
                security.get_current_user(credentials())
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Invalid or expired token")

    def test_provider_retryable_failure_is_503(self):
        unavailable = AuthRetryableError("provider unavailable", 503)
        with patch.object(security.supabase.auth, "get_user", side_effect=unavailable):
            with self.assertRaises(HTTPException) as raised:
                security.get_current_user(credentials())
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Authentication service is temporarily unavailable. Please retry.")

    def test_ambiguous_provider_failure_is_503_without_details(self):
        with patch.object(security.supabase.auth, "get_user", side_effect=RuntimeError("SUPABASE_SERVICE_KEY=private")):
            with self.assertRaises(HTTPException) as raised:
                security.get_current_user(credentials())
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Authentication service is temporarily unavailable. Please retry.")
        self.assertNotIn("private", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
