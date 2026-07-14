from groq import Groq

from app.core.config import settings

client = Groq(api_key=settings.groq_api_key)

DEFAULT_MODEL = "llama-3.3-70b-versatile"


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
under 20 seconds: strongest evidence of fit, one notable gap, and a
recommendation (refer / refer with reservations / not yet)."""

    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=300,
    )
    return response.choices[0].message.content


def generate_referral_message(candidate_name: str, role: str, trust_summary: str) -> str:
    prompt = f"""Write a short, respectful referral request message from
{candidate_name} to an employee, for the role "{role}". Base it on this
fit summary: {trust_summary}. Keep it under 120 words, no fluff."""

    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        max_tokens=200,
    )
    return response.choices[0].message.content
