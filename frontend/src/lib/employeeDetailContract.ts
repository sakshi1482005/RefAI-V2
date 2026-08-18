import { FriendlyRequestError } from './requestSafety'
import type { EmployeeAnalysisSummary, EmployeeReferralRequestView, EmployeeResumeAccess, EmployeeTrustCardView, ReferralStatus } from '../types'

const statuses = new Set<ReferralStatus>(['draft', 'submitted', 'pending', 'under_review', 'more_info_requested', 'approved', 'referred', 'declined', 'withdrawn', 'expired'])
const fail = (resource: string): never => { throw new FriendlyRequestError('validation', `${resource} returned an unexpected response. Please retry or contact the RefAI team.`) }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const nullableString = (value: unknown) => value === null || typeof value === 'string'
const nullableScore = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
const nullableStrings = (value: unknown) => value === null || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
const nullableObjects = (value: unknown) => value === null || (Array.isArray(value) && value.every(object))
const nullableReliability = (value: unknown) => value === null || (object(value)
  && ['High reliability', 'Medium reliability', 'Low reliability'].includes(String(value.label))
  && typeof value.basis === 'string' && typeof value.limitations === 'string')
const education = (value: unknown) => object(value) && nullableString(value.college) && nullableString(value.degree)
  && nullableString(value.branch) && (value.graduationYear === null || typeof value.graduationYear === 'string' || typeof value.graduationYear === 'number')
const compatibility = (value: unknown) => value === null || (object(value)
  && typeof value.score === 'number' && value.score >= 0 && value.score <= 100
  && ['Strong fit', 'Good fit', 'Review fit', 'Low fit'].includes(String(value.label))
  && Array.isArray(value.positiveFactors) && value.positiveFactors.every((item) => typeof item === 'string')
  && Array.isArray(value.missingOrConflictingFactors) && value.missingOrConflictingFactors.every((item) => typeof item === 'string')
  && Array.isArray(value.limitations) && value.limitations.every((item) => typeof item === 'string')
  && Array.isArray(value.suggestedImprovements) && value.suggestedImprovements.every((item) => typeof item === 'string')
  && Array.isArray(value.components) && value.components.length === 5)
const proofEntries = (value: unknown) => Array.isArray(value) && value.every((entry) => object(entry)
  && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.urlOrReference === 'string')

function analysis(value: unknown): value is EmployeeAnalysisSummary | null {
  if (value === null) return true
  if (!object(value)) return false
  return (value.trustScore === undefined || nullableScore(value.trustScore))
    && ['overallMatch', 'roleFit', 'proofScore', 'gapScore', 'confidence'].every((key) => nullableScore(value[key]))
    && (value.analysisReliability === undefined || nullableReliability(value.analysisReliability))
    && nullableStrings(value.matchedSkills) && nullableObjects(value.missingRequirements)
    && nullableStrings(value.strengths) && nullableStrings(value.evidence) && nullableString(value.readinessSummary)
}

export function parseEmployeeRequestDetail(value: unknown): EmployeeReferralRequestView {
  if (!object(value) || !object(value.candidate) || typeof value.id !== 'string' || !statuses.has(value.status as ReferralStatus)
    || typeof value.targetRole !== 'string' || typeof value.targetCompany !== 'string' || typeof value.studentMessage !== 'string'
    || !nullableString(value.employeeNote)
    || !nullableString(value.decisionReason) || !nullableString(value.decisionMessage) || !nullableString(value.decisionAt)
    || !nullableString(value.referralDate) || !nullableString(value.referralConfirmationNumber)
    || !nullableString(value.referralNoteToStudent) || !nullableString(value.referralSubmittedAt)
    || !nullableString(value.referralSubmittedBy)
    || !nullableString(value.moreInformationQuestion) || !nullableString(value.studentResponse)
    || !proofEntries(value.studentResponseProofEntries) || !nullableString(value.studentRespondedAt)
    || !compatibility(value.compatibility)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || typeof value.candidate.studentId !== 'string' || !nullableString(value.candidate.studentName)
    || !nullableString(value.candidate.college) || !nullableString(value.candidate.degree)
    || !(value.candidate.graduationYear === null || typeof value.candidate.graduationYear === 'string' || typeof value.candidate.graduationYear === 'number')
    || !nullableString(value.candidate.profilePhotoUrl)
    || !analysis(value.analysis) || typeof value.resumeExists !== 'boolean'
    || typeof value.trustCardExists !== 'boolean' || typeof value.analysisExists !== 'boolean') fail('Candidate review')
  const response = value as Record<string, unknown>
  const candidate = response.candidate as Record<string, unknown>
  return {
    ...response,
    candidate: {
      ...candidate,
      graduationYear: candidate.graduationYear === null ? null : String(candidate.graduationYear),
    },
  } as unknown as EmployeeReferralRequestView
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
    || !nullableString(value.scoreVersion)
    || (value.analysisReliability !== undefined && !nullableReliability(value.analysisReliability))
    || !nullableObjects(value.scoreBreakdown) || !nullableString(value.generatedAt) || !education(value.education)) fail('Trust Card')
  return value as unknown as EmployeeTrustCardView
}
