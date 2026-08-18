import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import { api } from '../lib/apiClient'
import { createUserScopedResource, type UserScopedResourceState } from '../lib/userScopedResource'

const employeeRequestResource = createUserScopedResource<unknown | null>(() => null)
const EMPTY_STATE: UserScopedResourceState<unknown | null> = {
  userId: null, data: null, loading: false, loaded: false, notFound: false, error: null,
}

export function useEmployeeRequestResource<T>(endpoint: string | null, parse: (value: unknown) => T) {
  const { authenticatedUserId, authLoading } = useAuthSession()
  // The employee identity is part of every key. The same assigned-request
  // lookup is consequently reused across Candidate Review, Resume Viewer,
  // Trust Card details, and the decision confirmation page without allowing
  // an account switch to show a previous employee's data.
  const key = authenticatedUserId && endpoint ? `${authenticatedUserId}:${endpoint}` : ''
  const subscribe = useCallback((listener: () => void) => key ? employeeRequestResource.subscribe(key, listener) : () => undefined, [key])
  const getSnapshot = useCallback(() => key ? employeeRequestResource.getSnapshot(key) : EMPTY_STATE, [key])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (authLoading || !key || !endpoint) return
    void employeeRequestResource.load(key, async (signal) => {
      const response = await api.get<unknown>(endpoint, { signal })
      return response.data
    })
  }, [authLoading, endpoint, key])

  const retry = useCallback(() => {
    if (!key || !endpoint) return
    void employeeRequestResource.load(key, async (signal) => {
      const response = await api.get<unknown>(endpoint, { signal })
      return response.data
    }, true)
  }, [endpoint, key])

  return {
    data: state.data === null ? null : parse(state.data),
    error: state.error,
    loading: authLoading || (Boolean(key) && !state.loaded) || state.loading,
    retry,
  }
}
