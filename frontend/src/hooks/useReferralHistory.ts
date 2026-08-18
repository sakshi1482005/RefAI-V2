import { useCallback, useEffect, useSyncExternalStore } from 'react'

import { useAuthSession } from '../context/AuthSessionContext'
import { api } from '../lib/apiClient'
import { parseReferralHistory } from '../lib/referralHistoryContract'
import { createUserScopedResource, type UserScopedResourceState } from '../lib/userScopedResource'
import type { ReferralStatusHistoryEntry } from '../types'

const historyResource = createUserScopedResource<ReferralStatusHistoryEntry[]>(() => [])
const EMPTY_STATE: UserScopedResourceState<ReferralStatusHistoryEntry[]> = {
  userId: null, data: [], loading: false, loaded: false, notFound: false, error: null,
}

/**
 * Loads one referral's persisted timeline only after its owner opens it.
 * History is deliberately not retried automatically: a server failure should
 * stay visible until the user chooses to retry, rather than amplifying it from
 * every dashboard card.
 */
export function useReferralHistory(requestId: string, enabled: boolean) {
  const { authenticatedUserId, authLoading } = useAuthSession()
  const key = authenticatedUserId && requestId ? `${authenticatedUserId}:${requestId}` : ''
  const subscribe = useCallback((listener: () => void) => key ? historyResource.subscribe(key, listener) : () => undefined, [key])
  const getSnapshot = useCallback(() => key ? historyResource.getSnapshot(key) : EMPTY_STATE, [key])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (authLoading || !enabled || !requestId || !key) return
    void historyResource.load(key, async (signal) => {
      const { data } = await api.get<unknown>(`/referral/requests/${requestId}/history`, {
        signal,
        headers: { 'X-RefAI-No-Retry': 'true' },
      })
      return parseReferralHistory(data)
    })
  }, [authLoading, enabled, key, requestId])

  const retry = useCallback(() => {
    if (!key || !requestId || !enabled) return
    void historyResource.load(key, async (signal) => {
      const { data } = await api.get<unknown>(`/referral/requests/${requestId}/history`, {
        signal,
        headers: { 'X-RefAI-No-Retry': 'true' },
      })
      return parseReferralHistory(data)
    }, true)
  }, [enabled, key, requestId])

  return {
    events: state.data,
    loading: authLoading || (enabled && Boolean(key) && !state.loaded) || state.loading,
    error: state.error,
    retry,
  }
}
