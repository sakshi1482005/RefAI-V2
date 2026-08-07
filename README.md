# 🚀 RefAI

> **AI-powered referral platform that helps students earn trusted referrals through evidence-based AI evaluation.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase)
![Groq](https://img.shields.io/badge/Groq-AI-orange)

---

# Problem

Students often struggle to obtain referrals because they lack professional networks. Employees are also hesitant to refer unknown candidates without evidence of their skills and job readiness.

# Solution

RefAI bridges this gap by analyzing a student's resume against a target job description, generating an AI-powered **Candidate Trust Card**, recommending improvements, and enabling employees to make informed referral decisions backed by evidence.

---

# Tech Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- Pydantic
- Groq LLM
- ChromaDB

### Platform
- Supabase Authentication
- PostgreSQL
- Row Level Security (RLS)
- Private Supabase Storage

---

# Features

- ✅ Resume Analysis
- ✅ AI Candidate Trust Card
- ✅ Resume evidence and requirement coverage review
- ✅ Personalized Action Plan
- ✅ Student Profile Management
- ✅ Employee Search
- ✅ Referral Request Workflow
- ✅ Referral Status Tracking
- ✅ Employee Review Dashboard
- ✅ Secure Resume Storage
- ✅ Google Authentication
- ✅ Role-Based Authorization
- ✅ PostgreSQL Row Level Security

---

# Project Structure

```text
RefAI/
├── frontend/              React application
├── backend/               FastAPI application
├── supabase/migrations/   Database migrations and RLS policies
└── README.md
```

---

# Prerequisites

- Node.js 18 or newer
- Python 3.11 or newer
- A Supabase project
- A Groq API key
- A private Supabase Storage bucket (default: `resumes`)

> **Never place the Supabase Service Role Key in the frontend environment.**

---

# Configure Supabase from a clean project

Use a new Supabase project with no manually created RefAI tables, functions,
triggers, policies, or Storage buckets. Install the Supabase CLI, authenticate,
and link the repository to the new project:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push
```

`supabase db push` applies every file in `supabase/migrations` by its timestamp.
Do not paste only the latest migration into the SQL Editor, and do not mark a
migration as applied unless its SQL completed successfully.

The required order is:

```text
202607190001_referral_foundation.sql
202607200001_student_workflow_persistence.sql
202607210001_oauth_profile_role_fix.sql
202607240001_profile_foundation.sql
202607240002_private_resume_storage.sql
202607250001_student_profile_branch.sql
202607250002_student_profile_fields.sql
202607300001_job_description_context.sql
202607300002_employee_referral_preferences.sql
202607300003_employee_reliability_profile.sql
202607300004_referral_compatibility.sql
202607300005_remove_compatibility_request_metadata.sql
202607310001_proof_vault.sql
202607310002_structured_referral_decisions.sql
202607310003_referral_status_model.sql
202607310004_referral_submission_workflow.sql
202608010001_in_app_notifications.sql
202608010002_demo_risk_repairs.sql
202608030001_employee_company_consistency.sql
```

This sequence creates the base profile and referral schema, persisted resume
analyses and Trust Cards, student and employee profiles, the private `resumes`
bucket, employee preference/reliability fields, compatibility snapshots, Proof
Vault, structured decision history, the complete referral status model, referral
submission metadata, and in-app notifications. RLS is enabled by migrations.
`employee_profiles.company` remains the canonical employee employer field; the
last migration normalizes/backfills missing legacy values and adds an immutable
`employee_company_snapshot` to referral requests.

After `db push`, verify the remote migration ledger:

```powershell
supabase migration list
```

Both Local and Remote columns should contain every timestamp above. Then run
these read-only checks in the Supabase SQL Editor:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles','student_profiles','employee_profiles','resume_analyses',
    'trust_cards','referral_requests','referral_status_history',
    'referral_decision_private_notes','proof_entries','notifications'
  )
order by tablename;

select id, name, public
from storage.buckets
where id = 'resumes';

select trigger_name, event_object_schema, event_object_table
from information_schema.triggers
where trigger_name in (
  'refai_on_auth_user_created',
  'refai_on_auth_user_metadata_updated'
)
order by trigger_name;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

Expected results:

- Every listed public table reports `rowsecurity = true`.
- `storage.buckets.public` is `false` for `resumes`.
- Both RefAI Auth triggers exist on `auth.users`.
- Resume object policies are scoped to the first path folder matching
  `auth.uid()`, for paths such as `{user_id}/{resume_id}.pdf`.

Create one disposable student and one disposable employee through the normal
signup UI. Confirm `public.profiles.role` is respectively `student` and
`employee`. Role-specific profile rows are created when each user saves their
profile; the Auth trigger intentionally creates the base `profiles` row only.

Keep the backend configured with:

```text
RESUME_STORAGE_BUCKET=resumes
```

## Safe recovery and rollback

Migrations are forward-only deployment history. Several files are additive and
idempotent, but the sequence also replaces constraints, functions, triggers, and
policies. Do not use repeated SQL Editor execution as a rollback strategy.

- If `db push` fails, retain the error, correct the failing migration in a
  disposable project, and retry from a newly created clean project.
- If a migration has already succeeded in a shared environment, add a new
  timestamped corrective migration instead of editing or deleting applied SQL.
- Before deploying to an existing environment, take a Supabase database backup
  and record the migration ledger.
- For a hackathon clean deployment, deleting and recreating the unused test
  project is safer than attempting destructive down migrations.
- Never run rollback or reset commands against the production project.

## Manual Supabase dashboard configuration

Database objects and the private resume bucket require no manual dashboard
creation after migrations succeed. The following project-level settings remain
manual:

- Enable the desired Auth providers, including Google when used.
- Add `http://localhost:5173/auth/callback` and the deployed frontend callback
  URL to Authentication → URL Configuration.
- Enter Google OAuth client credentials when Google login is enabled.
- Copy the project URL, anon key, service-role key, and JWT secret into the
  appropriate deployment environment. The service-role key belongs only in the
  backend.

---

# Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

## Backend Environment Variables

```env
GROQ_API_KEY=your-groq-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
RESUME_STORAGE_BUCKET=resumes
CHROMA_PERSIST_DIR=./chroma_data
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend.example
```

Start the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify:

```text
Health:
http://localhost:8000/health

API Docs:
http://localhost:8000/docs
```

Expected response:

```json
{"status":"ok"}
```

---

# Frontend Setup

Open another PowerShell terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

## Frontend Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Start Vite:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

Restart Vite whenever environment variables change.

---

# Application Workflow

## Student

```text
Sign In
      ↓
Complete Profile
      ↓
Upload Resume
      ↓
Enter Company, Role & Job Description
      ↓
Run AI Analysis
      ↓
Review Action Plan
      ↓
Generate Candidate Trust Card
      ↓
Find Employee
      ↓
Send Referral Request
      ↓
Track Referral Status
```

## Employee

```text
Sign In
      ↓
Complete Professional Profile
      ↓
View Assigned Referral Requests
      ↓
Review Candidate Resume
      ↓
Review Candidate Trust Card
      ↓
Approve / Reject Referral
```

Authenticated requests use:

```http
Authorization: Bearer <supabase-user-access-token>
```

The frontend must **never** send the Supabase Anon Key as the user access token.

---

# Important API Endpoints

```text
GET  /health

GET  /auth/student-profile
PUT  /auth/student-profile

POST /resume/upload
POST /resume/analyze
GET  /resume/analysis/latest

POST /trust-card/generate

GET  /referral/employees

POST /referral/requests
GET  /referral/requests

GET  /referral/employee/queue
GET  /referral/employee/requests/{request_id}
GET  /referral/employee/requests/{request_id}/resume
GET  /referral/employee/requests/{request_id}/trust-card
```

---

# Testing

## Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Frontend

```powershell
cd frontend
npm run typecheck
npm run build
```

---

# Troubleshooting

## Profile cannot be saved

Verify the backend is running.

Inspect:

```text
PUT http://localhost:8000/auth/student-profile
```

If PostgreSQL reports missing columns, rerun the student profile migrations.

---

## CORS Error

Ensure:

```text
http://localhost:5173
http://127.0.0.1:5173
```

are present inside `CORS_ORIGINS`.

Even unauthenticated requests should include:

```text
Access-Control-Allow-Origin
```

---

## Resume Upload Fails

Verify:

- Backend Service Role Key is configured.
- Private Storage bucket exists.
- `RESUME_STORAGE_BUCKET` matches the bucket.
- Uploaded file is a readable PDF under **10 MB**.

---

## Analysis Not Available

Verify both endpoints:

```text
POST /resume/analyze

GET /resume/analysis/latest
```

The latest analysis becomes available only after successful persistence.

---

# Deployment

## Backend (Render)

```text
Root Directory : backend

Build Command :
pip install -r requirements.txt

Start Command :
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Configure all backend environment variables in Render.

Set:

```text
CORS_ORIGINS=https://your-frontend.example
```

---

## Frontend (Vercel)

```text
Root Directory : frontend

Framework :
Vite

Build Command :
npm run build

Output Directory :
dist
```

Environment Variables:

```text
VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

VITE_API_BASE_URL=https://your-render-backend.example
```

Also add the deployed frontend callback URL to the Supabase OAuth Redirect Allow List.

---


# AI Stack

- Groq LLM for resume reasoning
- ChromaDB for semantic retrieval
- Prompt-engineered trust evaluation
- Rule-based candidate scoring pipeline

---

# Future Scope

- AI Mock Interviews
- Referral Success Prediction
- Company-specific Resume Optimization
- Personalized Learning Roadmaps
- Interview Scheduling
- Employee Reputation Score

---

# Team

- **Sakshi Mesare**
- **Arya Wade**
- **Santoshini Nahak**
- **Yukta Methwale**

---

# License

This project is intended for educational and hackathon purposes.


## Clean Supabase deployment verification

A production database is not proof that the migration chain is complete. Use a disposable, empty Supabase project:

1. Install the Supabase CLI and PostgreSQL client tools.
2. From the repository root run: `powershell -ExecutionPolicy Bypass -File supabase/verify_fresh_deployment.ps1 -ProjectRef <disposable-project-ref> -DatabaseUrl <direct-postgres-url>`.
3. In Supabase Auth, create one disposable student and one disposable employee with email/password. Confirm each can sign in and that `profiles` plus the matching role profile are created by the Auth trigger.
4. With each user JWT, verify self-profile reads succeed and cross-user/private-role reads fail.
5. As the student, upload a PDF to `resumes/<student-auth-id>/<resume-id>.pdf`, replace it, and confirm uploads outside that folder and anonymous reads fail.
6. Create an assigned referral. Call the authenticated employee resume endpoint as the assigned employee and confirm the signed URL works, contains an expiry, and stops working after the configured TTL. Repeat as another employee and require 403.
7. Inspect the Vercel build output and deployed frontend environment: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are allowed; never expose the service-role key.
8. Delete the disposable users/project after verification.

The script proves migration execution plus structural RLS, trigger, policy, and private-bucket prerequisites. Auth, OAuth redirects, JWT role guards, object upload, and signed-URL expiry are deliberate live smoke tests because they require a real disposable project and credentials. Google OAuth should be tested with the disposable project redirect URL if a disposable Google OAuth client is available.

The current More Information scope persists the employee's structured reason, student-visible clarification question, timestamp, notification, and `more_info_requested` history event. RefAI does not currently claim that the student has responded; the employee queue therefore labels this state “More information requested.”
