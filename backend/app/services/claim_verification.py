from __future__ import annotations

from hashlib import sha256
import re
from typing import Any, Callable

from app.services.groq_client import AIServiceUnavailable, generate_claim_clarifications


STATUS_VERSION = "claim-verification-v2-significant-claims"
ClaimInterpreter = Callable[[list[dict[str, str]]], dict[str, str]]

_SECTION_NAMES = {
    "experience": "Experience",
    "work experience": "Experience",
    "professional experience": "Experience",
    "internships": "Experience",
    "internship": "Experience",
    "projects": "Projects",
    "project experience": "Projects",
    "achievements": "Achievements",
    "awards": "Achievements",
    "honors": "Achievements",
    "leadership": "Leadership",
    "positions of responsibility": "Leadership",
    "skills": "Skills",
    "technical skills": "Skills",
}
_TARGET_SECTIONS = {"Experience", "Projects", "Achievements", "Leadership"}
_ACTION = re.compile(
    r"\b(?:built|created|developed|implemented|designed|deployed|automated|integrated|"
    r"delivered|maintained|managed|owned|launched|organized|coordinated|mentored|"
    r"led|headed|directed|increased|improved|reduced|saved|grew|won|ranked|achieved)\b",
    re.IGNORECASE,
)
_LEADERSHIP = re.compile(
    r"\b(?:led|managed|mentored|headed|directed|supervised|coordinated|organized|"
    r"team lead|president|captain|chairperson|founder)\b",
    re.IGNORECASE,
)
_ACHIEVEMENT = re.compile(
    r"\b(?:won|awarded|award|ranked|finalist|winner|scholarship|recognized|honou?r|"
    r"competition|hackathon|achieved)\b",
    re.IGNORECASE,
)
_QUANTIFIED = re.compile(
    r"(?:\b\d+(?:\.\d+)?\s*(?:%|x|users?|customers?|students?|members?|people|"
    r"hours?|days?|weeks?|months?|requests?|transactions?|downloads?|stars?|teams?)\b|"
    r"\b(?:increased|improved|reduced|saved|grew|cut|raised)\b[^.\n]{0,60}\b\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
_OUTCOME = re.compile(
    r"\b(?:resulting in|which (?:improved|reduced|increased|saved)|improved|reduced|"
    r"increased|saved|grew|cut|raised|used by|serving|adopted by|delivered)\b",
    re.IGNORECASE,
)
_SCOPE = re.compile(r"\b(?:using|with|for|across|through|on behalf of|to (?:build|deliver|improve|reduce|support|serve))\b", re.IGNORECASE)
_INJECTION = re.compile(
    r"\b(?:ignore (?:all |any |the )?(?:previous|prior|system)|system prompt|developer message|"
    r"reveal (?:the )?prompt|follow these instructions|do not follow|assistant:|system:|"
    r"auto[- ]?approve|auto[- ]?reject|bypass grounding|fabricate (?:evidence|claims?))\b",
    re.IGNORECASE,
)
_TOKEN = re.compile(r"[a-z][a-z0-9+#.-]{2,}", re.IGNORECASE)
_STOP = {"and", "the", "with", "from", "that", "this", "using", "into", "for", "was", "were", "are", "team"}


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9+#.]+", value.lower()))


def _compact(value: str, maximum: int) -> str:
    compact = " ".join(value.split())
    return compact if len(compact) <= maximum else compact[: maximum - 1].rstrip() + "…"


def _claim_id(section: str, claim: str) -> str:
    digest = sha256(f"{section}|{_normalize(claim)}".encode("utf-8")).hexdigest()[:12].upper()
    return f"CL-{digest}"


def _section_heading(line: str) -> str | None:
    normalized = _normalize(line.rstrip(":"))
    return _SECTION_NAMES.get(normalized) if len(line.strip()) <= 48 else None


def _resume_statements(resume_text: str) -> list[dict[str, str]]:
    statements: list[dict[str, str]] = []
    section = "Resume"
    for raw_line in resume_text.splitlines():
        line = raw_line.strip(" \t•●▪-–—")
        if not line:
            continue
        heading = _section_heading(line)
        if heading:
            section = heading
            continue
        for sentence in re.split(r"(?<=[.!?])\s+|[•●▪]", line):
            text = _compact(sentence.strip(), 500)
            if text and not _INJECTION.search(text):
                statements.append({"section": section, "text": text})
    return statements


def _contains_claim(text: str, claim: str) -> bool:
    normalized_text, normalized_claim = _normalize(text), _normalize(claim)
    return bool(normalized_claim) and f" {normalized_claim} " in f" {normalized_text} "


def _resume_segments(statements: list[dict[str, str]], claim: str) -> list[dict[str, str]]:
    return [item for item in statements if _contains_claim(item["text"], claim)][:3]


def _meaningful_tokens(value: str) -> set[str]:
    return {token.lower() for token in _TOKEN.findall(value) if token.lower() not in _STOP}


def _supporting_neighbors(statements: list[dict[str, str]], index: int, claim: str) -> list[str]:
    tokens = _meaningful_tokens(claim)
    section = statements[index]["section"]
    support: list[str] = []
    for candidate_index in range(max(0, index - 2), min(len(statements), index + 3)):
        if candidate_index == index or statements[candidate_index]["section"] != section:
            continue
        candidate = statements[candidate_index]["text"]
        if len(tokens & _meaningful_tokens(candidate)) >= 2:
            support.append(candidate)
    return support[:2]


def _category(statement: dict[str, str]) -> str:
    text, section = statement["text"], statement["section"]
    if _LEADERSHIP.search(text) or section == "Leadership":
        return "leadership"
    if _ACHIEVEMENT.search(text) or section == "Achievements":
        return "achievement"
    if _QUANTIFIED.search(text):
        return "quantified_impact"
    if section == "Projects":
        return "project"
    return "experience"


def _is_significant(statement: dict[str, str]) -> bool:
    text, section = statement["text"], statement["section"]
    signal = bool(_ACTION.search(text) or _LEADERSHIP.search(text) or _ACHIEVEMENT.search(text) or _QUANTIFIED.search(text))
    return signal and (section in _TARGET_SECTIONS or bool(_LEADERSHIP.search(text) or _ACHIEVEMENT.search(text) or _QUANTIFIED.search(text)))


def _linked_proofs(claim: str, proofs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    claim_tokens = _meaningful_tokens(claim)
    linked = []
    for proof in proofs:
        related = " ".join(str(proof.get(key) or "") for key in ("related_skill_claim", "related_project"))
        related_tokens = _meaningful_tokens(related)
        if related_tokens and (related_tokens <= claim_tokens or len(related_tokens & claim_tokens) >= 2):
            linked.append(proof)
    return linked


def _deterministic_question(category: str, claim: str) -> str:
    subject = _compact(claim.rstrip("."), 120)
    if category == "leadership":
        return f"What was your individual responsibility, the team context, and the observable outcome for: “{subject}”?"
    if category == "quantified_impact":
        return f"How was this result measured, over what period, and what work did you personally contribute to: “{subject}”?"
    if category == "achievement":
        return f"What organization, criteria, date, or result can clarify this achievement: “{subject}”?"
    if category == "skill":
        return f"Which project or experience demonstrates how you used {subject}, and what did you produce?"
    return f"What specific task, individual contribution, and observable result support: “{subject}”?"


def _classify_claim(
    claim: str,
    category: str,
    segments: list[dict[str, str]],
    neighbor_support: list[str],
    linked: list[dict[str, Any]],
    inconsistent: bool,
) -> tuple[str, str, str | None]:
    text = segments[0]["text"] if segments else claim
    has_action = bool(_ACTION.search(text))
    has_measure = bool(_QUANTIFIED.search(text))
    has_outcome = bool(_OUTCOME.search(text))
    has_scope = bool(_SCOPE.search(text))
    enough_context = len(_meaningful_tokens(text)) >= 8

    if inconsistent:
        return (
            "Needs clarification",
            "This claim appears in both supported and missing-evidence signals on the saved Trust Card.",
            "The saved analysis contains conflicting support signals that require manual clarification.",
        )
    if linked:
        return (
            "Evidence supported",
            f"{len(linked)} student-supplied Proof Vault entr{'y' if len(linked) == 1 else 'ies'} link{'s' if len(linked) == 1 else ''} to this claim. RefAI has not independently verified the external content.",
            None,
        )
    strong_measured_outcome = has_measure and has_outcome and len(_meaningful_tokens(text)) >= 5
    if segments and has_action and (strong_measured_outcome or (enough_context and (has_outcome or (has_measure and has_scope) or bool(neighbor_support)))):
        return (
            "Evidence supported",
            "The resume provides a concrete action plus observable scope, outcome, or corroborating context for this claim.",
            None,
        )
    if category in {"leadership", "quantified_impact"} and (has_measure or _LEADERSHIP.search(text)) and not (has_outcome or has_scope or neighbor_support):
        return (
            "Needs clarification",
            "This is a meaningful self-declared claim, but the resume does not state enough scope, individual contribution, measurement context, or outcome to evaluate its support.",
            "Add the specific project or organization, your individual responsibility, how the figure was measured, and the observable outcome.",
        )
    if segments and has_action:
        return (
            "Partially supported",
            "The resume states an action or responsibility, but the saved context does not fully establish its scope or outcome.",
            "Add the individual contribution, implementation context, and an observable result where truthful and available.",
        )
    if segments:
        return (
            "Self-declared",
            "The statement appears in the resume but is not connected to concrete implementation, responsibility, outcome, or linked Proof Vault evidence.",
            "Connect this statement to a specific project, experience, responsibility, or result.",
        )
    return (
        "Needs clarification",
        "The saved Trust Card references this claim, but no exact supporting resume statement is available.",
        "Identify the resume section and concrete experience that demonstrates this claim.",
    )


def build_claim_verifications(
    trust_card_payload: dict[str, Any],
    resume_text: str,
    proofs: list[dict[str, Any]],
    interpretation_provider: ClaimInterpreter = generate_claim_clarifications,
) -> dict[str, Any]:
    """Extract and classify resume claims without changing any score or alleging dishonesty."""
    statements = _resume_statements(resume_text)
    matched = [str(item).strip() for item in trust_card_payload.get("matchedSkills") or [] if str(item).strip()]
    missing = {
        _normalize(str(item.get("requirement") if isinstance(item, dict) else item))
        for item in (trust_card_payload.get("missingRequirements") or trust_card_payload.get("missingSkills") or [])
    }
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    for index, statement in enumerate(statements):
        if not _is_significant(statement):
            continue
        normalized = _normalize(statement["text"])
        if normalized in seen:
            continue
        seen.add(normalized)
        candidates.append({
            "claim": statement["text"],
            "category": _category(statement),
            "section": statement["section"],
            "segments": [statement],
            "neighbors": _supporting_neighbors(statements, index, statement["text"]),
        })

    proof_claims = [str(item.get("related_skill_claim") or "").strip() for item in proofs]
    for claim in [*matched, *proof_claims]:
        normalized = _normalize(claim)
        if not claim or normalized in seen:
            continue
        seen.add(normalized)
        segments = _resume_segments(statements, claim)
        candidates.append({
            "claim": claim,
            "category": "skill",
            "section": segments[0]["section"] if segments else None,
            "segments": segments,
            "neighbors": [],
        })

    results: list[dict[str, Any]] = []
    normalized_matched = {_normalize(item) for item in matched}
    for candidate in candidates[:30]:
        claim = candidate["claim"]
        normalized = _normalize(claim)
        segments = candidate["segments"]
        neighbors = candidate["neighbors"]
        linked = _linked_proofs(claim, proofs)
        inconsistent = normalized in missing and (normalized in normalized_matched or bool(segments))
        status, reason, missing_support = _classify_claim(
            claim, candidate["category"], segments, neighbors, linked, inconsistent,
        )
        supporting = []
        if status in {"Evidence supported", "Partially supported"}:
            supporting = [item["text"] for item in segments[:2]] + neighbors
        context_parts = [item["text"] for item in segments[:1]] + neighbors
        question = None if status == "Evidence supported" else _deterministic_question(candidate["category"], claim)
        claim_id = _claim_id(str(candidate["section"] or "Resume"), claim)
        results.append({
            "id": claim_id,
            "claim": claim,
            "category": candidate["category"],
            "status": status,
            "reason": reason,
            "resumeEvidence": [item["text"] for item in segments[:2]],
            "supportingEvidenceSnippets": list(dict.fromkeys(supporting))[:4],
            "resumeSection": candidate["section"],
            "resumeContext": _compact(" ".join(context_parts), 700) if context_parts else None,
            "missingSupport": missing_support,
            "suggestedClarificationQuestion": question,
            "proofEvidence": [{
                "id": str(item["id"]), "title": item["title"],
                "proofType": item["proof_type"], "urlOrReference": item["url_or_reference"],
            } for item in linked],
        })

    actionable = [
        {"id": item["id"], "claim": item["claim"], "missingSupport": item["missingSupport"] or item["reason"]}
        for item in results if item["status"] != "Evidence supported"
    ]
    interpretation_source = "deterministic"
    if actionable:
        try:
            ai_questions = interpretation_provider(actionable)
            for item in results:
                if item["id"] in ai_questions:
                    item["suggestedClarificationQuestion"] = ai_questions[item["id"]]
            interpretation_source = "groq_assisted"
        except (AIServiceUnavailable, ValueError, TypeError, KeyError):
            interpretation_source = "deterministic_fallback"

    return {
        "statusVersion": STATUS_VERSION,
        "claims": results,
        "interpretationSource": interpretation_source,
        "limitation": (
            "Statuses describe support visible in student-provided resume and Proof Vault records. "
            "They do not make misconduct judgments, independently verify external evidence, or prove that a claim is accurate. "
            "Embedded resume instructions are treated as untrusted text and are never followed."
        ),
    }
