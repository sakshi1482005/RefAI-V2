"""Small process cache for read-only candidate intelligence inputs.

The intelligence endpoints all derive their output from the same persisted
analysis and Trust Card.  This cache prevents a dashboard, the Intelligence
Lab, and the simulator from independently re-running vector matching and claim
lookups for identical saved inputs.  It is deliberately short-lived and keyed
by the authenticated student plus versioned persisted identifiers; it is not a
second scoring system and it never bypasses authorisation.
"""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from hashlib import sha256
import json
from threading import RLock
from time import monotonic
from typing import Any, Callable


_TTL_SECONDS = 90.0
_MAX_ENTRIES = 96
_cache: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
_lock = RLock()


def candidate_intelligence_cache_key(student_id: str, session: dict[str, Any]) -> str:
    """Return a non-sensitive key from the saved inputs that affect results."""
    card = session.get("trustCard") if isinstance(session.get("trustCard"), dict) else {}
    material = {
        "student": student_id,
        "analysisId": str(session.get("analysisId") or ""),
        "analysisVersion": str(session.get("analyzedAt") or ""),
        "trustCardId": str(card.get("id") or ""),
        "trustCardInputKey": str(card.get("inputKey") or ""),
        "trustScoreVersion": str(card.get("scoreVersion") or ""),
    }
    return sha256(json.dumps(material, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def get_or_build_candidate_intelligence(
    key: str, builder: Callable[[], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    """Return a defensive copy and whether it came from the process cache."""
    now = monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached and now - cached[0] <= _TTL_SECONDS:
            _cache.move_to_end(key)
            return deepcopy(cached[1]), True

        # Holding the narrow process lock while building avoids duplicate vector
        # work for concurrent identical dashboard requests.  This cache is only
        # used by synchronous FastAPI route handlers.
        value = builder()
        _cache[key] = (now, deepcopy(value))
        _cache.move_to_end(key)
        while len(_cache) > _MAX_ENTRIES:
            _cache.popitem(last=False)
        return deepcopy(value), False


def clear_candidate_intelligence_cache() -> None:
    """Test and lifecycle helper."""
    with _lock:
        _cache.clear()
