import type { AnalysisSession } from './analysisSession'

export type StudentWorkflowAction = {
  label: string
  href: string
}

export type StudentWorkflowState = {
  hasProfile: boolean
  hasResume: boolean
  hasAnalysis: boolean
  hasTrustCard: boolean
  hasReferralRequest: boolean
  uploadAction: StudentWorkflowAction
  analysisAction: StudentWorkflowAction
  evidenceAction: StudentWorkflowAction
  trustCardAction: StudentWorkflowAction
  actionPlanAction: StudentWorkflowAction
  optimizeResumeAction: StudentWorkflowAction
  findEmployeesAction: StudentWorkflowAction
  primaryAction: StudentWorkflowAction
}

export function getStudentWorkflowState({
  profile,
  session,
  hasReferralRequest = false,
}: {
  profile: { id?: string } | null | undefined
  session: AnalysisSession
  hasReferralRequest?: boolean
}): StudentWorkflowState {
  // Workflow completion is monotonic: downstream data proves every prerequisite
  // was completed even while an earlier profile/session read is still resolving.
  const hasTrustCard = Boolean(session.trustCard || hasReferralRequest)
  const hasAnalysis = Boolean(session.analysis?.analysisStatus === 'complete' || session.matchScore || hasTrustCard)
  const hasResume = Boolean((session.upload?.resumeId && session.upload.preview) || hasAnalysis)
  const hasProfile = Boolean(profile?.id || hasResume)

  const uploadAction: StudentWorkflowAction = hasAnalysis
    ? { label: 'View Analysis Result', href: '/dashboard/resume-analysis' }
    : hasResume
      ? { label: 'Continue Resume Analysis', href: '/dashboard/resume' }
      : { label: 'Upload Resume', href: '/dashboard/resume' }

  const analysisAction: StudentWorkflowAction = hasAnalysis
    ? { label: 'View Analysis Result', href: '/dashboard/resume-analysis' }
    : hasResume
      ? { label: 'Run Analysis', href: '/dashboard/resume' }
      : uploadAction

  const evidenceAction: StudentWorkflowAction = hasAnalysis
    ? { label: 'View Evidence', href: '/dashboard/resume-analysis#evidence' }
    : analysisAction

  const trustCardAction: StudentWorkflowAction = hasTrustCard
    ? { label: 'View Trust Card', href: '/dashboard/trust-card' }
    : hasAnalysis
      ? { label: 'Generate Trust Card', href: '/dashboard/resume-analysis' }
      : analysisAction

  const actionPlanAction: StudentWorkflowAction = hasAnalysis
    ? { label: 'View Action Plan', href: '/dashboard/action-plan' }
    : analysisAction

  const optimizeResumeAction: StudentWorkflowAction = hasAnalysis
    ? actionPlanAction
    : analysisAction

  const findEmployeesAction: StudentWorkflowAction = hasTrustCard
    ? { label: 'Find Employees', href: '/dashboard#find-referrers' }
    : trustCardAction

  const primaryAction: StudentWorkflowAction = !hasProfile
    ? { label: 'Complete Profile', href: '/settings#profile' }
    : !hasResume
      ? uploadAction
      : !hasAnalysis
        ? analysisAction
        : !hasTrustCard
          ? trustCardAction
          : hasReferralRequest
            ? { label: 'Track Status', href: '/dashboard#referral-requests' }
            : findEmployeesAction

  return {
    hasProfile,
    hasResume,
    hasAnalysis,
    hasTrustCard,
    hasReferralRequest,
    uploadAction,
    analysisAction,
    evidenceAction,
    trustCardAction,
    actionPlanAction,
    optimizeResumeAction,
    findEmployeesAction,
    primaryAction,
  }
}
