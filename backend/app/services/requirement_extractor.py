import re
from dataclasses import dataclass
from typing import Literal

Priority = Literal["critical", "important", "optional"]

# These words may provide sentence context, but must never become requirements.
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "that", "the", "their", "them", "they", "this", "to", "we", "with", "you", "your",
}
GENERIC_VERBS = {"build", "create", "develop", "drive", "ensure", "help", "maintain", "manage", "support", "use", "work"}
GENERIC_ADJECTIVES = {"clean", "excellent", "good", "great", "high", "modern", "scalable", "strong"}
BUSINESS_FILLER = {"applications", "business", "environment", "functional", "impact", "products", "solutions", "systems", "team", "teams"}
BLOCKED_STANDALONE_TERMS = STOP_WORDS | GENERIC_VERBS | GENERIC_ADJECTIVES | BUSINESS_FILLER


@dataclass(frozen=True)
class RequirementSpec:
    canonical: str
    category: str
    aliases: tuple[str, ...]


CATALOG = (
    RequirementSpec("Python", "programming language", ("python",)),
    RequirementSpec("Java", "programming language", ("java",)),
    RequirementSpec("JavaScript", "programming language", ("javascript", "js")),
    RequirementSpec("TypeScript", "programming language", ("typescript", "ts")),
    RequirementSpec("C++", "programming language", ("c++",)),
    RequirementSpec("C#", "programming language", ("c#",)),
    RequirementSpec("Go", "programming language", ("golang", "go language")),
    RequirementSpec("React", "framework", ("react", "react.js")),
    RequirementSpec("Angular", "framework", ("angular",)),
    RequirementSpec("Vue", "framework", ("vue", "vue.js")),
    RequirementSpec("Next.js", "framework", ("next.js", "nextjs")),
    RequirementSpec("Node.js", "framework", ("node.js", "nodejs")),
    RequirementSpec("FastAPI", "framework", ("fastapi",)),
    RequirementSpec("Django", "framework", ("django",)),
    RequirementSpec("Flask", "framework", ("flask",)),
    RequirementSpec("Spring Boot", "framework", ("spring boot",)),
    RequirementSpec("SQL", "database", ("sql",)),
    RequirementSpec("PostgreSQL", "database", ("postgresql", "postgres")),
    RequirementSpec("MySQL", "database", ("mysql",)),
    RequirementSpec("MongoDB", "database", ("mongodb", "mongo db")),
    RequirementSpec("Redis", "database", ("redis",)),
    RequirementSpec("AWS", "cloud platform", ("aws", "amazon web services")),
    RequirementSpec("Azure", "cloud platform", ("azure",)),
    RequirementSpec("Google Cloud", "cloud platform", ("google cloud", "gcp")),
    RequirementSpec("Cloud deployment", "cloud platform", ("cloud deployment", "deploy to the cloud", "cloud infrastructure")),
    RequirementSpec("Git", "tool", ("git",)),
    RequirementSpec("Docker", "tool", ("docker", "containerization")),
    RequirementSpec("Kubernetes", "tool", ("kubernetes", "k8s")),
    RequirementSpec("Terraform", "tool", ("terraform", "infrastructure as code")),
    RequirementSpec("CI/CD", "tool", ("ci/cd", "continuous integration", "continuous delivery")),
    RequirementSpec("GitHub Actions", "tool", ("github actions",)),
    RequirementSpec("Jest", "testing technology", ("jest",)),
    RequirementSpec("Pytest", "testing technology", ("pytest",)),
    RequirementSpec("Cypress", "testing technology", ("cypress",)),
    RequirementSpec("Playwright", "testing technology", ("playwright",)),
    RequirementSpec("Unit testing", "testing technology", ("unit testing", "unit tests")),
    RequirementSpec("Integration testing", "testing technology", ("integration testing", "integration tests")),
    RequirementSpec("Test automation", "testing technology", ("test automation", "automated testing")),
    RequirementSpec("REST APIs", "software engineering practice", ("rest apis", "restful apis", "rest api")),
    RequirementSpec("System design", "software engineering practice", ("system design", "systems design")),
    RequirementSpec("Software design", "software engineering practice", ("software design",)),
    RequirementSpec("Data structures and algorithms", "software engineering practice", ("data structures and algorithms", "data structures & algorithms", "dsa")),
    RequirementSpec("Microservices", "software engineering practice", ("microservices", "microservice architecture")),
    RequirementSpec("Debugging and troubleshooting", "software engineering practice", ("debug and troubleshoot", "debugging and troubleshooting", "debugging", "troubleshooting")),
    RequirementSpec("Clean code", "software engineering practice", ("clean code", "code quality")),
    RequirementSpec("Code review", "software engineering practice", ("code review", "peer review")),
    RequirementSpec("Agile development", "software engineering practice", ("agile development", "agile", "scrum")),
    RequirementSpec("Cross-functional collaboration", "collaboration requirement", ("cross-functional teams", "cross functional teams", "cross-functional collaboration", "cross functional collaboration")),
    RequirementSpec("Team collaboration", "collaboration requirement", ("team collaboration", "collaborate with the team", "collaborate across teams")),
    RequirementSpec("Stakeholder communication", "collaboration requirement", ("stakeholder communication", "communicate with stakeholders")),
    RequirementSpec("Technical communication", "collaboration requirement", ("technical communication", "communicate engineering trade-offs")),
    RequirementSpec("Bachelor’s degree", "degree requirement", ("bachelor's degree", "bachelors degree", "bachelor degree", "b.tech", "btech")),
    RequirementSpec("Master’s degree", "degree requirement", ("master's degree", "masters degree", "master degree", "m.tech", "mtech")),
    RequirementSpec("AWS certification", "certification requirement", ("aws certification", "aws certified")),
)

