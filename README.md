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
- ✅ ATS Compatibility Evaluation
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

# Configure Supabase

Run the migrations in chronological order:

```text
supabase/migrations/202607190001_referral_foundation.sql
supabase/migrations/202607200001_student_workflow_persistence.sql
supabase/migrations/202607210001_oauth_profile_role_fix.sql
supabase/migrations/202607250001_student_profile_branch.sql
supabase/migrations/202607250002_student_profile_fields.sql
```

The last two migrations are additive and safe to rerun.

They ensure `student_profiles` contains:

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

The `student_profiles.profile_id` must match the authenticated Supabase User ID and remain unique.

Create a private Storage bucket named:

```text
resumes
```

or configure a custom bucket using:

```text
RESUME_STORAGE_BUCKET
```

For Google OAuth, add these redirect URLs:

```text
http://localhost:5173/auth/callback
https://your-frontend.example/auth/callback
```

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