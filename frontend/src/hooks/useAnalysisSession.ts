import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { getAnalysisSessionScope, loadAnalysisSession } from '../lib/analysisSession'
import type { AnalysisSession } from '../lib/analysisSession'
import type { TrustCardResult } from '../types'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession } from '../lib/demoData'
import { api } from '../lib/apiClient'
import { parsePersistedAnalysisSessionResponse } from '../lib/resumeContract'
import { FriendlyRequestError } from '../lib/requestSafety'
import { createUserScopedResource, type UserScopedResourceState } from '../lib/userScopedResource'

const analysisResource = createUserScopedResource<AnalysisSession>(() => ({}))
const EMPTY_ANALYSIS_STATE: UserScopedResourceState<AnalysisSession> = { userId: null, data: {}, loading: false, loaded: false, notFound: false, error: null }

async function loadLatestAnalysis(signal: AbortSignal) {
  const { data, status } = await api.get<unknown>('/resume/analysis/latest', { signal })
  return parsePersistedAnalysisSessionResponse(data, status) as AnalysisSession
}

export function setAuthenticatedAnalysisSession(userId: string, session: AnalysisSession) {
  analysisResource.setData(userId, session)
}

export function setAuthenticatedTrustCard(userId: string, analysisId: string, trustCard: TrustCardResult) {
  const current = analysisResource.getSnapshot(userId).data
  if (current.analysisId && current.analysisId !== analysisId) return
  analysisResource.setData(userId, { ...current, analysisId, trustCard })
}

export function refreshAuthenticatedAnalysisSession(userId: string) {
  return analysisResource.load(userId, loadLatestAnalysis, true)
}

export function clearAuthenticatedAnalysisSession(userId: string) {
  analysisResource.clear(userId)
}

export function useAnalysisSessionResource(initialSession?: AnalysisSession) {
  const { isDemoMode, authenticatedUserId, demoJourneyStage, authLoading } = useDemoMode()
  const userId = authenticatedUserId ?? ''
  const subscribe = useCallback((listener: () => void) => userId ? analysisResource.subscribe(userId, listener) : () => undefined, [userId])
  const getSnapshot = useCallback(() => userId ? analysisResource.getSnapshot(userId) : EMPTY_ANALYSIS_STATE, [userId])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (isDemoMode || authLoading) return
    analysisResource.activate(authenticatedUserId)
    if (!authenticatedUserId) return
    if (initialSession?.analysisId && state.data.analysisId !== initialSession.analysisId) analysisResource.setData(authenticatedUserId, initialSession)
    else void analysisResource.load(authenticatedUserId, loadLatestAnalysis)
  }, [authLoading, authenticatedUserId, initialSession, isDemoMode, state.data.analysisId])

  const session = useMemo(() => {
    if (!isDemoMode) return state.data
    const scope = getAnalysisSessionScope(isDemoMode, authenticatedUserId)
    const storedSession = loadAnalysisSession(scope)
    const stagedSession = {
      role: demoAnalysisSession.role,
      jobDescription: demoAnalysisSession.jobDescription,
      ...(hasReachedDemoStage(demoJourneyStage, 'resume-uploaded') ? { upload: demoAnalysisSession.upload } : {}),
      ...(hasReachedDemoStage(demoJourneyStage, 'analyzed') ? { matchScore: demoAnalysisSession.matchScore, analysis: demoAnalysisSession.analysis, analyzedAt: demoAnalysisSession.analyzedAt, processingTimeMs: demoAnalysisSession.processingTimeMs } : {}),
      ...(hasReachedDemoStage(demoJourneyStage, 'trust-card-generated') ? { trustCard: demoAnalysisSession.trustCard } : {}),
    }
    return { ...stagedSession, ...storedSession }
  }, [authenticatedUserId, demoJourneyStage, isDemoMode, state.data])

  const retry = useCallback(() => {
    if (authenticatedUserId) void refreshAuthenticatedAnalysisSession(authenticatedUserId)
  }, [authenticatedUserId])

  return {
    session,
    loading: isDemoMode ? false : authLoading || state.loading || (Boolean(authenticatedUserId) && !state.loaded),
    error: !isDemoMode && !authenticatedUserId && !authLoading ? new FriendlyRequestError('auth', 'Your session is unavailable. Sign in again to load resume analysis.', 401) : state.error,
    notFound: isDemoMode ? false : state.notFound,
    retry,
  }
}

export function useAnalysisSession() {
  return useAnalysisSessionResource().session
}
