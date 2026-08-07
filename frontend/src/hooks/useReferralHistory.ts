import { useCallback, useEffect, useState } from 'react'

import { api } from '../lib/apiClient'
import { parseReferralHistory } from '../lib/referralHistoryContract'
import type { ReferralStatusHistoryEntry } from '../types'

/**
 * Loads one referral's persisted timeline only after its owner opens it.
 * History is deliberately not retried automatically: a server failure should
 * stay visible until the user chooses to retry, rather than amplifying it from
 * every dashboard card.
 */
export function useReferralHistory(requestId: string, enabled: boolean) {
  const [events, setEvents] = useState<ReferralStatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    if (!enabled || !requestId) {
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    api.get<unknown>(`/referral/requests/${requestId}/history`, {
      signal: controller.signal,
      headers: { 'X-RefAI-No-Retry': 'true' },
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setEvents(parseReferralHistory(data))
        }
      })
      .catch((historyError) => {
        if (!controller.signal.aborted) {
          setEvents([])
          setError(historyError)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [enabled, requestId, refreshVersion])

  const retry = useCallback(() => {
    setRefreshVersion((current) => current + 1)
  }, [])

  return { events, loading, error, retry }
}
