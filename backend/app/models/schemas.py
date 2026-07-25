from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MatchScore(BaseModel):
    overall: int
    roleFit: int
    proof: int
    gaps: int


class MatchScoreRequest(BaseModel):
    resumeText: str = Field(min_length=1, max_length=200_000)
    jobDescription: str = Field(min_length=1, max_length=100_000)
    resumeId: str | None = None
    fileName: str | None = None
    chunkCount: int | None = Field(default=None, ge=1)
    storagePath: str | None = None
    storageStatus: str | None = None
    indexed: bool | None = None
    uploadProcessingTimeMs: int | None = Field(default=None, ge=0)
    targetRole: str | None = Field(default=None, max_length=200)
    targetCompany: str | None = Field(default=None, max_length=200)


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
    scoreReasons: list[str]
    atsGuidance: list[ExplainedInsight]
    interviewReadiness: ExplainedInsight
    processingTimeMs: int
    analysisId: UUID | None = None


class TrustCardRequest(BaseModel):
    analysisId: UUID | None = None
    candidateName: str | None = None
    role: str | None = None
    jobDescription: str | None = None
    resumeText: str | None = None


class PersistedAnalysisSessionResponse(BaseModel):
    analysisId: UUID
    upload: ResumeUploadResponse
    matchScore: MatchScore
    analysis: MatchAnalysisResponse
    trustCard: "TrustCardResponse | None" = None
    jobDescription: str
    role: str
    company: str
    analyzedAt: datetime
    processingTimeMs: int


class EmployeeDirectoryItem(BaseModel):
    id: UUID
    name: str
    company: str | None = None
    designation: str | None = None


class EmployeeProfessionalProfile(BaseModel):
    profileId: UUID
    company: str | None = None
    designation: str | None = None


class EmployeeProfessionalProfileUpdate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    designation: str | None = Field(default=None, max_length=200)


class TrustScoreFactor(BaseModel):
    key: str
    label: str
    weight: int
    score: int = Field(ge=0, le=100)
    contribution: float
    reason: str


class TrustCardResponse(BaseModel):
    id: UUID | None = None
    candidateName: str
    role: str
    overallMatch: int = Field(ge=0, le=100)
    roleFit: int = Field(ge=0, le=100)
    proofScore: int = Field(ge=0, le=100)
    gapScore: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    trustScore: int = Field(ge=0, le=100)
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


class ReferralMessageRequest(BaseModel):
    candidateName: str
    role: str
    trustSummary: str


class ReferralMessageResponse(BaseModel):
    message: str


ReferralStatus = Literal["pending", "under_review", "more_info_requested", "approved", "declined", "referred"]


class CreateReferralRequest(BaseModel):
    studentId: UUID | None = None
    employeeId: UUID
    trustCardId: UUID
    targetRole: str = Field(min_length=1, max_length=200)
    targetCompany: str = Field(min_length=1, max_length=200)
    jobDescription: str = Field(min_length=1, max_length=100_000)
    studentMessage: str = Field(min_length=1, max_length=1_000)


class ReferralRequestSummary(BaseModel):
    id: UUID
    studentId: UUID
    employeeId: UUID
    trustCardId: UUID
    targetRole: str
    targetCompany: str
    status: ReferralStatus
    createdAt: datetime
    updatedAt: datetime


class ReferralRequestDetail(ReferralRequestSummary):
    jobDescription: str
    studentMessage: str
    employeeNote: str | None = None


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
    overallMatch: int | None = Field(default=None, ge=0, le=100)
    roleFit: int | None = Field(default=None, ge=0, le=100)
    proofScore: int | None = Field(default=None, ge=0, le=100)
    gapScore: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
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
    studentMessage: str
    createdAt: datetime
    updatedAt: datetime
    candidate: EmployeeCandidateProfile
    analysis: EmployeeAnalysisSummary | None = None
    resumeExists: bool
    trustCardExists: bool
    analysisExists: bool


class EmployeeResumeAccess(BaseModel):
    requestId: UUID
    fileName: str
    signedUrl: str
    expiresIn: int


class EmployeeTrustCardView(BaseModel):
    requestId: UUID
    trustCardId: UUID
    studentName: str | None = None
    targetRole: str
    targetCompany: str
    trustScore: int | None = Field(default=None, ge=0, le=100)
    overallMatch: int | None = Field(default=None, ge=0, le=100)
    roleFit: int | None = Field(default=None, ge=0, le=100)
    proofScore: int | None = Field(default=None, ge=0, le=100)
    gapScore: int | None = Field(default=None, ge=0, le=100)
    confidence: int | None = Field(default=None, ge=0, le=100)
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
    note: str | None = Field(default=None, max_length=2_000)


class ReferralStatusHistoryEntry(BaseModel):
    id: int
    referralRequestId: UUID
    previousStatus: ReferralStatus | None
    newStatus: ReferralStatus
    changedBy: UUID
    note: str | None = None
    createdAt: datetime
