import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import { api } from '../lib/apiClient'
import { createUserScopedResource, type UserScopedResourceState } from '../lib/userScopedResource'
import type { CandidateIntelligenceResult } from '../types'

const intelligenceResource = createUserScopedResource<CandidateIntelligenceResult | null>(() => null)
const EMPTY_STATE: UserScopedResourceState<CandidateIntelligenceResult | null> = {
  userId: null, data: null, loading: false, loaded: false, notFound: false, error: null,
}

export function useCandidateIntelligence(analysisId: string | null | undefined, enabled: boolean) {
  const { authenticatedUserId, authLoading } = useAuthSession()
  // The authenticated user ID remains part of the key so an account switch can
  // never render a previous student's intelligence data.
  const key = authenticatedUserId && analysisId ? `${authenticatedUserId}:${analysisId}` : ''
  const subscribe = useCallback((listener: () => void) => key ? intelligenceResource.subscribe(key, listener) : () => undefined, [key])
  const getSnapshot = useCallback(() => key ? intelligenceResource.getSnapshot(key) : EMPTY_STATE, [key])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (authLoading) return
    intelligenceResource.activate(key || null)
    if (!key || !enabled) return
    void intelligenceResource.load(key, async (signal) => {
      const { data } = await api.get<CandidateIntelligenceResult>('/resume/analysis/candidate-intelligence', { signal })
      return data
    })
  }, [authLoading, enabled, key])

  const retry = useCallback(() => {
    if (!key || !enabled) return
    void intelligenceResource.load(key, async (signal) => {
      const { data } = await api.get<CandidateIntelligenceResult>('/resume/analysis/candidate-intelligence', { signal })
      return data
    }, true)
  }, [enabled, key])

  return { data: state.data, loading: authLoading || (enabled && Boolean(key) && !state.loaded) || state.loading, error: state.error, notFound: state.notFound, retry }
}
