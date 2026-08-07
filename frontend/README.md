# RefAI — Frontend

React + TypeScript + Tailwind (Vite).

## Setup
```bash
npm install
cp .env.example .env         # fill in Supabase + API URL
npm run dev
```

Run the Supabase migrations in `../supabase/migrations` in filename order before
starting an authenticated workflow. They create the role-specific profile
tables, RLS policies, referral persistence, analysis persistence, and the
required private `resumes` Storage bucket.

The Phase 4A and 4B migrations create the private, student-owned AI Apply goal,
match-snapshot, allowance, idempotency, and credit-ledger tables. After they are applied, authenticated students can
open `/dashboard/ai-apply`, define a target opportunity, and review eligible
employee matches. No request is auto-created: the student must review a match
and message, and the backend must pass every atomic submission safeguard.

## Structure
- `src/components/landing/*` — marketing page sections (port your original HTML/CSS here piece by piece)
- `src/components/dashboard/*` — Trust Card, score meters, review panels
- `src/pages/*` — routed pages (Login, StudentDashboard, EmployeeReview)
- `src/lib/supabase.ts` — Supabase Auth client configured with the anon key
- `src/lib/apiClient.ts` — axios instance that calls the FastAPI backend, auto-attaching the Supabase session token
- `src/types/index.ts` — shared TS interfaces (mirror the backend's pydantic schemas)

## Checks
```bash
npm run typecheck
npm run build
```

## Deploy
Push to GitHub, import the `frontend` directory in Vercel, set the variables
from `.env.example`, use `npm run build`, and publish `dist`. The frontend uses
only the Supabase anon key; never configure a service-role key in Vite.
