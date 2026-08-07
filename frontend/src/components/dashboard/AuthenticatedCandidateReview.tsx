import { FileText, MessageSquareText, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from './PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from './primitives'
import { useEmployeeRequestResource } from '../../hooks/useEmployeeRequestResource'
import { parseEmployeeRequestDetail } from '../../lib/employeeDetailContract'
import { employeeStatusLabel, getEmployeeWorkflowState } from '../../lib/employeeWorkflow'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import { api } from '../../lib/apiClient'
import type { ClaimVerificationResult, EmployeeReviewCopilot } from '../../types'
import ProofVaultPanel from './ProofVaultPanel'
import CandidateReviewSnapshot from './CandidateReviewSnapshot'

const warningStatuses = new Set(['Partially supported', 'Self-declared', 'Needs clarification'])

export default function AuthenticatedCandidateReview({ requestId }: { requestId: string }) {
  const navigate = useNavigate()
  const resource = useEmployeeRequestResource(`/referral/employee/requests/${requestId}`, parseEmployeeRequestDetail)
  const detail = resource.data
  const [copilot, setCopilot] = useState<EmployeeReviewCopilot | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [claims, setClaims] = useState<ClaimVerificationResult | null>(null)
  const [claimsLoading, setClaimsLoading] = useState(true)
  const [claimsError, setClaimsError] = useState(false)
  const workflow = getEmployeeWorkflowState({ hasAssignedRequest: Boolean(detail), resumeExists: detail?.resumeExists, trustCardExists: detail?.trustCardExists, status: detail?.status })

  useEffect(() => {
    let active = true
    setClaimsLoading(true)
    setClaimsError(false)
    api.get<ClaimVerificationResult>(`/referral/employee/requests/${requestId}/claim-verifications`)
      .then(({ data }) => { if (active) setClaims(data) })
      .catch(() => { if (active) { setClaims(null); setClaimsError(true) } })
      .finally(() => { if (active) setClaimsLoading(false) })
    return () => { active = false }
  }, [requestId])

  const summarizeCandidate = async () => {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotError(null)
    try {
      const { data } = await api.post<EmployeeReviewCopilot>(`/referral/employee/requests/${requestId}/copilot`)
      setCopilot(data)
    } catch (error) {
      setCopilotError(friendlyErrorMessage(error, 'The advisory summary could not be prepared.'))
    } finally {
      setCopilotLoading(false)
    }
  }

  const claimWarnings = useMemo(() => claimsError
    ? ['Claim verification is unavailable for this saved request. Review the Trust Card manually.']
    : (claims?.claims ?? []).filter((item) => warningStatuses.has(item.status)).map((item) => `${item.claim} — ${item.reason}`),
  [claims, claimsError])

  if (resource.loading) return <PageShell eyebrow="Candidate review" title="Loading assigned candidate" description="Verifying request access and preparing the 30-second evidence view."><div className="space-y-5"><Skeleton className="h-[28rem] rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div></PageShell>
  if (resource.error || !detail) return <PageShell eyebrow="Candidate review" title="Candidate review unavailable" description="RefAI could not load this assigned referral request."><InlineFeedback tone="error">{friendlyErrorMessage(resource.error, 'This request was not found or is not assigned to your Employee account.')}</InlineFeedback><EmptyState className="mt-6" icon={ShieldCheck} title="Unable to open this assigned request" description="Return to your queue or retry the authorized request." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={resource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} /></PageShell>

  const candidate = detail.candidate
  const name = candidate.studentName || 'Student applicant'
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA'
  const analysis = detail.analysis
  const strengths = (analysis?.strengths?.length ? analysis.strengths : analysis?.matchedSkills) ?? []
  const concerns = (analysis?.missingRequirements ?? []).map((item) => `${item.requirement}: ${item.whyItMatters}`)
  const evidenceHref = `/employee/trust-card/${requestId}`
  const decisionHref = `/employee/decision/${requestId}`

  return <PageShell compact eyebrow="30-second candidate review" title="Evidence-based referral review" description="Start with the recorded evidence summary. Open the raw resume only when you need source-level verification." action={<SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Candidates</SecondaryButton>}>
    <CandidateReviewSnapshot
      candidateName={name}
      initials={initials}
      photoUrl={candidate.profilePhotoUrl}
      targetRole={detail.targetRole}
      targetCompany={detail.targetCompany}
      statusLabel={employeeStatusLabel[detail.status]}
      trustScore={analysis?.trustScore}
      reliabilityLabel={analysis?.analysisReliability?.label}
      compatibilityScore={detail.compatibility?.score}
      compatibilityLabel={detail.compatibility?.label}
      strengths={strengths}
      concerns={concerns}
      claimWarnings={claimWarnings}
      claimWarningsLoading={claimsLoading}
      evidenceHref={evidenceHref}
    />

    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-5">
        <Card className="border-blue-200 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><Sparkles className="size-5 text-blue-700" aria-hidden="true" /><h2 className="text-lg font-semibold">Employee Review Copilot</h2><Badge tone="info">Advisory AI</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">Evidence summary only. The employee makes every approval, decline, or information-request decision.</p></div><PrimaryButton onClick={summarizeCandidate} loading={copilotLoading}><Sparkles className="mr-2 size-4" />Summarize Candidate in 30 Seconds</PrimaryButton></div>
          {copilotError ? <div className="mt-4"><InlineFeedback tone="error">{copilotError}</InlineFeedback></div> : null}
          {copilot ? <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Suggested review priority</p><p className="mt-1 text-sm font-semibold">{copilot.suggestedReviewPriority}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Matched core requirements</p><p className="mt-1 text-sm font-semibold">{copilot.matchedCoreRequirementsCount}/{copilot.totalCoreRequirementsCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Grounding</p><p className="mt-1 text-sm font-semibold">{copilot.hasJobDescription ? 'Resume + Job Description' : 'Resume + role context'}</p></div></div>
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{copilot.narrative}</p>
            <div className="grid gap-3 lg:grid-cols-2">{([['Evidence-backed strengths', copilot.evidenceBackedStrengths], ['Concerns or missing evidence', copilot.concernsOrMissingEvidence]] as const).map(([title, items]) => <section key={title} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">{title}</p><div className="mt-3 space-y-2">{items.slice(0, 3).map((item, index) => <div key={`${title}-${index}`}><p className="text-sm leading-6 text-slate-700">{item.text}</p><Link to={evidenceHref} className="text-xs font-semibold text-slate-600 underline">Review grounded evidence</Link></div>)}</div></section>)}</div>
            <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-black">Questions and grounding limitations</summary><div className="mt-3 space-y-2">{copilot.usefulQuestions.map((question) => <p key={question} className="text-sm leading-6 text-slate-700">• {question}</p>)}{copilot.limitations.map((item) => <p key={item} className="text-xs leading-5 text-slate-500">Limit: {item}</p>)}</div></details>
          </div> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">Generate the existing grounded summary when useful. RefAI will not approve, decline, or submit a referral automatically.</p>}
        </Card>

        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-black">Student request note and saved analysis details</summary><div className="mt-4 space-y-4"><div className="rounded-xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><MessageSquareText className="size-4" />Student request note</p><p className="mt-2 text-sm leading-6 text-slate-700">{detail.studentMessage}</p></div>{analysis ? <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">Recorded evidence</p>{analysis.evidence?.slice(0, 4).map((item) => <p key={item} className="mt-2 text-xs leading-5 text-slate-600">• {item}</p>) || <p className="mt-2 text-xs text-slate-500">Unavailable for this saved request.</p>}</div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">Readiness summary</p><p className="mt-2 text-xs leading-5 text-slate-600">{analysis.readinessSummary || 'Unavailable for this saved request.'}</p></div></div> : <p className="text-sm text-slate-500">No persisted analysis summary is available for this older request.</p>}</div></details>
        <ProofVaultPanel requestId={requestId} />
      </div>

      <aside className="self-start xl:sticky xl:top-24">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Employee decision</p><h2 className="mt-2 text-lg font-semibold">Record your decision</h2><p className="mt-2 text-xs leading-5 text-slate-600">AI output is advisory. Review evidence and choose the appropriate action yourself.</p>
          <div className="mt-4 grid gap-2"><PrimaryButton onClick={() => navigate(decisionHref)} disabled={!workflow.canMakeDecision} disabledReason="A persisted Trust Card and active review state are required">Approve for referral</PrimaryButton><SecondaryButton onClick={() => navigate(decisionHref)} disabled={!workflow.canMakeDecision}>Request more information</SecondaryButton><SecondaryButton onClick={() => navigate(decisionHref)} disabled={!workflow.canMakeDecision}>Decline request</SecondaryButton></div>
          {!workflow.canMakeDecision ? <p className="mt-3 text-xs leading-5 text-slate-500">This request already has a recorded outcome or lacks a persisted Trust Card.</p> : null}
          <div className="mt-4 border-t border-slate-200 pt-4"><SecondaryButton className="w-full" onClick={() => navigate(`/employee/resume/${requestId}`)} disabled={!workflow.canOpenResume} disabledReason="No stored resume is linked"><FileText className="mr-2 size-4" />Open raw resume</SecondaryButton><SecondaryButton className="mt-2 w-full" onClick={() => navigate(evidenceHref)} disabled={!workflow.canOpenTrustCard}>Open full Trust Card</SecondaryButton>{!workflow.canMakeDecision && detail.decisionAt ? <PrimaryButton className="mt-2 w-full" onClick={() => navigate(`${decisionHref}/confirmation`)}>View decision confirmation</PrimaryButton> : null}</div>
        </Card>
      </aside>
    </div>
  </PageShell>
}
