import unittest

from fastapi.testclient import TestClient

from app.main import app


class CorsTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_required_origins_pass_preflight_for_protected_routes(self):
        routes = (
            "/resume/analysis/latest",
            "/referral/employees",
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

    def test_protected_error_response_keeps_cors_header(self):
        response = self.client.get(
            "/auth/student-profile",
            headers={"Origin": "http://localhost:5173"},
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")


if __name__ == "__main__":
    unittest.main()
