import { useEffect, useState, type ChangeEvent } from 'react'
import { Bell, Camera, KeyRound, Mail, Pencil, ShieldCheck, Sparkles, UserCircle2, X } from 'lucide-react'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useToast } from '../components/feedback/ToastProvider'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useDemoMode } from '../context/DemoModeContext'
import { demoStudent } from '../lib/demoData'
import { friendlyErrorMessage, requireOnline, retryRead, withRequestTimeout } from '../lib/requestSafety'
import { api } from '../lib/apiClient'
import type { StudentProfileData } from '../types'

type ResumeVisibility = 'private' | 'referrers' | 'public'

type ProfileForm = {
  fullName: string
  headline: string
  college: string
  degree: string
  branch: string
  graduationYear: string
  skills: string
  bio: string
  linkedinUrl: string
  githubUrl: string
  portfolioUrl: string
  preferredRole: string
  preferredCompany: string
  resumeVisibility: ResumeVisibility
  profilePhoto: string
}

type ProfileErrors = Partial<Record<keyof ProfileForm, string>>
type NotificationPreferences = {
  referralUpdates: boolean
  trustCardChanges: boolean
  weeklyReadiness: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  referralUpdates: true,
  trustCardChanges: true,
  weeklyReadiness: false,
}

const EMPTY_PROFILE: ProfileForm = {
  fullName: '',
  headline: '',
  college: '',
  degree: '',
  branch: '',
  graduationYear: '',
  skills: '',
  bio: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  preferredRole: '',
  preferredCompany: '',
  resumeVisibility: 'private',
  profilePhoto: '',
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-700'
const textareaClass = `${inputClass} h-auto min-h-28 resize-y py-3`

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function profileFromMetadata(metadata: Record<string, unknown>, email: string): ProfileForm {
  const metadataSkills = Array.isArray(metadata.skills) ? metadata.skills.filter((skill): skill is string => typeof skill === 'string').join(', ') : readString(metadata.skills)
  const visibility = metadata.resume_visibility

  return {
    fullName: readString(metadata.full_name) || readString(metadata.name) || email.split('@')[0] || '',
    headline: readString(metadata.headline),
    college: readString(metadata.college),
    degree: readString(metadata.degree),
    branch: readString(metadata.branch),
    graduationYear: readString(metadata.graduation_year),
    skills: metadataSkills,
    bio: readString(metadata.bio),
    linkedinUrl: readString(metadata.linkedin_url),
    githubUrl: readString(metadata.github_url),
    portfolioUrl: readString(metadata.portfolio_url),
    preferredRole: readString(metadata.preferred_role),
    preferredCompany: readString(metadata.preferred_company),
    resumeVisibility: visibility === 'public' || visibility === 'referrers' ? visibility : 'private',
    profilePhoto: readString(metadata.avatar_url),
  }
}

function validateUrl(value: string) {
  if (!value.trim()) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? '' : 'Use an http:// or https:// URL.'
  } catch {
    return 'Enter a valid URL, including https://.'
  }
}

function validateProfile(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {}
  const required: Array<[keyof ProfileForm, string]> = [
    ['fullName', 'Full Name'],
    ['college', 'College'],
    ['degree', 'Degree'],
    ['graduationYear', 'Graduation Year'],
    ['preferredRole', 'Preferred Role'],
  ]

  required.forEach(([key, label]) => {
    if (!form[key].trim()) errors[key] = `${label} is required.`
  })

  const limits: Array<[keyof ProfileForm, number]> = [
    ['fullName', 80], ['headline', 120], ['college', 120], ['degree', 100],
    ['branch', 100], ['skills', 400], ['bio', 500], ['linkedinUrl', 300],
    ['githubUrl', 300], ['portfolioUrl', 300], ['preferredRole', 100], ['preferredCompany', 120],
  ]
  limits.forEach(([key, limit]) => {
    if (form[key].length > limit) errors[key] = `Keep this field under ${limit} characters.`
  })

  const year = Number(form.graduationYear)
  if (form.graduationYear && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 10)) {
    errors.graduationYear = `Enter a year between 1950 and ${new Date().getFullYear() + 10}.`
  }

  const skills = form.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
  if (skills.length > 20) errors.skills = 'Add no more than 20 comma-separated skills.'
  if (skills.some((skill) => skill.length > 40)) errors.skills = 'Keep each skill under 40 characters.'

  const urls: Array<[keyof ProfileForm, string]> = [
    ['linkedinUrl', form.linkedinUrl],
    ['githubUrl', form.githubUrl],
    ['portfolioUrl', form.portfolioUrl],
  ]
  urls.forEach(([key, value]) => {
    const message = validateUrl(value)
    if (message) errors[key] = message
  })

  return errors
}

