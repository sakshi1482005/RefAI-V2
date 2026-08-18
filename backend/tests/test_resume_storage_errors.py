import asyncio
from io import BytesIO
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.datastructures import UploadFile

from app.api.routes import referral, resume
from app.services.referral_requests import ReferralRequestService, ReferralStorageUnavailable
from app.services.resume_storage import ResumeStorageUnavailable


class SigningFailureService:
    def employee_resume(self, _actor_id, _request_id):
        raise ReferralStorageUnavailable("provider secret-detail")


class SigningFailureRepository:
    def get_role(self, _actor_id): return "employee"
    def get_request(self, _request_id): return {"id": "request-1", "employee_id": "employee-1", "student_id": "student-1"}
    def find_resume(self, _student_id): return {"path": "student-1/resume.pdf", "file_name": "resume.pdf"}
    def sign_resume(self, _path, _expires_in): raise ResumeStorageUnavailable("provider secret-detail")


class ResumeStorageErrorRouteTests(unittest.TestCase):
    def test_upload_returns_safe_503_when_private_storage_is_unavailable(self):
        upload = UploadFile(filename="resume.pdf", file=BytesIO(b"pdf"))
        with patch.object(resume, "extract_text", return_value="Experience: Built a service."), \
             patch.object(resume, "chunk_text", return_value=["Experience: Built a service."]), \
             patch.object(resume, "store_resume", side_effect=ResumeStorageUnavailable("provider secret-detail")):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(resume.upload_resume(upload, {"sub": "student-1"}))
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Private resume storage is temporarily unavailable. Please try again shortly.")
        self.assertNotIn("secret-detail", str(raised.exception.detail))

    def test_signed_resume_provider_failure_returns_safe_503(self):
        original = referral.service
        referral.service = SigningFailureService()
        try:
            with self.assertRaises(HTTPException) as raised:
                referral.employee_request_resume("request-1", {"sub": "employee-1"})
        finally:
            referral.service = original
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "The private resume service is temporarily unavailable. Please try again shortly.")
        self.assertNotIn("secret-detail", str(raised.exception.detail))

    def test_employee_resume_normalizes_storage_signing_failure(self):
        service = ReferralRequestService(repository=SigningFailureRepository())
        with self.assertRaises(ReferralStorageUnavailable) as raised:
            service.employee_resume("employee-1", "request-1")
        self.assertEqual(str(raised.exception), "The private resume service is temporarily unavailable. Please try again shortly.")
        self.assertNotIn("secret-detail", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
