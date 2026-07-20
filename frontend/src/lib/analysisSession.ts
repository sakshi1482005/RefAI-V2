import type { MatchScore, ResumeAnalysisResult, TrustCardResult } from '../types'

const LEGACY_STORAGE_KEY = 'refai_analysis_session'
const STORAGE_KEY_PREFIX = 'refai_analysis_session:'

export type AnalysisSessionScope =
  | { kind: 'authenticated'; userId: string }
  | { kind: 'demo' }

export type ResumeUploadResult = {
  resumeId: string
  fileName: string
  chunkCount: number
  preview: string
  extractionStatus: 'complete'
  analysisStatus: 'pending'
  storagePath: string | null
  storageStatus: string
  indexed: boolean
  processingTimeMs: number
}

export type AnalysisSession = {
  analysisId?: string
  upload?: ResumeUploadResult
  matchScore?: MatchScore
  analysis?: ResumeAnalysisResult
  trustCard?: TrustCardResult
  jobDescription?: string
  role?: string
  company?: string
  analyzedAt?: string
  processingTimeMs?: number
}

export function getAnalysisSessionScope(isDemoMode: boolean, userId: string | null): AnalysisSessionScope | null {
  if (isDemoMode) return { kind: 'demo' }
  return userId ? { kind: 'authenticated', userId } : null
}

function storageKey(scope: AnalysisSessionScope) {
  return scope.kind === 'demo'
    ? `${STORAGE_KEY_PREFIX}demo`
    : `${STORAGE_KEY_PREFIX}user:${scope.userId}`
}

function removeLegacySharedSession() {
  sessionStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function loadAnalysisSession(scope: AnalysisSessionScope | null): AnalysisSession {
  removeLegacySharedSession()
  if (!scope) return {}
  try {
    const session = JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? '{}') as AnalysisSession
    // Old Trust Cards only contained matchScore. They must be regenerated rather
    // than silently presenting Overall Match as the new backend Trust Score.
    if (session.trustCard && typeof session.trustCard.trustScore !== 'number') {
      return { ...session, trustCard: undefined }
    }
    return session
  } catch {
    return {}
  }
}

export function saveAnalysisSession(scope: AnalysisSessionScope | null, update: Partial<AnalysisSession>) {
  removeLegacySharedSession()
  if (!scope) throw new Error('A signed-in user is required to save resume analysis.')
  if (scope.kind !== 'demo') throw new Error('Authenticated analysis must be persisted through the RefAI API.')
  sessionStorage.setItem(storageKey(scope), JSON.stringify({ ...loadAnalysisSession(scope), ...update }))
}

export function clearAnalysisSession(scope?: AnalysisSessionScope) {
  removeLegacySharedSession()
  if (scope) {
    sessionStorage.removeItem(storageKey(scope))
    return
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(STORAGE_KEY_PREFIX)) sessionStorage.removeItem(key)
  }
}
