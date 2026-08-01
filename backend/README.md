# RefAI — Backend

FastAPI + Groq (LLM) + ChromaDB (vector search) + Supabase (auth/db/storage).

## Setup
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Groq + Supabase credentials
python -m uvicorn app.main:app --reload
```

Docs available at `http://localhost:8000/docs` (use this instead of Postman
collections for quick manual testing, or import the OpenAPI schema into Postman).

The frontend defaults to `http://localhost:8000`; set `VITE_API_BASE_URL` when
the API is hosted elsewhere. Private PDF persistence is required for resume
uploads and Employee review. Set `RESUME_STORAGE_BUCKET=resumes` and configure
the service-role key only on the backend.

## Fresh Supabase setup

Apply every SQL file in `../supabase/migrations` in filename order. The sequence
is safe for a fresh project and additive for an existing RefAI project:

1. `202607190001_referral_foundation.sql`
2. `202607200001_student_workflow_persistence.sql`
3. `202607210001_oauth_profile_role_fix.sql`
4. `202607240001_profile_foundation.sql`
5. `202607240002_private_resume_storage.sql`
6. `202607250001_student_profile_branch.sql`
7. `202607250002_student_profile_fields.sql`
8. `202607300001_job_description_context.sql`
9. `202607300002_employee_referral_preferences.sql`
10. `202607300003_employee_reliability_profile.sql`
11. `202607300004_referral_compatibility.sql`
12. `202607300005_remove_compatibility_request_metadata.sql`
13. `202607310001_proof_vault.sql`
14. `202607310002_structured_referral_decisions.sql`

The Storage migration creates a non-public `resumes` bucket with authenticated
owner-folder policies. Server-authorized Employee access is provided through
short-lived signed URLs after referral assignment checks.

The Proof Vault migration creates private, metadata-only evidence entries linked
to persisted Trust Cards. Students can manage only their own entries; only the
employee assigned to a linked referral can read them. Proof URLs remain external
links or safe references—RefAI does not upload or verify proof documents.

### Employee Reliability Card

`GET /referral/employees` includes one deterministic Employee Reliability Card
per directory entry. Its fixed weights are Response Consistency 30, Referral
Completion 25, Profile Verification 20, Decision Transparency 15, and Platform
Activity 10. Scores use discrete tiers and recorded profile/referral events.
Declines with a recorded reason count as a response and transparent decision,
and are excluded from the accepted-referral completion denominator. Unanswered
requests are treated as silence only after seven days. Cards with fewer than
three requests are explicitly provisional.

### Referral Compatibility

`POST /referral/compatibility` calculates a deterministic pre-submission check
from the selected employee, target role, optional real JD, student note,
persisted Trust Card, and employee preferences. Fixed
weights are Role Alignment 35, Department Relevance 25, Employee Preferences
20, Candidate Readiness 15, and Request Completeness 5.

`POST /referral/requests` recalculates and persists the versioned compatibility
snapshot; client-supplied scores are never trusted. Compatibility describes
request appropriateness only and does not predict acceptance or hiring.

## Structure
- `app/api/routes/*` — one router per resource (auth, resume, match, trust-card, referral)
- `app/services/groq_client.py` — LLM calls (Trust Card summary, referral message)

`POST /referral/message` is an authenticated student-only, server-grounded
referral-draft endpoint. It resolves the student's owned Trust Card and resume
analysis, includes only approved employee-directory fields, supports an optional
Job Description, and returns structured grounding metadata. Groq supplies wording
only; a deterministic template is returned if the model is unavailable.

`POST /referral/quality` deterministically checks the current referral message.
Its 100-point formula is recipient and opportunity accuracy (25), resume and
Trust Card grounding (30), factual integrity (20), employee preference fit (15),
and professional clarity (10). The score is separate from Referral Compatibility
and Candidate Trust Score. Normal quality warnings never block submission;
unsupported or contradictory factual claims do. The same checker runs again
inside `POST /referral/requests` immediately before persistence. A Job Description
adds an evidence source when supplied but is never required and its absence does
not reduce the quality score.

`POST /referral/employee/requests/{request_id}/copilot` is an advisory-only
summary for the assigned employee. It sends Groq a minimal set of persisted
resume, Trust Card, Proof Vault, verified-profile, target-role/company, and
optional-JD facts. Candidate-provided text is treated as untrusted data:
instruction-like content is excluded, statements must cite authorized fact IDs,
and unsupported technologies or metrics invalidate the model response. A
deterministic summary is returned when Groq is unavailable or invalid. The
Copilot never approves, rejects, predicts hiring, or changes request status.

- `app/services/vector_store.py` — ChromaDB collection for resume-chunk embeddings

### Project and Experience Relevance

The 20-point Project and Experience Relevance component reuses the local ChromaDB
client and its default embedding function. Meaningful project and work-experience
lines are stored in the cosine-distance collection
`project_experience_relevance_v1`, scoped by the authenticated analysis ID.

Cosine distance is normalized deterministically:

`semantic_similarity_percent = clamp((1 - cosine_distance) * 100, 0, 100)`

The component basis is `60% semantic similarity + 40% observable evidence`.
Observable evidence covers implementation, individual contribution, completion,
measurable outcomes, explicit complexity, technologies, and responsibility
language. Semantic similarity alone is capped when implementation or supporting
outcomes are absent. Chroma indexing, embedding, and retrieval failures fall back
to deterministic lexical relevance and do not fail the Trust Card.
- `app/services/resume_parser.py` — PDF/DOCX text extraction
- `app/services/trust_card_engine.py` — combines scoring + LLM summary
- `app/db/supabase_client.py` — Supabase Auth client with optional service-role storage access
- `app/core/security.py` — verifies the Supabase JWT sent from the frontend

`POST /resume/analyze` is the canonical persisted analysis endpoint.
`POST /match/score` remains temporarily available only for compatibility.

## Tests
```bash
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Deploy (Render)
- New Web Service → point at this repo/folder
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add the env vars from `.env.example`
- Or just deploy the included `Dockerfile`