PRIORITY_ORDER: dict[Priority, int] = {"critical": 0, "important": 1, "optional": 2}
PRIORITY_WEIGHT: dict[Priority, int] = {"critical": 3, "important": 2, "optional": 1}


def _normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("–", "-").replace("—", "-")).strip()


def _contains(text: str, alias: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])", text))


def _priority_for_context(context: str) -> Priority:
    if re.search(r"\b(preferred|nice to have|bonus|optional|ideally)\b", context):
        return "optional"
    if re.search(r"\b(must|required|minimum|essential|mandatory|strong proficiency|proficient)\b", context):
        return "critical"
    return "important"


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"[\n\r]+|(?<=[.!?;])\s+|[•●▪]", _normalized(text)) if part.strip()]


def extract_requirements(job_description: str) -> list[dict]:
    """Extract canonical, phrase-level requirements; never return generic tokens."""
    sentences = _sentences(job_description)
    found: dict[str, dict] = {}
    for spec in CATALOG:
        if spec.canonical.lower() in BLOCKED_STANDALONE_TERMS:
            continue
        matching_contexts = [sentence for sentence in sentences if any(_contains(sentence, alias) for alias in spec.aliases)]
        if not matching_contexts:
            continue
        priorities = [_priority_for_context(context) for context in matching_contexts]
        priority = min(priorities, key=lambda item: PRIORITY_ORDER[item])
        found[spec.canonical] = {
            "requirement": spec.canonical,
            "category": spec.category,
            "priority": priority,
            "aliases": list(spec.aliases),
        }

    experience_patterns = (
        r"(\d+)\+?\s*(?:-|to\s*\d+\s*)?years?\s+(?:of\s+)?(?:professional\s+|relevant\s+)?experience",
        r"minimum\s+(?:of\s+)?(\d+)\s+years?",
    )
    normalized = _normalized(job_description)
    for pattern in experience_patterns:
        for match in re.finditer(pattern, normalized):
            years = int(match.group(1))
            canonical = f"{years}+ years of experience"
            context = next((sentence for sentence in sentences if match.group(0) in sentence), match.group(0))
            found[canonical] = {"requirement": canonical, "category": "experience requirement", "priority": _priority_for_context(context), "aliases": [match.group(0)]}

    return sorted(found.values(), key=lambda item: (PRIORITY_ORDER[item["priority"]], item["category"], item["requirement"]))


def classify_job_description(job_description: str) -> dict[str, list[str]]:
    """Classify real JD content deterministically without generating scores."""
    requirements = extract_requirements(job_description)
    skill_categories = {
        "programming language", "framework", "database", "cloud platform", "tool",
        "testing technology", "software engineering practice", "collaboration requirement",
    }
    required_skills = [
        item["requirement"] for item in requirements
        if item["category"] in skill_categories and item["priority"] != "optional"
    ]
    preferred_skills = [
        item["requirement"] for item in requirements
        if item["category"] in skill_categories and item["priority"] == "optional"
    ]
    experience = [
        item["requirement"] for item in requirements
        if item["category"] == "experience requirement"
    ]
    education = [
        item["requirement"] for item in requirements
        if item["category"] in {"degree requirement", "certification requirement"}
    ]
    responsibility_markers = re.compile(
        r"\b(responsib|design|develop|build|implement|maintain|manage|lead|collaborat|"
        r"deliver|own|create|review|support|troubleshoot|analy[sz]e|coordinate)\w*\b"
    )
    responsibilities: list[str] = []
    for sentence in _sentences(job_description):
        if responsibility_markers.search(sentence) and len(sentence.split()) >= 4:
            cleaned = sentence[0].upper() + sentence[1:] if sentence else sentence
            if cleaned not in responsibilities:
                responsibilities.append(cleaned)
        if len(responsibilities) == 12:
            break
    return {
        "requiredSkills": required_skills,
        "preferredSkills": preferred_skills,
        "responsibilities": responsibilities,
        "experienceExpectations": experience,
        "educationOrCertificationExpectations": education,
    }


