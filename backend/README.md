# RefAI — Backend

FastAPI + Groq (LLM) + ChromaDB (vector search) + Supabase (auth/db/storage).

## Setup
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Groq + Supabase credentials
uvicorn app.main:app --reload
```

Docs available at `http://localhost:8000/docs` (use this instead of Postman
collections for quick manual testing, or import the OpenAPI schema into Postman).

## Structure
- `app/api/routes/*` — one router per resource (auth, resume, match, trust-card, referral)
- `app/services/groq_client.py` — LLM calls (Trust Card summary, referral message)
- `app/services/vector_store.py` — ChromaDB collection for resume-chunk embeddings
- `app/services/resume_parser.py` — PDF/DOCX text extraction
- `app/services/trust_card_engine.py` — combines scoring + LLM summary
- `app/db/supabase_client.py` — server-side Supabase client (service role key)
- `app/core/security.py` — verifies the Supabase JWT sent from the frontend

## Deploy (Render)
- New Web Service → point at this repo/folder
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add the env vars from `.env.example`
- Or just deploy the included `Dockerfile`
