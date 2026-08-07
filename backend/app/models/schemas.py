from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class MatchScore(BaseModel):
    overall: int
    roleFit: int
    proof: int
    gaps: int


class MatchScoreRequest(BaseModel):
    resumeText: str = Field(min_length=1, max_length=200_000)
    jobDescription: str = Field(default="", max_length=50_000)
    resumeId: str | None = None
    fileName: str | None = None
    chunkCount: int | None = Field(default=None, ge=1)
    storagePath: str | None = None
    storageStatus: str | None = None
    indexed: bool | None = None
    uploadProcessingTimeMs: int | None = Field(default=None, ge=0)
    targetRole: str | None = Field(default=None, max_length=200)
    targetCompany: str | None = Field(default=None, max_length=200)
    @field_validator("jobDescription", mode="before")
    @classmethod
    def trim_job_description(cls, value: str | None) -> str:
        if value is None:
            return ""
        return value.strip() if isinstance(value, str) else value

    @field_validator("jobDescription")
    @classmethod
    def validate_job_description_content(cls, value: str) -> str:
        if not value:
            return value
        if len(value) < 80:
            raise ValueError("Paste a fuller job description or leave the field empty.")
        if len(value.split()) < 12:
            raise ValueError("Paste a fuller job description or leave the field empty.")
        return value


class ResumeUploadResponse(BaseModel):
    resumeId: str
    fileName: str
    chunkCount: int
    preview: str
    extractionStatus: Literal["complete"]
    analysisStatus: Literal["pending"]
    storagePath: str | None
    storageStatus: str
    indexed: bool
    processingTimeMs: int


class ActionPlanItem(BaseModel):
    requirement: str
    category: str
    priority: Literal["critical", "important", "optional"]
    whyItMatters: str
    practicalAction: str
    evidenceSuggestion: str
    estimatedEffort: str
    nextStep: str


class ExplainedInsight(BaseModel):
    title: str
    description: str


class JobDescriptionClassification(BaseModel):
    requiredSkills: list[str] = Field(default_factory=list)
    preferredSkills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    experienceExpectations: list[str] = Field(default_factory=list)
    educationOrCertificationExpectations: list[str] = Field(default_factory=list)


class AnalysisReliability(BaseModel):
    label: Literal["High reliability", "Medium reliability", "Low reliability"]
    basis: str
    limitations: str


class StudentEducation(BaseModel):
    college: str | None = None
    degree: str | None = None
    branch: str | None = None
    graduationYear: str | int | None = None


class StudentEducationUpdate(BaseModel):
    college: str | None = Field(default=None, max_length=120)
    degree: str | None = Field(default=None, max_length=100)
    branch: str | None = Field(default=None, max_length=100)
    graduationYear: str | int | None = None


class StudentProfile(StudentEducation):
    preferredRole: str | None = None
    preferredCompany: str | None = None
    skills: list[str] = Field(default_factory=list)
    bio: str | None = None
    linkedinUrl: str | None = None
    githubUrl: str | None = None
    portfolioUrl: str | None = None


class StudentProfileUpdate(StudentEducationUpdate):
    preferredRole: str | None = Field(default=None, max_length=100)
    preferredCompany: str | None = Field(default=None, max_length=120)
    skills: list[str] = Field(default_factory=list, max_length=20)
    bio: str | None = Field(default=None, max_length=500)
    linkedinUrl: str | None = Field(default=None, max_length=300)
    githubUrl: str | None = Field(default=None, max_length=300)
    portfolioUrl: str | None = Field(default=None, max_length=300)


class MatchAnalysisResponse(MatchScore):
    analysisStatus: Literal["complete"]
    matchedSkills: list[str]
    missingSkills: list[str]
    missingRequirements: list[ActionPlanItem]
    actionPlan: list[ActionPlanItem] = Field(max_length=5)
    strengths: list[str]
    weaknesses: list[str]
    evidence: list[str]
    resumeSectionsUsed: list[str]
    readinessSummary: str
    learningRecommendations: list[str]
    confidence: int = Field(ge=0, le=100)
    analysisReliability: AnalysisReliability | None = None
    scoreReasons: list[str]
    atsGuidance: list[ExplainedInsight]
    interviewReadiness: ExplainedInsight
    processingTimeMs: int
    analysisId: UUID | None = None
    jobDescriptionClassification: JobDescriptionClassification = Field(default_factory=JobDescriptionClassification)
    usedGeneralRoleExpectations: bool = False


class TrustCardRequest(BaseModel):
    analysisId: UUID | None = None
    candidateName: str | None = None
    role: str | None = None
    jobDescription: str | None = None
    resumeText: str | None = None
    forceRegenerate: bool = False


