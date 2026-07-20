from groq import Groq

from app.core.config import settings

DEFAULT_MODEL = "llama-3.3-70b-versatile"


class AIServiceUnavailable(RuntimeError):
    pass


def _client() -> Groq:
    if not settings.groq_api_key.strip():
        raise AIServiceUnavailable("GROQ_API_KEY is not configured")
    return Groq(api_key=settings.groq_api_key)


def _completion_text(response) -> str:
    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as exc:
        raise AIServiceUnavailable("The AI service returned a malformed response") from exc
    if not isinstance(content, str) or not content.strip():
        raise AIServiceUnavailable("The AI service returned an empty response")
    return content.strip()


def generate_trust_summary(resume_text: str, job_description: str, match_score: dict) -> str:
    """Ask the LLM to write the human-readable Trust Card summary."""
    prompt = f"""You are helping an employee decide whether to refer a candidate.

Job description:
{job_description}

Candidate resume (extracted text):
{resume_text}

Computed match signals:
{match_score}

Write a concise, honest 3-4 sentence summary an employee can read in
under 20 seconds. Identify the strongest fit by citing one specific project,
skill, responsibility, or outcome from the resume and explain why it matters
for one explicit requirement in the job description. Identify one concrete
gap and explain what evidence should be reviewed next. Keep the summary neutral;
the deterministic Trust Card response provides referral readiness and the
employee recommendation separately. Do not use generic praise,
invent evidence, claim a hiring probability, or call the match score a Trust
Score."""

    response = _client().chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=300,
    )
    return _completion_text(response)


def generate_referral_message(candidate_name: str, role: str, trust_summary: str) -> str:
    prompt = f"""Write a short, evidence-based referral message from an employee
referring {candidate_name} for the role "{role}". Base it only on this reviewed
fit summary: {trust_summary}. Use employee referring language, identify any
important evidence gap as an interview check, and keep it under 120 words.
Do not claim a guarantee, verification, or hiring outcome."""

    response = _client().chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        max_tokens=200,
    )
    return _completion_text(response)
