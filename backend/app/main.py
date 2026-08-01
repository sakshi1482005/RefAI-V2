import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, resume, match, trust_card, referral, notifications
from app.core.config import settings


app = FastAPI(title="RefAI API", version="0.1.0")
logger = logging.getLogger(__name__)


@app.middleware("http")
async def preserve_transport_response(request, call_next):
    """Keep unexpected backend failures visible to cross-origin clients."""
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled API request failure method=%s path=%s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "The RefAI backend could not complete this request."},
        )


# Add CORS after the exception boundary so it is the outer user middleware and
# attaches headers to successful, authentication, validation, and unexpected
# error responses alike.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(match.router)
app.include_router(trust_card.router)
app.include_router(referral.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}
