const DEFAULT_TIMEOUT_MS = 15_000

export class FriendlyRequestError extends Error {
  constructor(public readonly kind: 'offline' | 'timeout' | 'auth' | 'rate-limit' | 'validation' | 'server' | 'network' | 'unknown', message: string) {
    super(message)
    this.name = 'FriendlyRequestError'
  }
}

export function friendlyErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof FriendlyRequestError) return error.message
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You appear to be offline. Reconnect and try again.'

  const raw = error instanceof Error ? error.message.toLowerCase() : ''
  if (raw.includes('invalid login credentials')) return 'Email or password is incorrect. If you recently signed up, confirm your email first or reset your password.'
  if (raw.includes('email not confirmed')) return 'Please confirm your email using the link we sent before logging in.'
  if (raw.includes('already registered') || raw.includes('already exists')) return 'An account with this email already exists. Log in or use Forgot password.'
  if (raw.includes('rate limit') || raw.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.'
  if (raw.includes('timeout') || raw.includes('timed out') || raw.includes('abort')) return 'The request took too long. Check your connection and try again.'
  if (raw.includes('failed to fetch') || raw.includes('network')) return 'RefAI could not reach the service. Check your connection and try again.'
  return fallback
}

export function requireOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new FriendlyRequestError('offline', 'You appear to be offline. Reconnect and try again.')
  }
}

export async function withRequestTimeout<T>(request: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new FriendlyRequestError('timeout', 'The request took too long. Check your connection and try again.')), timeoutMs)
  })
  try {
    return await Promise.race([request, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function retryRead<T>(request: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      requireOnline()
      return await withRequestTimeout(request())
    } catch (error) {
      lastError = error
      if (error instanceof FriendlyRequestError && error.kind === 'offline') break
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
    }
  }
  throw lastError
}
