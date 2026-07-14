# RefAI — Frontend

React + TypeScript + Tailwind (Vite).

## Setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase + API URL
npm run dev
```

## Structure
- `src/components/landing/*` — marketing page sections (port your original HTML/CSS here piece by piece)
- `src/components/dashboard/*` — Trust Card, score meters, review panels
- `src/pages/*` — routed pages (Login, StudentDashboard, EmployeeReview)
- `src/lib/supabaseClient.ts` — Supabase auth/db/storage client
- `src/lib/apiClient.ts` — axios instance that calls the FastAPI backend, auto-attaching the Supabase session token
- `src/types/index.ts` — shared TS interfaces (mirror the backend's pydantic schemas)

## Deploy
Push to GitHub, import the repo in Vercel, set the env vars from `.env.example` in the Vercel dashboard, framework preset: Vite.
