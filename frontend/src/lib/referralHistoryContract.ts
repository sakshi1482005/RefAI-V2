import { FriendlyRequestError } from './requestSafety'
import type { ReferralStatus, ReferralStatusHistoryEntry } from '../types'

const statuses = new Set<ReferralStatus>(['draft', 'submitted', 'pending', 'under_review', 'more_info_requested', 'approved', 'referred', 'declined', 'withdrawn', 'expired'])
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const referralJourneyLabel: Record<ReferralStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', pending: 'Submitted', under_review: 'Under Review',
  more_info_requested: 'More Information Requested', approved: 'Approved for Referral',
  referred: 'Referral Submitted', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired',
}

export function referralHistoryEventLabel(event: Pick<ReferralStatusHistoryEntry, 'previousStatus' | 'newStatus' | 'eventType'>) {
  if (event.eventType === 'employee_viewed') return 'Employee Viewed'
  if (event.previousStatus === null) return 'Request Created'
  return referralJourneyLabel[event.newStatus]
}

export function parseReferralHistory(value: unknown): ReferralStatusHistoryEntry[] {
  if (!Array.isArray(value)) throw new FriendlyRequestError('validation', 'Referral history returned an unexpected response.')
  return value.map((entry) => {
    if (!object(entry) || typeof entry.id !== 'number' || typeof entry.referralRequestId !== 'string'
      || !(entry.previousStatus === null || (typeof entry.previousStatus === 'string' && statuses.has(entry.previousStatus as ReferralStatus)))
      || typeof entry.newStatus !== 'string' || !statuses.has(entry.newStatus as ReferralStatus)
      || typeof entry.changedBy !== 'string' || typeof entry.createdAt !== 'string') {
      throw new FriendlyRequestError('validation', 'Referral history returned an unexpected event.')
    }
    // Deliberately omit `note`: timeline consumers never receive or render employee notes.
    return {
      id: entry.id,
      referralRequestId: entry.referralRequestId,
      previousStatus: entry.previousStatus as ReferralStatus | null,
      newStatus: entry.newStatus as ReferralStatus,
      changedBy: entry.changedBy,
      note: null,
      eventType: entry.eventType === 'employee_viewed' || entry.eventType === 'request_created' ? entry.eventType : 'status_changed',
      createdAt: entry.createdAt,
    }
  })
}

