"""Privacy-safe projection of a persisted Candidate Trust Card for sharing."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)
ALLOWED_VISIBILITY = {"identity", "role", "scores", "evidence", "reliability"}


class PassportError(Exception): pass
class PassportForbidden(PassportError): pass
class PassportNotFound(PassportError): pass


class PassportRepository(Protocol):
    def get_role(self, user_id: str) -> str | None: ...
    def get_owned_card(self, user_id: str, card_id: str) -> dict[str, Any] | None: ...
    def get_active(self, user_id: str, card_id: str) -> dict[str, Any] | None: ...
    def revoke_active(self, user_id: str, card_id: str) -> None: ...
    def create(self, values: dict[str, Any]) -> dict[str, Any]: ...
    def get_public(self, token_hash: str) -> dict[str, Any] | None: ...
    def record_event(self, passport_id: str, event: str, actor_id: str | None = None) -> None: ...
    def mark_access(self, passport_id: str) -> None: ...


class SupabasePassportRepository:
    def get_role(self, user_id: str) -> str | None:
        rows = supabase.table("profiles").select("role").eq("id", user_id).limit(1).execute().data or []
        return rows[0].get("role") if rows else None

    def get_owned_card(self, user_id: str, card_id: str) -> dict[str, Any] | None:
        rows = supabase.table("trust_cards").select("id,student_id,payload,created_at").eq("id", card_id).eq("student_id", user_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def get_active(self, user_id: str, card_id: str) -> dict[str, Any] | None:
        rows = supabase.table("trust_passports").select("*").eq("student_id", user_id).eq("trust_card_id", card_id).is_("revoked_at", "null").order("created_at", desc=True).limit(1).execute().data or []
        return rows[0] if rows else None

    def revoke_active(self, user_id: str, card_id: str) -> None:
        supabase.table("trust_passports").update({"enabled": False, "revoked_at": datetime.now(timezone.utc).isoformat()}).eq("student_id", user_id).eq("trust_card_id", card_id).is_("revoked_at", "null").execute()

    def create(self, values: dict[str, Any]) -> dict[str, Any]:
        rows = supabase.table("trust_passports").insert(values).execute().data or []
        if not rows: raise PassportError("Passport could not be created")
        return rows[0]

    def get_public(self, token_hash: str) -> dict[str, Any] | None:
        query = "id,student_id,trust_card_id,visibility,enabled,expires_at,revoked_at,created_at,trust_card:trust_cards!trust_passports_trust_card_id_fkey(id,payload,created_at)"
        rows = supabase.table("trust_passports").select(query).eq("token_hash", token_hash).limit(1).execute().data or []
        return rows[0] if rows else None

    def record_event(self, passport_id: str, event: str, actor_id: str | None = None) -> None:
        supabase.table("trust_passport_events").insert({"passport_id": passport_id, "actor_id": actor_id, "event_type": event}).execute()

    def mark_access(self, passport_id: str) -> None:
        # Metadata only: never put the public token, IP address, or card payload in logs.
        row = supabase.table("trust_passports").select("access_count").eq("id", passport_id).limit(1).execute().data or []
        if row:
            supabase.table("trust_passports").update({"access_count": int(row[0].get("access_count") or 0) + 1, "last_accessed_at": datetime.now(timezone.utc).isoformat()}).eq("id", passport_id).execute()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _clean_list(value: Any, limit: int = 3) -> list[str]:
    return [" ".join(str(item).split())[:240] for item in (value or []) if " ".join(str(item).split())][:limit]


def _public_projection(row: dict[str, Any]) -> dict[str, Any]:
    card = row.get("trust_card") or {}
    payload = card.get("payload") or {}
    visibility = set(row.get("visibility") or []) & ALLOWED_VISIBILITY
    result: dict[str, Any] = {
        "issuedAt": row.get("created_at"), "expiresAt": row.get("expires_at"),
        "algorithmVersion": payload.get("scoreVersion"), "generatedAt": payload.get("generatedAt") or card.get("created_at"),
        "visibility": sorted(visibility),
    }
    if "identity" in visibility:
        result["candidateName"] = payload.get("candidateName")
    if "role" in visibility:
        result["targetRole"] = payload.get("role")
    if "scores" in visibility:
        result["trustScore"] = payload.get("trustScore")
        # Hybrid/Fuzzy values are only included if they were deliberately persisted.
        for key in ("hybridScore", "fuzzySuitabilityScore"):
            if isinstance(payload.get(key), (int, float)): result[key] = payload[key]
    if "evidence" in visibility:
        matched = _clean_list(payload.get("matchedSkills"), 8)
        evidence_items = [item for factor in (payload.get("scoreBreakdown") or []) for item in (factor.get("evidenceItems") or []) if isinstance(item, dict)]
        verified = [item for item in evidence_items if item.get("status") in {"Verified evidence", "Resume supported"}]
        result["verifiedSkills"] = matched
        result["verifiedEvidenceCount"] = len(verified)
        result["strongestVerifiedEvidence"] = _clean_list([item.get("factLabel") or item.get("snippet") for item in verified], 2)
    if "reliability" in visibility:
        reliability = payload.get("analysisReliability") or {}
        result["reliability"] = {"label": reliability.get("label"), "basis": reliability.get("basis"), "limitations": reliability.get("limitations")}
    return result


class TrustPassportService:
    def __init__(self, repository: PassportRepository | None = None): self.repository = repository or SupabasePassportRepository()

    def _require_student_card(self, user_id: str, card_id: str) -> dict[str, Any]:
        if self.repository.get_role(user_id) != "student": raise PassportForbidden("Student access is required")
        card = self.repository.get_owned_card(user_id, card_id)
        if not card: raise PassportNotFound("Trust Card was not found")
        return card

    def create(self, user_id: str, card_id: str, visibility: list[str], expires_in_days: int | None) -> dict[str, Any]:
        self._require_student_card(user_id, card_id)
        selected = sorted(set(visibility) & ALLOWED_VISIBILITY)
        if not selected: raise PassportError("Select at least one information category to share")
        self.repository.revoke_active(user_id, card_id)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days or 30)
        row = self.repository.create({"student_id": user_id, "trust_card_id": card_id, "token_hash": _hash(token), "visibility": selected, "enabled": True, "expires_at": expires_at.isoformat()})
        self.repository.record_event(str(row["id"]), "created", user_id)
        logger.info("trust_passport_event action=created passport_id=%s", row["id"])
        return {"passportId": row["id"], "shareToken": token, "enabled": True, "visibility": selected, "expiresAt": row["expires_at"]}

    def status(self, user_id: str, card_id: str) -> dict[str, Any]:
        self._require_student_card(user_id, card_id)
        row = self.repository.get_active(user_id, card_id)
        if not row: return {"enabled": False, "visibility": [], "expiresAt": None}
        active = bool(row.get("enabled")) and not row.get("revoked_at") and (not row.get("expires_at") or row["expires_at"] > datetime.now(timezone.utc).isoformat())
        return {"passportId": row["id"], "enabled": active, "visibility": row.get("visibility") or [], "expiresAt": row.get("expires_at"), "accessCount": row.get("access_count", 0)}

    def revoke(self, user_id: str, card_id: str) -> None:
        self._require_student_card(user_id, card_id)
        row = self.repository.get_active(user_id, card_id)
        if row: self.repository.record_event(str(row["id"]), "revoked", user_id)
        self.repository.revoke_active(user_id, card_id)
        logger.info("trust_passport_event action=revoked passport_id=%s", row.get("id") if row else "none")

    def public(self, token: str) -> dict[str, Any]:
        row = self.repository.get_public(_hash(token))
        now = datetime.now(timezone.utc).isoformat()
        if not row or not row.get("enabled") or row.get("revoked_at") or (row.get("expires_at") and row["expires_at"] <= now):
            raise PassportNotFound("Trust Passport is unavailable")
        self.repository.mark_access(str(row["id"]))
        self.repository.record_event(str(row["id"]), "accessed")
        logger.info("trust_passport_event action=accessed passport_id=%s", row["id"])
        return _public_projection(row)
