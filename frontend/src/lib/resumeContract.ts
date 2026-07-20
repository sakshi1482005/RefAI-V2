import type { ResumeUploadResult } from './analysisSession'
import type { ResumeAnalysisResult } from '../types'
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

export function parseResumeAnalysisResponse(value: unknown, status: number): ResumeAnalysisResult {
  const endpoint = '/resume/analyze'
  if (!isRecord(value)) contractFailure(endpoint, status, value, ['valid JSON object'])
  const required = ['overall', 'roleFit', 'proof', 'gaps', 'analysisStatus', 'matchedSkills', 'missingSkills', 'missingRequirements', 'actionPlan', 'strengths', 'evidence', 'resumeSectionsUsed', 'readinessSummary', 'learningRecommendations', 'confidence', 'processingTimeMs']
  const missing = missingFields(value, required)
  if (missing.length > 0) contractFailure(endpoint, status, value, missing)
  const numbersValid = ['overall', 'roleFit', 'proof', 'gaps', 'confidence', 'processingTimeMs'].every((field) => typeof value[field] === 'number')
  const stringArraysValid = ['matchedSkills', 'missingSkills', 'strengths', 'evidence', 'resumeSectionsUsed', 'learningRecommendations'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((item) => typeof item === 'string'),
  )
  const actionPlanArraysValid = ['missingRequirements', 'actionPlan'].every(
    (field) => Array.isArray(value[field]) && (value[field] as unknown[]).every(isActionPlanItem),
  )
  if (!numbersValid || !stringArraysValid || !actionPlanArraysValid || value.analysisStatus !== 'complete' || typeof value.readinessSummary !== 'string') {
    const invalid = [
      ...(!numbersValid ? ['numeric score/timing fields'] : []),
      ...(!stringArraysValid ? ['string-array analysis fields'] : []),
      ...(!actionPlanArraysValid ? ['structured missingRequirements/actionPlan fields'] : []),
      ...(value.analysisStatus !== 'complete' ? ['analysisStatus'] : []),
      ...(typeof value.readinessSummary !== 'string' ? ['readinessSummary'] : []),
    ]
    contractFailure(endpoint, status, value, invalid)
  }
  return value as unknown as ResumeAnalysisResult
}
