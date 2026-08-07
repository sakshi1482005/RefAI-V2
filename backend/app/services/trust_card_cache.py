from __future__ import annotations

from hashlib import sha256
import json
import re
from typing import Any

from app.services.trust_score import SCORE_VERSION


TRUST_CARD_SCHEMA_VERSION = "trust-card-schema-v2"
TRUST_CARD_GENERATION_VERSION = "trust-card-generation-v2"


def _normalized(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def build_trust_card_input_metadata(analysis: dict[str, Any]) -> dict[str, str]:
    """Build a non-reversible key from only versioned Trust Card dependencies."""
    job_description_hash = sha256(_normalized(analysis.get("job_description")).encode("utf-8")).hexdigest()
    resume_content_hash = sha256(str(analysis.get("resume_text") or "").strip().encode("utf-8")).hexdigest()
    material = {
        "analysisId": str(analysis.get("id") or ""),
        "role": _normalized(analysis.get("target_role")),
        "company": _normalized(analysis.get("target_company")),
        "jobDescriptionHash": job_description_hash,
        "resumeContentHash": resume_content_hash,
        "analysisVersion": str(analysis.get("updated_at") or analysis.get("created_at") or ""),
        "scoreVersion": SCORE_VERSION,
        "schemaVersion": TRUST_CARD_SCHEMA_VERSION,
        "generationVersion": TRUST_CARD_GENERATION_VERSION,
    }
    input_key = sha256(json.dumps(material, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {
        "inputKey": input_key,
        "jobDescriptionHash": job_description_hash,
        "resumeContentHash": resume_content_hash,
        "scoreVersion": SCORE_VERSION,
        "schemaVersion": TRUST_CARD_SCHEMA_VERSION,
        "generationVersion": TRUST_CARD_GENERATION_VERSION,
    }


def is_current_trust_card(card: dict[str, Any] | None, analysis: dict[str, Any]) -> bool:
    if not card:
        return False
    payload = card.get("payload") or {}
    expected = build_trust_card_input_metadata(analysis)
    return all(payload.get(field) == expected[field] for field in (
        "inputKey", "scoreVersion", "schemaVersion", "generationVersion",
    ))


def persisted_trust_card_response(card: dict[str, Any]) -> dict[str, Any]:
    return {"id": card["id"], **(card.get("payload") or {})}