function Field({ label, name, value, editing, error, required, maxLength, type = 'text', onChange }: {
  label: string
  name: keyof ProfileForm
  value: string
  editing: boolean
  error?: string
  required?: boolean
  maxLength?: number
  type?: string
  onChange: (name: keyof ProfileForm, value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}{required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      <input id={`profile-${name}`} type={type} value={value} disabled={!editing} maxLength={maxLength} onChange={(event) => onChange(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `profile-${name}-error` : undefined} className={`${inputClass} ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`} />
      {error ? <span id={`profile-${name}-error`} className="mt-1.5 block text-xs text-rose-600">{error}</span> : null}
    </label>
  )
}

export default function ProfileSettings() {
  const { profile, loading, error: profileError } = useCurrentUser()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { isDemoMode } = useDemoMode()
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE)
  const [savedForm, setSavedForm] = useState<ProfileForm>(EMPTY_PROFILE)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [editing, setEditing] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS)
  const [savedNotifications, setSavedNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS)
  const [savingNotifications, setSavingNotifications] = useState(false)

  const notificationStorageKey = `refai-notifications:${isDemoMode ? 'demo-isolated' : profile?.id ?? 'current-user'}`

  useEffect(() => {
    const metadataPreferences = profile?.notificationPreferences
    try {
      const cached = window.localStorage.getItem(notificationStorageKey)
      const next = cached ? { ...DEFAULT_NOTIFICATIONS, ...(JSON.parse(cached) as Partial<NotificationPreferences>) } : { ...DEFAULT_NOTIFICATIONS, ...metadataPreferences }
      setNotifications(next)
      setSavedNotifications(next)
    } catch {
      setNotifications(DEFAULT_NOTIFICATIONS)
      setSavedNotifications(DEFAULT_NOTIFICATIONS)
    }
  }, [notificationStorageKey, profile])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        if (isDemoMode) {
          const next: ProfileForm = { fullName: demoStudent.fullName, headline: demoStudent.headline, college: demoStudent.college, degree: demoStudent.degree, branch: demoStudent.branch, graduationYear: demoStudent.graduationYear, skills: demoStudent.skills.join(', '), bio: demoStudent.bio, linkedinUrl: demoStudent.linkedinUrl, githubUrl: demoStudent.githubUrl, portfolioUrl: demoStudent.portfolioUrl, preferredRole: demoStudent.preferredRole, preferredCompany: demoStudent.preferredCompany, resumeVisibility: 'referrers', profilePhoto: demoStudent.avatarUrl }
          setForm(next)
          setSavedForm(next)
          setInitializing(false)
          return
        }
        const { data } = await retryRead(async () => {
          const result = await supabase.auth.getUser()
          if (result.error) throw result.error
          return result
        })
        if (!active) return

        const user = data.user
        const fromSupabase = user ? profileFromMetadata(user.user_metadata ?? {}, user.email ?? '') : EMPTY_PROFILE
        let next = fromSupabase

        if (user) {
          try {
            const { data: savedProfile } = await api.get<StudentProfileData>('/auth/student-profile')
            next = {
              ...next,
              college: String(savedProfile.college ?? next.college),
              degree: String(savedProfile.degree ?? next.degree),
              branch: String(savedProfile.branch ?? next.branch),
              graduationYear: String(savedProfile.graduationYear ?? next.graduationYear),
              skills: savedProfile.skills.length ? savedProfile.skills.join(', ') : next.skills,
              bio: String(savedProfile.bio ?? next.bio),
              linkedinUrl: String(savedProfile.linkedinUrl ?? next.linkedinUrl),
              githubUrl: String(savedProfile.githubUrl ?? next.githubUrl),
              portfolioUrl: String(savedProfile.portfolioUrl ?? next.portfolioUrl),
              preferredRole: String(savedProfile.preferredRole ?? next.preferredRole),
              preferredCompany: String(savedProfile.preferredCompany ?? next.preferredCompany),
            }
            setProfileLoadError(null)
          } catch (error) {
            setProfileLoadError(friendlyErrorMessage(error, 'Your saved profile could not be loaded from the database.'))
          }
        }

        setForm(next)
        setSavedForm(next)
      } catch (error) {
        if (!active) return
        setForm(EMPTY_PROFILE)
        setSavedForm(EMPTY_PROFILE)
        setProfileLoadError(friendlyErrorMessage(error, 'Your profile could not be loaded.'))
      } finally {
        if (active) setInitializing(false)
      }
    }

    void load()
    return () => { active = false }
  }, [isDemoMode])

  const setValue = (name: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, profilePhoto: 'Choose a JPG, PNG, WebP, or GIF image.' }))
      return
    }
    if (file.size > 1024 * 1024) {
      setErrors((current) => ({ ...current, profilePhoto: 'Keep the profile photo under 1 MB.' }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setValue('profilePhoto', reader.result)
    }
    reader.readAsDataURL(file)
  }

  const cancelEditing = () => {
    setForm(savedForm)
    setErrors({})
    setEditing(false)
  }

  const saveProfile = async () => {
    if (saving) return
    const nextErrors = validateProfile(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.keys(nextErrors)[0] as keyof ProfileForm
      document.getElementById(`profile-${firstError}`)?.focus()
      toast({ title: 'Check the highlighted fields', description: 'Complete the required information and correct invalid values.', tone: 'error' })
      return
    }

    const normalized: ProfileForm = {
      ...form,
      fullName: form.fullName.trim(),
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean).join(', '),
    }
    setSaving(true)

    try {
      requireOnline()
      if (!isDemoMode) {
        await api.put<StudentProfileData>('/auth/student-profile', {
          college: normalized.college.trim() || null,
          degree: normalized.degree.trim() || null,
          branch: normalized.branch.trim() || null,
          graduationYear: normalized.graduationYear || null,
          preferredRole: normalized.preferredRole.trim() || null,
          preferredCompany: normalized.preferredCompany.trim() || null,
          skills: normalized.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
          bio: normalized.bio.trim() || null,
          linkedinUrl: normalized.linkedinUrl.trim() || null,
          githubUrl: normalized.githubUrl.trim() || null,
          portfolioUrl: normalized.portfolioUrl.trim() || null,
        })
      }
      const { error } = await withRequestTimeout(supabase.auth.updateUser({
        data: {
          full_name: normalized.fullName,
          headline: normalized.headline.trim(),
          college: normalized.college.trim(),
          degree: normalized.degree.trim(),
          branch: normalized.branch.trim(),
          graduation_year: normalized.graduationYear,
          skills: normalized.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
          bio: normalized.bio.trim(),
          linkedin_url: normalized.linkedinUrl.trim(),
          github_url: normalized.githubUrl.trim(),
          portfolio_url: normalized.portfolioUrl.trim(),
          preferred_role: normalized.preferredRole.trim(),
          preferred_company: normalized.preferredCompany.trim(),
          resume_visibility: normalized.resumeVisibility,
        },
      }))
      if (error) throw error

      // TODO: Move profilePhoto to Supabase Storage when a profile-photo bucket is configured.
      setForm(normalized)
      setSavedForm(normalized)
      setEditing(false)
      setProfileLoadError(null)
      toast({ title: 'Profile saved successfully', description: 'Your profile details were saved to Supabase.', tone: 'success' })
    } catch (error) {
      toast({ title: 'Profile could not be saved', description: friendlyErrorMessage(error, 'Your profile could not be saved to Supabase. Please try again.'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const saveNotificationPreferences = async () => {
    if (savingNotifications) return
    setSavingNotifications(true)
    try {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications))
      if (!isDemoMode) {
        requireOnline()
        const { error } = await withRequestTimeout(supabase.auth.updateUser({ data: { notification_preferences: notifications } }))
        if (error) throw error
      }
      setSavedNotifications(notifications)
      toast({ title: 'Notification preferences saved', description: isDemoMode ? 'Demo preferences were saved only in this browser.' : 'Your RefAI notification choices were updated.', tone: 'success' })
    } catch (error) {
      toast({ title: 'Preferences could not be synced', description: friendlyErrorMessage(error, 'Your notification preferences could not be saved. Please try again.'), tone: 'error' })
    } finally {
      setSavingNotifications(false)
    }
  }

  const busy = loading || initializing
  const initials = form.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '—'

  return (
    <PageShell
      eyebrow="Profile & settings"
      title="Complete the profile behind your referral requests"
      description="These details give RefAI and employees context about your background and goals. Review them for accuracy, then continue to your resume."
      action={editing ? (
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={cancelEditing} disabled={saving}><X className="mr-2 size-4" />Cancel</SecondaryButton>
          <PrimaryButton onClick={saveProfile} loading={saving}>Save changes</PrimaryButton>
        </div>
      ) : <div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => navigate('/dashboard')}>Back to Dashboard</SecondaryButton><SecondaryButton onClick={() => setEditing(true)} disabled={busy || isDemoMode} disabledReason={isDemoMode ? 'The demo profile is read-only and isolated from authenticated profiles' : 'Profile details are still loading'}><Pencil className="mr-2 size-4" />Edit profile</SecondaryButton><PrimaryButton onClick={() => navigate('/dashboard/resume')}>Continue to Resume</PrimaryButton></div>}
    >
      {profileError ? <InlineFeedback tone="error">{friendlyErrorMessage(profileError, 'Account details could not be loaded. Refresh the page to try again.')}</InlineFeedback> : null}
      {profileLoadError ? <InlineFeedback tone="error">{profileLoadError}</InlineFeedback> : null}

      <div id="profile" className="grid scroll-mt-24 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {form.profilePhoto ? <img src={form.profilePhoto} alt="Profile preview" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-xl font-semibold text-slate-700">{initials}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><UserCircle2 className="size-6" /></div>
                <div><h2 className="text-xl font-semibold">Candidate profile details</h2><p className="mt-1 text-sm text-slate-500">Employees use this context alongside your resume and Trust Card.</p></div>
              </div>
              {editing ? <div className="mt-4 flex flex-wrap gap-2"><label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"><Camera className="mr-2 size-4" />Choose photo<input id="profile-profilePhoto" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={handlePhoto} /></label>{form.profilePhoto ? <button type="button" onClick={() => setValue('profilePhoto', '')} className="inline-flex h-10 cursor-pointer items-center rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">Remove photo</button> : null}</div> : null}
              {errors.profilePhoto ? <p className="mt-1.5 text-xs text-rose-600">{errors.profilePhoto}</p> : null}
            </div>
          </div>

          {busy ? <div className="mt-8 grid gap-5 sm:grid-cols-2">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Field label="Full Name" name="fullName" value={form.fullName} editing={editing} error={errors.fullName} required maxLength={80} onChange={setValue} />
              <Field label="Headline" name="headline" value={form.headline} editing={editing} error={errors.headline} maxLength={120} onChange={setValue} />
              <Field label="College" name="college" value={form.college} editing={editing} error={errors.college} required maxLength={120} onChange={setValue} />
              <Field label="Degree" name="degree" value={form.degree} editing={editing} error={errors.degree} required maxLength={100} onChange={setValue} />
              <Field label="Branch" name="branch" value={form.branch} editing={editing} error={errors.branch} maxLength={100} onChange={setValue} />
              <Field label="Graduation Year" name="graduationYear" value={form.graduationYear} editing={editing} error={errors.graduationYear} required type="number" onChange={setValue} />
              <Field label="Preferred Role" name="preferredRole" value={form.preferredRole} editing={editing} error={errors.preferredRole} required maxLength={100} onChange={setValue} />
              <Field label="Preferred Company" name="preferredCompany" value={form.preferredCompany} editing={editing} error={errors.preferredCompany} maxLength={120} onChange={setValue} />
              <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Skills</span><textarea id="profile-skills" value={form.skills} disabled={!editing} maxLength={400} onChange={(event) => setValue('skills', event.target.value)} placeholder="React, FastAPI, SQL" className={`${textareaClass} min-h-20 ${errors.skills ? 'border-rose-400' : ''}`} /><span className="mt-1.5 flex justify-between text-xs text-slate-500"><span>{errors.skills || 'Separate skills with commas. Maximum 20 skills.'}</span><span>{form.skills.length}/400</span></span></label>
              <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bio</span><textarea id="profile-bio" value={form.bio} disabled={!editing} maxLength={500} onChange={(event) => setValue('bio', event.target.value)} className={`${textareaClass} ${errors.bio ? 'border-rose-400' : ''}`} /><span className="mt-1.5 flex justify-between text-xs text-slate-500"><span>{errors.bio}</span><span>{form.bio.length}/500</span></span></label>
              <Field label="LinkedIn URL" name="linkedinUrl" value={form.linkedinUrl} editing={editing} error={errors.linkedinUrl} maxLength={300} type="url" onChange={setValue} />
              <Field label="GitHub URL" name="githubUrl" value={form.githubUrl} editing={editing} error={errors.githubUrl} maxLength={300} type="url" onChange={setValue} />
              <Field label="Portfolio URL" name="portfolioUrl" value={form.portfolioUrl} editing={editing} error={errors.portfolioUrl} maxLength={300} type="url" onChange={setValue} />
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Resume Visibility</span><select id="profile-resumeVisibility" value={form.resumeVisibility} disabled={!editing} onChange={(event) => setValue('resumeVisibility', event.target.value)} className={inputClass}><option value="private">Private</option><option value="referrers">Verified referrers</option><option value="public">Public profile</option></select></label>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /><p className="text-sm font-semibold">Account status</p></div>
            <div className="mt-3 flex flex-wrap gap-2"><Badge tone={profile ? 'success' : 'neutral'}>{profile ? 'Authenticated' : 'Not signed in'}</Badge><Badge tone={profile?.emailVerified ? 'success' : 'neutral'}>{profile?.emailVerified ? 'Email verified' : 'Email not verified'}</Badge><Badge>{profile?.email || 'Email unavailable'}</Badge></div>
          </div>
        </Card>

        <div id="settings" className="scroll-mt-24 space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Bell className="size-5" /></div><div><h3 className="text-lg font-semibold">Notifications</h3><p className="mt-1 text-sm text-slate-500">Choose which updates should appear in your inbox.</p></div></div>
            <div className="mt-6 space-y-3">{([
              ['referralUpdates', 'Referral request updates'],
              ['trustCardChanges', 'Trust Card changes'],
              ['weeklyReadiness', 'Weekly readiness reminders'],
            ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><span className="text-sm text-slate-700">{label}</span><button type="button" role="switch" aria-checked={notifications[key]} onClick={() => setNotifications((current) => ({ ...current, [key]: !current[key] }))} className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${notifications[key] ? 'bg-black' : 'bg-slate-300'}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${notifications[key] ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>)}</div>
            <div className="mt-5 flex justify-end"><PrimaryButton onClick={saveNotificationPreferences} loading={savingNotifications} disabled={JSON.stringify(notifications) === JSON.stringify(savedNotifications)} disabledReason="No notification changes to save">Save preferences</PrimaryButton></div>
          </Card>
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><KeyRound className="size-5" /></div><div><h3 className="text-lg font-semibold">Security</h3><p className="mt-1 text-sm text-slate-500">Protect your account with strong access controls.</p></div></div>
            <div className="mt-6 space-y-3"><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><Mail className="size-4 text-slate-600" /><span className="text-sm text-slate-700">Email verified</span></div><Badge tone={profile?.emailVerified ? 'success' : 'neutral'}>{profile?.emailVerified ? 'Verified' : 'Unverified'}</Badge></div><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><Sparkles className="size-4 text-slate-600" /><span className="text-sm text-slate-700">Two-factor authentication</span></div><SecondaryButton disabled disabledReason="Two-factor authentication is not available yet">Enable</SecondaryButton></div></div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
