import { useEffect, useMemo, useState } from 'react'
import { getAnalysisSessionScope, loadAnalysisSession } from '../lib/analysisSession'
import type { AnalysisSession } from '../lib/analysisSession'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession } from '../lib/demoData'
import { api } from '../lib/apiClient'
import { parsePersistedAnalysisSessionResponse } from '../lib/resumeContract'
import { FriendlyRequestError } from '../lib/requestSafety'

export function useAnalysisSessionResource(initialSession?: AnalysisSession) {
  const { isDemoMode, authenticatedUserId, demoJourneyStage, authLoading } = useDemoMode()
  const [persistedSession, setPersistedSession] = useState<AnalysisSession>(initialSession ?? {})
  const [loading, setLoading] = useState(!isDemoMode && !initialSession)
  const [error, setError] = useState<unknown>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (isDemoMode) {
      setPersistedSession({})
      setLoading(false)
      setError(null)
      setNotFound(false)
      return
    }
    if (initialSession?.analysisId) {
      setPersistedSession(initialSession)
      setLoading(false)
      setError(null)
      setNotFound(false)
      return
    }
    if (authLoading) {
      setLoading(true)
      return
    }
    if (!authenticatedUserId) {
      setPersistedSession({})
      setLoading(false)
      setError(new FriendlyRequestError('auth', 'Your session is unavailable. Sign in again to load resume analysis.', 401))
      setNotFound(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    setNotFound(false)
    api.get<unknown>('/resume/analysis/latest')
      .then(({ data, status }) => {
        if (!active) return
        setPersistedSession(parsePersistedAnalysisSessionResponse(data, status) as AnalysisSession)
      })
      .catch((error) => {
        if (!active) return
        setPersistedSession({})
        if (error instanceof FriendlyRequestError && error.status === 404) setNotFound(true)
        else setError(error)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authLoading, authenticatedUserId, initialSession, isDemoMode, retryKey])

  const session = useMemo(() => {
    if (!isDemoMode) return persistedSession
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
  }, [authenticatedUserId, demoJourneyStage, isDemoMode, persistedSession])

  return {
    session,
    loading,
    error,
    notFound,
    retry: () => setRetryKey((current) => current + 1),
  }
}

export function useAnalysisSession() {
  return useAnalysisSessionResource().session
}
