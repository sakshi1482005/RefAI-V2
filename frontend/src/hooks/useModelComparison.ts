import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import { api } from '../lib/apiClient'
import { createUserScopedResource, type UserScopedResourceState } from '../lib/userScopedResource'
import type { ModelComparisonResult } from '../types'

const modelComparisonResource = createUserScopedResource<ModelComparisonResult | null>(() => null)
const EMPTY_STATE: UserScopedResourceState<ModelComparisonResult | null> = {
  userId: null, data: null, loading: false, loaded: false, notFound: false, error: null,
}

/** Read-only, student-scoped view of saved academic intelligence outputs. */
export function useModelComparison(analysisId: string | null | undefined, trustCardVersion: string | null | undefined, enabled: boolean) {
  const { authenticatedUserId, authLoading } = useAuthSession()
  const key = authenticatedUserId && analysisId && trustCardVersion
    ? `${authenticatedUserId}:${analysisId}:${trustCardVersion}`
    : ''
  const subscribe = useCallback((listener: () => void) => key ? modelComparisonResource.subscribe(key, listener) : () => undefined, [key])
  const getSnapshot = useCallback(() => key ? modelComparisonResource.getSnapshot(key) : EMPTY_STATE, [key])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const load = useCallback((force = false) => {
    if (!key || !enabled) return Promise.resolve()
    return modelComparisonResource.load(key, async (signal) => {
      const { data } = await api.get<ModelComparisonResult>('/resume/analysis/model-comparison', { signal, headers: { 'X-RefAI-No-Retry': 'true' } })
      return data
    }, force)
  }, [enabled, key])

  useEffect(() => {
    if (authLoading) return
    modelComparisonResource.activate(key || null)
    if (!key || !enabled) return
    void load()
  }, [authLoading, enabled, key, load])

  return {
    data: state.data,
    loading: authLoading || (enabled && Boolean(key) && !state.loaded) || state.loading,
    error: state.error,
    notFound: state.notFound,
    retry: () => { void load(true) },
  }
}
