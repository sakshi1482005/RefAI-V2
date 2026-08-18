import { CheckCircle2, ChevronLeft, CircleAlert, Compass, History, Plus, Send, Sparkles, WalletCards, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import AddCreditsDrawer, { type CreditPlanId } from '../components/dashboard/AddCreditsDrawer'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useAnalysisSessionResource } from '../hooks/useAnalysisSession'
import { api } from '../lib/apiClient'
import { friendlyErrorMessage } from '../lib/requestSafety'
import type { AIApplyAllowance, AIApplyMatch, AIApplyMatchRun, AIApplySubmission, AIApplyTimeline, AIApplyWorkMode, CreditBalance, CreditLedgerEntry } from '../types'

const createKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function AIOpportunityRecommendations() {
  const navigate = useNavigate()
  const analysisResource = useAnalysisSessionResource()
  const session = analysisResource.session
  const [targetRole, setTargetRole] = useState(session.role || '')
  const [targetCompany, setTargetCompany] = useState(session.company || '')
  const [department, setDepartment] = useState('')
  const [timeline, setTimeline] = useState<AIApplyTimeline | ''>('')
  const [workMode, setWorkMode] = useState<AIApplyWorkMode | ''>('')
  const [minimumCompatibility, setMinimumCompatibility] = useState('')
  const [matchCount, setMatchCount] = useState('5')
  const [run, setRun] = useState<AIApplyMatchRun | null>(null)
  const [allowance, setAllowance] = useState<AIApplyAllowance | null>(null)
  const [loadingAllowance, setLoadingAllowance] = useState(true)
  const [finding, setFinding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [created, setCreated] = useState<AIApplySubmission[]>([])
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([])
  const [wallet, setWallet] = useState<CreditBalance | null>(null)
  const [usage, setUsage] = useState<CreditLedgerEntry[]>([])
  const [walletError, setWalletError] = useState(false)
  const [showAddCredits, setShowAddCredits] = useState(false)
  const [selectedCreditPlan, setSelectedCreditPlan] = useState<CreditPlanId>('boost')
  const [recommendationNotice, setRecommendationNotice] = useState<string | null>(null)
  const recommendationRequestRef = useRef<{ signature: string; idempotencyKey: string } | null>(null)

  const missingSkills = useMemo(() => (session.trustCard?.missingRequirements ?? session.analysis?.missingRequirements ?? [])
    .map((item) => item.requirement).filter(Boolean).slice(0, 5), [session.analysis?.missingRequirements, session.trustCard?.missingRequirements])
  const hasPrerequisites = Boolean(session.analysisId && session.trustCard)

  useEffect(() => {
    let active = true
    api.get<AIApplyAllowance>('/ai-apply/allowance').then(({ data }) => {
      if (active) setAllowance(data)
    }).catch((cause) => {
      if (active) setError(friendlyErrorMessage(cause, 'Opportunity allowance is temporarily unavailable.'))
    }).finally(() => { if (active) setLoadingAllowance(false) })
    return () => { active = false }
  }, [])

  const refreshWallet = async () => {
    try {
      const [balance, history] = await Promise.all([
        api.get<CreditBalance>('/referral/credits'),
        api.get<CreditLedgerEntry[]>('/referral/credits/history'),
      ])
      setWallet(balance.data)
      setUsage(history.data)
      setWalletError(false)
    } catch {
      setWalletError(true)
    }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get<CreditBalance>('/referral/credits'), api.get<CreditLedgerEntry[]>('/referral/credits/history')])
      .then(([balance, history]) => { if (active) { setWallet(balance.data); setUsage(history.data) } })
      .catch(() => { if (active) setWalletError(true) })
    return () => { active = false }
  }, [])

  const findRecommendations = async () => {
    if (finding) return
    if (!targetRole.trim() || !targetCompany.trim()) { setError('Add both a target role and company to find appropriate referral opportunities.'); return }
    const signature = recommendationSignature({
      analysisId: session.analysisId, trustCardId: session.trustCard?.id,
      targetRole, targetCompany, department, timeline, workMode, minimumCompatibility, matchCount,
    })
    if (!recommendationRequestRef.current || recommendationRequestRef.current.signature !== signature) {
      recommendationRequestRef.current = { signature, idempotencyKey: createKey() }
    }
    setFinding(true); setError(null); setRecommendationNotice(null); setCreated([]); setSubmissionErrors([]); setConfirmed(false)
    try {
      // This read occurs only after an explicit click. It reuses the latest
      // persisted run only when it was built from this analysis/card and goal.
      try {
        const { data: savedRun } = await api.get<AIApplyMatchRun>('/ai-apply/goals/latest')
        if (isReusableRecommendationRun(savedRun, {
          analysisId: session.analysisId, trustCardId: session.trustCard?.id,
          targetRole, targetCompany, department, timeline, workMode, minimumCompatibility, matchCount,
          defaultMinimumCompatibility: allowance?.minimumCompatibilityThreshold,
        })) {
          setRun(savedRun)
          setSelected(savedRun.matches.filter((match) => match.referralRequestId === null && match.compatibility.score >= savedRun.goal.minimumCompatibility).map((match) => match.id))
          setMessage(`Hello, I am exploring the ${savedRun.goal.targetRole} opportunity at ${savedRun.goal.targetCompany}. Would you be open to reviewing my Candidate Trust Card for a referral?`)
          setRecommendationNotice('Saved recommendations were reused for these unchanged inputs.')
          return
        }
      } catch {
        // A saved run is optional. The authenticated create route below remains
        // the source of truth when none is available or it cannot be reused.
      }
      const { data } = await api.post<AIApplyMatchRun>('/ai-apply/goals', {
        targetRole: targetRole.trim(), targetCompany: targetCompany.trim(),
        preferredDepartment: department.trim() || null, timeline: timeline || null,
        workMode: workMode || null,
        minimumCompatibility: minimumCompatibility === '' ? null : Number(minimumCompatibility),
        numberOfMatches: Math.max(1, Math.min(10, Number(matchCount) || 5)),
        idempotencyKey: recommendationRequestRef.current.idempotencyKey,
      })
      setRun(data)
      setSelected(data.matches.filter((match) => match.referralRequestId === null && match.compatibility.score >= data.goal.minimumCompatibility).map((match) => match.id))
      setMessage(`Hello, I am exploring the ${data.goal.targetRole} opportunity at ${data.goal.targetCompany}. Would you be open to reviewing my Candidate Trust Card for a referral?`)
      setRecommendationNotice(data.matches.length ? 'Recommendations are ready to review.' : 'The matching run completed with no eligible recommendations.')
    } catch (cause) { setError(friendlyErrorMessage(cause, 'Recommendations could not be prepared.')) }
    finally { setFinding(false) }
  }

  const toggle = (match: AIApplyMatch) => {
    if (!run || match.referralRequestId || match.compatibility.score < run.goal.minimumCompatibility) return
    setSelected((current) => current.includes(match.id) ? current.filter((id) => id !== match.id) : [...current, match.id])
    setConfirmed(false)
  }

  const submitSelected = async () => {
    if (!confirmed || !message.trim() || !selected.length || submitting) return
    setSubmitting(true); setError(null); setSubmissionErrors([])
    const successes: AIApplySubmission[] = []
    const failures: string[] = []
    for (const matchId of selected) {
      try {
        const { data } = await api.post<AIApplySubmission>('/ai-apply/requests', {
          matchId, studentMessage: message.trim(), idempotencyKey: createKey(),
        })
        successes.push(data)
      } catch (cause) { failures.push(friendlyErrorMessage(cause, 'This referral request could not be created.')) }
    }
    setCreated(successes); setSubmissionErrors([...new Set(failures)])
    setSelected((current) => current.filter((matchId) => !successes.some((item) => item.matchId === matchId)))
    const last = successes[successes.length - 1]
    if (last) setAllowance((current) => current ? { ...current, creditBalance: last.creditBalance, weeklyRemaining: last.weeklyRemaining, weeklyUsed: current.weeklyCap - last.weeklyRemaining, available: last.weeklyRemaining > 0 && last.creditBalance > 0 } : current)
    setSubmitting(false)
  }

  return <PageShell eyebrow="AI Opportunity Recommendations" title="Find appropriate referral opportunities" description="Recommendations combine your saved profile, Candidate Trust Card, skill gaps, employee preferences, and a small semantic-ranking signal. They never predict hiring or send anything automatically." action={<SecondaryButton onClick={() => navigate('/dashboard')}><ChevronLeft className="mr-2 size-4" />Back to dashboard</SecondaryButton>}>
    {analysisResource.loading ? <Card className="p-5 sm:p-6"><Skeleton className="h-6 w-48" /><div className="mt-5 grid gap-4 md:grid-cols-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div></Card> : analysisResource.error ? <InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error, 'Your saved analysis could not be loaded.')} <button type="button" className="font-semibold underline" onClick={analysisResource.retry}>Retry</button></InlineFeedback> : !hasPrerequisites ? <EmptyState className="py-12" icon={Compass} title="Complete your analysis first" description="A current resume analysis and Candidate Trust Card are required before RefAI can prepare grounded opportunity recommendations." action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Analyse an opportunity</PrimaryButton>} /> : <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]"><Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Your opportunity goal</h2><p className="mt-1 text-sm leading-6 text-slate-600">Choose an opportunity, then review the employees RefAI finds appropriate for a referral request.</p></div>{loadingAllowance ? <Skeleton className="h-16 w-32" /> : allowance ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs"><p className="text-slate-500">Weekly remaining</p><p className="mt-1 text-lg font-semibold">{allowance.weeklyRemaining}</p></div> : null}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" required /></label><label className="text-sm font-medium">Target company<input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" required /></label><label className="text-sm font-medium">Preferred department <span className="font-normal text-slate-500">(optional)</span><input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">Timeline <span className="font-normal text-slate-500">(optional)</span><select value={timeline} onChange={(event) => setTimeline(event.target.value as AIApplyTimeline | '')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">No preference</option><option value="immediate">Immediate</option><option value="within_30_days">Within 30 days</option><option value="within_3_months">Within 3 months</option><option value="exploring">Exploring</option></select></label><label className="text-sm font-medium">Work mode <span className="font-normal text-slate-500">(optional)</span><select value={workMode} onChange={(event) => setWorkMode(event.target.value as AIApplyWorkMode | '')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">No preference</option><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="flexible">Flexible</option></select></label><label className="text-sm font-medium">Minimum compatibility <span className="font-normal text-slate-500">(optional)</span><input type="number" min="0" max="100" value={minimumCompatibility} onChange={(event) => setMinimumCompatibility(event.target.value)} placeholder={allowance ? String(allowance.minimumCompatibilityThreshold) : 'Default'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">Recommendations <select value={matchCount} onChange={(event) => setMatchCount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">{[3, 5, 8, 10].map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div>
        {missingSkills.length ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Current skill gaps considered</p><p className="mt-1 text-xs leading-5 text-amber-900">These are evidence gaps from your saved Trust Card, not claims that you lack a skill.</p><div className="mt-3 flex flex-wrap gap-2">{missingSkills.map((skill) => <Badge key={skill} tone="warning">{skill}</Badge>)}</div></div> : null}
        {error ? <div className="mt-4"><InlineFeedback tone="error">{error}</InlineFeedback></div> : null}{recommendationNotice ? <div className="mt-4"><InlineFeedback tone="success">{recommendationNotice}</InlineFeedback></div> : null}<PrimaryButton className="mt-5" onClick={findRecommendations} loading={finding} disabled={finding}><Sparkles className="mr-2 size-4" />Find recommendations</PrimaryButton>
      </Card><AIWallet wallet={wallet} usage={usage} error={walletError} onAddCredits={() => setShowAddCredits(true)} /></div>

      {run ? <section className="mt-6 space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ranked results</p><h2 className="mt-1 text-xl font-semibold">{run.matches.length ? `${run.matches.length} appropriate referral opportunities` : 'No appropriate opportunities found'}</h2></div><p className="text-xs text-slate-500">{run.eligibleEmployeeCount} eligible · {run.excludedEmployeeCount} excluded</p></div>
        {!run.matches.length ? <Card className="p-6"><EmptyState icon={Users} title="No recommendations met your threshold" description="Try a different role, company, or lower the compatibility preference. No referral request was created." />{run.exclusionReasons.length ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Why employees were excluded</summary>{run.exclusionReasons.map((item) => <p key={item.reason} className="mt-2 text-sm text-slate-600">• {item.reason} ({item.count})</p>)}</details> : null}</Card> : <div className="grid gap-4 lg:grid-cols-2">{run.matches.map((match) => <MatchCard key={match.id} match={match} minimum={run.goal.minimumCompatibility} selected={selected.includes(match.id)} onToggle={() => toggle(match)} />)}</div>}
        {run.limitations.length ? <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Matching limitations</summary>{run.limitations.map((item) => <p key={item} className="mt-2 text-xs leading-5 text-slate-600">{item}</p>)}</details> : null}
        {run.matches.length ? <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Confirm selected referral requests</h2><p className="mt-1 text-sm leading-6 text-slate-600">Your selection creates referral requests only. RefAI does not submit job applications or contact employees until you explicitly confirm below.</p><label className="mt-4 block text-sm font-medium">Referral message<textarea value={message} onChange={(event) => { setMessage(event.target.value); setConfirmed(false) }} maxLength={1000} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><p className="mt-1 text-xs text-slate-500">{message.length}/1000 · This is checked by the existing referral quality safeguards before each request is created. The server also checks factual integrity, compatibility, employee availability, capacity, your weekly allowance, and one credit per created request.</p><label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><span className="font-semibold">I confirm these {selected.length} selected referral request{selected.length === 1 ? '' : 's'}.</span><span className="mt-1 block text-xs leading-5 text-slate-600">This can use one credit per created request and counts against the weekly allowance. It does not apply for a job automatically.</span></span></label><PrimaryButton className="mt-4" onClick={submitSelected} loading={submitting} disabled={!confirmed || !selected.length || !message.trim()} disabledReason={!selected.length ? 'Select at least one eligible recommendation first.' : 'Confirm the selected referral requests first.'}><Send className="mr-2 size-4" />Confirm and create referral requests</PrimaryButton>
          {created.length ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" />{created.length} referral request{created.length === 1 ? '' : 's'} created</p><p className="mt-1 text-xs">Saved as Submitted. You can track each request from your dashboard.</p><SecondaryButton className="mt-3" onClick={() => navigate('/dashboard#referral-requests')}>Track requests</SecondaryButton></div> : null}{submissionErrors.length ? <div className="mt-4"><InlineFeedback tone="error">{submissionErrors.join(' ')}</InlineFeedback></div> : null}
        </Card> : null}
      </section> : null}
    </>}
    {showAddCredits ? <AddCreditsDrawer open balance={wallet?.balance ?? null} selectedPlan={selectedCreditPlan} onPlanChange={setSelectedCreditPlan} onClose={() => { setShowAddCredits(false); void refreshWallet() }} onPurchased={(result) => { setWallet({ balance: result.balance }); setWalletError(false); void refreshWallet() }} /> : null}
  </PageShell>
}

function normalizeRecommendationInput(value: string | null | undefined) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function recommendationSignature(input: {
  analysisId: string | undefined; trustCardId: string | undefined; targetRole: string; targetCompany: string;
  department: string; timeline: AIApplyTimeline | ''; workMode: AIApplyWorkMode | ''; minimumCompatibility: string; matchCount: string;
}) {
  return JSON.stringify({
    analysisId: input.analysisId || '', trustCardId: input.trustCardId || '',
    targetRole: normalizeRecommendationInput(input.targetRole), targetCompany: normalizeRecommendationInput(input.targetCompany),
    department: normalizeRecommendationInput(input.department), timeline: input.timeline || null, workMode: input.workMode || null,
    minimumCompatibility: input.minimumCompatibility === '' ? null : Number(input.minimumCompatibility),
    matchCount: Math.max(1, Math.min(10, Number(input.matchCount) || 5)),
  })
}

function isReusableRecommendationRun(run: AIApplyMatchRun, input: {
  analysisId: string | undefined; trustCardId: string | undefined; targetRole: string; targetCompany: string;
  department: string; timeline: AIApplyTimeline | ''; workMode: AIApplyWorkMode | ''; minimumCompatibility: string;
  matchCount: string; defaultMinimumCompatibility: number | undefined;
}) {
  const expectedMinimum = input.minimumCompatibility === '' ? input.defaultMinimumCompatibility : Number(input.minimumCompatibility)
  if (expectedMinimum == null || Number.isNaN(expectedMinimum)) return false
  return run.goal.analysisId === input.analysisId
    && run.goal.trustCardId === input.trustCardId
    && normalizeRecommendationInput(run.goal.targetRole) === normalizeRecommendationInput(input.targetRole)
    && normalizeRecommendationInput(run.goal.targetCompany) === normalizeRecommendationInput(input.targetCompany)
    && normalizeRecommendationInput(run.goal.preferredDepartment) === normalizeRecommendationInput(input.department)
    && run.goal.timeline === (input.timeline || null)
    && run.goal.workMode === (input.workMode || null)
    && run.goal.minimumCompatibility === expectedMinimum
    && run.goal.numberOfMatches === Math.max(1, Math.min(10, Number(input.matchCount) || 5))
}

function MatchCard({ match, minimum, selected, onToggle }: { match: AIApplyMatch; minimum: number; selected: boolean; onToggle: () => void }) {
  const blocked = Boolean(match.referralRequestId) || match.compatibility.score < minimum
  return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">Recommendation {match.rank}</p><h3 className="mt-1 text-lg font-semibold">{match.employee.name}</h3><p className="mt-1 text-sm text-slate-600">{match.employee.designation || 'Employee'} · {match.employee.company || 'Company not listed'}</p>{match.employee.department ? <p className="mt-1 text-xs text-slate-500">{match.employee.department}</p> : null}</div><div className="text-right"><p className="text-xl font-semibold">{match.compatibility.score}/100</p><Badge tone={match.compatibility.label === 'Strong fit' || match.compatibility.label === 'Good fit' ? 'success' : 'warning'}>{match.compatibility.label}</Badge></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Why this may fit</p>{match.reason.positiveFactors.slice(0, 3).map((item) => <p key={item} className="mt-2 text-xs leading-5 text-slate-700">✓ {item}</p>)}<p className="mt-3 text-[11px] leading-4 text-slate-500">{match.reason.semanticBasis}</p></div>{match.reason.cautions.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-amber-950"><CircleAlert className="size-3.5" />Missing evidence or conflicts</p>{match.reason.cautions.slice(0, 3).map((item) => <p key={item} className="mt-1 text-xs leading-5 text-amber-900">• {item}</p>)}</div> : null}<label className={`mt-4 flex items-center gap-2 text-sm font-semibold ${blocked ? 'text-slate-400' : 'cursor-pointer text-slate-900'}`}><input type="checkbox" checked={selected} disabled={blocked} onChange={onToggle} />{match.referralRequestId ? 'A referral request already exists' : blocked ? `Below the ${minimum} compatibility threshold` : 'Select for confirmation'}</label></Card>
}

function AIWallet({ wallet, usage, error, onAddCredits }: { wallet: CreditBalance | null; usage: CreditLedgerEntry[]; error: boolean; onAddCredits: () => void }) {
  const balance = wallet?.balance
  const low = typeof balance === 'number' && balance <= 2
  return <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.75)]"><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">RefAI Credits</p><h2 className="mt-1 text-lg font-semibold">AI Wallet</h2></div><span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"><WalletCards className="size-4 text-emerald-300" /></span></div>{error ? <p className="mt-5 text-sm leading-6 text-slate-300">Balance is temporarily unavailable. Credit checks still happen securely when you use a paid AI action.</p> : wallet ? <><div className="mt-6"><p className="text-4xl font-semibold tabular-nums">{balance}</p><p className="mt-1 text-xs text-slate-400">AI credits available</p></div><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-3"><p className="text-xs font-semibold text-white">About {balance} AI action{balance === 1 ? '' : 's'} remaining</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Most referral-message actions cost 1 credit. The server confirms every charge.</p></div>{low ? <p className="mt-3 text-xs leading-5 text-amber-200">Low balance — you can still use all free RefAI features.</p> : null}</> : <div className="mt-5 space-y-3"><Skeleton className="h-10 w-16 bg-white/10" /><Skeleton className="h-16 w-full bg-white/10" /></div>}<button type="button" onClick={onAddCredits} className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/15 bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"><Plus className="mr-2 size-4" />Add Credits</button></div><details className="border-t border-white/10"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-semibold text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">Recent usage <History className="size-3.5 text-slate-400" /></summary><div className="border-t border-white/10 px-5 py-3">{usage.length ? usage.slice(0, 3).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="truncate text-slate-300">{entry.action.replace(/_/g, ' ')}</span><span className={entry.amount < 0 ? 'text-amber-200' : 'text-emerald-200'}>{entry.amount > 0 ? '+' : ''}{entry.amount}</span></div>) : <p className="text-xs leading-5 text-slate-400">No AI credit usage yet.</p>}</div></details></aside>
}
