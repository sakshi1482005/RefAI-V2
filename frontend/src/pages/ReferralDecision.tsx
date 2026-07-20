import { ArrowRight, Check, CheckCircle2, MessageSquareText, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoEmployeeReview, demoReferral } from '../lib/demoData'
import type { DemoDecision } from '../context/DemoModeContext'
import { useEmployeeRequestResource } from '../hooks/useEmployeeRequestResource'
import { parseEmployeeRequestDetail, parseEmployeeTrustCard } from '../lib/employeeDetailContract'
import { employeeStatusLabel, getEmployeeWorkflowState } from '../lib/employeeWorkflow'
import { api } from '../lib/apiClient'
import { friendlyErrorMessage } from '../lib/requestSafety'
import type { ReferralRequestDetail } from '../types'

type RecordedDecision = Exclude<DemoDecision, 'pending'>

function decisionLabel(decision: DemoDecision) {
  if (decision === 'approved') return 'Approved'
  if (decision === 'declined') return 'Declined'
  if (decision === 'more_info_requested') return 'More information requested'
  return 'Decision pending'
}

function AuthenticatedReferralDecision({ requestId }: { requestId: string }) {
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const detailResource = useEmployeeRequestResource(`/referral/employee/requests/${requestId}`, parseEmployeeRequestDetail)
  const cardResource = useEmployeeRequestResource(detailResource.data?.trustCardExists ? `/referral/employee/requests/${requestId}/trust-card` : null, parseEmployeeTrustCard)
  const detail = detailResource.data
  const card = cardResource.data
  const workflow = getEmployeeWorkflowState({ hasAssignedRequest: Boolean(detail), resumeExists: detail?.resumeExists, trustCardExists: Boolean(card), status: detail?.status })

  const recordDecision = async (decision: RecordedDecision) => {
    if (!detail || !card || !workflow.canMakeDecision || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const { data } = await api.patch<ReferralRequestDetail>(`/referral/requests/${requestId}/decision`, { status: decision, note: note.trim() || null })
      navigate(`/employee/decision/${requestId}/confirmation`, { state: { requestId, candidateName: detail.candidate.studentName || 'Student applicant', decision, note: data.employeeNote || note.trim(), recordedAt: data.updatedAt, persistence: 'backend' } })
    } catch (error) {
      setSaveError(friendlyErrorMessage(error, 'The decision could not be saved. Refresh the request and try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (detailResource.loading || cardResource.loading) return <PageShell eyebrow="Referral decision" title="Loading decision evidence" description="Verifying the assigned request and persisted Trust Card."><Card className="h-72 animate-pulse bg-slate-100"><span className="sr-only">Loading decision evidence</span></Card></PageShell>
  if (detailResource.error || !detail) return <PageShell eyebrow="Referral decision" title="Decision unavailable" description="RefAI could not verify this assigned request."><InlineFeedback tone="error">{friendlyErrorMessage(detailResource.error, 'This request is unavailable or is not assigned to your Employee account.')}</InlineFeedback><EmptyState className="mt-6" icon={ShieldCheck} title="Candidate request unavailable" description="Return to the Employee queue or retry the authorized request." action={<div className="flex gap-2"><PrimaryButton onClick={detailResource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} /></PageShell>

  const candidateName = detail.candidate.studentName || 'Student applicant'
  const unavailableReason = !card ? 'A readable persisted Trust Card is required before deciding.' : !workflow.canMakeDecision ? 'This request already has a recorded outcome.' : null
  return <PageShell eyebrow="Referral decision" title={`Decide whether to refer ${candidateName}`} description="Use the persisted candidate evidence and Trust Card, add a concise reason, then approve, decline, or request more information." action={<div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap"><SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId}`)}>Back to Trust Card</SecondaryButton><SecondaryButton onClick={() => recordDecision('declined')} loading={saving} disabled={!workflow.canMakeDecision} disabledReason={unavailableReason || undefined}><X className="mr-2 size-4" />Decline referral</SecondaryButton><SecondaryButton onClick={() => recordDecision('more_info_requested')} loading={saving} disabled={!workflow.canMakeDecision} disabledReason={unavailableReason || undefined}><MessageSquareText className="mr-2 size-4" />Request more information</SecondaryButton><PrimaryButton onClick={() => recordDecision('approved')} loading={saving} disabled={!workflow.canMakeDecision} disabledReason={unavailableReason || undefined}><Check className="mr-2 size-4" />Approve referral</PrimaryButton></div>}>
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck className="size-5" /></div><div><h2 className="text-xl font-semibold">Evidence to decide from</h2><p className="mt-1 text-sm text-slate-500">Persisted data for {detail.targetRole} at {detail.targetCompany}</p></div></div>{card ? <div className="mt-6 space-y-3"><Badge tone={workflow.canMakeDecision ? 'warning' : 'info'}>{workflow.canMakeDecision ? 'Ready for decision' : employeeStatusLabel[detail.status]}</Badge><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Trust Score</p><p className="mt-2 text-xl font-semibold">{card.trustScore ?? 'Unavailable'}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Overall Match</p><p className="mt-2 text-xl font-semibold">{card.overallMatch === null ? 'Unavailable' : `${card.overallMatch}%`}</p></div></div><p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{card.summary || detail.analysis?.readinessSummary || 'No summary is available; inspect the linked evidence before deciding.'}</p></div> : <EmptyState className="mt-6" icon={ShieldCheck} title="Trust Card required" description="Decision controls remain disabled because this request has no readable persisted Trust Card." action={<PrimaryButton onClick={cardResource.retry}>Retry Trust Card</PrimaryButton>} />}</Card>
      <Card className="p-6 sm:p-8"><div id="decision-panel" className="scroll-mt-28" /><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquareText className="size-5" /></div><div><h3 className="text-lg font-semibold">Explain the decision</h3><p className="mt-1 text-sm text-slate-500">Record which evidence supports the outcome or remains insufficient.</p></div></div><label htmlFor="decision-note" className="sr-only">Decision note</label><textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={!workflow.canMakeDecision || saving} className="mt-6 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" placeholder="Add an evidence-based decision note…" /><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>The decision is saved to the existing referral request.</span><span>{note.length}/500</span></div>{saveError ? <div className="mt-4"><InlineFeedback tone="error">{saveError}</InlineFeedback></div> : null}{unavailableReason ? <div className="mt-4"><InlineFeedback tone="info">{unavailableReason}</InlineFeedback></div> : null}</Card>
    </div>
  </PageShell>
}

export default function ReferralDecision() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision, setDemoDecision } = useDemoMode()
  const candidateName = isDemoMode ? demoEmployeeReview.candidateName : requestId ? `Candidate ${requestId}` : 'Candidate'
  const [note, setNote] = useState(isDemoMode ? demoReferral.note : '')
  if (!isDemoMode && requestId) return <AuthenticatedReferralDecision requestId={requestId} />
  const recordDecision = (decision: RecordedDecision) => {
    if (!isDemoMode) return
    const decisionRecord = { requestId: requestId ?? demoEmployeeReview.candidateId, candidateName, decision, note: note.trim(), recordedAt: new Date().toISOString(), persistence: isDemoMode ? 'demo' as const : 'local' as const }
    if (isDemoMode) setDemoDecision(decision)
    else window.localStorage.setItem(`refai-decision:${decisionRecord.requestId}`, JSON.stringify(decisionRecord))
    navigate(`/employee/decision/${decisionRecord.requestId}/confirmation`, { state: decisionRecord })
  }

  return (
    <PageShell
      eyebrow="Referral decision"
      title={`Decide whether to refer ${candidateName}`}
      description="You are at the final review step. Use the resume and Trust Card evidence, add a concise reason, then approve, decline, or request more information."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId ?? 'sg-001'}`)}>Back to Trust Card</SecondaryButton>
          <SecondaryButton onClick={() => recordDecision('declined')} disabled={!isDemoMode} disabledReason="Candidate evidence is not available for a decision">
            <X className="mr-2 size-4" />
            {isDemoMode ? 'Decline referral' : 'Save decline draft'}
          </SecondaryButton>
          <SecondaryButton onClick={() => recordDecision('more_info_requested')} disabled={!isDemoMode} disabledReason="Candidate evidence is not available for a decision">
            <MessageSquareText className="mr-2 size-4" />
            Request more information
          </SecondaryButton>
          <PrimaryButton onClick={() => recordDecision('approved')} disabled={!isDemoMode} disabledReason="Candidate evidence is not available for a decision">
            <Check className="mr-2 size-4" />
            {isDemoMode ? 'Approve referral' : 'Save approval draft'}
          </PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Evidence to decide from</h2>
              <p className="mt-1 text-sm text-slate-500">{isDemoMode ? demoDecision === 'pending' ? 'Review the supporting claims before choosing an outcome · Demo data only' : 'This employee decision has been recorded · Demo data only' : 'Candidate decision data is not exposed by the current backend.'}</p>
            </div>
          </div>

          {/* TODO: Populate when a candidate decision API is available. */}
          {isDemoMode ? <div className="mt-6 space-y-3"><Badge tone={demoDecision === 'pending' ? 'warning' : demoDecision === 'approved' ? 'success' : 'neutral'}>{decisionLabel(demoDecision)}{demoDecision !== 'pending' ? ' · Demo' : ''}</Badge><p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{demoDecision === 'pending' ? 'Ananya’s 88% Resume Match, 93 ATS Score, and 91 Trust Score are supported by measurable React delivery, FastAPI ownership, and SQL evidence. Meera should verify that evidence before deciding on the Atlassian referral.' : demoDecision === 'approved' ? 'Meera approved Ananya’s Atlassian referral after reviewing the 88% Resume Match, 93 ATS Score, 91 Trust Score, and supporting project evidence.' : demoDecision === 'more_info_requested' ? 'Meera requested more information so Ananya can add stronger evidence for the remaining cloud deployment gap before a final decision.' : 'Meera declined Ananya’s Atlassian referral after reviewing the available resume evidence and Trust Card.'}</p></div> : <EmptyState className="mt-6" title="Review evidence before deciding" description="Candidate match signals, proof points, and recommendations will appear when the decision workflow returns evidence. Decisions remain disabled until then." icon={ShieldCheck} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Open Candidate Review</PrimaryButton><SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId ?? 'sg-001'}`)}>View Trust Card</SecondaryButton></div>} />}

        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8" >
            <div id="decision-panel" className="scroll-mt-28" />
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <MessageSquareText className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Explain the decision</h3>
                <p className="mt-1 text-sm text-slate-500">Record which evidence supports the outcome or what remains insufficient.</p>
              </div>
            </div>

            <label htmlFor="decision-note" className="sr-only">Decision note</label>
            <textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={!isDemoMode} className="mt-6 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" placeholder={isDemoMode ? 'Add a decision note…' : 'Candidate evidence is required before adding a decision note.'} />

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Use concise, evidence-based language.</span>
              <span className="shrink-0">{note.length}/500</span>
            </div>

            <div className="mt-4"><InlineFeedback tone="info">{isDemoMode ? 'This decision stays inside the isolated demo session and updates both employee and student views.' : 'Decisions are recorded locally for this hackathon flow. The confirmation clearly identifies them as drafts until a backend decision API is connected.'}</InlineFeedback></div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Badge tone={isDemoMode ? demoDecision === 'pending' ? 'warning' : 'success' : 'neutral'}>{isDemoMode ? demoDecision === 'pending' ? 'Ready for decision' : 'Demo decision recorded' : 'Status unavailable'}</Badge>
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Supporting links</h3>
                <p className="mt-1 text-sm text-slate-500">Jump back into the evidence that informed this decision.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Link to={`/employee/review/${requestId}`} className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                <span className="text-sm font-semibold text-slate-700">Open candidate review</span>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to={`/employee/trust-card/${requestId}`} className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                <span className="text-sm font-semibold text-slate-700">Open trust-card details</span>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
