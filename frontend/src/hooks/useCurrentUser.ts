import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { useDemoMode } from '../context/DemoModeContext'
import { demoStudent } from '../lib/demoData'
import { api } from '../lib/apiClient'
import { friendlyErrorMessage } from '../lib/requestSafety'
import { createUserScopedResource } from '../lib/userScopedResource'

export type CurrentUserProfile = {
  id: string
  email: string
  fullName: string
  role: string
  location: string
  headline: string
  college: string
  degree: string
  branch: string
  graduationYear: string
  skills: string[]
  bio: string
  linkedinUrl: string
  githubUrl: string
  portfolioUrl: string
  preferredRole: string
  preferredCompany: string
  resumeVisibility: string
  avatarUrl: string
  emailVerified: boolean
  initials: string
  notificationPreferences?: { referralUpdates?: boolean; trustCardChanges?: boolean; weeklyReadiness?: boolean }
}

type StudentProfileResponse = {
  college?: string | null
  degree?: string | null
  branch?: string | null
  graduationYear?: number | string | null
  preferredRole?: string | null
  preferredCompany?: string | null
  skills?: string[] | null
  bio?: string | null
  linkedinUrl?: string | null
  githubUrl?: string | null
  portfolioUrl?: string | null
}

function toProfile(user: User): CurrentUserProfile {
  const metadata = user.user_metadata ?? {}
  const email = user.email ?? ''
  const fullName = String(metadata.full_name ?? metadata.name ?? email.split('@')[0] ?? '')
  const skills = Array.isArray(metadata.skills) ? metadata.skills.filter((skill): skill is string => typeof skill === 'string') : String(metadata.skills ?? '').split(',').map((skill) => skill.trim()).filter(Boolean)
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '—'
  return {
    id: user.id, email, fullName, role: String(metadata.role ?? ''), location: String(metadata.location ?? ''),
    headline: String(metadata.headline ?? ''), college: String(metadata.college ?? ''), degree: String(metadata.degree ?? ''),
    branch: String(metadata.branch ?? ''), graduationYear: String(metadata.graduation_year ?? ''), skills,
    bio: String(metadata.bio ?? ''), linkedinUrl: String(metadata.linkedin_url ?? ''), githubUrl: String(metadata.github_url ?? ''),
    portfolioUrl: String(metadata.portfolio_url ?? ''), preferredRole: String(metadata.preferred_role ?? ''),
    preferredCompany: String(metadata.preferred_company ?? ''), resumeVisibility: String(metadata.resume_visibility ?? 'private'),
    avatarUrl: String(metadata.avatar_url ?? ''), emailVerified: Boolean(user.email_confirmed_at), initials,
    notificationPreferences: metadata.notification_preferences && typeof metadata.notification_preferences === 'object' ? metadata.notification_preferences as CurrentUserProfile['notificationPreferences'] : undefined,
  }
}

function mergeStudentProfile(base: CurrentUserProfile, saved: StudentProfileResponse): CurrentUserProfile {
  return {
    ...base,
    college: saved.college ?? base.college,
    degree: saved.degree ?? base.degree,
    branch: saved.branch ?? base.branch,
    graduationYear: saved.graduationYear == null ? base.graduationYear : String(saved.graduationYear),
    preferredRole: saved.preferredRole ?? base.preferredRole,
    preferredCompany: saved.preferredCompany ?? base.preferredCompany,
    skills: saved.skills ?? base.skills,
    bio: saved.bio ?? base.bio,
    linkedinUrl: saved.linkedinUrl ?? base.linkedinUrl,
    githubUrl: saved.githubUrl ?? base.githubUrl,
    portfolioUrl: saved.portfolioUrl ?? base.portfolioUrl,
  }
}

const profileResource = createUserScopedResource<CurrentUserProfile | null>(() => null)
const EMPTY_PROFILE_STATE = { userId: null, data: null, loading: false, loaded: false, notFound: false, error: null } as const

export function setCurrentUserProfile(userId: string, profile: CurrentUserProfile) {
  profileResource.setData(userId, profile)
}

export function useCurrentUser() {
  const { isDemoMode, authenticatedUser, authenticatedUserId, authLoading } = useDemoMode()
  const userId = authenticatedUserId ?? ''
  const subscribe = useCallback((listener: () => void) => userId ? profileResource.subscribe(userId, listener) : () => undefined, [userId])
  const getSnapshot = useCallback(() => userId ? profileResource.getSnapshot(userId) : EMPTY_PROFILE_STATE, [userId])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (isDemoMode || authLoading) return
    profileResource.activate(authenticatedUserId)
    if (!authenticatedUserId || !authenticatedUser) return
    const base = toProfile(authenticatedUser)
    profileResource.seed(authenticatedUserId, base)
    void profileResource.load(authenticatedUserId, async (signal) => {
      const { data } = await api.get<StudentProfileResponse>('/auth/student-profile', { signal })
      return mergeStudentProfile(base, data)
    })
  }, [authLoading, authenticatedUser, authenticatedUserId, isDemoMode])

  return useMemo(() => ({
    profile: isDemoMode ? demoStudent : state.data,
    loading: isDemoMode ? false : authLoading || state.loading || (Boolean(authenticatedUserId) && !state.loaded),
    error: isDemoMode || !state.error ? null : friendlyErrorMessage(state.error, 'Unable to load the current user.'),
  }), [authLoading, authenticatedUserId, isDemoMode, state.data, state.error, state.loaded, state.loading])
}