def general_expectations_for_role(target_role: str | None) -> str:
    """Build deterministic, non-employer-specific expectations when no JD is supplied."""
    role = (target_role or "entry-level professional").strip()
    normalized_role = role.lower()
    role_requirements: list[str]
    if any(term in normalized_role for term in ("front end", "frontend", "ui", "react")):
        role_requirements = ["JavaScript", "TypeScript", "React", "unit testing"]
    elif any(term in normalized_role for term in ("back end", "backend", "api", "server")):
        role_requirements = ["REST APIs", "SQL", "unit testing", "debugging and troubleshooting"]
    elif any(term in normalized_role for term in ("data", "analytics", "machine learning", "ml")):
        role_requirements = ["Python", "SQL", "data structures and algorithms", "technical communication"]
    elif any(term in normalized_role for term in ("cloud", "devops", "platform", "site reliability", "sre")):
        role_requirements = ["Git", "CI/CD", "cloud deployment", "debugging and troubleshooting"]
    else:
        role_requirements = ["Git", "unit testing", "debugging and troubleshooting", "team collaboration"]
    requirements = ", ".join(role_requirements)
    return (
        f"General expectations for an early-career {role} role include {requirements}. "
        "Candidates should build and maintain reliable work, explain project decisions, "
        "collaborate with a team, review their output, and provide truthful evidence of relevant skills."
    )


def requirement_occurrences(resume_text: str, requirement: dict) -> int:
    normalized = _normalized(resume_text)
    if requirement["category"] == "experience requirement":
        required_years = int(requirement["requirement"].split("+")[0])
        years = [int(value) for value in re.findall(r"(\d+)\+?\s+years?", normalized)]
        return 2 if years and max(years) >= required_years else 0
    return max((_occurrence_count(normalized, alias) for alias in requirement["aliases"]), default=0)


def _occurrence_count(text: str, alias: str) -> int:
    return len(re.findall(rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])", text))


def build_gap(requirement: dict) -> dict:
    label = requirement["requirement"]
    category = requirement["category"]
    priority: Priority = requirement["priority"]
    article = "an" if priority == "optional" else "a"
    why = f"{label} is {article} {priority} {category} in the target job description and no supporting resume evidence was found."
    actions = {
        "programming language": f"Complete one focused exercise or feature using {label}.",
        "framework": f"Build one small production-style feature with {label}.",
        "database": f"Design and query a small data model using {label}.",
        "cloud platform": f"Deploy an existing project using {label} and record the deployment steps.",
        "tool": f"Add {label} to an existing project workflow and document how it is used.",
        "testing technology": f"Add a focused automated test suite using {label}.",
        "software engineering practice": f"Apply {label.lower()} to one existing project and document the engineering decisions.",
        "collaboration requirement": f"Write a concise STAR example demonstrating {label}.",
        "experience requirement": "Document the closest relevant internships, projects, and sustained ownership honestly.",
        "degree requirement": f"Add the exact degree details to Education if you meet the {label} requirement.",
        "certification requirement": f"Review the official {label} objectives and decide whether certification is justified for this role.",
    }
    evidence = {
        "collaboration requirement": "Add a resume bullet naming the team context, your contribution, and a measurable outcome.",
        "experience requirement": "Create an evidence inventory showing dates, responsibilities, and outcomes without inflating tenure.",
        "degree requirement": "Use a clear Education entry with degree, institution, specialization, and graduation year.",
        "certification requirement": "Link the credential or show a completed project covering the same practical competencies.",
    }.get(category, f"Add a project bullet that names {label}, explains what you built, and quantifies the result.")
    effort = "4–6 hours" if priority == "critical" else "2–4 hours" if priority == "important" else "1–2 hours"
    return {
        "requirement": label,
        "category": category,
        "priority": priority,
        "whyItMatters": why,
        "practicalAction": actions.get(category, f"Create evidence that demonstrates {label}."),
        "evidenceSuggestion": evidence,
        "estimatedEffort": effort,
        "nextStep": "Complete the action, add truthful evidence to the resume, then rerun the analysis.",
    }
