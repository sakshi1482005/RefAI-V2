from datetime import datetime, timezone
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
import unittest

from app.core.config import settings
from app.models.schemas import AIApplyGoalRequest, AIApplyMatchRunResponse, AIApplySubmissionRequest, AIApplySubmissionResponse
from app.services.ai_apply import AIApplyService, AIApplySubmissionError, AIApplyUnavailable, MATCH_VERSION
from app.services.trust_card_cache import build_trust_card_input_metadata


class FakeAIApplyRepository:
    def __init__(self):
        self.student = str(uuid4())
        self.employee = str(uuid4())
        self.roles = {self.student: "student", self.employee: "employee"}
        now = datetime.now(timezone.utc).isoformat()
        self.analysis = {
            "id": str(uuid4()), "student_id": self.student, "resume_text": "Built a Python API used by 200 users.",
            "target_role": "Software Engineer", "target_company": "Acme",
            "job_description": "Build reliable Python APIs for cloud services.",
            "used_general_role_expectations": False, "created_at": now, "updated_at": now,
        }
        metadata = build_trust_card_input_metadata(self.analysis)
        self.card = {
            "id": str(uuid4()), "student_id": self.student, "analysis_id": self.analysis["id"],
            "payload": {
                **metadata, "role": "Software Engineer", "trustScore": 84,
                "referralReadiness": "Ready to request referral", "matchedSkills": ["Python", "API"],
                "evidence": ["Built a Python API used by 200 users."],
            },
        }
        self.requests = []
        self.goals, self.runs, self.matches = [], [], []
        self.create_run_count = 0
        self.credit_balance = 5
        self.weekly_used = 0
        self.submissions = {}
        self.submission_lock = Lock()

    def get_role(self, user_id): return self.roles.get(user_id)
    def latest_analysis(self, student_id): return self.analysis if student_id == self.student else None
    def latest_trust_card(self, student_id, analysis_id):
        return self.card if student_id == self.student and analysis_id == self.analysis["id"] else None
    def list_student_requests(self, student_id): return self.requests if student_id == self.student else []
    def find_goal(self, student_id, idempotency_key):
        return next((row for row in self.goals if row["student_id"] == student_id and row["idempotency_key"] == idempotency_key), None)
    def create_goal(self, values):
        row = {"id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **values}
        self.goals.append(row); return row
    def latest_goal(self, student_id):
        rows = [row for row in self.goals if row["student_id"] == student_id]
        return rows[-1] if rows else None
    def find_run(self, goal_id, match_version, input_key):
        return next((row for row in self.runs if row["goal_id"] == goal_id and row["match_version"] == match_version and row["input_key"] == input_key), None)
    def latest_run(self, goal_id):
        rows = [row for row in self.runs if row["goal_id"] == goal_id]
        return rows[-1] if rows else None
    def create_run(self, values, matches):
        self.create_run_count += 1
        run = {"id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **values}
        self.runs.append(run)
        stored = [{"id": str(uuid4()), "match_run_id": run["id"], **row} for row in matches]
        self.matches.extend(stored)
        return run, stored
    def list_matches(self, run_id): return sorted((row for row in self.matches if row["match_run_id"] == run_id), key=lambda row: row["rank"])
    def submission_context(self, student_id, match_id):
        match = next((row for row in self.matches if row["id"] == match_id and row["student_id"] == student_id), None)
        if not match: return None
        run = next(row for row in self.runs if row["id"] == match["match_run_id"])
        goal = next(row for row in self.goals if row["id"] == run["goal_id"])
        return {"match": match, "run": run, "goal": goal, "analysis": self.analysis}
    def allowance(self, student_id):
        return {"minimumCompatibilityThreshold": settings.ai_apply_default_min_compatibility,
                "weeklyCap": settings.ai_apply_weekly_request_cap, "weeklyUsed": self.weekly_used,
                "weeklyRemaining": max(0, settings.ai_apply_weekly_request_cap - self.weekly_used),
                "creditBalance": self.credit_balance,
                "available": self.credit_balance > 0 and self.weekly_used < settings.ai_apply_weekly_request_cap}
    def submit_match(self, values):
        with self.submission_lock:
            key = (values["p_student_id"], values["p_idempotency_key"])
            if key in self.submissions:
                return {**self.submissions[key], "idempotentReplay": True}
            match = next(row for row in self.matches if row["id"] == values["p_match_id"])
            if match.get("referral_request_id"):
                return {"ok": False, "errorCode": "existing_request", "message": "A referral request already exists for this employee and opportunity."}
            if values["p_compatibility_score"] < values["p_minimum_threshold"]:
                return {"ok": False, "errorCode": "compatibility_below_threshold", "message": "This match is below the current compatibility threshold."}
            if self.weekly_used >= values["p_weekly_cap"]:
                return {"ok": False, "errorCode": "weekly_cap_reached", "message": "Your weekly AI Apply allowance has been used."}
            if self.credit_balance < 1:
                return {"ok": False, "errorCode": "no_credit", "message": "No AI Apply credit is available."}
            request_id = str(uuid4())
            self.weekly_used += 1; self.credit_balance -= 1; match["referral_request_id"] = request_id
            result = {"ok": True, "requestId": request_id, "matchId": values["p_match_id"], "status": "submitted",
                      "chargedCredits": 1, "creditBalance": self.credit_balance,
                      "weeklyRemaining": max(0, values["p_weekly_cap"] - self.weekly_used),
                      "compatibilityScore": values["p_compatibility_score"],
                      "compatibilityThreshold": values["p_minimum_threshold"], "idempotentReplay": False}
            self.submissions[key] = dict(result)
            return result


class FakeDirectory:
    def __init__(self, repository):
        self.repository = repository
        self.employees = [{
            "id": repository.employee, "name": "Riya Employee", "company": "Acme",
            "designation": "Senior Software Engineer", "department": "Engineering",
            "supportedCompanies": ["Acme"], "supportedRoles": ["Software Engineer"],
            "supportedDepartments": ["Engineering"], "acceptsFreshers": True,
            "preferredCandidateLevels": ["student", "fresher"], "acceptingRequests": True,
            "aiApplyOptIn": True,
        }]
    def employee_directory(self, actor_id):
        if actor_id != self.repository.student: raise AssertionError("directory was not student scoped")
        return self.employees
    def quality(self, actor_id, payload):
        return {"canSubmit": True, "blockingErrors": []}
    def compatibility(self, actor_id, payload):
        return {"score": 82, "label": "Strong fit", "scoreVersion": "referral-compatibility-v1",
                "positiveFactors": [], "missingOrConflictingFactors": [], "limitations": [],
                "suggestedImprovements": [], "components": [
                    {"key": "role_alignment", "label": "Role alignment", "score": 30, "maximumScore": 35},
                    {"key": "department_relevance", "label": "Department relevance", "score": 20, "maximumScore": 25},
                    {"key": "employee_preferences", "label": "Employee referral preferences", "score": 17, "maximumScore": 20},
                    {"key": "candidate_readiness", "label": "Candidate readiness", "score": 12, "maximumScore": 15},
                    {"key": "request_completeness", "label": "Request completeness", "score": 3, "maximumScore": 5},
                ], "maximumScore": 100}


class SemanticMatcher:
    def __init__(self, score=88.0, fail=False): self.score, self.fail = score, fail
    def similarity(self, context_id, employee_context, goal_context):
        if self.fail: raise RuntimeError("Chroma unavailable")
        return self.score


class AIApplyTests(unittest.TestCase):
    def setUp(self):
        self.repository = FakeAIApplyRepository()
        self.directory = FakeDirectory(self.repository)

    def payload(self, **overrides):
        values = {
            "targetRole": "Software Engineer", "targetCompany": "Acme",
            "preferredDepartment": "Engineering", "minimumCompatibility": 55,
            "numberOfMatches": 5, "idempotencyKey": "goal-key-0001",
        }
        values.update(overrides)
        return AIApplyGoalRequest(**values)

    def service(self, matcher=None):
        return AIApplyService(self.repository, self.directory, matcher or SemanticMatcher())

    def test_requires_current_trust_card(self):
        self.repository.card = None
        with self.assertRaises(AIApplyUnavailable): self.service().create(self.repository.student, self.payload())

    def test_no_eligible_employees_returns_a_saved_empty_review(self):
        self.directory.employees[0]["aiApplyOptIn"] = False
        result = self.service().create(self.repository.student, self.payload())
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["vectorStatus"], "not_used")
        self.assertEqual(result["excludedEmployeeCount"], 1)

    def test_employee_below_threshold_is_excluded(self):
        result = self.service().create(self.repository.student, self.payload(minimumCompatibility=100))
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["eligibleEmployeeCount"], 0)

    def test_duplicate_existing_request_is_excluded(self):
        self.repository.requests.append({
            "employee_id": self.repository.employee, "target_role": "Software Engineer",
            "target_company": "Acme", "status": "submitted",
        })
        result = self.service().create(self.repository.student, self.payload())
        self.assertEqual(result["matches"], [])

    def test_explicit_preference_conflict_is_excluded(self):
        self.directory.employees[0]["supportedRoles"] = ["Accountant"]
        result = self.service().create(self.repository.student, self.payload())
        self.assertEqual(result["matches"], [])

    def test_strong_match_reuses_compatibility_and_vector_signal(self):
        result = self.service(SemanticMatcher(score=92)).create(self.repository.student, self.payload())
        AIApplyMatchRunResponse.model_validate(result)
        match = result["matches"][0]
        self.assertEqual(match["compatibility"]["scoreVersion"], "referral-compatibility-v1")
        self.assertEqual(match["semanticSimilarity"], 92)
        self.assertAlmostEqual(match["rankingScore"], match["compatibility"]["score"] * .95 + 92 * .05)
        self.assertEqual(result["matchVersion"], MATCH_VERSION)

    def test_chromadb_failure_uses_deterministic_fallback(self):
        result = self.service(SemanticMatcher(fail=True)).create(self.repository.student, self.payload())
        match = result["matches"][0]
        self.assertEqual(result["vectorStatus"], "unavailable")
        self.assertIsNone(match["semanticSimilarity"])
        self.assertEqual(match["rankingScore"], match["compatibility"]["score"])
        self.assertEqual(match["relevanceSource"], "deterministic_fallback")

    def test_same_idempotent_submission_returns_the_same_run(self):
        service = self.service()
        first = service.create(self.repository.student, self.payload())
        second = service.create(self.repository.student, self.payload())
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self.repository.create_run_count, 1)
        self.assertEqual(len(self.repository.goals), 1)

    def _prepared_submission(self, key="submit-key-0001"):
        run = self.service().create(self.repository.student, self.payload())
        return AIApplySubmissionRequest(matchId=run["matches"][0]["id"], studentMessage="Hi Riya, I am applying for the Software Engineer role at Acme. My resume includes a Python API project. Would you consider reviewing my Candidate Trust Card for a referral?", idempotencyKey=key)

    def test_allowance_reports_server_threshold_cap_and_credit(self):
        allowance = self.service().allowance(self.repository.student)
        self.assertEqual(allowance["minimumCompatibilityThreshold"], settings.ai_apply_default_min_compatibility)
        self.assertEqual(allowance["weeklyRemaining"], settings.ai_apply_weekly_request_cap)
        self.assertEqual(allowance["creditBalance"], 5)

    def test_submission_is_idempotent_and_charges_one_credit(self):
        payload = self._prepared_submission()
        first = self.service().submit(self.repository.student, payload)
        second = self.service().submit(self.repository.student, payload)
        AIApplySubmissionResponse.model_validate(first)
        self.assertEqual(first["requestId"], second["requestId"])
        self.assertEqual(self.repository.credit_balance, 4)
        self.assertEqual(self.repository.weekly_used, 1)
        self.assertTrue(second["idempotentReplay"])

    def test_concurrent_retry_cannot_double_charge_or_duplicate(self):
        payload = self._prepared_submission("concurrent-key-0001")
        service = self.service()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: service.submit(self.repository.student, payload), range(2)))
        self.assertEqual(results[0]["requestId"], results[1]["requestId"])
        self.assertEqual(self.repository.credit_balance, 4)
        self.assertEqual(self.repository.weekly_used, 1)

    def test_concurrent_different_keys_cannot_duplicate_match(self):
        first_payload = self._prepared_submission("concurrent-key-0002")
        second_payload = first_payload.model_copy(update={"idempotencyKey": "concurrent-key-0003"})
        service = self.service()
        outcomes = []
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(service.submit, self.repository.student, item) for item in (first_payload, second_payload)]
            for future in futures:
                try: outcomes.append(future.result())
                except AIApplySubmissionError as exc: outcomes.append(exc.code)
        self.assertEqual(sum(isinstance(item, dict) for item in outcomes), 1)
        self.assertIn("existing_request", outcomes)
        self.assertEqual(self.repository.credit_balance, 4)

    def test_concurrent_distinct_matches_cannot_exceed_weekly_cap(self):
        first_payload = self._prepared_submission("weekly-race-key-0001")
        first_match = next(row for row in self.repository.matches if row["id"] == str(first_payload.matchId))
        second_match = {**first_match, "id": str(uuid4()), "employee_id": str(uuid4()), "referral_request_id": None}
        self.repository.matches.append(second_match)
        second_payload = first_payload.model_copy(update={
            "matchId": second_match["id"], "idempotencyKey": "weekly-race-key-0002",
        })
        original_cap = settings.ai_apply_weekly_request_cap
        settings.ai_apply_weekly_request_cap = 1
        outcomes = []
        try:
            service = self.service()
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(service.submit, self.repository.student, item) for item in (first_payload, second_payload)]
                for future in futures:
                    try: outcomes.append(future.result())
                    except AIApplySubmissionError as exc: outcomes.append(exc.code)
        finally:
            settings.ai_apply_weekly_request_cap = original_cap
        self.assertEqual(sum(isinstance(item, dict) for item in outcomes), 1)
        self.assertIn("weekly_cap_reached", outcomes)
        self.assertEqual(self.repository.weekly_used, 1)
        self.assertEqual(self.repository.credit_balance, 4)

    def test_weekly_cap_and_no_credit_are_server_enforced(self):
        payload = self._prepared_submission("limit-key-0001")
        self.repository.weekly_used = settings.ai_apply_weekly_request_cap
        with self.assertRaisesRegex(AIApplySubmissionError, "weekly"):
            self.service().submit(self.repository.student, payload)
        self.repository.weekly_used = 0; self.repository.credit_balance = 0
        with self.assertRaisesRegex(AIApplySubmissionError, "credit"):
            self.service().submit(self.repository.student, payload.model_copy(update={"idempotencyKey": "limit-key-0002"}))

    def test_fresh_compatibility_below_server_threshold_is_rejected(self):
        payload = self._prepared_submission("threshold-key-0001")
        original = self.directory.compatibility
        self.directory.compatibility = lambda *_: {**original(None, None), "score": settings.ai_apply_default_min_compatibility - 1}
        with self.assertRaisesRegex(AIApplySubmissionError, "threshold"):
            self.service().submit(self.repository.student, payload)


if __name__ == "__main__":
    unittest.main()
