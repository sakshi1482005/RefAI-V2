import type { JobDescriptionClassification, MatchScore, ResumeAnalysisResult, TrustCardResult } from '../types'

const LEGACY_STORAGE_KEY = 'refai_analysis_session'
const STORAGE_KEY_PREFIX = 'refai_analysis_session:'

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
  jobDescriptionClassification?: JobDescriptionClassification
  usedGeneralRoleExpectations?: boolean
  analyzedAt?: string
  processingTimeMs?: number
}

export function clearAnalysisSession() {
  sessionStorage.removeItem(LEGACY_STORAGE_KEY)

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(STORAGE_KEY_PREFIX)) sessionStorage.removeItem(key)
  }
}
