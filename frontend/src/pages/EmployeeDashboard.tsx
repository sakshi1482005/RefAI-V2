import { BriefcaseBusiness, CheckCircle2, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import ReferralJourneyTimeline from '../components/dashboard/ReferralJourneyTimeline'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { DEMO_CANDIDATE_ID, demoEmployeeReview } from '../lib/demoData'
import { employeeReviewHref, employeeStatusLabel } from '../lib/employeeWorkflow'
import { parseEmployeeQueue } from '../lib/employeeQueueContract'
import { api } from '../lib/apiClient'
import { FriendlyRequestError, friendlyErrorMessage } from '../lib/requestSafety'
import type { AvailabilityStatus, CandidateLevel, DeclineReasonCode, EmployeeProfessionalProfile, EmployeeReferralQueueItem, EvidenceExpectation, MessageLength, ReferralCategory, ReferralStatus } from '../types'
import { useCurrentUser } from '../hooks/useCurrentUser'

type QueueFilter = 'highest_compatibility' | 'recently_submitted' | 'awaiting_response' | 'more_information_received' | 'approved' | 'completed'
type CandidateQueueItem = { id: string; name: string; college: string | null; role: string; company: string; trustScore: number | null; compatibilityScore: number | null; compatibilityLabel: string | null; status: string; rawStatus: ReferralStatus; createdAt: string; time: string; resumeExists: boolean; trustCardExists: boolean; journeyStatus?: ReferralStatus; demo?: boolean }
const evidenceOptions: { value: EvidenceExpectation; label: string }[] = [['resume', 'Resume'], ['trust_card', 'Trust Card'], ['project_evidence', 'Project evidence'], ['quantified_outcomes', 'Quantified outcomes'], ['education_details', 'Education details'], ['portfolio_links', 'Portfolio links']].map(([value, label]) => ({ value: value as EvidenceExpectation, label }))
const candidateLevelOptions: { value: CandidateLevel; label: string }[] = [['student', 'Student'], ['fresher', 'Fresher'], ['entry_level', 'Entry level'], ['experienced', 'Experienced']].map(([value, label]) => ({ value: value as CandidateLevel, label }))
const formatResponseTime = (hours: number) => {
  const rounded = Math.round(hours)
  if (rounded < 24) return `${rounded}h`
  const days = Math.floor(rounded / 24)
  const remainder = rounded % 24
  return remainder ? `${days}d ${remainder}h` : `${days}d`
}
const categoryOptions: { value: ReferralCategory; label: string }[] = [['internship', 'Internship'], ['full_time', 'Full time'], ['apprenticeship', 'Apprenticeship'], ['graduate_program', 'Graduate program'], ['campus_hiring', 'Campus hiring'], ['contract', 'Contract']].map(([value, label]) => ({ value: value as ReferralCategory, label }))
const declineOptions: { value: DeclineReasonCode; label: string }[] = [['insufficient_evidence', 'Insufficient evidence'], ['role_mismatch', 'Role mismatch'], ['capacity_unavailable', 'At capacity'], ['profile_incomplete', 'Profile incomplete'], ['experience_mismatch', 'Experience mismatch'], ['unsupported_category', 'Unsupported category'], ['other', 'Other']].map(([value, label]) => ({ value: value as DeclineReasonCode, label }))
const splitPreferenceList = (value: string) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 20)

