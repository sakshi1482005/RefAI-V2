import { useEffect, useMemo, useState } from 'react'
import { getAnalysisSessionScope, loadAnalysisSession } from '../lib/analysisSession'
import type { AnalysisSession } from '../lib/analysisSession'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession } from '../lib/demoData'
import { api } from '../lib/apiClient'

export function useAnalysisSession() {
  const { isDemoMode, authenticatedUserId, demoJourneyStage } = useDemoMode()
  const [persistedSession, setPersistedSession] = useState<AnalysisSession>({})
  useEffect(() => {
    if (isDemoMode || !authenticatedUserId) {
      setPersistedSession({})
      return
    }
    let active = true
    api.get<AnalysisSession>('/resume/analysis/latest')
      .then(({ data }) => { if (active) setPersistedSession(data) })
      .catch((error) => {
        if (active && error?.response?.status === 404) setPersistedSession({})
      })
    return () => { active = false }
  }, [authenticatedUserId, isDemoMode])

  return useMemo(() => {
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
}
