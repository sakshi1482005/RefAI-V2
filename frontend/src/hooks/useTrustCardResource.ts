import {
  useCallback,
  useEffect,
  useSyncExternalStore
} from 'react'

import { useDemoMode } from '../context/DemoModeContext'
import { api } from '../lib/apiClient'
import { parseTrustCardResponse } from '../lib/resumeContract'
import {
  createUserScopedResource,
  type UserScopedResourceState
} from '../lib/userScopedResource'

import type { TrustCardResult } from '../types'
import { setAuthenticatedTrustCard } from './useAnalysisSession'


const trustCardResource =
  createUserScopedResource<TrustCardResult | null>(() => null)


const EMPTY_STATE: UserScopedResourceState<TrustCardResult | null> = {
  userId: null,
  data: null,
  loading: false,
  loaded: false,
  notFound: false,
  error: null,
}


const resourceKey = (
  userId: string,
  analysisId: string
) => `${userId}:${analysisId}`


async function loadPersistedTrustCard(
  userId: string,
  analysisId: string,
  signal: AbortSignal
) {
  const { data, status } = await api.get(
    '/trust-card/current',
    {
      params: { analysisId },
      signal,
    }
  )

  const card = parseTrustCardResponse(
    data,
    status,
    '/trust-card/current'
  )

  setAuthenticatedTrustCard(
    userId,
    analysisId,
    card
  )

  return card
}


export function prefetchAuthenticatedTrustCard(
  userId: string,
  analysisId: string
) {
  const key = resourceKey(userId, analysisId)

  trustCardResource.activate(key)

  return trustCardResource.load(
    key,
    (signal) =>
      loadPersistedTrustCard(
        userId,
        analysisId,
        signal
      )
  ).then(() => trustCardResource.getSnapshot(key).data)
}


export function setAuthenticatedTrustCardResource(
  userId: string,
  analysisId: string,
  card: TrustCardResult
) {
  const key = resourceKey(userId, analysisId)

  trustCardResource.activate(key)
  trustCardResource.setData(key, card)

  setAuthenticatedTrustCard(
    userId,
    analysisId,
    card
  )
}


export function invalidateAuthenticatedTrustCard(
  userId: string,
  analysisId: string
) {
  trustCardResource.clear(
    resourceKey(userId, analysisId)
  )
}


export function useTrustCardResource({
  analysisId,
  initialCard,
  autoLoad = true,
}: {
  analysisId?: string
  initialCard?: TrustCardResult
  autoLoad?: boolean
}) {
  const {
    isDemoMode,
    authenticatedUserId,
    authLoading
  } = useDemoMode()

  const key =
    authenticatedUserId && analysisId
      ? resourceKey(
          authenticatedUserId,
          analysisId
        )
      : ''

  const subscribe = useCallback(
    (listener: () => void) =>
      key
        ? trustCardResource.subscribe(
            key,
            listener
          )
        : () => undefined,
    [key]
  )

  const getSnapshot = useCallback(
    () =>
      key
        ? trustCardResource.getSnapshot(key)
        : EMPTY_STATE,
    [key]
  )

  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )


  useEffect(() => {
    if (
      isDemoMode ||
      authLoading ||
      !authenticatedUserId ||
      !analysisId
    ) {
      return
    }

    trustCardResource.activate(key)

    // Trust Card already came with analysis.
    // Use it immediately.
    if (initialCard) {
      if (state.data?.id !== initialCard.id) {
        trustCardResource.setData(
          key,
          initialCard
        )
      }

      return
    }

    // Already cached / loading / loaded.
    // Do not request it again.
    if (
      state.data ||
      state.loaded ||
      state.loading
    ) {
      return
    }

    if (autoLoad) {
      void prefetchAuthenticatedTrustCard(
        authenticatedUserId,
        analysisId
      )
    }
  }, [
    analysisId,
    authLoading,
    authenticatedUserId,
    autoLoad,
    initialCard,
    isDemoMode,
    key,
    state.data,
    state.loaded,
    state.loading,
  ])


  const prefetch = useCallback(async () => {
    if (
      !authenticatedUserId ||
      !analysisId ||
      isDemoMode
    ) {
      return {
        card: null,
        notFound: false,
        error: null,
      }
    }

    const card = await prefetchAuthenticatedTrustCard(
      authenticatedUserId,
      analysisId
    )
    const nextState = trustCardResource.getSnapshot(key)

    return {
      card,
      notFound: nextState.notFound,
      error: nextState.error,
    }
  }, [
    analysisId,
    authenticatedUserId,
    isDemoMode,
    key,
  ])


  return {
    card: isDemoMode
      ? initialCard ?? null
      : state.data ?? initialCard ?? null,

    loadingPersisted:
      !isDemoMode &&
      Boolean(analysisId) &&
      !state.data &&
      !initialCard &&
      (
        authLoading ||
        state.loading ||
        (autoLoad && !state.loaded)
      ),

    notFound:
      !isDemoMode &&
      state.notFound,

    error:
      isDemoMode
        ? null
        : state.error,

    prefetch,
  }
}