class PersistedAnalysisSessionResponse(BaseModel):
    analysisId: UUID
    upload: ResumeUploadResponse
    matchScore: MatchScore
    analysis: MatchAnalysisResponse
    trustCard: "TrustCardResponse | None" = None
    jobDescription: str
    role: str
    company: str
    jobDescriptionClassification: JobDescriptionClassification = Field(default_factory=JobDescriptionClassification)
    usedGeneralRoleExpectations: bool = False
    analyzedAt: datetime
    processingTimeMs: int


class ImprovementSuggestion(BaseModel):
    componentKey: str
    affectedComponent: str
    missingEvidence: list[str]
    recommendedAction: str
    maximumPotentialPoints: int = Field(ge=0, le=100)
    limitation: str


class ImprovementComponentDelta(BaseModel):
    componentKey: str
    component: str
    previousScore: int = Field(ge=0)
    currentScore: int = Field(ge=0)
    delta: int
    evidenceCausingChange: list[str] = Field(default_factory=list)


class ImprovementComparison(BaseModel):
    previousScore: int = Field(ge=0, le=100)
    currentScore: int = Field(ge=0, le=100)
    delta: int
    componentDeltas: list[ImprovementComponentDelta]
    scoreVersion: str


class ImprovementSimulatorResponse(BaseModel):
    simulatorVersion: str
    scoreVersion: str
    currentScore: int = Field(ge=0, le=100)
    maximumScore: Literal[100] = 100
    suggestions: list[ImprovementSuggestion]
    totalMaximumPotentialPoints: int = Field(ge=0, le=100)
    comparison: ImprovementComparison | None = None
    limitations: list[str]


class EmployeeReliabilityMetric(BaseModel):
    key: Literal["response_consistency", "referral_completion", "profile_verification", "decision_transparency", "platform_activity"]
    label: str
    score: int = Field(ge=0)
    maximumScore: int = Field(gt=0)
    basis: str
    evidence: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class EmployeeReliabilityCard(BaseModel):
    label: Literal["Excellent", "Strong", "Verified", "Building history"]
    score: int = Field(ge=0, le=100)
    maximumScore: Literal[100] = 100
    isProvisional: bool
    averageResponseHours: int | None = Field(default=None, ge=0)
    requestsReviewed: int = Field(ge=0)
    completedReferrals: int = Field(ge=0)
    metrics: list[EmployeeReliabilityMetric] = Field(min_length=5, max_length=5)
    limitations: list[str] = Field(default_factory=list)


class EmployeeReliabilityCounts(BaseModel):
    meaningfulResponses: int = Field(ge=0)
    completedReferrals: int = Field(ge=0)
    recentMeaningfulResponses: int = Field(ge=0)
    overdueUnansweredRequests: int = Field(ge=0)


class EmployeeReliabilityBadge(BaseModel):
    badgeType: Literal["new_referrer", "verified_referrer", "reliable_referrer", "developing_referrer"]
    label: Literal["New Referrer", "Verified Referrer", "Reliable Referrer", "Developing Referrer"]
    reliabilityLevel: Literal["Excellent", "Strong", "Verified", "Building history"]
    basis: str
    relevantCounts: EmployeeReliabilityCounts
    lastCalculatedAt: datetime
    limitations: list[str] = Field(default_factory=list)


class EmployeeDirectoryItem(BaseModel):
    id: UUID
    name: str
    photoUrl: str | None = None
    company: str | None = None
    designation: str | None = None
    department: str | None = None
    yearsExperience: int | None = Field(default=None, ge=0, le=60)
    verifiedEmployee: bool = False
    linkedinUrl: str | None = None
    companyProfileUrl: str | None = None
    portfolioUrl: str | None = None
    supportedCompanies: list[str] = Field(default_factory=list)
    supportedRoles: list[str] = Field(default_factory=list)
    supportedDepartments: list[str] = Field(default_factory=list)
    acceptsFreshers: bool = True
    minimumEvidenceExpectations: list[str] = Field(default_factory=list)
    preferredCandidateLevels: list[str] = Field(default_factory=list)
    preferredMessageLength: Literal["concise", "standard", "detailed"] = "concise"
    referralGuidelines: str | None = None
    referralCategories: list[str] = Field(default_factory=list)
    aiApplyOptIn: bool = True
    acceptingRequests: bool = False
    activeRequestCount: int = Field(default=0, ge=0)
    maxActiveRequests: int = Field(default=5, ge=0, le=50)
    reliabilityBadge: EmployeeReliabilityBadge


