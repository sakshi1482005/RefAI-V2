import logging
from time import perf_counter
from typing import Any

from pydantic import ValidationError

from app.models.schemas import MatchAnalysisResponse
from app.services.trust_card_engine import InsufficientJobRequirements, build_match_analysis

logger = logging.getLogger(__name__)


class ResumeAnalysisUnavailable(RuntimeError):
    pass


class ResumeAnalysisInputError(ValueError):
    pass


def _shape(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: f"list[{type(item[0]).__name__}]" if isinstance(item, list) and item else type(item).__name__ for key, item in value.items()}
    return type(value).__name__


def run_resume_analysis(resume_text: str, job_description: str) -> dict:
    """Build and strictly serialize the one canonical resume-analysis response."""
    started_at = perf_counter()
    try:
        raw = build_match_analysis(resume_text, job_description)
    except InsufficientJobRequirements as exc:
        raise ResumeAnalysisInputError(str(exc)) from exc
    except Exception as exc:
        logger.exception("Resume analysis service failed before serialization")
        raise ResumeAnalysisUnavailable("Resume analysis could not be completed") from exc

    if not isinstance(raw, dict):
        logger.error("Resume analysis returned a non-object shape=%s", _shape(raw))
        raise ResumeAnalysisUnavailable("Resume analysis returned an invalid result")

    raw["processingTimeMs"] = round((perf_counter() - started_at) * 1000)
    logger.debug("Resume analysis raw service output shape=%s", _shape(raw))
    try:
        validated = MatchAnalysisResponse.model_validate(raw, strict=True)
    except ValidationError as exc:
        logger.error(
            "Resume analysis contract validation failed fields=%s shape=%s",
            [".".join(str(part) for part in error["loc"]) for error in exc.errors()],
            _shape(raw),
        )
        raise ResumeAnalysisUnavailable("Resume analysis returned an invalid result") from exc

    response = validated.model_dump(mode="json")
    logger.debug("Resume analysis final API response shape=%s", _shape(response))
    return response
