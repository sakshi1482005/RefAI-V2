from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)


def create_notification(*, recipient_id: str, event_type: str, event_key: str, title: str,
                        body: str, target_url: str, referral_request_id: str | None = None,
                        analysis_id: str | None = None) -> None:
    """Best-effort, idempotent notification write; never breaks the source workflow."""
    try:
        supabase.table("notifications").upsert({
            "recipient_id": recipient_id,
            "event_type": event_type,
            "event_key": event_key,
            "title": title,
            "body": body,
            "target_url": target_url,
            "referral_request_id": referral_request_id,
            "analysis_id": analysis_id,
        }, on_conflict="event_key", ignore_duplicates=True).execute()
    except Exception:
        logger.exception("Notification write failed event_type=%s event_key=%s", event_type, event_key)


class NotificationService:
    def list(self, actor_id: str, limit: int = 30) -> list[dict[str, Any]]:
        rows = (
            supabase.table("notifications").select("*").eq("recipient_id", actor_id)
            .order("created_at", desc=True).limit(limit).execute().data or []
        )
        return [self._response(row) for row in rows]

    def mark_read(self, actor_id: str, notification_id: str) -> dict[str, Any] | None:
        read_at = datetime.now(timezone.utc).isoformat()
        rows = (
            supabase.table("notifications").update({"read_at": read_at})
            .eq("id", notification_id).eq("recipient_id", actor_id).execute().data or []
        )
        return self._response(rows[0]) if rows else None

    def mark_all_read(self, actor_id: str) -> int:
        read_at = datetime.now(timezone.utc).isoformat()
        rows = (
            supabase.table("notifications").update({"read_at": read_at})
            .eq("recipient_id", actor_id).is_("read_at", "null").execute().data or []
        )
        return len(rows)

    @staticmethod
    def _response(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"], "eventType": row["event_type"], "title": row["title"],
            "body": row["body"], "targetUrl": row["target_url"],
            "referralRequestId": row.get("referral_request_id"), "analysisId": row.get("analysis_id"),
            "readAt": row.get("read_at"), "createdAt": row["created_at"],
        }
