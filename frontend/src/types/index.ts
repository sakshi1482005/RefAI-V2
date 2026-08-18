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

export interface JobDescriptionClassification {
  requiredSkills: string[]
  preferredSkills: string[]
  responsibilities: string[]
  experienceExpectations: string[]
  educationOrCertificationExpectations: string[]
}

export type AnalysisReliabilityLabel = 'High reliability' | 'Medium reliability' | 'Low reliability'

export interface AnalysisReliability {
  label: AnalysisReliabilityLabel
  basis: string
  limitations: string
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
  analysisReliability?: AnalysisReliability | null
  scoreReasons: string[]
  atsGuidance: ExplainedInsight[]
  interviewReadiness: ExplainedInsight
  processingTimeMs: number
  jobDescriptionClassification?: JobDescriptionClassification
  usedGeneralRoleExpectations?: boolean
}

export type ReferralReadiness = 'Ready to request referral' | 'Improve before requesting' | 'Not ready yet'
export type EmployeeRecommendation = 'Ready for referral' | 'Review before referring' | 'Not ready yet'

export type TrustScoreEvidenceStatus = 'Verified evidence' | 'Resume supported' | 'Self-declared' | 'Needs clarification' | 'Missing evidence'

export interface TrustScoreEvidenceItem {
  id: string
  status: TrustScoreEvidenceStatus
  factLabel: string
  snippet: string | null
  resumeSection: string | null
  whyItAffectsScore: string
  sourceType: 'resume' | 'derived' | 'missing'
}

export interface TrustScoreFactor {
  key: string
  label: string
  weight: number
  score: number
  maximumScore?: number | null
  basisPercentage?: number | null
  contribution: number
  reason: string
  details?: Record<string, unknown>
  evidenceItems?: TrustScoreEvidenceItem[]
  formulaOrBasis?: string | null
  evidenceFound?: string[]
  evidenceMissing?: string[]
  improvementAction?: string | null
  potentialImprovementPoints?: number | null
  limitation?: string | null
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
  analysisReliability?: AnalysisReliability | null
  trustScore: number
  scoreVersion: string
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
  inputKey?: string | null
  jobDescriptionHash?: string | null
  resumeContentHash?: string | null
  schemaVersion?: string | null
  generationVersion?: string | null
  generatedAt?: string | null
  narrativeSource?: 'groq' | 'deterministic_fallback'
  generationLimitations?: string[]
}

export type ReferralStatus = 'draft' | 'submitted' | 'pending' | 'under_review' | 'more_info_requested' | 'approved' | 'referred' | 'declined' | 'withdrawn' | 'expired'

