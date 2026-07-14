from app.services.groq_client import generate_trust_summary


def compute_match_score(resume_text: str, job_description: str) -> dict:
    """
    Placeholder scoring logic. Replace with real embedding-similarity +
    keyword-overlap scoring using the ChromaDB collection in
    vector_store.py once you have real resume/job data to tune against.
    """
    resume_words = set(resume_text.lower().split())
    jd_words = set(job_description.lower().split())
    overlap = len(resume_words & jd_words)
    role_fit = min(100, overlap * 2)
    return {
        "overall": role_fit,
        "roleFit": role_fit,
        "proof": min(100, role_fit - 10) if role_fit > 10 else 0,
        "gaps": max(0, 100 - role_fit),
    }


def build_trust_card(candidate_name: str, role: str, resume_text: str, job_description: str) -> dict:
    match_score = compute_match_score(resume_text, job_description)
    summary = generate_trust_summary(resume_text, job_description, match_score)
    return {
        "candidateName": candidate_name,
        "role": role,
        "matchScore": match_score,
        "aiSummary": summary,
        "status": "ready" if match_score["overall"] >= 60 else "draft",
    }
