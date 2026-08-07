import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { retryRead } from '../lib/requestSafety'
import { clearAnalysisSession } from '../lib/analysisSession'
import type { User } from '@supabase/supabase-js'

const STORAGE_KEY = 'refai_demo_mode'
const DECISION_KEY = 'refai_demo_decision'
const JOURNEY_KEY = 'refai_demo_journey_stage'
export type DemoDecision = 'pending' | 'approved' | 'declined' | 'more_info_requested'
export type DemoJourneyStage = 'profile' | 'resume-uploaded' | 'analyzed' | 'trust-card-generated' | 'employee-selected' | 'message-generated' | 'message-reviewed' | 'referral-sent'
export type AuthenticatedRole = 'student' | 'employee'
const DEMO_JOURNEY_ORDER: DemoJourneyStage[] = ['profile', 'resume-uploaded', 'analyzed', 'trust-card-generated', 'employee-selected', 'message-generated', 'message-reviewed', 'referral-sent']

export function hasReachedDemoStage(current: DemoJourneyStage, required: DemoJourneyStage) {
  return DEMO_JOURNEY_ORDER.indexOf(current) >= DEMO_JOURNEY_ORDER.indexOf(required)
}
type DemoModeValue = {
  isDemoMode: boolean
  isJudgeMode: boolean
  hasAuthenticatedUser: boolean
  authenticatedUserId: string | null
  authenticatedUser: User | null
  authenticatedRole: AuthenticatedRole | null
  canEnterDemoMode: boolean
  canUseJudgeMode: boolean
  authLoading: boolean
  demoDecision: DemoDecision
  demoJourneyStage: DemoJourneyStage
  enterDemoMode: () => void
  exitDemoMode: () => void
  setJudgeMode: (enabled: boolean) => void
  setDemoDecision: (decision: DemoDecision) => void
  setDemoJourneyStage: (stage: DemoJourneyStage) => void
}
const DemoModeContext = createContext<DemoModeValue | null>(null)

function readAuthenticatedRole(role: unknown): AuthenticatedRole | null {
  return role === 'student' || role === 'employee' ? role : null
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [hasAuthenticatedUser, setHasAuthenticatedUser] = useState(false)
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null)
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null)
  const [authenticatedRole, setAuthenticatedRole] = useState<AuthenticatedRole | null>(null)
  const previousAuthenticatedUserId = useRef<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const requestedFromLanding = new URLSearchParams(window.location.search).get('demo') === '1'
  const [demoRequested, setDemoRequested] = useState(() => sessionStorage.getItem(STORAGE_KEY) === 'true' || requestedFromLanding)
  const [demoDecision, updateDemoDecision] = useState<DemoDecision>(() => requestedFromLanding ? 'pending' : (sessionStorage.getItem(DECISION_KEY) as DemoDecision | null) ?? 'pending')
  const [demoJourneyStage, updateDemoJourneyStage] = useState<DemoJourneyStage>(() => requestedFromLanding ? 'profile' : (sessionStorage.getItem(JOURNEY_KEY) as DemoJourneyStage | null) ?? 'profile')
  useEffect(() => {
    let active = true
    const applyAuthenticatedUser = (user: User | null | undefined) => {
      const nextUserId = user?.id ?? null
      const previousUserId = previousAuthenticatedUserId.current
      if (previousUserId && previousUserId !== nextUserId) {
        clearAnalysisSession({ kind: 'authenticated', userId: previousUserId })
      }
      previousAuthenticatedUserId.current = nextUserId
      setHasAuthenticatedUser(Boolean(user))
      setAuthenticatedUserId(nextUserId)
      setAuthenticatedUser(user ?? null)
      setAuthenticatedRole(readAuthenticatedRole(user?.user_metadata?.role))
    }
    retryRead(async () => {
      const result = await supabase.auth.getSession()
      if (result.error) throw result.error
      return result
    }).then(({ data }) => {
      if (!active) return
      const authenticated = Boolean(data.session?.user)
      applyAuthenticatedUser(data.session?.user)
      if (authenticated) { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(DECISION_KEY); sessionStorage.removeItem(JOURNEY_KEY); setDemoRequested(false) }
      else if (requestedFromLanding) {
        sessionStorage.setItem(STORAGE_KEY, 'true')
        sessionStorage.setItem(DECISION_KEY, 'pending')
        sessionStorage.setItem(JOURNEY_KEY, 'profile')
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`)
      }
      setAuthLoading(false)
    }).catch(() => { if (active) setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = Boolean(session?.user)
      applyAuthenticatedUser(session?.user)
      if (authenticated) { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(DECISION_KEY); sessionStorage.removeItem(JOURNEY_KEY); setDemoRequested(false) }
      setAuthLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  const enterDemoMode = useCallback(() => { if (!hasAuthenticatedUser) { clearAnalysisSession({ kind: 'demo' }); sessionStorage.setItem(STORAGE_KEY, 'true'); sessionStorage.setItem(DECISION_KEY, 'pending'); sessionStorage.setItem(JOURNEY_KEY, 'profile'); updateDemoDecision('pending'); updateDemoJourneyStage('profile'); setDemoRequested(true) } }, [hasAuthenticatedUser])
  const exitDemoMode = useCallback(() => { clearAnalysisSession({ kind: 'demo' }); sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(DECISION_KEY); sessionStorage.removeItem(JOURNEY_KEY); setDemoRequested(false); updateDemoDecision('pending'); updateDemoJourneyStage('profile') }, [])
  const setJudgeMode = useCallback((enabled: boolean) => { if (enabled) enterDemoMode(); else exitDemoMode() }, [enterDemoMode, exitDemoMode])
  const setDemoDecision = useCallback((decision: DemoDecision) => { sessionStorage.setItem(DECISION_KEY, decision); updateDemoDecision(decision) }, [])
  const setDemoJourneyStage = useCallback((stage: DemoJourneyStage) => { sessionStorage.setItem(JOURNEY_KEY, stage); updateDemoJourneyStage(stage) }, [])
  const isDemoMode = demoRequested && !hasAuthenticatedUser && !authLoading
  const canEnterDemoMode = !authLoading && !hasAuthenticatedUser
  const canUseJudgeMode = canEnterDemoMode && (import.meta.env.DEV || isDemoMode)
  const value = useMemo(() => ({ isDemoMode, isJudgeMode: isDemoMode, hasAuthenticatedUser, authenticatedUserId, authenticatedUser, authenticatedRole, canEnterDemoMode, canUseJudgeMode, authLoading, demoDecision, demoJourneyStage, enterDemoMode, exitDemoMode, setJudgeMode, setDemoDecision, setDemoJourneyStage }), [authLoading, authenticatedRole, authenticatedUser, authenticatedUserId, canEnterDemoMode, canUseJudgeMode, demoDecision, demoJourneyStage, enterDemoMode, exitDemoMode, hasAuthenticatedUser, isDemoMode, setDemoDecision, setDemoJourneyStage, setJudgeMode])
  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
}

export function useDemoMode() {
  const value = useContext(DemoModeContext)
  if (!value) throw new Error('useDemoMode must be used inside DemoModeProvider')
  return value
}
