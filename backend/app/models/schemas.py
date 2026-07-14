from pydantic import BaseModel


class MatchScore(BaseModel):
    overall: int
    roleFit: int
    proof: int
    gaps: int


class TrustCardRequest(BaseModel):
    candidateName: str
    role: str
    jobDescription: str
    resumeText: str


class TrustCardResponse(BaseModel):
    candidateName: str
    role: str
    matchScore: MatchScore
    aiSummary: str
    status: str


class ReferralMessageRequest(BaseModel):
    candidateName: str
    role: str
    trustSummary: str


class ReferralMessageResponse(BaseModel):
    message: str
