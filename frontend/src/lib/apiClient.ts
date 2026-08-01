import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { supabase } from './supabase'
import { FriendlyRequestError, friendlyErrorMessage, requireOnline, retryRead } from './requestSafety'

type RetryConfig = InternalAxiosRequestConfig & { _refaiRetryCount?: number }
const RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504])

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8000',
  timeout: 30_000,
})

// Attach the Supabase session token to every request so FastAPI
// can verify the user on the backend.
api.interceptors.request.use(async (config) => {
  requireOnline()
  const { data } = await retryRead(async () => {
    const result = await supabase.auth.getSession()
    if (result.error) throw result.error
    return result
  })
  const token = data.session?.access_token
  if (!token) throw new FriendlyRequestError('auth', 'Your session is unavailable. Sign in again before uploading a resume.')
  config.headers.Authorization = `Bearer ${token}`
  if (import.meta.env.DEV && (config.url?.includes('/resume/') || config.url?.includes('/match/'))) {
    console.debug('[RefAI resume API request]', {
      method: config.method?.toUpperCase(),
      endpoint: config.url,
      baseURL: config.baseURL,
      hasBearerAccessToken: true,
    })
  }
  return config
})

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (error instanceof FriendlyRequestError) return Promise.reject(error)
  const axiosError = error as AxiosError
  const config = axiosError.config as RetryConfig | undefined
  const method = config?.method?.toUpperCase()
  const safeToRetry = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
  const retryableFailure = !axiosError.response || RETRYABLE_STATUS.has(axiosError.response.status)
  const retryCount = config?._refaiRetryCount ?? 0

  if (config && safeToRetry && retryableFailure && retryCount < 2 && navigator.onLine) {
    config._refaiRetryCount = retryCount + 1
    await new Promise((resolve) => setTimeout(resolve, 350 * config._refaiRetryCount!))
    return api.request(config)
  }

  const status = axiosError.response?.status
  const responseData = axiosError.response?.data
  const isStudentProfileRequest = config?.url?.includes('/auth/student-profile') ?? false
  const isStudentProfileSave = isStudentProfileRequest && method === 'PUT'
  const isExpectedEmptyAnalysis = status === 404 && config?.url?.includes('/resume/analysis/latest')
  const backendDetail = typeof responseData === 'object' && responseData !== null && 'detail' in responseData && typeof responseData.detail === 'string'
    ? responseData.detail
    : undefined
  if (!isExpectedEmptyAnalysis) {
    console.error('[RefAI API request failed]', {
      method: config?.method?.toUpperCase(),
      endpoint: config?.url,
      baseURL: config?.baseURL,
      status,
      code: axiosError.code,
      response: axiosError.response?.data,
    })
  }
  let kind: FriendlyRequestError['kind'] = 'unknown'
  let fallback = 'RefAI could not complete that request. Please try again.'
  if (!navigator.onLine) { kind = 'offline'; fallback = 'You appear to be offline. Reconnect and try again.' }
  else if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') { kind = 'timeout'; fallback = 'The request took too long. Check your connection and try again.' }
  else if (!axiosError.response) { kind = 'network'; fallback = isStudentProfileRequest ? 'Unable to connect to the RefAI backend.' : 'RefAI could not reach the service. Check your connection and try again.' }
  else if (status === 401) { kind = 'auth'; fallback = 'Your session has expired. Sign in again and retry.' }
  else if (status === 403) { kind = 'auth'; fallback = 'You do not have permission to perform this action.' }
  else if (status === 422 && isStudentProfileSave) { kind = 'validation'; fallback = `Profile validation failed${backendDetail ? `: ${backendDetail}` : '. Review the highlighted fields and try again.'}` }
  else if (status && status >= 500 && isStudentProfileSave) { kind = 'server'; fallback = `Profile could not be saved${backendDetail ? `: ${backendDetail}` : '. Please try again.'}` }
  else if (status === 404 && config?.url?.includes('/resume/upload')) { fallback = 'The resume upload service could not be found. Check that the RefAI backend is running and VITE_API_BASE_URL points to it.' }
  else if (status === 404 && (config?.url?.includes('/resume/analyze') || config?.url?.includes('/match/score'))) { fallback = 'The resume analysis service could not be found. Check the backend connection and try again.' }
  else if (status === 404 && config?.url?.includes('/trust-card/generate')) { fallback = 'The Trust Card service could not be found. Check the backend connection and try again.' }
  else if (status === 404 && config?.url?.includes('/resume/analysis/latest')) { fallback = 'No saved resume analysis is available yet.' }
  else if (status === 404 && config?.url?.includes('/referral/employee/requests/') && config?.url?.endsWith('/resume')) { fallback = 'No private resume is available for this assigned referral request.' }
  else if (status === 404 && config?.url?.includes('/referral/employee/requests/') && config?.url?.endsWith('/trust-card')) { fallback = 'No persisted Trust Card is available for this assigned referral request.' }
  else if (status === 404 && config?.url?.includes('/referral/employee/requests/')) { fallback = 'This referral request was not found or is no longer available.' }
  else if (status === 404) { fallback = 'This RefAI service endpoint could not be found. Check the backend configuration and try again.' }
  else if (status === 408) { kind = 'timeout'; fallback = 'The request took too long. Please try again.' }
  else if (status === 413) { kind = 'validation'; fallback = 'This file is too large to process. Choose a smaller PDF.' }
  else if (status === 415) { kind = 'validation'; fallback = 'This file type is not supported. Choose a PDF resume.' }
  else if (status === 400) { kind = 'validation'; fallback = 'The resume request is invalid or incomplete. Review the submitted information and try again.' }
  else if (status === 422) { kind = 'validation'; fallback = 'The resume request did not match the backend validation schema. Check the PDF and job description, then retry.' }
  else if (status === 429) { kind = 'rate-limit'; fallback = 'Too many requests were sent. Wait a moment and try again.' }
  else if (status && status >= 500 && config?.url?.includes('/resume/upload')) { kind = 'server'; fallback = 'The resume service could not process this PDF. Try another text-based PDF or retry when the backend is available.' }
  else if (status && status >= 500 && (config?.url?.includes('/resume/analyze') || config?.url?.includes('/match/score'))) { kind = 'server'; fallback = 'The analysis service is temporarily unavailable. Your uploaded resume remains available in this session.' }
  else if (status && status >= 500) { kind = 'server'; fallback = 'The RefAI backend is temporarily unavailable. Please try again shortly.' }

  return Promise.reject(new FriendlyRequestError(kind, friendlyErrorMessage(axiosError, fallback), status, backendDetail))
})