class EmployeeProfessionalProfile(BaseModel):
    profileId: UUID
    company: str | None = None
    designation: str | None = None
    department: str | None = None
    yearsExperience: int | None = Field(default=None, ge=0, le=60)
    verifiedEmployee: bool = False
    linkedinUrl: str | None = None
    companyProfileUrl: str | None = None
    portfolioUrl: str | None = None
    supportedCompanies: list[str] = Field(default_factory=list)
    supportedRoles: list[str] = Field(default_factory=list)
    supportedDepartments: list[str] = Field(default_factory=list)
    acceptsFreshers: bool = True
    minimumEvidenceExpectations: list[str] = Field(default_factory=list)
    maxActiveRequests: int = Field(default=5, ge=0, le=50)
    availabilityStatus: Literal["accepting", "paused", "unavailable"] = "accepting"
    preferredCandidateLevels: list[str] = Field(default_factory=lambda: ["student", "fresher"])
    preferredMessageLength: Literal["concise", "standard", "detailed"] = "concise"
    referralGuidelines: str | None = None
    declineReasonCodes: list[str] = Field(default_factory=list)
    referralCategories: list[str] = Field(default_factory=list)
    aiApplyOptIn: bool = True
    averageResponseTimeValue: float | None = Field(default=None, ge=0)
    averageResponseTimeUnit: Literal["hours"] = "hours"
    respondedRequestCount: int = Field(default=0, ge=0)
    responseTimeAvailable: bool = False
    reliabilityBadge: EmployeeReliabilityBadge