export default function EmployeeDashboard() {
  const { profile } = useCurrentUser()
  const { isDemoMode, demoDecision, demoJourneyStage } = useDemoMode()
  const [requests, setRequests] = useState<EmployeeReferralQueueItem[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<unknown>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('recently_submitted')
  const [company, setCompany] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [yearsExperience, setYearsExperience] = useState<number | ''>('')
  const [verifiedEmployee, setVerifiedEmployee] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [companyProfileUrl, setCompanyProfileUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [savedCompany, setSavedCompany] = useState('')
  const [supportedCompanies, setSupportedCompanies] = useState('')
  const [supportedRoles, setSupportedRoles] = useState('')
  const [supportedDepartments, setSupportedDepartments] = useState('')
  const [acceptsFreshers, setAcceptsFreshers] = useState(true)
  const [minimumEvidenceExpectations, setMinimumEvidenceExpectations] = useState<EvidenceExpectation[]>([])
  const [maxActiveRequests, setMaxActiveRequests] = useState(5)
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('accepting')
  const [preferredCandidateLevels, setPreferredCandidateLevels] = useState<CandidateLevel[]>(['student', 'fresher'])
  const [preferredMessageLength, setPreferredMessageLength] = useState<MessageLength>('concise')
  const [referralGuidelines, setReferralGuidelines] = useState('')
  const [declineReasonCodes, setDeclineReasonCodes] = useState<DeclineReasonCode[]>([])
  const [referralCategories, setReferralCategories] = useState<ReferralCategory[]>([])
  const [professionalProfileLoading, setProfessionalProfileLoading] = useState(!isDemoMode)
  const [professionalProfileSaving, setProfessionalProfileSaving] = useState(false)
  const [responseTime, setResponseTime] = useState<{ value: number | null; available: boolean; count: number }>({ value: null, available: false, count: 0 })
  const [professionalProfileFeedback, setProfessionalProfileFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
  const referralSent = isDemoMode && hasReachedDemoStage(demoJourneyStage, 'referral-sent')

  useEffect(() => {
    if (isDemoMode) { setLoading(false); setError(null); return }
    let active = true
    setLoading(true); setError(null)
    api.get<unknown>('/referral/employee/queue').then((response) => {
      if (active) setRequests(parseEmployeeQueue(response.data))
    }).catch((queueError) => {
      if (active) setError(queueError)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isDemoMode, reloadKey])

  useEffect(() => {
    if (isDemoMode) { setProfessionalProfileLoading(false); setProfessionalProfileFeedback(null); return }
    let active = true
    setProfessionalProfileLoading(true)
    api.get<EmployeeProfessionalProfile>('/referral/employee/profile').then(({ data }) => {
      if (!active) return
      setCompany(data.company ?? '')
      setDesignation(data.designation ?? '')
      setDepartment(data.department ?? '')
      setYearsExperience(data.yearsExperience ?? '')
      setVerifiedEmployee(data.verifiedEmployee)
      setLinkedinUrl(data.linkedinUrl ?? '')
      setCompanyProfileUrl(data.companyProfileUrl ?? '')
      setPortfolioUrl(data.portfolioUrl ?? '')
      setSavedCompany(data.company ?? '')
      setSupportedCompanies(data.supportedCompanies.join(', '))
      setSupportedRoles(data.supportedRoles.join(', '))
      setSupportedDepartments(data.supportedDepartments.join(', '))
      setAcceptsFreshers(data.acceptsFreshers)
      setMinimumEvidenceExpectations(data.minimumEvidenceExpectations)
      setMaxActiveRequests(data.maxActiveRequests)
      setAvailabilityStatus(data.availabilityStatus)
      setPreferredCandidateLevels(data.preferredCandidateLevels)
      setPreferredMessageLength(data.preferredMessageLength)
      setReferralGuidelines(data.referralGuidelines ?? '')
      setDeclineReasonCodes(data.declineReasonCodes)
      setReferralCategories(data.referralCategories)
      setResponseTime({ value: data.averageResponseTimeValue, available: data.responseTimeAvailable, count: data.respondedRequestCount })
      setProfessionalProfileFeedback(null)
    }).catch((profileError) => {
      if (active) setProfessionalProfileFeedback({ tone: 'error', message: friendlyErrorMessage(profileError, 'We could not load your professional profile. Please try again.') })
    }).finally(() => { if (active) setProfessionalProfileLoading(false) })
    return () => { active = false }
  }, [isDemoMode])

  const demoStatus = demoDecision === 'approved' ? 'Approved' : demoDecision === 'declined' ? 'Declined' : demoDecision === 'more_info_requested' ? 'More information requested' : 'Pending'
  const queue: CandidateQueueItem[] = isDemoMode
    ? referralSent ? [{ id: DEMO_CANDIDATE_ID, name: demoEmployeeReview.candidateName, college: 'PES University', role: demoEmployeeReview.role, company: demoEmployeeReview.company, trustScore: 91, compatibilityScore: 88, compatibilityLabel: 'Good fit', status: demoStatus, rawStatus: demoDecision === 'approved' ? 'approved' : demoDecision === 'declined' ? 'declined' : demoDecision === 'more_info_requested' ? 'more_info_requested' : 'submitted', createdAt: new Date().toISOString(), time: demoEmployeeReview.submitted, resumeExists: true, trustCardExists: true, demo: true }] : []
    : requests.map((request) => ({ id: request.id, name: request.studentName || 'Student applicant', college: request.college, role: request.targetRole, company: request.targetCompany, trustScore: request.trustScore, compatibilityScore: request.compatibilityScore, compatibilityLabel: request.compatibilityLabel, status: employeeStatusLabel[request.status], rawStatus: request.status, createdAt: request.createdAt, journeyStatus: request.status, time: new Date(request.createdAt).toLocaleDateString(), resumeExists: request.resumeExists, trustCardExists: request.trustCardExists }))
  const filteredQueue = useMemo(() => {
    const statePriority: Record<ReferralStatus, number> = { more_info_requested: 0, submitted: 1, pending: 1, under_review: 2, approved: 3, referred: 4, draft: 5, declined: 6, withdrawn: 7, expired: 8 }
    let items = [...queue]
    if (queueFilter === 'awaiting_response') items = items.filter((item) => ['submitted', 'pending', 'under_review'].includes(item.rawStatus))
    if (queueFilter === 'more_information_received') items = items.filter((item) => item.rawStatus === 'more_info_requested')
    if (queueFilter === 'approved') items = items.filter((item) => item.rawStatus === 'approved')
    if (queueFilter === 'completed') items = items.filter((item) => item.rawStatus === 'referred')
    return items.sort((a, b) => queueFilter === 'highest_compatibility'
      ? (b.compatibilityScore ?? -1) - (a.compatibilityScore ?? -1) || statePriority[a.rawStatus] - statePriority[b.rawStatus]
      : queueFilter === 'recently_submitted'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : statePriority[a.rawStatus] - statePriority[b.rawStatus] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [queue, queueFilter])
  const metrics = useMemo(() => {
    if (isDemoMode) return { pending: demoDecision === 'pending' ? 1 : 0, completed: demoDecision === 'approved' ? 1 : 0 }
    const count = (status: string) => requests.filter((request) => request.status === status).length
    return { pending: count('submitted') + count('pending') + count('under_review') + count('more_info_requested'), completed: count('referred') }
  }, [demoDecision, isDemoMode, requests])
  const errorKind = error instanceof FriendlyRequestError ? error.kind : 'unknown'
  const errorText = error ? friendlyErrorMessage(error, 'We could not load your referral queue. Please try again.') : null
  const saveProfessionalProfile = async () => {
    const normalizedCompany = company.trim()
    if (!normalizedCompany || professionalProfileSaving) {
      if (!normalizedCompany) setProfessionalProfileFeedback({ tone: 'error', message: 'Company Name is required.' })
      return
    }
    setProfessionalProfileSaving(true)
    setProfessionalProfileFeedback(null)
    try {
      const { data } = await api.put<EmployeeProfessionalProfile>('/referral/employee/profile', {
        company: normalizedCompany,
        designation: designation.trim() || null,
        department: department.trim() || null,
        yearsExperience: yearsExperience === '' ? null : yearsExperience,
        linkedinUrl: linkedinUrl.trim() || null,
        companyProfileUrl: companyProfileUrl.trim() || null,
        portfolioUrl: portfolioUrl.trim() || null,
        supportedCompanies: splitPreferenceList(supportedCompanies),
        supportedRoles: splitPreferenceList(supportedRoles),
        supportedDepartments: splitPreferenceList(supportedDepartments),
        acceptsFreshers,
        minimumEvidenceExpectations,
        maxActiveRequests,
        availabilityStatus,
        preferredCandidateLevels,
        preferredMessageLength,
        referralGuidelines: referralGuidelines.trim() || null,
        declineReasonCodes,
        referralCategories,
      })
      setCompany(data.company ?? '')
      setDesignation(data.designation ?? '')
      setSavedCompany(data.company ?? '')
      setProfessionalProfileFeedback({ tone: 'success', message: 'Profile and referral preferences saved.' })
    } catch (profileError) {
      const message = profileError instanceof FriendlyRequestError && profileError.kind === 'validation'
        ? 'Enter a valid company name before saving your professional profile.'
        : friendlyErrorMessage(profileError, 'We could not save your professional profile. Please try again.')
      setProfessionalProfileFeedback({ tone: 'error', message })
    } finally {
      setProfessionalProfileSaving(false)
    }
  }

  return <PageShell eyebrow="Employee portal" title="Referral review workspace" description="Review assigned requests using candidate evidence, deterministic scores, and an advisory AI summary. Every decision remains yours.">
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section id="candidate-queue" className="min-w-0 scroll-mt-24 space-y-6">
        <Card className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review status</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Hello, {profile?.fullName?.split(/\s+/)[0] || 'Reviewer'}</h2></div><Badge tone={isDemoMode ? 'warning' : 'neutral'}><Sparkles className="mr-1.5 size-3.5" />{isDemoMode ? 'Demo data' : 'Secured live queue'}</Badge></div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />) : [
            { label: 'Pending Reviews', value: String(metrics.pending) },
            { label: 'Average Response Time', value: responseTime.available && responseTime.value !== null ? formatResponseTime(responseTime.value) : 'Not enough data' },
            { label: 'Completed Referrals', value: String(metrics.completed) },
            { label: 'Availability', value: availabilityStatus === 'accepting' ? 'Accepting' : availabilityStatus === 'paused' ? 'Paused' : 'Unavailable' },
          ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p><p className="mt-2 text-base font-semibold">{item.value}</p></div>)}</div>
          {!isDemoMode ? <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-semibold text-slate-600">Quick availability update<select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value as AvailabilityStatus)} className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="accepting">Accepting requests</option><option value="paused">Paused</option><option value="unavailable">Unavailable</option></select></label><SecondaryButton onClick={() => { void saveProfessionalProfile() }} loading={professionalProfileSaving} disabled={!company.trim()}>Save availability</SecondaryButton></div> : null}
        </Card>

        <Card className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-semibold">Candidate review queue</h3><p className="mt-1 text-sm text-slate-500">Sorted by request state and relevance—not as a student ranking.</p></div><SecondaryButton onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Refresh</SecondaryButton></div>
          <div className="mt-5 flex w-full max-w-full gap-2 overflow-x-auto pb-2" aria-label="Queue filters">{([
            ['highest_compatibility', 'Highest compatibility'], ['recently_submitted', 'Recently submitted'], ['awaiting_response', 'Awaiting response'], ['more_information_received', 'More information requested'], ['approved', 'Approved'], ['completed', 'Completed'],
          ] as [QueueFilter, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setQueueFilter(value)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${queueFilter === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{label}</button>)}</div>
          {errorText ? <div className="mt-6"><InlineFeedback tone="error">{errorKind === 'auth' ? (errorText.includes('permission') ? 'You do not have permission to view this queue.' : 'Your session has expired. Sign in again, then reload your queue.') : errorText}<SecondaryButton className="ml-3" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></InlineFeedback></div> : null}
          <div className="mt-4 space-y-3">{filteredQueue.map((candidate) => <div key={candidate.id} className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{candidate.name}</p><Badge tone={candidate.demo ? 'warning' : 'info'}>{candidate.status}</Badge>{candidate.demo ? <Badge tone="warning">Demo</Badge> : null}</div><p className="mt-2 text-sm text-slate-600">{candidate.role} · {candidate.company}</p><p className="mt-1 text-xs text-slate-500">{candidate.college || 'College not provided'} · {candidate.time}</p></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-semibold">{candidate.trustScore ?? '—'}</p><p className="text-[10px] text-slate-500">Trust Score</p></div><div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-semibold">{candidate.compatibilityScore ?? '—'}</p><p className="text-[10px] text-slate-500">Compatibility</p></div><div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-semibold">{candidate.resumeExists && candidate.trustCardExists ? 'Ready' : 'Partial'}</p><p className="text-[10px] text-slate-500">Evidence</p></div></div></div><details className="mt-4 rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold">Review details</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><p className="text-xs text-slate-600">Candidate Trust Score: <span className="font-semibold">{candidate.trustScore ?? 'Unavailable'}</span></p><p className="text-xs text-slate-600">Compatibility Score: <span className="font-semibold">{candidate.compatibilityScore ?? 'Unavailable'}{candidate.compatibilityLabel ? ` · ${candidate.compatibilityLabel}` : ''}</span></p><p className="text-xs text-slate-600">Evidence: <span className="font-semibold">{candidate.resumeExists ? 'Resume available' : 'Resume unavailable'} · {candidate.trustCardExists ? 'Trust Card available' : 'Trust Card unavailable'}</span></p></div>{!isDemoMode && candidate.journeyStatus ? <div className="mt-4"><ReferralJourneyTimeline requestId={candidate.id} currentStatus={candidate.journeyStatus} /></div> : null}<p className="mt-4 text-xs leading-5 text-slate-500">The AI Review Copilot is available inside Candidate Review as an advisory summary. It cannot approve, decline, or change scores.</p></details><div className="mt-4"><Link to={isDemoMode ? `/employee/review/${candidate.id}` : employeeReviewHref({ id: candidate.id })} className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-slate-800">Open Candidate Review</Link></div></div>)}
            {!loading && !error && filteredQueue.length === 0 ? <EmptyState title={queue.length ? "No requests match this filter" : "Your review queue is clear"} description={queue.length ? "Choose another queue filter to see assigned requests in a different state." : "Referral requests addressed to you will appear here with candidate evidence, compatibility, and Trust Card signals."} icon={BriefcaseBusiness} action={<SecondaryButton onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Refresh queue</SecondaryButton>} /> : null}
          </div>
        </Card>
      </section>

      <section className="min-w-0 space-y-6">{!isDemoMode ? <Card className="p-5 sm:p-6"><details><summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><BriefcaseBusiness className="size-5" /></div><div><h3 className="text-lg font-semibold">Profile & referral preferences</h3><p className="mt-1 text-sm text-slate-500">Expand to edit directory details and referral settings.</p></div></div></summary>{professionalProfileLoading ? <div className="mt-6 space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-32 w-full" /></div> : <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void saveProfessionalProfile() }}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Professional identity</p><Badge tone={verifiedEmployee ? 'success' : 'neutral'}>{verifiedEmployee ? 'Verified employee' : 'Verification pending'}</Badge></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Company Name</span><input value={company} onChange={(event) => setCompany(event.target.value)} required maxLength={200} autoComplete="organization" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" placeholder="Company name" /></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Designation <span className="font-normal normal-case tracking-normal">(optional)</span></span><input value={designation} onChange={(event) => setDesignation(event.target.value)} maxLength={200} autoComplete="organization-title" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" placeholder="Software Engineer" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Department</span><input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={120} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder="Engineering" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Years of experience</span><input type="number" min={0} max={60} value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value === '' ? '' : Math.min(60, Math.max(0, Number(event.target.value))))} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label></div>
        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Professional links</summary><div className="mt-4 space-y-3">{([['LinkedIn URL', linkedinUrl, setLinkedinUrl, 'https://linkedin.com/in/...'], ['Company profile URL', companyProfileUrl, setCompanyProfileUrl, 'https://company.com/team/...'], ['Portfolio URL', portfolioUrl, setPortfolioUrl, 'https://...']] as const).map(([label, value, setter, placeholder]) => <label key={label} className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span><input type="url" value={value} onChange={(event) => setter(event.target.value)} maxLength={500} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={placeholder} /></label>)}</div></details>
        <details className="rounded-xl border border-slate-200 p-4" open><summary className="cursor-pointer text-sm font-semibold">Referral settings</summary><div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Availability</span><select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value as AvailabilityStatus)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="accepting">Accepting requests</option><option value="paused">Paused</option><option value="unavailable">Unavailable</option></select></label><label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Maximum active requests</span><input type="number" min={0} max={50} value={maxActiveRequests} onChange={(event) => setMaxActiveRequests(Math.min(50, Math.max(0, Number(event.target.value))))} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label></div>
          {([['Companies supported', supportedCompanies, setSupportedCompanies, 'Acme, RefAI Labs'], ['Roles supported', supportedRoles, setSupportedRoles, 'Software Engineer, Data Analyst'], ['Departments supported', supportedDepartments, setSupportedDepartments, 'Engineering, Product']] as const).map(([label, value, setter, placeholder]) => <label key={label} className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span><input value={value} onChange={(event) => setter(event.target.value)} maxLength={1000} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={placeholder} /><span className="mt-1 block text-xs text-slate-500">Separate entries with commas.</span></label>)}
          <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={acceptsFreshers} onChange={(event) => setAcceptsFreshers(event.target.checked)} />Accept student and fresher requests</label>
          <PreferenceChecks title="Preferred candidate level" options={candidateLevelOptions} selected={preferredCandidateLevels} onChange={setPreferredCandidateLevels} />
          <PreferenceChecks title="Minimum evidence expected" options={evidenceOptions} selected={minimumEvidenceExpectations} onChange={setMinimumEvidenceExpectations} />
          <PreferenceChecks title="Referral categories supported" options={categoryOptions} selected={referralCategories} onChange={setReferralCategories} />
          <PreferenceChecks title="Structured decline reasons" options={declineOptions} selected={declineReasonCodes} onChange={setDeclineReasonCodes} />
          <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Preferred message length</span><select value={preferredMessageLength} onChange={(event) => setPreferredMessageLength(event.target.value as MessageLength)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="concise">Concise</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Referral guidelines <span className="font-normal">(optional)</span></span><textarea value={referralGuidelines} onChange={(event) => setReferralGuidelines(event.target.value)} maxLength={2000} rows={4} className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm" placeholder="What should a student include before requesting a referral?" /><span className="mt-1 block text-right text-xs text-slate-500">{referralGuidelines.length}/2000</span></label>
        </div></details>
        {professionalProfileFeedback ? <InlineFeedback tone={professionalProfileFeedback.tone}>{professionalProfileFeedback.message}</InlineFeedback> : null}<PrimaryButton className="w-full" type="submit" loading={professionalProfileSaving} disabled={!company.trim()} disabledReason="Company Name is required">{savedCompany ? 'Save changes' : 'Save profile'}</PrimaryButton></form>}</details></Card> : null}
        <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquareText className="size-5" /></div><div><h3 className="text-lg font-semibold">Recent decisions</h3><p className="mt-1 text-sm text-slate-500">Completed employee decisions will appear here.</p></div></div>{!isDemoMode && requests.filter((request) => ['approved', 'declined', 'referred'].includes(request.status)).length === 0 ? <EmptyState className="mt-6" title="No completed decisions yet" description="Review an assigned request to move it forward." icon={CheckCircle2} /> : null}</Card>
      </section>
    </div>
  </PageShell>
}

function PreferenceChecks<T extends string>({ title, options, selected, onChange }: { title: string; options: { value: T; label: string }[]; selected: T[]; onChange: (values: T[]) => void }) {
  return <fieldset><legend className="mb-2 text-xs font-semibold text-slate-600">{title}</legend><div className="flex flex-wrap gap-2">{options.map((option) => <label key={option.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${selected.includes(option.value) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><input className="sr-only" type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value])} />{option.label}</label>)}</div></fieldset>
}
