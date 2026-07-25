# RefAI

RefAI is an AI-assisted referral platform that helps students compare a resume
with a target job, generate an evidence-based Candidate Trust Card, find
employees, request a referral, and track the request. Employees receive only
the referral requests assigned to them and can review the linked candidate
evidence before making a decision.

## Technology

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: FastAPI, Pydantic, Groq, ChromaDB
- Platform: Supabase Auth, PostgreSQL, Row Level Security, and private Storage

## Project structure

```text
RefAI/
├── frontend/              React application
├── backend/               FastAPI application
├── supabase/migrations/   Database migrations and RLS policies
└── README.md
```

## Prerequisites

- Node.js 18 or newer
- Python 3.11 or newer
- A Supabase project
- A Groq API key
- A private Supabase Storage bucket for resumes (default: `resumes`)

Never place the Supabase service-role key in the frontend environment.

## 1. Configure Supabase

Run the migrations in chronological order:

```text
supabase/migrations/202607190001_referral_foundation.sql
supabase/migrations/202607200001_student_workflow_persistence.sql
supabase/migrations/202607210001_oauth_profile_role_fix.sql
supabase/migrations/202607250001_student_profile_branch.sql
supabase/migrations/202607250002_student_profile_fields.sql
```

The final two migrations are additive and safe to rerun. They ensure the
existing `student_profiles` table contains:

```text
branch
preferred_role
preferred_company
skills
bio
linkedin
github
portfolio
```

The `student_profiles.profile_id` value must match the authenticated Supabase
user ID and must be unique for upserts.

Create a private Storage bucket named `resumes`, or set a different bucket name
through `RESUME_STORAGE_BUCKET`.

For Google OAuth, add the application callback URL to the Supabase redirect
allowlist:

```text
http://localhost:5173/auth/callback
https://your-frontend.example/auth/callback
```

## 2. Start the backend

### PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Configure `backend/.env`:

```dotenv
GROQ_API_KEY=your-groq-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=
RESUME_STORAGE_BUCKET=resumes
CHROMA_PERSIST_DIR=./chroma_data
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend.example
```

Start FastAPI:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify:

```text
Health: http://localhost:8000/health
API docs: http://localhost:8000/docs
```

Expected health response:

```json
{"status":"ok"}
```

## 3. Start the frontend

Open another PowerShell terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Configure `frontend/.env`:

```dotenv
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

Restart Vite after changing frontend environment variables.

## Main application flow

### Student

```text
Sign in
→ Complete profile
→ Upload resume
→ Enter target role, company, and job description
→ Run analysis
→ Review Action Plan
→ Generate Trust Card
→ Find an employee
→ Send referral request
→ Track status
```

### Employee

```text
Sign in
→ Complete professional profile
→ View assigned referral requests
→ Open candidate review
→ Review the authorized resume
→ Review the persisted Trust Card
→ Make and confirm a referral decision
```

Authenticated requests use:

```http
Authorization: Bearer <supabase-user-access-token>
```

The frontend must never send the Supabase anon key as the user access token.

## Important API endpoints

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

## Validation

### Backend tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

### Frontend checks

```powershell
cd frontend
npm run typecheck
npm run build
```

## Troubleshooting

### Profile cannot be saved

Confirm the backend is running and then inspect the API response from:

```text
PUT http://localhost:8000/auth/student-profile
```

If PostgreSQL reports that a `student_profiles` column does not exist, apply the
student-profile migrations listed above. Profile saves use an upsert on
`profile_id`; they do not create duplicate rows.

### CORS error

Confirm `CORS_ORIGINS` includes the exact frontend origin without a trailing
slash:

```text
http://localhost:5173
http://127.0.0.1:5173
```

An unauthenticated protected request may return `401` or `403`, but it should
still contain `Access-Control-Allow-Origin`.

### Resume upload fails

Verify:

- The backend service-role key is configured.
- The private Storage bucket exists.
- `RESUME_STORAGE_BUCKET` matches the bucket name.
- The uploaded file is a readable PDF smaller than 10 MB.

### Analysis is unavailable after navigation

Check both requests:

```text
POST /resume/analyze
GET  /resume/analysis/latest
```

The POST returns success only after the analysis has been persisted for the
authenticated student.

## Deployment

### Backend on Render

```text
Root directory: backend
Build command: pip install -r requirements.txt
Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Add all backend environment variables in Render. Set `CORS_ORIGINS` to the
deployed frontend URL.

### Frontend on Vercel

```text
Root directory: frontend
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Set:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_BASE_URL=https://your-render-backend.example
```

Add the deployed frontend callback URL to the Supabase Auth redirect allowlist.

## Security notes

- Keep resumes in a private Storage bucket.
- Keep `SUPABASE_SERVICE_KEY` on the backend only.
- Use RLS and server-side role checks for student and employee authorization.
- Employee candidate access must be authorized through the referral-request ID.
- Demo Mode data must remain isolated from authenticated production data.