class EmployeeProfessionalProfileUpdate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    designation: str | None = Field(default=None, max_length=200)
    department: str | None = Field(default=None, max_length=120)
    yearsExperience: int | None = Field(default=None, ge=0, le=60)
    linkedinUrl: str | None = Field(default=None, max_length=500)
    companyProfileUrl: str | None = Field(default=None, max_length=500)
    portfolioUrl: str | None = Field(default=None, max_length=500)
    supportedCompanies: list[str] = Field(default_factory=list, max_length=20)
    supportedRoles: list[str] = Field(default_factory=list, max_length=20)
    supportedDepartments: list[str] = Field(default_factory=list, max_length=20)
    acceptsFreshers: bool = True
    minimumEvidenceExpectations: list[Literal[
        "resume", "trust_card", "project_evidence", "quantified_outcomes",
        "education_details", "portfolio_links"
    ]] = Field(default_factory=list)
    maxActiveRequests: int = Field(default=5, ge=0, le=50)
    availabilityStatus: Literal["accepting", "paused", "unavailable"] = "accepting"
    preferredCandidateLevels: list[Literal["student", "fresher", "entry_level", "experienced"]] = Field(default_factory=lambda: ["student", "fresher"])
    preferredMessageLength: Literal["concise", "standard", "detailed"] = "concise"
    referralGuidelines: str | None = Field(default=None, max_length=2000)
    declineReasonCodes: list[Literal[
        "insufficient_evidence", "role_mismatch", "capacity_unavailable",
        "profile_incomplete", "experience_mismatch", "unsupported_category", "other"
    ]] = Field(default_factory=list)
    referralCategories: list[Literal[
        "internship", "full_time", "apprenticeship", "graduate_program",
        "campus_hiring", "contract"
    ]] = Field(default_factory=list)
    aiApplyOptIn: bool = True

    @field_validator("company", mode="before")
    @classmethod
    def normalize_company(cls, value: object) -> object:
        if isinstance(value, str):
            return " ".join(value.split())
        return value

    @field_validator("supportedCompanies", "supportedRoles", "supportedDepartments")
    @classmethod
    def normalize_filter_values(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            item = value.strip()
            if not item:
                continue
            if len(item) > 100:
                raise ValueError("Preference entries must be 100 characters or fewer.")
            if item.casefold() not in {existing.casefold() for existing in normalized}:
                normalized.append(item)
        return normalized

    @field_validator("linkedinUrl", "companyProfileUrl", "portfolioUrl")
    @classmethod
    def validate_professional_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip()
        if not normalized.lower().startswith(("https://", "http://")):
            raise ValueError("Professional links must start with http:// or https://.")
        return normalized


class TrustScoreEvidenceItem(BaseModel):
    id: str = Field(min_length=4, max_length=64)
    status: Literal[
        "Verified evidence", "Resume supported", "Self-declared",
        "Needs clarification", "Missing evidence",
    ]
    factLabel: str = Field(min_length=1, max_length=180)
    snippet: str | None = Field(default=None, max_length=240)
    resumeSection: str | None = Field(default=None, max_length=80)
    whyItAffectsScore: str = Field(min_length=1, max_length=500)
    sourceType: Literal["resume", "derived", "missing"]


class TrustScoreFactor(BaseModel):
    key: str
    label: str
    weight: int
    score: int = Field(ge=0, le=100)
    maximumScore: int | None = Field(default=None, ge=0, le=100)
    basisPercentage: int | None = Field(default=None, ge=0, le=100)
    contribution: float
    reason: str
    details: dict[str, object] = Field(default_factory=dict)
    evidenceItems: list[TrustScoreEvidenceItem] = Field(default_factory=list, max_length=12)
    formulaOrBasis: str | None = None
    evidenceFound: list[str] = Field(default_factory=list)
    evidenceMissing: list[str] = Field(default_factory=list)
    improvementAction: str | None = None
    potentialImprovementPoints: int | None = Field(default=None, ge=0, le=100)
    limitation: str | None = None


class TrustCardResponse(BaseModel):
    id: UUID | None = None
    candidateName: str
    role: str
    overallMatch: int = Field(ge=0, le=100)
    roleFit: int = Field(ge=0, le=100)
    proofScore: int = Field(ge=0, le=100)
    gapScore: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    analysisReliability: AnalysisReliability | None = None
    trustScore: int = Field(ge=0, le=100)
    scoreVersion: str
    referralReadiness: Literal["Ready to request referral", "Improve before requesting", "Not ready yet"]
    recommendation: Literal["Ready for referral", "Review before referring", "Not ready yet"]
    strengths: list[str]
    weaknesses: list[str]
    missingSkills: list[str]
    missingRequirements: list[ActionPlanItem]
    actionPlan: list[ActionPlanItem] = Field(max_length=5)
    evidence: list[str]
    riskSignals: list[str]
    scoreFormula: str
    scoreBreakdown: list[TrustScoreFactor]
    scoreReasons: list[str]
    aiSummary: str
    education: StudentEducation = Field(default_factory=StudentEducation)
    inputKey: str | None = None
    jobDescriptionHash: str | None = None
    resumeContentHash: str | None = None
    schemaVersion: str | None = None
    generationVersion: str | None = None
    generatedAt: datetime | None = None
    narrativeSource: Literal["groq", "deterministic_fallback"] = "groq"
    generationLimitations: list[str] = Field(default_factory=list)


ReferralMessageTone = Literal[
    "professional_concise", "friendly", "alumni_connection",
    "first_time_outreach", "follow_up",
]
ReferralMessageAction = Literal[
    "generate", "regenerate", "shorter", "more_formal",
    "add_strongest_project", "remove_weak_claims",
]


class ReferralMessageRequest(BaseModel):
    employeeId: UUID
    trustCardId: UUID
    targetCompany: str = Field(min_length=1, max_length=200)
    targetRole: str = Field(min_length=1, max_length=200)
    jobDescription: str = Field(default="", max_length=100_000)
    tone: ReferralMessageTone = "professional_concise"
    action: ReferralMessageAction = "generate"
    currentMessage: str = Field(default="", max_length=1_000)
    referralRequestId: UUID | None = None


class ReferralMessageGroundingFact(BaseModel):
    id: str
    sourceType: Literal[
        "resume", "trust_card", "profile", "job_description",
        "employee_directory", "verified_shared_data", "referral_draft",
    ]
    value: str


class ReferralMessageResponse(BaseModel):
    message: str
    usedFacts: list[ReferralMessageGroundingFact] = Field(default_factory=list)
    omittedOrUnavailableFacts: list[str] = Field(default_factory=list)
    groundingLimitations: list[str] = Field(default_factory=list)
    usedFallback: bool = False
    wordCount: int = Field(ge=1, le=120)
    alumniConnectionAvailable: bool = False
    followUpAvailable: bool = False


class ReferralQualityRequest(BaseModel):
    employeeId: UUID
    trustCardId: UUID
    targetCompany: str = Field(min_length=1, max_length=200)
    targetRole: str = Field(min_length=1, max_length=200)
    jobDescription: str = Field(default="", max_length=100_000)
    studentMessage: str = Field(min_length=1, max_length=1_000)


class ReferralQualityCheck(BaseModel):
    key: Literal[
        "opportunity_accuracy", "evidence_grounding", "factual_integrity",
        "employee_preferences", "professional_clarity",
    ]
    label: str
    score: int = Field(ge=0)
    maximumScore: int = Field(gt=0)
    status: Literal["passed", "warning"]
    basis: str


class ReferralQualityResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    maximumScore: Literal[100] = 100
    label: Literal["Excellent", "Strong", "Needs review", "Weak"]
    scoreVersion: str
    passedChecks: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    blockingErrors: list[str] = Field(default_factory=list)
    recommendedEdits: list[str] = Field(default_factory=list)
    checks: list[ReferralQualityCheck] = Field(min_length=5, max_length=5)
    canSubmit: bool
    limitations: list[str] = Field(default_factory=list)


ReferralStatus = Literal[
    "draft", "submitted", "pending", "under_review", "more_info_requested",
    "approved", "referred", "declined", "withdrawn", "expired",
]
class ReferralCompatibilityComponent(BaseModel):
    key: Literal["role_alignment", "department_relevance", "employee_preferences", "candidate_readiness", "request_completeness"]
    label: str
    score: int = Field(ge=0)
    maximumScore: int = Field(gt=0)


class ReferralCompatibilityResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    maximumScore: Literal[100] = 100
    label: Literal["Strong fit", "Good fit", "Review fit", "Low fit"]
    scoreVersion: str
    positiveFactors: list[str] = Field(default_factory=list)
    missingOrConflictingFactors: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    suggestedImprovements: list[str] = Field(default_factory=list)
    components: list[ReferralCompatibilityComponent] = Field(min_length=5, max_length=5)


class ReferralCompatibilityRequest(BaseModel):
    employeeId: UUID
    trustCardId: UUID
    targetRole: str = Field(min_length=1, max_length=200)
    targetCompany: str = Field(min_length=1, max_length=200)
    jobDescription: str = Field(default="", max_length=100_000)
    studentMessage: str = Field(default="", max_length=1_000)


AIApplyTimeline = Literal["immediate", "within_30_days", "within_3_months", "exploring"]
AIApplyWorkMode = Literal["onsite", "hybrid", "remote", "flexible"]


class AIApplyGoalRequest(BaseModel):
    targetRole: str = Field(min_length=1, max_length=200)
    targetCompany: str = Field(min_length=1, max_length=200)
    preferredDepartment: str | None = Field(default=None, max_length=120)
    timeline: AIApplyTimeline | None = None
    location: str | None = Field(default=None, max_length=160)
    workMode: AIApplyWorkMode | None = None
    minimumCompatibility: int | None = Field(default=None, ge=0, le=100)
    numberOfMatches: int = Field(default=5, ge=1, le=10)
    idempotencyKey: str = Field(min_length=8, max_length=100)

    @field_validator("targetRole", "targetCompany", mode="before")
    @classmethod
    def normalize_required_goal_text(cls, value: object) -> object:
        return " ".join(value.split()) if isinstance(value, str) else value

    @field_validator("preferredDepartment", "location", mode="before")
    @classmethod
    def normalize_optional_goal_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = " ".join(value.split())
        return normalized or None


class AIApplyMatchReason(BaseModel):
    positiveFactors: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    semanticBasis: str
    limitations: list[str] = Field(default_factory=list)


class AIApplyExclusionReason(BaseModel):
    reason: str
    count: int = Field(ge=1)


class AIApplyEmployeeSnapshot(BaseModel):
    id: UUID
    name: str
    company: str | None = None
    designation: str | None = None
    department: str | None = None
    supportedRoles: list[str] = Field(default_factory=list)
    supportedDepartments: list[str] = Field(default_factory=list)
    availability: Literal["accepting"] = "accepting"


class AIApplyMatch(BaseModel):
    id: UUID
    rank: int = Field(ge=1, le=10)
    employee: AIApplyEmployeeSnapshot
    compatibility: ReferralCompatibilityResponse
    semanticSimilarity: float | None = Field(default=None, ge=0, le=100)
    rankingScore: float = Field(ge=0, le=100)
    relevanceSource: Literal["goal_context", "deterministic_fallback"]
    reason: AIApplyMatchReason
    referralRequestId: UUID | None = None


class AIApplyGoal(BaseModel):
    id: UUID
    analysisId: UUID
    trustCardId: UUID
    targetRole: str
    targetCompany: str
    preferredDepartment: str | None = None
    timeline: AIApplyTimeline | None = None
    location: str | None = None
    workMode: AIApplyWorkMode | None = None
    minimumCompatibility: int = Field(ge=0, le=100)
    numberOfMatches: int = Field(ge=1, le=10)
    createdAt: datetime


class AIApplyMatchRunResponse(BaseModel):
    id: UUID
    goal: AIApplyGoal
    matchVersion: str
    inputKey: str
    vectorStatus: Literal["available", "partial", "unavailable", "not_used"]
    eligibleEmployeeCount: int = Field(ge=0)
    excludedEmployeeCount: int = Field(ge=0)
    exclusionReasons: list[AIApplyExclusionReason] = Field(default_factory=list)
    matches: list[AIApplyMatch] = Field(default_factory=list, max_length=10)
    limitations: list[str] = Field(default_factory=list)
    createdAt: datetime


class AIApplyAllowanceResponse(BaseModel):
    minimumCompatibilityThreshold: int = Field(ge=0, le=100)
    weeklyCap: int = Field(ge=0)
    weeklyUsed: int = Field(ge=0)
    weeklyRemaining: int = Field(ge=0)
    creditBalance: int = Field(ge=0)
    available: bool


class AIApplySubmissionRequest(BaseModel):
    matchId: UUID
    studentMessage: str = Field(min_length=1, max_length=1_000)
    idempotencyKey: str = Field(min_length=8, max_length=100)

    @field_validator("studentMessage", mode="before")
    @classmethod
    def normalize_submission_message(cls, value: object) -> object:
        return " ".join(value.split()) if isinstance(value, str) else value


class AIApplySubmissionResponse(BaseModel):
    requestId: UUID
    matchId: UUID
    status: Literal["submitted"]
    chargedCredits: int = Field(ge=0)
    creditBalance: int = Field(ge=0)
    weeklyRemaining: int = Field(ge=0)
    compatibilityScore: int = Field(ge=0, le=100)
    compatibilityThreshold: int = Field(ge=0, le=100)
    idempotentReplay: bool = False


class CreateReferralRequest(BaseModel):
    studentId: UUID | None = None
    employeeId: UUID
    trustCardId: UUID
    targetRole: str = Field(min_length=1, max_length=200)
    targetCompany: str = Field(min_length=1, max_length=200)
    jobDescription: str = Field(default="", max_length=100_000)
    studentMessage: str = Field(min_length=1, max_length=1_000)


class ReferralRequestSummary(BaseModel):
    id: UUID
    studentId: UUID
    employeeId: UUID
    trustCardId: UUID
    targetRole: str
    targetCompany: str
    employeeCompanySnapshot: str | None = None
    compatibilityScore: int | None = Field(default=None, ge=0, le=100)
    compatibilityLabel: Literal["Strong fit", "Good fit", "Review fit", "Low fit"] | None = None
    status: ReferralStatus
    decisionReason: str | None = None
    decisionMessage: str | None = None
    decisionAt: datetime | None = None
    referralDate: date | None = None
    referralConfirmationNumber: str | None = None
    referralNoteToStudent: str | None = None
    referralSubmittedAt: datetime | None = None
    referralSubmittedBy: UUID | None = None
    createdAt: datetime
    updatedAt: datetime


class ReferralRequestDetail(ReferralRequestSummary):
    jobDescription: str
    studentMessage: str
    employeeNote: str | None = None
    decisionReason: str | None = None
    decisionMessage: str | None = None
    decisionAt: datetime | None = None
    compatibility: ReferralCompatibilityResponse | None = None


class EmployeeReferralQueueItem(ReferralRequestSummary):
    candidateId: UUID
    studentName: str | None = None
    college: str | None = None
    trustScore: int | None = Field(default=None, ge=0, le=100)
    overallMatch: int | None = Field(default=None, ge=0, le=100)
    resumeExists: bool
    trustCardExists: bool


class EmployeeCandidateProfile(BaseModel):
    studentId: UUID
    studentName: str | None = None
    college: str | None = None
    degree: str | None = None
    graduationYear: str | None = None
    profilePhotoUrl: str | None = None


class EmployeeAnalysisSummary(BaseModel):
    trustScore: int | None = Field(default=None, ge=0, le=100)
    overallMatch: int | None = Field(default=None, ge=0, le=100)
    roleFit: int | None = Field(default=None, ge=0, le=100)
    proofScore: int | None = Field(default=None, ge=0, le=100)
    gapScore: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
    analysisReliability: AnalysisReliability | None = None
    matchedSkills: list[str] | None = None
    missingRequirements: list[ActionPlanItem] | None = None
    strengths: list[str] | None = None
    evidence: list[str] | None = None
    readinessSummary: str | None = None


class EmployeeReferralRequestView(BaseModel):
    id: UUID
    status: ReferralStatus
    targetRole: str
    targetCompany: str
    employeeCompanySnapshot: str | None = None
    studentMessage: str
    employeeNote: str | None = None
    decisionReason: str | None = None
    decisionMessage: str | None = None
    decisionAt: datetime | None = None
    referralDate: date | None = None
    referralConfirmationNumber: str | None = None
    referralNoteToStudent: str | None = None
    referralSubmittedAt: datetime | None = None
    referralSubmittedBy: UUID | None = None
    compatibility: ReferralCompatibilityResponse | None = None
    createdAt: datetime
    updatedAt: datetime
    candidate: EmployeeCandidateProfile
    analysis: EmployeeAnalysisSummary | None = None
    resumeExists: bool
    trustCardExists: bool
    analysisExists: bool


class EmployeeCopilotStatement(BaseModel):
    text: str
    evidenceType: Literal[
        "demonstrated_evidence", "inferred_relevance",
        "missing_evidence", "manual_verification",
    ]
    factIds: list[str] = Field(default_factory=list)


class EmployeeReviewCopilotResponse(BaseModel):
    whyCandidateMayFit: list[EmployeeCopilotStatement] = Field(default_factory=list)
    evidenceBackedStrengths: list[EmployeeCopilotStatement] = Field(default_factory=list)
    concernsOrMissingEvidence: list[EmployeeCopilotStatement] = Field(default_factory=list)
    matchedCoreRequirementsCount: int = Field(ge=0)
    totalCoreRequirementsCount: int = Field(ge=0)
    pointsRequiringManualVerification: list[EmployeeCopilotStatement] = Field(default_factory=list)
    suggestedReviewPriority: Literal["Standard review", "Evidence gaps first", "Verify core evidence first"]
    usefulQuestions: list[str] = Field(default_factory=list)
    narrative: str
    hasJobDescription: bool
    usedFallback: bool
    scoreVersion: str
    groundingSources: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class EmployeeResumeAccess(BaseModel):
    requestId: UUID
    fileName: str
    signedUrl: str
    expiresIn: int


ProofType = Literal[
    "github_repository", "live_demo", "certification", "project_screenshot",
    "internship_letter_reference", "portfolio", "research_paper",
    "presentation", "competition_result",
]


class ProofEntryInput(BaseModel):
    trustCardId: UUID
    proofType: ProofType
    title: str = Field(min_length=1, max_length=200)
    urlOrReference: str = Field(min_length=1, max_length=1000)
    relatedProject: str | None = Field(default=None, max_length=200)
    relatedSkillClaim: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_metadata(self):
        self.title = self.title.strip()
        self.urlOrReference = self.urlOrReference.strip()
        self.relatedProject = self.relatedProject.strip() if self.relatedProject else None
        self.relatedSkillClaim = self.relatedSkillClaim.strip() if self.relatedSkillClaim else None
        self.description = self.description.strip() if self.description else None
        if not self.title or not self.urlOrReference:
            raise ValueError("Proof title and URL or reference are required")
        reference = self.urlOrReference
        if ":" in reference:
            scheme = reference.split(":", 1)[0].lower()
            if scheme not in {"http", "https"}:
                raise ValueError("Only http and https proof links are allowed")
            if not reference.lower().startswith(("http://", "https://")):
                raise ValueError("Enter a complete http or https URL")
        elif any(character in reference for character in "<>\r\n"):
            raise ValueError("Enter a safe proof reference")
        return self


class ProofEntryResponse(BaseModel):
    id: UUID
    ownerId: UUID
    trustCardId: UUID
    proofType: ProofType
    title: str
    urlOrReference: str
    relatedProject: str | None = None
    relatedSkillClaim: str | None = None
    description: str | None = None
    createdAt: datetime
    updatedAt: datetime


class ClaimProofEvidence(BaseModel):
    id: UUID
    title: str
    proofType: ProofType
    urlOrReference: str


class ClaimVerificationItem(BaseModel):
    id: str = Field(min_length=4, max_length=64)
    claim: str
    category: Literal["experience", "project", "achievement", "leadership", "quantified_impact", "skill"]
    status: Literal[
        "Evidence supported", "Partially supported", "Self-declared", "Needs clarification",
        # Accepted while older persisted/API fixtures are migrated by clients.
        "Verified evidence", "Resume supported",
    ]
    reason: str
    resumeEvidence: list[str] = Field(default_factory=list)
    supportingEvidenceSnippets: list[str] = Field(default_factory=list, max_length=4)
    resumeSection: str | None = Field(default=None, max_length=80)
    resumeContext: str | None = Field(default=None, max_length=700)
    missingSupport: str | None = Field(default=None, max_length=500)
    suggestedClarificationQuestion: str | None = Field(default=None, max_length=300)
    proofEvidence: list[ClaimProofEvidence] = Field(default_factory=list)


class ClaimVerificationResponse(BaseModel):
    statusVersion: str
    claims: list[ClaimVerificationItem] = Field(default_factory=list)
    interpretationSource: Literal["deterministic", "groq_assisted", "deterministic_fallback"] = "deterministic"
    limitation: str


class EmployeeTrustCardView(BaseModel):
    requestId: UUID
    trustCardId: UUID
    studentName: str | None = None
    targetRole: str
    targetCompany: str
    trustScore: int | None = Field(default=None, ge=0, le=100)
    scoreVersion: str | None = None
    overallMatch: int | None = Field(default=None, ge=0, le=100)
    roleFit: int | None = Field(default=None, ge=0, le=100)
    proofScore: int | None = Field(default=None, ge=0, le=100)
    gapScore: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
    analysisReliability: AnalysisReliability | None = None
    matchedSkills: list[str] | None = None
    missingRequirements: list[ActionPlanItem] | None = None
    strengths: list[str] | None = None
    evidence: list[str] | None = None
    readiness: str | None = None
    recommendation: str | None = None
    summary: str | None = None
    riskSignals: list[str] | None = None
    scoreFormula: str | None = None
    scoreBreakdown: list[TrustScoreFactor] | None = None
    generatedAt: datetime | None = None
    education: StudentEducation = Field(default_factory=StudentEducation)


class EmployeeDecisionUpdate(BaseModel):
    status: ReferralStatus
    reason: Literal[
        "suitable_profile", "strong_evidence", "relevant_role_alignment",
        "will_refer_externally", "additional_details_required_first",
        "role_mismatch", "insufficient_evidence", "not_accepting_referrals",
        "job_closed", "unable_to_verify_experience", "other",
        "clarification_required",
    ]
    note: str | None = Field(default=None, max_length=2_000)
    question: str | None = Field(default=None, max_length=1_000)

    @model_validator(mode="after")
    def validate_decision_reason(self):
        approve = {"suitable_profile", "strong_evidence", "relevant_role_alignment", "will_refer_externally", "additional_details_required_first"}
        decline = {"role_mismatch", "insufficient_evidence", "not_accepting_referrals", "job_closed", "unable_to_verify_experience", "other"}
        if self.status == "approved" and self.reason not in approve: raise ValueError("Select an approved referral reason")
        if self.status == "declined" and self.reason not in decline: raise ValueError("Select a decline reason")
        if self.status == "more_info_requested":
            if self.reason != "clarification_required": raise ValueError("More-information requests require a clarification reason")
            self.question = self.question.strip() if self.question else None
            if not self.question: raise ValueError("Write or draft a clarification question")
        if self.status not in {"approved", "declined", "more_info_requested"}: raise ValueError("Choose approve, decline, or request more information")
        self.note = self.note.strip() if self.note else None
        return self


class ReferralSubmissionUpdate(BaseModel):
    referralDate: date | None = None
    confirmationNumber: str | None = Field(default=None, max_length=100)
    noteToStudent: str | None = Field(default=None, max_length=1_000)

    @model_validator(mode="after")
    def validate_submission(self):
        if self.referralDate and self.referralDate > date.today():
            raise ValueError("Referral date cannot be in the future")
        self.confirmationNumber = self.confirmationNumber.strip() if self.confirmationNumber else None
        self.noteToStudent = self.noteToStudent.strip() if self.noteToStudent else None
        return self


class ClarificationDraftResponse(BaseModel):
    question: str
    missingEvidence: list[str]
    usedFallback: bool
    limitation: str


class ReferralStatusHistoryEntry(BaseModel):
    id: int
    referralRequestId: UUID
    previousStatus: ReferralStatus | None
    newStatus: ReferralStatus
    changedBy: UUID
    note: str | None = None
    decisionReason: str | None = None
    decisionMessage: str | None = None
    eventType: Literal["request_created", "status_changed", "employee_viewed"] = "status_changed"
    createdAt: datetime


NotificationEventType = Literal[
    "employee_viewed_request", "more_information_requested", "request_approved",
    "referral_submitted", "request_declined", "employee_stopped_accepting",
    "resume_reanalysis_completed",
]


class NotificationResponse(BaseModel):
    id: UUID
    eventType: NotificationEventType
    title: str
    body: str
    targetUrl: str
    referralRequestId: UUID | None = None
    analysisId: UUID | None = None
    readAt: datetime | None = None
    createdAt: datetime


class MarkAllNotificationsReadResponse(BaseModel):
    updated: int = Field(ge=0)
