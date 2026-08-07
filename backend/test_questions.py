from app.services.groq_client import generate_interview_questions

result = generate_interview_questions(
    missing_skills=["React", "SQL"],
    gap_analysis="Candidate has strong Python experience but no evidence of frontend frameworks or database work."
)

for q in result:
    print(q)
