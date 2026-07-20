import { FriendlyRequestError } from './requestSafety'
import type { EmployeeAnalysisSummary, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeTrustCardView, ReferralStatus } from '../types'

const statuses = new Set<ReferralStatus>(['pending', 'under_review', 'more_info_requested', 'approved', 'declined', 'referred'])
const fail = (resource: string): never => { throw new FriendlyRequestError('validation', `${resource} returned an unexpected response. Please retry or contact the RefAI team.`) }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const nullableString = (value: unknown) => value === null || typeof value === 'string'
const nullableScore = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
const nullableStrings = (value: unknown) => value === null || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
const nullableObjects = (value: unknown) => value === null || (Array.isArray(value) && value.every(object))

function analysis(value: unknown): value is EmployeeAnalysisSummary | null {
  if (value === null) return true
  if (!object(value)) return false
  return ['overallMatch', 'roleFit', 'proofScore', 'gapScore', 'confidence'].every((key) => nullableScore(value[key]))
    && nullableStrings(value.matchedSkills) && nullableObjects(value.missingRequirements)
    && nullableStrings(value.strengths) && nullableStrings(value.evidence) && nullableString(value.readinessSummary)
}

export function parseEmployeeRequestDetail(value: unknown): EmployeeReferralRequestView {
  if (!object(value) || !object(value.candidate) || typeof value.id !== 'string' || !statuses.has(value.status as ReferralStatus)
    || typeof value.targetRole !== 'string' || typeof value.targetCompany !== 'string' || typeof value.studentMessage !== 'string'
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || typeof value.candidate.studentId !== 'string' || !nullableString(value.candidate.studentName)
    || !nullableString(value.candidate.college) || !nullableString(value.candidate.degree)
    || !nullableString(value.candidate.graduationYear) || !nullableString(value.candidate.profilePhotoUrl)
    || !analysis(value.analysis) || typeof value.resumeExists !== 'boolean'
    || typeof value.trustCardExists !== 'boolean' || typeof value.analysisExists !== 'boolean') fail('Candidate review')
  return value as unknown as EmployeeReferralRequestView
}

export function parseEmployeeResume(value: unknown): EmployeeResumeAccess {
  if (!object(value) || typeof value.requestId !== 'string' || typeof value.fileName !== 'string'
    || typeof value.signedUrl !== 'string' || !/^https:\/\//.test(value.signedUrl)
    || typeof value.expiresIn !== 'number' || value.expiresIn <= 0 || value.expiresIn > 900) fail('Resume access')
  return value as unknown as EmployeeResumeAccess
}

export function parseEmployeeTrustCard(value: unknown): EmployeeTrustCardView {
  if (!object(value) || typeof value.requestId !== 'string' || typeof value.trustCardId !== 'string'
    || !nullableString(value.studentName) || typeof value.targetRole !== 'string' || typeof value.targetCompany !== 'string'
    || !['trustScore', 'overallMatch', 'roleFit', 'proofScore', 'gapScore', 'confidence'].every((key) => nullableScore(value[key]))
    || !nullableStrings(value.matchedSkills) || !nullableObjects(value.missingRequirements)
    || !nullableStrings(value.strengths) || !nullableStrings(value.evidence)
    || !nullableString(value.readiness) || !nullableString(value.recommendation) || !nullableString(value.summary)
    || !nullableStrings(value.riskSignals) || !nullableString(value.scoreFormula)
    || !nullableObjects(value.scoreBreakdown) || !nullableString(value.generatedAt)) fail('Trust Card')
  return value as unknown as EmployeeTrustCardView
}
