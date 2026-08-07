import type { ResumeUploadResult } from './analysisSession'
import type { ResumeAnalysisResult, TrustCardResult } from '../types'
import { FriendlyRequestError } from './requestSafety'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseShape(value: unknown) {
  return isRecord(value) ? Object.keys(value).sort() : typeof value
}

function contractFailure(endpoint: string, status: number, value: unknown, missingExpectedFields: string[]): never {
  if (import.meta.env.DEV) {
    console.error('[RefAI resume API contract mismatch]', {
      endpoint,
      status,
      parsedResponseShape: responseShape(value),
      missingExpectedFields,
    })
  }
  const detail = isRecord(value)
    ? `The backend response is missing: ${missingExpectedFields.join(', ')}.`
    : 'The backend returned an invalid JSON response.'
  throw new FriendlyRequestError('server', `${detail} Restart the backend and retry the analysis.`)
}

function missingFields(value: JsonRecord, fields: string[]) {
  return fields.filter((field) => !(field in value) || value[field] === undefined)
}

export function parseResumeUploadResponse(value: unknown, status: number): ResumeUploadResult {
  const endpoint = '/resume/upload'
  if (!isRecord(value)) contractFailure(endpoint, status, value, ['valid JSON object'])
  const required = ['resumeId', 'fileName', 'chunkCount', 'preview', 'extractionStatus', 'analysisStatus', 'storagePath', 'storageStatus', 'indexed', 'processingTimeMs']
  const missing = missingFields(value, required)
  if (missing.length > 0) contractFailure(endpoint, status, value, missing)
  if (
    typeof value.resumeId !== 'string' || typeof value.fileName !== 'string' ||
    typeof value.chunkCount !== 'number' || typeof value.preview !== 'string' ||
    value.extractionStatus !== 'complete' || value.analysisStatus !== 'pending' ||
    typeof value.storageStatus !== 'string' || typeof value.indexed !== 'boolean' ||
    typeof value.processingTimeMs !== 'number' ||
    !(value.storagePath === null || value.storagePath === undefined || typeof value.storagePath === 'string')
  ) contractFailure(endpoint, status, value, ['valid typed upload fields'])
  return value as unknown as ResumeUploadResult
}

function isActionPlanItem(value: unknown) {
  if (!isRecord(value)) return false
  const stringFields = ['requirement', 'category', 'whyItMatters', 'practicalAction', 'evidenceSuggestion', 'estimatedEffort', 'nextStep']
  return stringFields.every((field) => typeof value[field] === 'string')
    && ['critical', 'important', 'optional'].includes(String(value.priority))
}

function isExplainedInsight(value: unknown) {
  return isRecord(value) && typeof value.title === 'string' && typeof value.description === 'string'
}

