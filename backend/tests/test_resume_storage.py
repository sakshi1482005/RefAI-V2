from types import SimpleNamespace
import unittest
from unittest.mock import patch

from app.services import resume_storage


class FluentQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs): return self
    def eq(self, *_args, **_kwargs): return self
    @property
    def not_(self): return self
    def is_(self, *_args, **_kwargs): return self
    def order(self, *_args, **_kwargs): return self
    def limit(self, *_args, **_kwargs): return self
    def execute(self): return SimpleNamespace(data=self.rows)


class PersistedResumeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.requested_table = None

    def table(self, name):
        self.requested_table = name
        return FluentQuery(self.rows)

    @property
    def storage(self):
        raise AssertionError("Storage listing must not run when a persisted path exists")


class ResumeStorageTests(unittest.TestCase):
    def test_persisted_analysis_path_is_preferred_over_storage_listing(self):
        fake = PersistedResumeSupabase([{
            "storage_path": "student-1/resume-1.pdf",
            "file_name": "candidate.pdf",
            "updated_at": "2026-07-30T00:00:00Z",
        }])
        with patch.object(resume_storage, "supabase", fake), \
             patch.object(resume_storage.settings, "resume_storage_bucket", "resumes"), \
             patch.object(resume_storage.settings, "supabase_service_key", "service-key"):
            result = resume_storage.find_latest_student_resume("student-1")
        self.assertEqual(fake.requested_table, "resume_analyses")
        self.assertEqual(result, {
            "path": "student-1/resume-1.pdf",
            "file_name": "candidate.pdf",
        })


if __name__ == "__main__":
    unittest.main()
