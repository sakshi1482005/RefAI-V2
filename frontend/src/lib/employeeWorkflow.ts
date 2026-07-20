import type { EmployeeReferralQueueItem, ReferralStatus } from '../types'

export const employeeStatusLabel: Record<ReferralStatus, string> = {
  pending: 'Pending', under_review: 'Under review', more_info_requested: 'More info requested', approved: 'Approved', declined: 'Declined', referred: 'Referred',
}

export function employeeStatusTone(status: ReferralStatus): 'success' | 'danger' | 'warning' | 'info' {
  return status === 'approved' || status === 'referred' ? 'success' : status === 'declined' ? 'danger' : status === 'pending' || status === 'more_info_requested' ? 'warning' : 'info'
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
  const decisionStatusAllowsUpdate = input.status === undefined || input.status === 'pending' || input.status === 'under_review'
  return {
    canOpenReview: input.hasAssignedRequest,
    canOpenResume: input.hasAssignedRequest && input.resumeExists === true,
    canOpenTrustCard: input.hasAssignedRequest && input.trustCardExists === true,
    canMakeDecision: input.hasAssignedRequest && input.trustCardExists === true && decisionStatusAllowsUpdate,
  }
}
