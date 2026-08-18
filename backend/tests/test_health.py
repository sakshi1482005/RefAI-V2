import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app import main


class HealthRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_reports_ready_supabase_without_data(self):
        query = Mock()
        query.select.return_value.limit.return_value.execute.return_value = Mock()
        with (
            patch.object(main.settings, "supabase_url", "https://project.supabase.co"),
            patch.object(main.settings, "supabase_service_key", "configured"),
            patch.object(main, "supabase") as supabase,
        ):
            supabase.table.return_value = query
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "dependencies": {"supabase": {"status": "ok"}},
        })
        query.select.assert_called_once_with("id")
        query.select.return_value.limit.assert_called_once_with(1)

    def test_health_reports_missing_required_configuration_safely(self):
        with patch.object(main.settings, "supabase_service_key", ""):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {
            "status": "degraded",
            "dependencies": {"supabase": {"status": "not_configured"}},
        })

    def test_health_reports_unavailable_supabase_without_provider_details(self):
        query = Mock()
        query.select.return_value.limit.return_value.execute.side_effect = RuntimeError("provider detail")
        with (
            patch.object(main.settings, "supabase_url", "https://project.supabase.co"),
            patch.object(main.settings, "supabase_service_key", "configured"),
            patch.object(main, "supabase") as supabase,
        ):
            supabase.table.return_value = query
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {
            "status": "degraded",
            "dependencies": {"supabase": {"status": "unavailable"}},
        })
        self.assertNotIn("provider detail", response.text)


if __name__ == "__main__":
    unittest.main()
