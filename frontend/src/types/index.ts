export interface MatchScore {
  overall: number
  roleFit: number
  proof: number
  gaps: number
}

export interface ActionPlanItem {
  requirement: string
  category: string
  priority: 'critical' | 'important' | 'optional'
  whyItMatters: string
  practicalAction: string
  evidenceSuggestion: string
  estimatedEffort: string
  nextStep: string
}

export interface ExplainedInsight {
  title: string
  description: string
}

export interface ResumeAnalysisResult extends MatchScore {
  analysisId?: string
  analysisStatus: 'complete'
  matchedSkills: string[]
  missingSkills: string[]
  missingRequirements: ActionPlanItem[]
  actionPlan: ActionPlanItem[]
  strengths: string[]
  weaknesses: string[]
  evidence: string[]
  resumeSectionsUsed: string[]
  readinessSummary: string
  learningRecommendations: string[]
  confidence: number
  scoreReasons: string[]
  atsGuidance: ExplainedInsight[]
  interviewReadiness: ExplainedInsight
  processingTimeMs: number
}

export type ReferralReadiness = 'Ready to request referral' | 'Improve before requesting' | 'Not ready yet'
export type EmployeeRecommendation = 'Ready for referral' | 'Review before referring' | 'Not ready yet'

export interface TrustScoreFactor {
  key: string
  label: string
  weight: number
  score: number
  contribution: number
  reason: string
}

export interface StudentEducation {
  college: string | null
  degree: string | null
  branch: string | null
  graduationYear: string | number | null
}

export interface StudentProfileData extends StudentEducation {
  preferredRole: string | null
  preferredCompany: string | null
  skills: string[]
  bio: string | null
  linkedinUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
}

export interface TrustCardResult {
  id?: string
  candidateName: string
  role: string
  overallMatch: number
  roleFit: number
  proofScore: number
  gapScore: number
  confidence: number
  trustScore: number
  referralReadiness: ReferralReadiness
  recommendation: EmployeeRecommendation
  strengths: string[]
  weaknesses: string[]
  missingSkills: string[]
  missingRequirements: ActionPlanItem[]
  actionPlan: ActionPlanItem[]
  evidence: string[]
  riskSignals: string[]
  scoreFormula: string
  scoreBreakdown: TrustScoreFactor[]
  scoreReasons: string[]
  aiSummary: string
  education: StudentEducation
}

export type ReferralStatus = 'pending' | 'under_review' | 'more_info_requested' | 'approved' | 'declined' | 'referred'

export interface ReferralRequestSummary {
  id: string
  studentId: string
  employeeId: string
  trustCardId: string
  targetRole: string
  targetCompany: string
  status: ReferralStatus
  createdAt: string
  updatedAt: string
}

export interface ReferralRequestDetail extends ReferralRequestSummary {
  jobDescription: string
  studentMessage: string
  employeeNote: string | null
}

export interface EmployeeReferralQueueItem extends ReferralRequestSummary {
  candidateId: string
  studentName: string | null
  college: string | null
  trustScore: number | null
  overallMatch: number | null
  resumeExists: boolean
  trustCardExists: boolean
}

export interface EmployeeCandidateProfile {
  studentId: string
  studentName: string | null
  college: string | null
  degree: string | null
  graduationYear: string | null
  profilePhotoUrl: string | null
}

export interface EmployeeAnalysisSummary {
  overallMatch: number | null
  roleFit: number | null
  proofScore: number | null
  gapScore: number | null
  confidence: number | null
  matchedSkills: string[] | null
  missingRequirements: ActionPlanItem[] | null
  strengths: string[] | null
  evidence: string[] | null
  readinessSummary: string | null
}

export interface EmployeeReferralRequestView {
  id: string
  status: ReferralStatus
  targetRole: string
  targetCompany: string
  studentMessage: string
  createdAt: string
  updatedAt: string
  candidate: EmployeeCandidateProfile
  analysis: EmployeeAnalysisSummary | null
  resumeExists: boolean
  trustCardExists: boolean
  analysisExists: boolean
}

export interface EmployeeResumeAccess {
  requestId: string
  fileName: string
  signedUrl: string
  expiresIn: number
}

export interface EmployeeTrustCardView {
  requestId: string
  trustCardId: string
  studentName: string | null
  targetRole: string
  targetCompany: string
  trustScore: number | null
  overallMatch: number | null
  roleFit: number | null
  proofScore: number | null
  gapScore: number | null
  confidence: number | null
  matchedSkills: string[] | null
  missingRequirements: ActionPlanItem[] | null
  strengths: string[] | null
  evidence: string[] | null
  readiness: string | null
  recommendation: string | null
  summary: string | null
  riskSignals: string[] | null
  scoreFormula: string | null
  scoreBreakdown: TrustScoreFactor[] | null
  generatedAt: string | null
  education: StudentEducation
}

export interface ReferralStatusHistoryEntry {
  id: number
  referralRequestId: string
  previousStatus: ReferralStatus | null
  newStatus: ReferralStatus
  changedBy: string
  note: string | null
  createdAt: string
}

export interface EmployeeDirectoryItem {
  id: string
  name: string
  company: string | null
  designation: string | null
}

export interface EmployeeProfessionalProfile {
  profileId: string
  company: string | null
  designation: string | null
}