function isJobDescriptionClassification(value: unknown) {
  return isRecord(value) && [
    'requiredSkills', 'preferredSkills', 'responsibilities',
    'experienceExpectations', 'educationOrCertificationExpectations',
  ].every((field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((item) => typeof item === 'string'))
}

function isAnalysisReliability(value: unknown) {
  return isRecord(value)
    && ['High reliability', 'Medium reliability', 'Low reliability'].includes(String(value.label))
    && typeof value.basis === 'string'
    && typeof value.limitations === 'string'
}

function isTrustScoreEvidenceItem(value: unknown) {
  return isRecord(value)
    && typeof value.id === 'string'
    && ['Verified evidence', 'Resume supported', 'Self-declared', 'Needs clarification', 'Missing evidence'].includes(String(value.status))
    && typeof value.factLabel === 'string'
    && (value.snippet === null || typeof value.snippet === 'string')
    && (value.resumeSection === null || typeof value.resumeSection === 'string')
    && typeof value.whyItAffectsScore === 'string'
    && ['resume', 'derived', 'missing'].includes(String(value.sourceType))
}

function isNullableEducationValue(value: unknown) {
  return value === null || typeof value === 'string' || typeof value === 'number'
}

export function parseTrustCardResponse(value: unknown, status: number, endpoint = '/trust-card/generate'): TrustCardResult {
  if (!isRecord(value)) contractFailure(endpoint, status, value, ['valid JSON object'])
  const required = [
    'id', 'candidateName', 'role', 'overallMatch', 'roleFit', 'proofScore', 'gapScore',
    'confidence', 'trustScore', 'referralReadiness', 'recommendation', 'strengths', 'weaknesses',
    'missingSkills', 'missingRequirements', 'actionPlan', 'evidence', 'riskSignals',
    'scoreFormula', 'scoreBreakdown', 'scoreReasons', 'aiSummary', 'education',
  ]
  const missing = missingFields(value, required)
  if (missing.length > 0) contractFailure(endpoint, status, value, missing)
  const scoreFields = ['overallMatch', 'roleFit', 'proofScore', 'gapScore', 'confidence', 'trustScore']
  const scoresValid = scoreFields.every((field) => typeof value[field] === 'number')
  const stringFields = ['id', 'candidateName', 'role', 'referralReadiness', 'recommendation', 'scoreFormula', 'aiSummary']
  const stringsValid = stringFields.every((field) => typeof value[field] === 'string')
  const stringArraysValid = ['strengths', 'weaknesses', 'missingSkills', 'evidence', 'riskSignals', 'scoreReasons'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((item) => typeof item === 'string'),
  )
  const plansValid = ['missingRequirements', 'actionPlan'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every(isActionPlanItem),
  )
  const breakdownValid = Array.isArray(value.scoreBreakdown) && value.scoreBreakdown.every((factor) => (
    isRecord(factor)
    && ['key', 'label', 'reason'].every((field) => typeof factor[field] === 'string')
    && ['weight', 'score', 'contribution'].every((field) => typeof factor[field] === 'number')
    && (factor.details === undefined || isRecord(factor.details))
    && (factor.evidenceItems === undefined || (Array.isArray(factor.evidenceItems) && factor.evidenceItems.every(isTrustScoreEvidenceItem)))
    && (factor.evidenceFound === undefined || (Array.isArray(factor.evidenceFound) && factor.evidenceFound.every((item) => typeof item === 'string')))
    && (factor.evidenceMissing === undefined || (Array.isArray(factor.evidenceMissing) && factor.evidenceMissing.every((item) => typeof item === 'string')))
  ))
  const education = value.education
  const educationValid = isRecord(education)
    && ['college', 'degree', 'branch', 'graduationYear'].every((field) => isNullableEducationValue(education[field]))
  const reliabilityValid = value.analysisReliability === undefined || value.analysisReliability === null || isAnalysisReliability(value.analysisReliability)
  const cacheMetadataValid = ['inputKey', 'jobDescriptionHash', 'resumeContentHash', 'schemaVersion', 'generationVersion', 'generatedAt'].every(
    (field) => value[field] === undefined || value[field] === null || typeof value[field] === 'string',
  ) && (value.narrativeSource === undefined || value.narrativeSource === 'groq' || value.narrativeSource === 'deterministic_fallback')
    && (value.generationLimitations === undefined || (Array.isArray(value.generationLimitations) && value.generationLimitations.every((item) => typeof item === 'string')))
  if (!scoresValid || !stringsValid || !stringArraysValid || !plansValid || !breakdownValid || !educationValid || !reliabilityValid || !cacheMetadataValid) {
    contractFailure(endpoint, status, value, [
      ...(!scoresValid ? ['numeric Trust Card scores'] : []),
      ...(!stringsValid ? ['typed Trust Card text fields'] : []),
      ...(!stringArraysValid ? ['Trust Card evidence arrays'] : []),
      ...(!plansValid ? ['structured Trust Card action plan'] : []),
      ...(!breakdownValid ? ['scoreBreakdown'] : []),
      ...(!educationValid ? ['education'] : []),
      ...(!reliabilityValid ? ['analysisReliability'] : []),
      ...(!cacheMetadataValid ? ['Trust Card cache/version metadata'] : []),
    ])
  }
  return {
    ...value,
    scoreVersion: typeof value.scoreVersion === 'string' ? value.scoreVersion : 'legacy-unversioned',
    scoreBreakdown: (value.scoreBreakdown as Record<string, unknown>[]).map((factor) => ({
      ...factor,
      details: isRecord(factor.details) ? factor.details : {},
      evidenceItems: Array.isArray(factor.evidenceItems) ? factor.evidenceItems : [],
      evidenceFound: Array.isArray(factor.evidenceFound) ? factor.evidenceFound : [],
      evidenceMissing: Array.isArray(factor.evidenceMissing) ? factor.evidenceMissing : [],
    })),
  } as unknown as TrustCardResult
}

export function parseResumeAnalysisResponse(value: unknown, status: number): ResumeAnalysisResult {
  const endpoint = '/resume/analyze'
  if (!isRecord(value)) contractFailure(endpoint, status, value, ['valid JSON object'])
  const required = ['analysisId', 'overall', 'roleFit', 'proof', 'gaps', 'analysisStatus', 'matchedSkills', 'missingSkills', 'missingRequirements', 'actionPlan', 'strengths', 'weaknesses', 'evidence', 'resumeSectionsUsed', 'readinessSummary', 'learningRecommendations', 'confidence', 'scoreReasons', 'atsGuidance', 'interviewReadiness', 'processingTimeMs', 'jobDescriptionClassification', 'usedGeneralRoleExpectations']
  const missing = missingFields(value, required)
  if (missing.length > 0) contractFailure(endpoint, status, value, missing)
  const numbersValid = ['overall', 'roleFit', 'proof', 'gaps', 'confidence', 'processingTimeMs'].every((field) => typeof value[field] === 'number')
  const stringArraysValid = ['matchedSkills', 'missingSkills', 'strengths', 'weaknesses', 'evidence', 'resumeSectionsUsed', 'learningRecommendations', 'scoreReasons'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((item) => typeof item === 'string'),
  )
  const actionPlanArraysValid = ['missingRequirements', 'actionPlan'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every(isActionPlanItem),
  )
  const insightsValid = Array.isArray(value.atsGuidance) && value.atsGuidance.every(isExplainedInsight) && isExplainedInsight(value.interviewReadiness)
  const classificationValid = isJobDescriptionClassification(value.jobDescriptionClassification)
  const reliabilityValid = value.analysisReliability === undefined || value.analysisReliability === null || isAnalysisReliability(value.analysisReliability)
  if (!numbersValid || !stringArraysValid || !actionPlanArraysValid || !insightsValid || !classificationValid || !reliabilityValid || typeof value.usedGeneralRoleExpectations !== 'boolean' || value.analysisStatus !== 'complete' || typeof value.readinessSummary !== 'string' || typeof value.analysisId !== 'string') {
    const invalid = [
      ...(!numbersValid ? ['numeric score/timing fields'] : []),
      ...(!stringArraysValid ? ['string-array analysis fields'] : []),
      ...(!actionPlanArraysValid ? ['structured missingRequirements/actionPlan fields'] : []),
      ...(!insightsValid ? ['backend-generated guidance fields'] : []),
      ...(!classificationValid ? ['jobDescriptionClassification'] : []),
      ...(!reliabilityValid ? ['analysisReliability'] : []),
      ...(typeof value.usedGeneralRoleExpectations !== 'boolean' ? ['usedGeneralRoleExpectations'] : []),
      ...(value.analysisStatus !== 'complete' ? ['analysisStatus'] : []),
      ...(typeof value.readinessSummary !== 'string' ? ['readinessSummary'] : []),
      ...(typeof value.analysisId !== 'string' ? ['analysisId'] : []),
    ]
    contractFailure(endpoint, status, value, invalid)
  }
  return value as unknown as ResumeAnalysisResult
}

export function parsePersistedAnalysisSessionResponse(value: unknown, status: number) {
  const endpoint = '/resume/analysis/latest'
  if (!isRecord(value)) contractFailure(endpoint, status, value, ['valid JSON object'])
  const required = ['analysisId', 'upload', 'matchScore', 'analysis', 'trustCard', 'jobDescription', 'role', 'company', 'jobDescriptionClassification', 'usedGeneralRoleExpectations', 'analyzedAt', 'processingTimeMs']
  const missing = missingFields(value, required)
  if (missing.length > 0) contractFailure(endpoint, status, value, missing)
  if (!isRecord(value.matchScore)) contractFailure(endpoint, status, value, ['matchScore'])
  const matchScore = value.matchScore
  const scoresValid = ['overall', 'roleFit', 'proof', 'gaps'].every((field) => typeof matchScore[field] === 'number')
  if (
    typeof value.analysisId !== 'string' || !scoresValid ||
    typeof value.jobDescription !== 'string' || typeof value.role !== 'string' ||
    typeof value.company !== 'string' || typeof value.analyzedAt !== 'string' ||
    typeof value.processingTimeMs !== 'number' ||
    typeof value.usedGeneralRoleExpectations !== 'boolean' ||
    !isJobDescriptionClassification(value.jobDescriptionClassification)
  ) contractFailure(endpoint, status, value, ['valid typed persisted analysis fields'])
  parseResumeUploadResponse(value.upload, status)
  parseResumeAnalysisResponse(value.analysis, status)
  if (value.trustCard !== null) parseTrustCardResponse(value.trustCard, status, endpoint)
  return value
}
