import { BriefcaseBusiness, CheckCircle2, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { DEMO_CANDIDATE_ID, demoEmployeeReview } from '../lib/demoData'
import { employeeReviewHref, employeeStatusLabel } from '../lib/employeeWorkflow'
import { parseEmployeeQueue } from '../lib/employeeQueueContract'
import { api } from '../lib/apiClient'
import { FriendlyRequestError, friendlyErrorMessage } from '../lib/requestSafety'
import type { EmployeeProfessionalProfile, EmployeeReferralQueueItem } from '../types'

type CandidateQueueItem = { id: string; name: string; college: string | null; role: string; company: string; trustScore: number | null; overallMatch: number | null; status: string; time: string; demo?: boolean }

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { isDemoMode, demoDecision, demoJourneyStage } = useDemoMode()
  const [requests, setRequests] = useState<EmployeeReferralQueueItem[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<unknown>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [company, setCompany] = useState('')
  const [designation, setDesignation] = useState('')
  const [savedCompany, setSavedCompany] = useState('')
  const [professionalProfileLoading, setProfessionalProfileLoading] = useState(!isDemoMode)
  const [professionalProfileSaving, setProfessionalProfileSaving] = useState(false)
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
      setSavedCompany(data.company ?? '')
      setProfessionalProfileFeedback(null)
    }).catch((profileError) => {
      if (active) setProfessionalProfileFeedback({ tone: 'error', message: friendlyErrorMessage(profileError, 'We could not load your professional profile. Please try again.') })
    }).finally(() => { if (active) setProfessionalProfileLoading(false) })
    return () => { active = false }
  }, [isDemoMode])

  const demoStatus = demoDecision === 'approved' ? 'Approved' : demoDecision === 'declined' ? 'Declined' : demoDecision === 'more_info_requested' ? 'More information requested' : 'Pending'
  const queue: CandidateQueueItem[] = isDemoMode
    ? referralSent ? [{ id: DEMO_CANDIDATE_ID, name: demoEmployeeReview.candidateName, college: 'PES University', role: demoEmployeeReview.role, company: demoEmployeeReview.company, trustScore: 91, overallMatch: demoEmployeeReview.match, status: demoStatus, time: demoEmployeeReview.submitted, demo: true }] : []
    : requests.map((request) => ({ id: request.id, name: request.studentName || 'Student applicant', college: request.college, role: request.targetRole, company: request.targetCompany, trustScore: request.trustScore, overallMatch: request.overallMatch, status: employeeStatusLabel[request.status], time: new Date(request.createdAt).toLocaleDateString() }))
  const metrics = useMemo(() => {
    if (isDemoMode) return [{ label: demoDecision === 'pending' ? 'Pending Requests' : 'Reviewed', value: '1' }, { label: 'Approved', value: demoDecision === 'approved' ? '1' : '0' }]
    const count = (status: string) => requests.filter((request) => request.status === status).length
    const scores = requests.flatMap((request) => request.trustScore === null ? [] : [request.trustScore])
    return [{ label: 'Pending Requests', value: String(count('pending')) }, { label: 'Under Review', value: String(count('under_review')) }, { label: 'Approved', value: String(count('approved')) }, { label: 'Declined', value: String(count('declined')) }, { label: 'Average Trust Score', value: scores.length ? String(Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)) : '—' }]
  }, [demoDecision, isDemoMode, requests])
  const errorKind = error instanceof FriendlyRequestError ? error.kind : 'unknown'
  const errorText = error ? friendlyErrorMessage(error, 'We could not load your referral queue. Please try again.') : null
  const review = (candidate: CandidateQueueItem) => navigate(isDemoMode ? `/employee/review/${candidate.id}` : employeeReviewHref({ id: candidate.id }))
  const saveProfessionalProfile = async () => {
    const normalizedCompany = company.trim()
    if (!normalizedCompany || professionalProfileSaving) {
      if (!normalizedCompany) setProfessionalProfileFeedback({ tone: 'error', message: 'Company Name is required.' })
      return
    }
    setProfessionalProfileSaving(true)
    setProfessionalProfileFeedback(null)
    try {
      const { data } = await api.put<EmployeeProfessionalProfile>('/referral/employee/profile', { company: normalizedCompany, designation: designation.trim() || null })
      setCompany(data.company ?? '')
      setDesignation(data.designation ?? '')
      setSavedCompany(data.company ?? '')
      setProfessionalProfileFeedback({ tone: 'success', message: 'Professional profile saved. Students can now see your company in the employee directory.' })
    } catch (profileError) {
      const message = profileError instanceof FriendlyRequestError && profileError.kind === 'validation'
        ? 'Enter a valid company name before saving your professional profile.'
        : friendlyErrorMessage(profileError, 'We could not save your professional profile. Please try again.')
      setProfessionalProfileFeedback({ tone: 'error', message })
    } finally {
      setProfessionalProfileSaving(false)
    }
  }

  return <PageShell eyebrow="Employee portal" title="Review incoming referral requests" description="Open a request to inspect the candidate evidence and Trust Card before making a referral decision." action={<PrimaryButton onClick={() => document.getElementById('candidate-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View Candidates</PrimaryButton>}>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section id="candidate-queue" className="scroll-mt-24 space-y-6">
        <Card className="p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review status</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">What needs your attention</h2></div><Badge tone={isDemoMode ? 'warning' : 'neutral'}><Sparkles className="mr-1.5 size-3.5" />{isDemoMode ? 'Demo data' : 'Live queue'}</Badge></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{loading ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />) : metrics.map((item) => <div key={item.label} className="rounded-xl border border-slate-200 p-4"><p className="text-xl font-semibold">{item.value}</p><p className="mt-4 text-sm font-semibold">{item.label}</p></div>)}</div>
        </Card>

        <Card className="p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-semibold">Candidates to review</h3><p className="mt-1 text-sm text-slate-500">Start with the available evidence, not the score alone.</p></div><PrimaryButton className="w-full sm:w-auto" onClick={() => queue[0] && review(queue[0])} disabled={loading || queue.length === 0} disabledReason="No assigned requests are currently available">Open review board</PrimaryButton></div>
          {errorText ? <div className="mt-6"><InlineFeedback tone="error">{errorKind === 'auth' ? (errorText.includes('permission') ? 'You do not have permission to view this queue.' : 'Your session has expired. Sign in again, then reload your queue.') : errorText}<SecondaryButton className="ml-3" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></InlineFeedback></div> : null}
          <div className="mt-6 space-y-3">{queue.map((candidate) => <div key={candidate.id} className="group relative rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm sm:p-5"><Link to={isDemoMode ? `/employee/review/${candidate.id}` : employeeReviewHref({ id: candidate.id })} className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" aria-label={`Review ${candidate.name}`}><span className="sr-only">Review {candidate.name}</span></Link><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{candidate.name}</p><Badge tone={candidate.demo ? 'warning' : 'info'}>{candidate.status}</Badge>{candidate.demo ? <Badge tone="warning">Demo</Badge> : null}</div><p className="mt-2 text-sm text-slate-600">{candidate.role} · {candidate.company}</p><p className="mt-1 text-xs text-slate-500">{candidate.college || 'College not provided'}</p></div><div className="flex flex-wrap items-center gap-3 text-sm text-slate-500"><span className="rounded-full bg-slate-100 px-3 py-1">Trust {candidate.trustScore ?? '—'}</span><span>Match {candidate.overallMatch === null ? '—' : `${candidate.overallMatch}%`}</span><span>{candidate.time}</span></div></div><div className="relative z-10 mt-5"><Link to={isDemoMode ? `/employee/review/${candidate.id}` : employeeReviewHref({ id: candidate.id })} className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">Review candidate</Link></div></div>)}
            {!loading && !error && queue.length === 0 ? <EmptyState title="Your review queue is clear" description="Referral requests addressed to you will appear here with candidate evidence and Trust Card signals." icon={BriefcaseBusiness} action={<PrimaryButton onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Refresh queue</PrimaryButton>} /> : null}
          </div>
        </Card>
      </section>

      <section className="space-y-6">{!isDemoMode ? <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><BriefcaseBusiness className="size-5" /></div><div><h3 className="text-lg font-semibold">Professional Profile</h3><p className="mt-1 text-sm text-slate-500">Shown to students in the employee directory.</p></div></div>{professionalProfileLoading ? <div className="mt-6 space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div> : <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void saveProfessionalProfile() }}><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Company Name</span><input value={company} onChange={(event) => setCompany(event.target.value)} required maxLength={200} autoComplete="organization" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" placeholder="Company name" /></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Designation / Job Title <span className="font-normal normal-case tracking-normal">(optional)</span></span><input value={designation} onChange={(event) => setDesignation(event.target.value)} maxLength={200} autoComplete="organization-title" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" placeholder="Software Engineer" /></label>{professionalProfileFeedback ? <InlineFeedback tone={professionalProfileFeedback.tone}>{professionalProfileFeedback.message}</InlineFeedback> : null}<PrimaryButton className="w-full" type="submit" loading={professionalProfileSaving} disabled={!company.trim()} disabledReason="Company Name is required">{savedCompany ? 'Update profile' : 'Save profile'}</PrimaryButton></form>}</Card> : null}<Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><BriefcaseBusiness className="size-5" /></div><div><h3 className="text-lg font-semibold">Quick actions</h3><p className="mt-1 text-sm text-slate-500">Continue with the first request assigned to you.</p></div></div><div className="mt-6 space-y-3"><PrimaryButton className="w-full" onClick={() => queue[0] && review(queue[0])} disabled={loading || queue.length === 0} disabledReason="No assigned requests are currently available">Open next review</PrimaryButton><SecondaryButton className="w-full" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="mr-2 size-4" />Refresh requests</SecondaryButton></div></Card>
        <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquareText className="size-5" /></div><div><h3 className="text-lg font-semibold">Recent decisions</h3><p className="mt-1 text-sm text-slate-500">Completed employee decisions will appear here.</p></div></div>{!isDemoMode && requests.filter((request) => ['approved', 'declined', 'referred'].includes(request.status)).length === 0 ? <EmptyState className="mt-6" title="No completed decisions yet" description="Review an assigned request to move it forward." icon={CheckCircle2} /> : null}</Card>
      </section>
    </div>
  </PageShell>
}
