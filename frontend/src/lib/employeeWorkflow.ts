import type { EmployeeReferralQueueItem, ReferralStatus } from '../types'

export const employeeStatusLabel: Record<ReferralStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', pending: 'Submitted', under_review: 'Under review', more_info_requested: 'More information requested', approved: 'Approved for referral', referred: 'Referral submitted', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired',
}

export function employeeStatusTone(status: ReferralStatus): 'success' | 'danger' | 'warning' | 'info' {
  return status === 'approved' || status === 'referred' ? 'success' : status === 'declined' || status === 'expired' ? 'danger' : status === 'submitted' || status === 'pending' || status === 'more_info_requested' ? 'warning' : 'info'
}

export function employeeReviewHref(request: Pick<EmployeeReferralQueueItem, 'id'>) {
  return `/employee/review/${request.id}`
}

export function getEmployeeWorkflowState(input: {
  hasAssignedRequest: boolean
  resumeExists?: boolean
  trustCardExists?: boolean
  status?: ReferralStatus
}) {
  const decisionStatusAllowsUpdate = input.status === undefined || input.status === 'submitted' || input.status === 'pending' || input.status === 'under_review'
  return {
    canOpenReview: input.hasAssignedRequest,
    canOpenResume: input.hasAssignedRequest && input.resumeExists === true,
    canOpenTrustCard: input.hasAssignedRequest && input.trustCardExists === true,
    canMakeDecision: input.hasAssignedRequest && input.trustCardExists === true && decisionStatusAllowsUpdate,
  }
}
