import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'

import { supabase } from './supabase'
import {
  FriendlyRequestError,
  friendlyErrorMessage,
  requireOnline,
  retryRead,
} from './requestSafety'

type RetryConfig = InternalAxiosRequestConfig & {
  _refaiRetryCount?: number
  _refaiAuthRetry?: boolean
}

const RETRYABLE_STATUS = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
])

export const api = axios.create({
  baseURL:
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    'http://localhost:8000',
  timeout: 30_000,
})

/**
 * Attach the latest Supabase access token to every backend request.
 */
api.interceptors.request.use(async (config) => {
  requireOnline()

  const { data } = await retryRead(async () => {
    const result = await supabase.auth.getSession()

    if (result.error) {
      throw result.error
    }

    return result
  })

  const token = data.session?.access_token

  if (!token) {
    throw new FriendlyRequestError(
      'auth',
      'Your session is unavailable. Sign in again before continuing.',
    )
  }

  config.headers.Authorization = `Bearer ${token}`

  if (import.meta.env.DEV) {
    console.debug('[RefAI API request]', {
      method: config.method?.toUpperCase(),
      endpoint: config.url,
      baseURL: config.baseURL,
      hasBearerAccessToken: true,
    })
  }

  return config
})

api.interceptors.response.use(
  (response) => response,

  async (error: unknown) => {
    if (error instanceof FriendlyRequestError) {
      return Promise.reject(error)
    }

    const axiosError = error as AxiosError
    const config = axiosError.config as RetryConfig | undefined

    const status = axiosError.response?.status
    const method = config?.method?.toUpperCase()

    /**
     * Refresh an expired Supabase session once when the backend returns 401.
     */
    if (status === 401 && config && !config._refaiAuthRetry) {
      config._refaiAuthRetry = true

      try {
        const {
          data: { session },
          error: refreshError,
        } = await supabase.auth.refreshSession()

        if (refreshError || !session?.access_token) {
          console.error('[RefAI session refresh failed]', refreshError)

          await supabase.auth.signOut()

          return Promise.reject(
            new FriendlyRequestError(
              'auth',
              'Your session has expired. Sign in again.',
              401,
            ),
          )
        }

        config.headers.Authorization =
          `Bearer ${session.access_token}`

        return api.request(config)
      } catch (refreshFailure) {
        console.error(
          '[RefAI session refresh exception]',
          refreshFailure,
        )

        await supabase.auth.signOut()

        return Promise.reject(
          new FriendlyRequestError(
            'auth',
            'Your session has expired. Sign in again.',
            401,
          ),
        )
      }
    }

    /**
     * Retry safe read requests for temporary backend/network failures.
     */
    const safeToRetry =
      method === 'GET' ||
      method === 'HEAD' ||
      method === 'OPTIONS'

    const retryableFailure =
      !axiosError.response ||
      RETRYABLE_STATUS.has(status ?? 0)

    const retryCount = config?._refaiRetryCount ?? 0
    const headers = config?.headers as (Record<string, unknown> & {
      get?: (name: string) => unknown
    }) | undefined
    const retryOptOut = String(
      headers?.get?.('X-RefAI-No-Retry') ??
      headers?.['X-RefAI-No-Retry'] ??
      headers?.['x-refai-no-retry'] ??
      '',
    ).toLowerCase() === 'true'

    if (
      config &&
      safeToRetry &&
      retryableFailure &&
      !retryOptOut &&
      retryCount < 2 &&
      navigator.onLine
    ) {
      config._refaiRetryCount = retryCount + 1

      await new Promise((resolve) =>
        window.setTimeout(
          resolve,
          350 * config._refaiRetryCount!,
        ),
      )

      return api.request(config)
    }

    const responseData = axiosError.response?.data

    const isStudentProfileRequest =
      config?.url?.includes('/auth/student-profile') ?? false

    const isStudentProfileSave =
      isStudentProfileRequest && method === 'PUT'

    const isExpectedEmptyAnalysis =
      status === 404 &&
      config?.url?.includes('/resume/analysis/latest')

    const isExpectedEmptyAIApply =
      status === 404 &&
      config?.url?.includes('/ai-apply/goals/latest')

    const backendDetail =
      typeof responseData === 'object' &&
      responseData !== null &&
      'detail' in responseData &&
      typeof responseData.detail === 'string'
        ? responseData.detail
        : undefined

    if (
      !isExpectedEmptyAnalysis &&
      !isExpectedEmptyAIApply
    ) {
      console.error('[RefAI API request failed]', {
        method,
        endpoint: config?.url,
        baseURL: config?.baseURL,
        status,
        code: axiosError.code,
        response: responseData,
      })
    }

    let kind: FriendlyRequestError['kind'] = 'unknown'

    let fallback =
      'RefAI could not complete that request. Please try again.'

    if (!navigator.onLine) {
      kind = 'offline'
      fallback =
        'You appear to be offline. Reconnect and try again.'
    } else if (
      axiosError.code === 'ECONNABORTED' ||
      axiosError.code === 'ETIMEDOUT'
    ) {
      kind = 'timeout'
      fallback =
        'The request took too long. Check your connection and try again.'
    } else if (!axiosError.response) {
      kind = 'network'
      fallback = isStudentProfileRequest
        ? 'Unable to connect to the RefAI backend.'
        : 'RefAI could not reach the service. Check your connection and try again.'
    } else if (status === 401) {
      kind = 'auth'
      fallback =
        'Your session has expired. Sign in again and retry.'
    } else if (status === 403) {
      kind = 'auth'
      fallback =
        'You do not have permission to perform this action.'
    } else if (
      status === 422 &&
      isStudentProfileSave
    ) {
      kind = 'validation'
      fallback = backendDetail
        ? `Profile validation failed: ${backendDetail}`
        : 'Profile validation failed. Review the highlighted fields and try again.'
    } else if (
      status &&
      status >= 500 &&
      isStudentProfileSave
    ) {
      kind = 'server'
      fallback = backendDetail
        ? `Profile could not be saved: ${backendDetail}`
        : 'Profile could not be saved. Please try again.'
    } else if (
      status === 404 &&
      config?.url?.includes('/resume/upload')
    ) {
      fallback =
        'The resume upload service could not be found. Check that the RefAI backend is running and VITE_API_BASE_URL points to it.'
    } else if (
      status === 404 &&
      (
        config?.url?.includes('/resume/analyze') ||
        config?.url?.includes('/match/score')
      )
    ) {
      fallback =
        'The resume analysis service could not be found. Check the backend connection and try again.'
    } else if (
      status === 404 &&
      config?.url?.includes('/trust-card/generate')
    ) {
      fallback =
        'The Trust Card service could not be found. Check the backend connection and try again.'
    } else if (
      status === 404 &&
      config?.url?.includes('/resume/analysis/latest')
    ) {
      fallback =
        'No saved resume analysis is available yet.'
    } else if (
      status === 404 &&
      config?.url?.includes(
        '/referral/employee/requests/',
      ) &&
      config?.url?.endsWith('/resume')
    ) {
      fallback =
        'No private resume is available for this assigned referral request.'
    } else if (
      status === 404 &&
      config?.url?.includes(
        '/referral/employee/requests/',
      ) &&
      config?.url?.endsWith('/trust-card')
    ) {
      fallback =
        'No persisted Trust Card is available for this assigned referral request.'
    } else if (
      status === 404 &&
      config?.url?.includes(
        '/referral/employee/requests/',
      )
    ) {
      fallback =
        'This referral request was not found or is no longer available.'
    } else if (status === 404) {
      fallback =
        'This RefAI service endpoint could not be found. Check the backend configuration and try again.'
    } else if (status === 408) {
      kind = 'timeout'
      fallback =
        'The request took too long. Please try again.'
    } else if (status === 413) {
      kind = 'validation'
      fallback =
        'This file is too large to process. Choose a smaller PDF.'
    } else if (status === 415) {
      kind = 'validation'
      fallback =
        'This file type is not supported. Choose a PDF resume.'
    } else if (status === 400) {
      kind = 'validation'
      fallback =
        backendDetail ||
        'The request is invalid or incomplete. Review the submitted information and try again.'
    } else if (
      config?.url?.includes('/ai-apply/requests') &&
      status &&
      [402, 409, 422, 429].includes(status)
    ) {
      kind =
        status === 429
          ? 'rate-limit'
          : 'validation'

      fallback =
        backendDetail ||
        'The AI Apply request did not pass the current submission safeguards.'
    } else if (status === 422) {
      kind = 'validation'
      fallback =
        backendDetail ||
        'The request did not match the backend validation schema. Check the submitted information and retry.'
    } else if (status === 429) {
      kind = 'rate-limit'
      fallback =
        'Too many requests were sent. Wait a moment and try again.'
    } else if (
      status &&
      status >= 500 &&
      config?.url?.includes('/resume/upload')
    ) {
      kind = 'server'
      fallback =
        'The resume service could not process this PDF. Try another text-based PDF or retry when the backend is available.'
    } else if (
      status &&
      status >= 500 &&
      (
        config?.url?.includes('/resume/analyze') ||
        config?.url?.includes('/match/score')
      )
    ) {
      kind = 'server'
      fallback =
        'The analysis service is temporarily unavailable. Your uploaded resume remains available in this session.'
    } else if (
      status &&
      status >= 500
    ) {
      kind = 'server'
      fallback =
        backendDetail ||
        'The RefAI backend is temporarily unavailable. Please try again shortly.'
    }

    return Promise.reject(
      new FriendlyRequestError(
        kind,
        friendlyErrorMessage(
          axiosError,
          fallback,
        ),
        status,
        backendDetail,
      ),
    )
  },
)
