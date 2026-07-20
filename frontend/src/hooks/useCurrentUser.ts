import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useDemoMode } from '../context/DemoModeContext'
import { demoStudent } from '../lib/demoData'
import { friendlyErrorMessage, retryRead } from '../lib/requestSafety'

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

function toProfile(user: User): CurrentUserProfile {
  const metadata = user.user_metadata ?? {}
  const email = user.email ?? ''
  const fullName = String(metadata.full_name ?? metadata.name ?? email.split('@')[0] ?? '')
  const role = String(metadata.role ?? '')
  const location = String(metadata.location ?? '')
  const skills = Array.isArray(metadata.skills)
    ? metadata.skills.filter((skill): skill is string => typeof skill === 'string')
    : String(metadata.skills ?? '').split(',').map((skill) => skill.trim()).filter(Boolean)
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '—'

  return {
    id: user.id,
    email,
    fullName,
    role,
    location,
    headline: String(metadata.headline ?? ''),
    college: String(metadata.college ?? ''),
    degree: String(metadata.degree ?? ''),
    branch: String(metadata.branch ?? ''),
    graduationYear: String(metadata.graduation_year ?? ''),
    skills,
    bio: String(metadata.bio ?? ''),
    linkedinUrl: String(metadata.linkedin_url ?? ''),
    githubUrl: String(metadata.github_url ?? ''),
    portfolioUrl: String(metadata.portfolio_url ?? ''),
    preferredRole: String(metadata.preferred_role ?? ''),
    preferredCompany: String(metadata.preferred_company ?? ''),
    resumeVisibility: String(metadata.resume_visibility ?? 'private'),
    avatarUrl: String(metadata.avatar_url ?? ''),
    emailVerified: Boolean(user.email_confirmed_at),
    initials,
    notificationPreferences: metadata.notification_preferences && typeof metadata.notification_preferences === 'object' ? metadata.notification_preferences as CurrentUserProfile['notificationPreferences'] : undefined,
  }
}

export function useCurrentUser() {
  const { isDemoMode } = useDemoMode()
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    retryRead(async () => {
      const result = await supabase.auth.getUser()
      if (result.error) throw result.error
      return result
    }).then(({ data }) => {
      if (active) {
        setError(null)
        setProfile(data.user ? toProfile(data.user) : null)
        setLoading(false)
      }
    }).catch((authError: unknown) => {
      if (active) {
        setError(friendlyErrorMessage(authError, 'Unable to load the current user.'))
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setProfile(session?.user ? toProfile(session.user) : null)
        setError(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { profile: isDemoMode ? demoStudent : profile, loading: isDemoMode ? false : loading, error: isDemoMode ? null : error }
}
