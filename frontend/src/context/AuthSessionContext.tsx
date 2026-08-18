import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { retryRead } from '../lib/requestSafety'
import { clearAnalysisSession } from '../lib/analysisSession'

export type AuthenticatedRole = 'student' | 'employee'

type AuthSessionValue = {
  hasAuthenticatedUser: boolean
  authenticatedUserId: string | null
  authenticatedUser: User | null
  authenticatedRole: AuthenticatedRole | null
  authLoading: boolean
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null)

function readAuthenticatedRole(role: unknown): AuthenticatedRole | null {
  return role === 'student' || role === 'employee' ? role : null
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null)
  const [authenticatedRole, setAuthenticatedRole] = useState<AuthenticatedRole | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const previousAuthenticatedUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    const applyAuthenticatedUser = (user: User | null | undefined) => {
      const nextUserId = user?.id ?? null
      const previousUserId = previousAuthenticatedUserId.current
      if (previousUserId && previousUserId !== nextUserId) clearAnalysisSession()
      previousAuthenticatedUserId.current = nextUserId
      setAuthenticatedUser(user ?? null)
      setAuthenticatedRole(readAuthenticatedRole(user?.user_metadata?.role))
    }
    void retryRead(async () => {
      const result = await supabase.auth.getSession()
      if (result.error) throw result.error
      return result
    }).then(({ data }) => {
      if (!active) return
      applyAuthenticatedUser(data.session?.user)
      setAuthLoading(false)
    }).catch(() => { if (active) setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthenticatedUser(session?.user)
      setAuthLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const value = useMemo(() => ({
    hasAuthenticatedUser: Boolean(authenticatedUser),
    authenticatedUserId: authenticatedUser?.id ?? null,
    authenticatedUser,
    authenticatedRole,
    authLoading,
  }), [authenticatedRole, authenticatedUser, authLoading])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider')
  return value
}