export interface ReferralRequestSummary {
  id: string
  studentId: string
  employeeId: string
  trustCardId: string
  targetRole: string
  targetCompany: string
  employeeCompanySnapshot: string | null
  compatibilityScore: number | null
  compatibilityLabel: ReferralCompatibilityLabel | null
  status: ReferralStatus
  decisionReason: string | null
  decisionMessage: string | null
  decisionAt: string | null
  referralDate: string | null
  referralConfirmationNumber: string | null
  referralNoteToStudent: string | null
  referralSubmittedAt: string | null
  referralSubmittedBy: string | null
  moreInformationQuestion: string | null
  studentResponse: string | null
  studentResponseProofEntries: ProofEntry[]
  studentRespondedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReferralRequestDetail extends ReferralRequestSummary {
  jobDescription: string
  studentMessage: string
  employeeNote: string | null
  decisionReason: string | null
  decisionMessage: string | null
  decisionAt: string | null
  referralDate: string | null
  referralConfirmationNumber: string | null
  referralNoteToStudent: string | null
  referralSubmittedAt: string | null
  referralSubmittedBy: string | null
  compatibility: ReferralCompatibility | null
}

export interface EmployeeReferralQueueItem extends ReferralRequestSummary {
  candidateId: string
  studentName: string | null
  college: string | null
  trustScore: number | null
  overallMatch: number | null
  resumeExists: boolean
  trustCardExists: boolean
  studentResponseAvailable: boolean
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
  trustScore: number | null
  overallMatch: number | null
  roleFit: number | null
  proofScore: number | null
  gapScore: number | null
  confidence: number | null
  analysisReliability?: AnalysisReliability | null
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
  employeeCompanySnapshot: string | null
  studentMessage: string
  employeeNote: string | null
  decisionReason: string | null
  decisionMessage: string | null
  decisionAt: string | null
  referralDate: string | null
  referralConfirmationNumber: string | null
  referralNoteToStudent: string | null
  referralSubmittedAt: string | null
  referralSubmittedBy: string | null
  moreInformationQuestion: string | null
  studentResponse: string | null
  studentResponseProofEntries: ProofEntry[]
  studentRespondedAt: string | null
  compatibility: ReferralCompatibility | null
  createdAt: string
  updatedAt: string
  candidate: EmployeeCandidateProfile
  analysis: EmployeeAnalysisSummary | null
  resumeExists: boolean
  trustCardExists: boolean
  analysisExists: boolean
}

export interface EmployeeCopilotStatement {
  text: string
  evidenceType: 'demonstrated_evidence' | 'inferred_relevance' | 'missing_evidence' | 'manual_verification'
  factIds: string[]
}

export interface EmployeeReviewCopilot {
  whyCandidateMayFit: EmployeeCopilotStatement[]
  evidenceBackedStrengths: EmployeeCopilotStatement[]
  concernsOrMissingEvidence: EmployeeCopilotStatement[]
  matchedCoreRequirementsCount: number
  totalCoreRequirementsCount: number
  pointsRequiringManualVerification: EmployeeCopilotStatement[]
  suggestedReviewPriority: 'Standard review' | 'Evidence gaps first' | 'Verify core evidence first'
  usefulQuestions: string[]
  narrative: string
  hasJobDescription: boolean
  usedFallback: boolean
  scoreVersion: string
  groundingSources: string[]
  limitations: string[]
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
  scoreVersion: string | null
  overallMatch: number | null
  roleFit: number | null
  proofScore: number | null
  gapScore: number | null
  confidence: number | null
  analysisReliability?: AnalysisReliability | null
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
  eventType: 'request_created' | 'status_changed' | 'employee_viewed' | 'student_responded'
  createdAt: string
}

export type NotificationEventType = 'employee_viewed_request' | 'more_information_requested' | 'request_approved' | 'referral_submitted' | 'request_declined' | 'employee_stopped_accepting' | 'resume_reanalysis_completed' | 'student_responded'

export interface InAppNotification {
  id: string
  eventType: NotificationEventType
  title: string
  body: string
  targetUrl: string
  referralRequestId: string | null
  analysisId: string | null
  readAt: string | null
  createdAt: string
}

export interface EmployeeDirectoryItem {
  id: string
  name: string
  photoUrl: string | null
  company: string | null
  designation: string | null
  department: string | null
  yearsExperience: number | null
  verifiedEmployee: boolean
  linkedinUrl: string | null
  companyProfileUrl: string | null
  portfolioUrl: string | null
  supportedCompanies: string[]
  supportedRoles: string[]
  supportedDepartments: string[]
  acceptsFreshers: boolean
  minimumEvidenceExpectations: string[]
  preferredCandidateLevels: string[]
  preferredMessageLength: 'concise' | 'standard' | 'detailed'
  referralGuidelines: string | null
  referralCategories: string[]
  aiApplyOptIn?: boolean
  acceptingRequests: boolean
  activeRequestCount: number
  maxActiveRequests: number
  reliabilityBadge: EmployeeReliabilityBadge
}

export interface EmployeeProfessionalProfile {
  profileId: string
  company: string | null
  designation: string | null
  department: string | null
  yearsExperience: number | null
  verifiedEmployee: boolean
  linkedinUrl: string | null
  companyProfileUrl: string | null
  portfolioUrl: string | null
  supportedCompanies: string[]
  supportedRoles: string[]
  supportedDepartments: string[]
  acceptsFreshers: boolean
  minimumEvidenceExpectations: EvidenceExpectation[]
  maxActiveRequests: number
  availabilityStatus: AvailabilityStatus
  preferredCandidateLevels: CandidateLevel[]
  preferredMessageLength: MessageLength
  referralGuidelines: string | null
  declineReasonCodes: DeclineReasonCode[]
  referralCategories: ReferralCategory[]
  aiApplyOptIn: boolean
  averageResponseTimeValue: number | null
  averageResponseTimeUnit: 'hours'
  respondedRequestCount: number
  responseTimeAvailable: boolean
  reliabilityBadge: EmployeeReliabilityBadge
}

export interface EmployeeReliabilityBadge {
  badgeType: 'new_referrer' | 'verified_referrer' | 'reliable_referrer' | 'developing_referrer'
  label: 'New Referrer' | 'Verified Referrer' | 'Reliable Referrer' | 'Developing Referrer'
  reliabilityLevel: 'Excellent' | 'Strong' | 'Verified' | 'Building history'
  basis: string
  relevantCounts: {
    meaningfulResponses: number
    completedReferrals: number
    recentMeaningfulResponses: number
    overdueUnansweredRequests: number
  }
  lastCalculatedAt: string
  limitations: string[]
}

export interface EmployeeReliabilityMetric {
  key: 'response_consistency' | 'referral_completion' | 'profile_verification' | 'decision_transparency' | 'platform_activity'
  label: string
  score: number
  maximumScore: number
  basis: string
  evidence: string[]
  limitations: string[]
}

export interface EmployeeReliabilityCard {
  label: 'Excellent' | 'Strong' | 'Verified' | 'Building history'
  score: number
  maximumScore: 100
  isProvisional: boolean
  averageResponseHours: number | null
  requestsReviewed: number
  completedReferrals: number
  metrics: EmployeeReliabilityMetric[]
  limitations: string[]
}

export type AvailabilityStatus = 'accepting' | 'paused' | 'unavailable'
export type CandidateLevel = 'student' | 'fresher' | 'entry_level' | 'experienced'
export type MessageLength = 'concise' | 'standard' | 'detailed'
export type EvidenceExpectation = 'resume' | 'trust_card' | 'project_evidence' | 'quantified_outcomes' | 'education_details' | 'portfolio_links'
export type DeclineReasonCode = 'insufficient_evidence' | 'role_mismatch' | 'capacity_unavailable' | 'profile_incomplete' | 'experience_mismatch' | 'unsupported_category' | 'other'
export type ReferralCategory = 'internship' | 'full_time' | 'apprenticeship' | 'graduate_program' | 'campus_hiring' | 'contract'
export type ReferralCompatibilityLabel = 'Strong fit' | 'Good fit' | 'Review fit' | 'Low fit'

export interface ReferralCompatibilityComponent {
  key: 'role_alignment' | 'department_relevance' | 'employee_preferences' | 'candidate_readiness' | 'request_completeness'
  label: string
  score: number
  maximumScore: number
}

export interface ReferralCompatibility {
  score: number
  maximumScore: 100
  label: ReferralCompatibilityLabel
  scoreVersion: string
  positiveFactors: string[]
  missingOrConflictingFactors: string[]
  limitations: string[]
  suggestedImprovements: string[]
  components: ReferralCompatibilityComponent[]
}

export type AIApplyTimeline = 'immediate' | 'within_30_days' | 'within_3_months' | 'exploring'
export type AIApplyWorkMode = 'onsite' | 'hybrid' | 'remote' | 'flexible'

export interface AIApplyGoal {
  id: string
  analysisId: string
  trustCardId: string
  targetRole: string
  targetCompany: string
  preferredDepartment: string | null
  timeline: AIApplyTimeline | null
  location: string | null
  workMode: AIApplyWorkMode | null
  minimumCompatibility: number
  numberOfMatches: number
  createdAt: string
}

export interface AIApplyMatch {
  id: string
  rank: number
  employee: {
    id: string
    name: string
    company: string | null
    designation: string | null
    department: string | null
    supportedRoles: string[]
    supportedDepartments: string[]
    availability: 'accepting'
  }
  compatibility: ReferralCompatibility
  semanticSimilarity: number | null
  rankingScore: number
  relevanceSource: 'goal_context' | 'deterministic_fallback'
  reason: {
    positiveFactors: string[]
    cautions: string[]
    semanticBasis: string
    limitations: string[]
  }
  referralRequestId: string | null
}

export interface AIApplyMatchRun {
  id: string
  goal: AIApplyGoal
  matchVersion: string
  inputKey: string
  vectorStatus: 'available' | 'partial' | 'unavailable' | 'not_used'
  eligibleEmployeeCount: number
  excludedEmployeeCount: number
  exclusionReasons: { reason: string; count: number }[]
  matches: AIApplyMatch[]
  limitations: string[]
  createdAt: string
}

export interface AIApplyAllowance {
  minimumCompatibilityThreshold: number
  weeklyCap: number
  weeklyUsed: number
  weeklyRemaining: number
  creditBalance: number
  available: boolean
}

export interface AIApplySubmission {
  requestId: string
  matchId: string
  status: 'submitted'
  chargedCredits: number
  creditBalance: number
  weeklyRemaining: number
  compatibilityScore: number
  compatibilityThreshold: number
  idempotentReplay: boolean
}

export type ReferralMessageTone = 'professional_concise' | 'friendly' | 'alumni_connection' | 'first_time_outreach' | 'follow_up'
export type ReferralMessageAction = 'generate' | 'regenerate' | 'shorter' | 'more_formal' | 'add_strongest_project' | 'remove_weak_claims'

export interface ReferralMessageGroundingFact {
  id: string
  sourceType: 'resume' | 'trust_card' | 'profile' | 'job_description' | 'employee_directory' | 'verified_shared_data' | 'referral_draft'
  value: string
}

export interface ReferralMessageResult {
  message: string
  usedFacts: ReferralMessageGroundingFact[]
  omittedOrUnavailableFacts: string[]
  groundingLimitations: string[]
  usedFallback: boolean
  wordCount: number
  alumniConnectionAvailable: boolean
  followUpAvailable: boolean
}

export interface ReferralQualityCheck {
  key: 'opportunity_accuracy' | 'evidence_grounding' | 'factual_integrity' | 'employee_preferences' | 'professional_clarity'
  label: string
  score: number
  maximumScore: number
  status: 'passed' | 'warning'
  basis: string
}

export interface ReferralQuality {
  score: number
  maximumScore: 100
  label: 'Excellent' | 'Strong' | 'Needs review' | 'Weak'
  scoreVersion: string
  passedChecks: string[]
  warnings: string[]
  blockingErrors: string[]
  recommendedEdits: string[]
  checks: ReferralQualityCheck[]
  canSubmit: boolean
  limitations: string[]
}

export type ProofType = 'github_repository' | 'live_demo' | 'certification' | 'project_screenshot' | 'internship_letter_reference' | 'portfolio' | 'research_paper' | 'presentation' | 'competition_result'

export interface ProofEntry {
  id: string
  ownerId: string
  trustCardId: string
  proofType: ProofType
  title: string
  urlOrReference: string
  relatedProject: string | null
  relatedSkillClaim: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type ClaimVerificationStatus = 'Evidence supported' | 'Partially supported' | 'Self-declared' | 'Needs clarification' | 'Verified evidence' | 'Resume supported'

export type ClaimVerificationCategory = 'experience' | 'project' | 'achievement' | 'leadership' | 'quantified_impact' | 'skill'

export interface ClaimVerificationItem {
  id: string
  claim: string
  category: ClaimVerificationCategory
  status: ClaimVerificationStatus
  reason: string
  resumeEvidence: string[]
  supportingEvidenceSnippets: string[]
  resumeSection: string | null
  resumeContext: string | null
  missingSupport: string | null
  suggestedClarificationQuestion: string | null
  proofEvidence: Pick<ProofEntry, 'id' | 'title' | 'proofType' | 'urlOrReference'>[]
}

export interface ClaimVerificationResult {
  statusVersion: string
  claims: ClaimVerificationItem[]
  interpretationSource: 'deterministic' | 'groq_assisted' | 'deterministic_fallback'
  limitation: string
}

export interface ImprovementSuggestion {
  componentKey: string
  affectedComponent: string
  missingEvidence: string[]
  recommendedAction: string
  maximumPotentialPoints: number
  limitation: string
}

export interface ImprovementComponentDelta {
  componentKey: string
  component: string
  previousScore: number
  currentScore: number
  delta: number
  evidenceCausingChange: string[]
}

export interface ImprovementSimulatorResult {
  simulatorVersion: string
  scoreVersion: string
  currentScore: number
  maximumScore: 100
  suggestions: ImprovementSuggestion[]
  totalMaximumPotentialPoints: number
  comparison: null | {
    previousScore: number
    currentScore: number
    delta: number
    componentDeltas: ImprovementComponentDelta[]
    scoreVersion: string
  }
  limitations: string[]
  intelligenceSnapshot?: {
    fuzzySuitabilityScore: number
    semanticJobMatchScore: number
    hybridScore: number
    algorithmVersion: string
    availableSkillScenarios: Array<{ skill: string; priority: 'High' | 'Medium' | 'Low' }>
  } | null
  simulation?: {
    isSimulation: true
    currentScore: number
    simulatedScore: number
    difference: number
    affectedComponents: Array<{
      key: string
      label: string
      currentScore: number
      simulatedScore: number
      difference: number
      whyChanged: string
    }>
    whyScoreChanged: string[]
    limitations: string[]
  } | null
}

export interface EmployeeDiscoveryRecommendation {
  employeeId: string
  compatibility: ReferralCompatibility
  matchReasons: string[]
  concern: string | null
  acceptingRequests: boolean
  reliabilityLabel: string
}

export interface CreditBalance { balance: number }
export interface CreditLedgerEntry { id: number; action: string; amount: number; balanceAfter: number; createdAt: string }

export interface CandidateIntelligenceResult {
  trustScore: number
  trustScoreVersion: string | null
  trustScoreBreakdown: TrustScoreFactor[]
  hybrid: {
    algorithm_version: string
    hybrid_score: number
    label: 'Low' | 'Moderate' | 'High'
    component_scores: Record<string, number>
    contribution_breakdown: Array<{ key: string; label: string; score: number; weight: number; contribution: number; basis: string; limitation: string | null }>
    positive_factors: string[]
    risk_gap_factors: string[]
    explanation: string
  }
  fuzzy: {
    algorithm_version: string
    fuzzy_suitability_score: number
    label: 'Low' | 'Moderate' | 'High'
    input_memberships: Record<string, { low: number; medium: number; high: number }>
    activated_rules: Array<{ id: string; rule: string; consequent: 'Low' | 'Moderate' | 'High'; activation: number }>
    strongest_positive_factors: Array<{ input: string; value: number; dominant_membership: 'Low' | 'Medium' | 'High'; membership: number }>
    weakest_factors: Array<{ input: string; value: number; dominant_membership: 'Low' | 'Medium' | 'High'; membership: number }>
    explanation: string
    inputValuesUsed: Record<string, number>
    inputSources: Record<string, string>
  }
  semantic: {
    semantic_match_version: string
    semantic_match_score: number
    matched_skills: string[]
    missing_skills: string[]
    strongest_matching_evidence: Array<{ resume_evidence: string; compared_to: string; match_type: 'semantic' | 'required_skill'; normalized_similarity: number | null }>
    weak_missing_evidence: string[]
    role_relevance_explanation: string
    relevance_source: 'job_description' | 'role_context'
    limitations: string[]
  }
  skillGaps: {
    missing_skills: string[]
    recommendations: Array<{ skill: string; priority: 'High' | 'Medium' | 'Low'; reason: string; learning_order: number; estimated_suitability_impact: number; project_improvement: string; evidence_basis: string }>
    recommended_learning_order: string[]
    limitations: string[]
  }
}

export interface ModelComparisonComponent {
  key: string
  label: string
  value: number
  maximumScore: number | null
  unit: 'points' | 'normalized_input' | 'membership' | 'count'
  basis: string
}

export interface ModelComparisonResult {
  comparisonVersion: 'model-comparison-v1'
  targetRole: string | null
  relevanceSource: 'job_description' | 'role_context'
  models: Array<{
    key: 'trust_score_v2' | 'fuzzy_suitability' | 'semantic_job_match' | 'hybrid_candidate_intelligence'
    label: string
    score: number
    maximumScore: 100
    algorithmVersion: string
    measures: string
    components: ModelComparisonComponent[]
    limitations: string[]
  }>
  activatedFuzzyRules: Array<{ id: string; rule: string; consequent: 'Low' | 'Moderate' | 'High'; activation: number }>
  fuzzyExplanation: string | null
  semanticEvidence: Array<{ resume_evidence: string; compared_to: string; match_type: 'semantic' | 'required_skill'; normalized_similarity: number | null }>
  semanticExplanation: string | null
  semanticMatchedSkills: string[]
  semanticMissingSkills: string[]
  semanticWeakEvidence: string[]
  hybridContributions: Array<{ key: string; label: string; score: number; weight: number; contribution: number; basis: string; limitation: string | null }>
  hybridExplanation: string | null
  hybridPositiveFactors: string[]
  hybridRiskGapFactors: string[]
  methodologyNote: string
}
