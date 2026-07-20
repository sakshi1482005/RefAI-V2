import { FriendlyRequestError } from './requestSafety'
import type { EmployeeReferralQueueItem, ReferralStatus } from '../types'

const STATUSES = new Set<ReferralStatus>(['pending', 'under_review', 'more_info_requested', 'approved', 'declined', 'referred'])

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableScore(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
}

function isQueueItem(value: unknown): value is EmployeeReferralQueueItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'studentId', 'employeeId', 'trustCardId', 'targetRole', 'targetCompany', 'createdAt', 'updatedAt', 'candidateId']
    .every((field) => typeof item[field] === 'string' && item[field] !== '')
    && typeof item.status === 'string'
    && STATUSES.has(item.status as ReferralStatus)
    && isNullableString(item.studentName)
    && isNullableString(item.college)
    && isNullableScore(item.trustScore)
    && isNullableScore(item.overallMatch)
    && typeof item.resumeExists === 'boolean'
    && typeof item.trustCardExists === 'boolean'
}

export function parseEmployeeQueue(value: unknown): EmployeeReferralQueueItem[] {
  if (!Array.isArray(value) || !value.every(isQueueItem)) {
    throw new FriendlyRequestError('validation', 'The employee queue returned an unexpected response. Please retry or contact the RefAI team.')
  }
  return value
}
