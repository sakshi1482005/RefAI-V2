import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import parse_cors_origins
from app.core.security import get_current_user
from app.api.routes import resume


class EmptyAnalysisService:
    def latest_session(self, student_id):
        return None


def unexpected_failure():
    raise RuntimeError("simulated protected-route failure")


class CorsTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_required_origins_pass_preflight_for_protected_routes(self):
        routes = (
            "/resume/analysis/latest",
            "/referral/employees",
            "/referral/employee/requests/11111111-1111-4111-8111-111111111111",
            "/auth/student-profile",
        )
        origins = (
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://refaiog.vercel.app",
        )
        for route in routes:
            for origin in origins:
                with self.subTest(route=route, origin=origin):
                    response = self.client.options(
                        route,
                        headers={
                            "Origin": origin,
                            "Access-Control-Request-Method": "GET",
                            "Access-Control-Request-Headers": "authorization",
                        },
                    )
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers.get("access-control-allow-origin"), origin)
                    self.assertIn("authorization", response.headers.get("access-control-allow-headers", "").lower())

    def test_vercel_preview_origin_passes_preflight(self):
        origin = "https://refai-feature-123.vercel.app"
        response = self.client.options(
            "/referral/employee/requests/11111111-1111-4111-8111-111111111111",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), origin)

    def test_cors_origins_environment_formats_are_normalized(self):
        expected = "https://custom-refai.example"
        formats = (
            f'["http://localhost:5173", "{expected}/"]',
            f'"http://localhost:5173"; {expected}/',
            f"http://localhost:5173,{expected}/",
            f"http://localhost:5173\n{expected}/",
        )
        for value in formats:
            with self.subTest(value=value):
                parsed = parse_cors_origins(value)
                self.assertIn("http://localhost:5173", parsed)
                self.assertIn(expected, parsed)

    def test_protected_error_response_keeps_cors_header(self):
        response = self.client.get(
            "/auth/student-profile",
            headers={"Origin": "http://localhost:5173"},
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_missing_latest_analysis_is_a_cors_enabled_empty_state_response(self):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "student-user"}
        original = resume.persistence_service
        resume.persistence_service = EmptyAnalysisService()
        try:
            response = self.client.get(
                "/resume/analysis/latest",
                headers={"Origin": "http://localhost:5173", "Authorization": "Bearer test"},
            )
        finally:
            resume.persistence_service = original
            app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "No persisted resume analysis is available.")
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_unhandled_protected_failure_is_not_masked_as_cors(self):
        app.dependency_overrides[get_current_user] = unexpected_failure
        try:
            response = self.client.get(
                "/referral/employee/requests/11111111-1111-4111-8111-111111111111",
                headers={"Origin": "http://localhost:5173", "Authorization": "Bearer test"},
            )
        finally:
            app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertEqual(response.json()["detail"], "The RefAI backend could not complete this request.")


if __name__ == "__main__":
    unittest.main()
