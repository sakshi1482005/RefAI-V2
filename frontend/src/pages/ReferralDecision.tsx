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
type DecisionReason = 'suitable_profile' | 'strong_evidence' | 'relevant_role_alignment' | 'will_refer_externally' | 'additional_details_required_first' | 'role_mismatch' | 'insufficient_evidence' | 'not_accepting_referrals' | 'job_closed' | 'unable_to_verify_experience' | 'other' | 'clarification_required'
const reasonOptions: Record<RecordedDecision, { value: DecisionReason; label: string }[]> = {
  approved: [['suitable_profile', 'Suitable profile'], ['strong_evidence', 'Strong evidence'], ['relevant_role_alignment', 'Relevant role alignment'], ['will_refer_externally', 'Will refer externally'], ['additional_details_required_first', 'Additional details required first']].map(([value, label]) => ({ value: value as DecisionReason, label })),
  declined: [['role_mismatch', 'Role mismatch'], ['insufficient_evidence', 'Insufficient evidence'], ['not_accepting_referrals', 'Not accepting referrals'], ['job_closed', 'Job closed'], ['unable_to_verify_experience', 'Unable to verify experience'], ['other', 'Other']].map(([value, label]) => ({ value: value as DecisionReason, label })),
  more_info_requested: [{ value: 'clarification_required', label: 'Additional evidence or clarification required' }],
}

function decisionLabel(decision: DemoDecision) {
  if (decision === 'approved') return 'Approved'
  if (decision === 'declined') return 'Declined'
  if (decision === 'more_info_requested') return 'More information requested'
  return 'Decision pending'
}

function AuthenticatedReferralDecision({ requestId }: { requestId: string }) {
  const navigate = useNavigate()
  const [decisionType, setDecisionType] = useState<RecordedDecision>('approved')
  const [reason, setReason] = useState<DecisionReason>('suitable_profile')
  const [privateNote, setPrivateNote] = useState('')
  const [question, setQuestion] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const detailResource = useEmployeeRequestResource(`/referral/employee/requests/${requestId}`, parseEmployeeRequestDetail)
  const cardResource = useEmployeeRequestResource(detailResource.data?.trustCardExists ? `/referral/employee/requests/${requestId}/trust-card` : null, parseEmployeeTrustCard)
  const detail = detailResource.data
  const card = cardResource.data
  const workflow = getEmployeeWorkflowState({ hasAssignedRequest: Boolean(detail), resumeExists: detail?.resumeExists, trustCardExists: Boolean(card), status: detail?.status })

  const changeDecisionType = (decision: RecordedDecision) => {
    setDecisionType(decision); setReason(reasonOptions[decision][0].value); setSaveError(null)
  }
  const draftClarification = async () => {
    setDrafting(true); setSaveError(null)
    try { const { data } = await api.post<{ question: string }>(`/referral/employee/requests/${requestId}/clarification-draft`); setQuestion(data.question) }
    catch (error) { setSaveError(friendlyErrorMessage(error, 'A clarification question could not be drafted. Write one manually instead.')) }
    finally { setDrafting(false) }
  }
  const recordDecision = async () => {
    if (!detail || !card || !workflow.canMakeDecision || saving) return
    if (decisionType === 'more_info_requested' && !question.trim()) { setSaveError('Write or draft a clarification question before continuing.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const { data } = await api.patch<ReferralRequestDetail>(`/referral/requests/${requestId}/decision`, { status: decisionType, reason, question: decisionType === 'more_info_requested' ? question.trim() : null, note: privateNote.trim() || null })
      navigate(`/employee/decision/${requestId}/confirmation`, { state: { requestId, candidateName: detail.candidate.studentName || 'Student applicant', decision: decisionType, reason: data.decisionReason, message: data.decisionMessage, note: data.employeeNote || '', recordedAt: data.decisionAt || data.updatedAt, persistence: 'backend' } })
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
  return <PageShell eyebrow="Referral decision" title={`Decide whether to refer ${candidateName}`} description="Use the persisted candidate evidence and Trust Card, select a transparent reason, then record the outcome." action={<div className="flex flex-wrap gap-3"><SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId}`)}>Back to Trust Card</SecondaryButton><PrimaryButton onClick={recordDecision} loading={saving} disabled={!workflow.canMakeDecision} disabledReason={unavailableReason || undefined}><Check className="mr-2 size-4" />Record decision</PrimaryButton></div>}>
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck className="size-5" /></div><div><h2 className="text-xl font-semibold">Evidence to decide from</h2><p className="mt-1 text-sm text-slate-500">Persisted data for {detail.targetRole} at {detail.targetCompany}</p></div></div>{card ? <div className="mt-6 space-y-3"><Badge tone={workflow.canMakeDecision ? 'warning' : 'info'}>{workflow.canMakeDecision ? 'Ready for decision' : employeeStatusLabel[detail.status]}</Badge><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Trust Score</p><p className="mt-2 text-xl font-semibold">{card.trustScore ?? 'Unavailable'}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Overall Match</p><p className="mt-2 text-xl font-semibold">{card.overallMatch === null ? 'Unavailable' : `${card.overallMatch}%`}</p></div></div><p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{card.summary || detail.analysis?.readinessSummary || 'No summary is available; inspect the linked evidence before deciding.'}</p></div> : <EmptyState className="mt-6" icon={ShieldCheck} title="Trust Card required" description="Decision controls remain disabled because this request has no readable persisted Trust Card." action={<PrimaryButton onClick={cardResource.retry}>Retry Trust Card</PrimaryButton>} />}</Card>
      <Card className="p-6 sm:p-8"><div id="decision-panel" className="scroll-mt-28" /><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquareText className="size-5" /></div><div><h3 className="text-lg font-semibold">Structured decision</h3><p className="mt-1 text-sm text-slate-500">The student receives respectful standardized wording. Private notes remain employee-only.</p></div></div>
        <label className="mt-5 block text-sm font-medium">Decision type<select value={decisionType} onChange={(event) => changeDecisionType(event.target.value as RecordedDecision)} disabled={!workflow.canMakeDecision || saving} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="approved">Approve</option><option value="declined">Decline</option><option value="more_info_requested">Request more information</option></select></label>
        <label className="mt-4 block text-sm font-medium">Structured reason<select value={reason} onChange={(event) => setReason(event.target.value as DecisionReason)} disabled={!workflow.canMakeDecision || saving} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">{reasonOptions[decisionType].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {decisionType === 'more_info_requested' ? <div className="mt-4"><div className="flex items-center justify-between gap-3"><label htmlFor="clarification-question" className="text-sm font-medium">Clarification question</label><SecondaryButton onClick={draftClarification} loading={drafting}>Draft with AI</SecondaryButton></div><textarea id="clarification-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm leading-6" placeholder="What additional evidence would help you review this request?" /><p className="mt-1 text-xs text-slate-500">AI drafting uses only saved missing-evidence labels. Review and edit before sending.</p></div> : null}
        <label htmlFor="decision-note" className="mt-4 block text-sm font-medium">Private employee note (optional)</label><textarea id="decision-note" value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} maxLength={2000} disabled={!workflow.canMakeDecision || saving} className="mt-1 min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 disabled:bg-slate-50" placeholder="Internal note — never shown to the student" /><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>Decisions never modify the Candidate Trust Score.</span><span>{privateNote.length}/2000</span></div>
        {decisionType === 'declined' ? <div className="mt-4"><InlineFeedback tone="info">A decline does not reduce the Candidate Trust Score.</InlineFeedback></div> : null}{saveError ? <div className="mt-4"><InlineFeedback tone="error">{saveError}</InlineFeedback></div> : null}{unavailableReason ? <div className="mt-4"><InlineFeedback tone="info">{unavailableReason}</InlineFeedback></div> : null}</Card>
    </div>
  </PageShell>
}

export default function ReferralDecision() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision, setDemoDecision } = useDemoMode()
  const candidateName = demoEmployeeReview.candidateName
  const [note, setNote] = useState(demoReferral.note)
  if (!isDemoMode) return requestId ? <AuthenticatedReferralDecision requestId={requestId} /> : null
  const recordDecision = (decision: RecordedDecision) => {
    const decisionRecord = { requestId: requestId || demoEmployeeReview.candidateId, candidateName, decision, note: note.trim(), recordedAt: new Date().toISOString(), persistence: 'demo' as const }
    setDemoDecision(decision)
    navigate(`/employee/decision/${decisionRecord.requestId}/confirmation`, { state: decisionRecord })
  }

  return (
    <PageShell
      eyebrow="Referral decision"
      title={`Decide whether to refer ${candidateName}`}
      description="You are at the final review step. Use the resume and Trust Card evidence, add a concise reason, then approve, decline, or request more information."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId || demoEmployeeReview.candidateId}`)}>Back to Trust Card</SecondaryButton>
          <SecondaryButton onClick={() => recordDecision('declined')}>
            <X className="mr-2 size-4" />
            Decline referral
          </SecondaryButton>
          <SecondaryButton onClick={() => recordDecision('more_info_requested')}>
            <MessageSquareText className="mr-2 size-4" />
            Request more information
          </SecondaryButton>
          <PrimaryButton onClick={() => recordDecision('approved')}>
            <Check className="mr-2 size-4" />
            Approve referral
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
              <p className="mt-1 text-sm text-slate-500">{demoDecision === 'pending' ? 'Review the supporting claims before choosing an outcome · Demo data only' : 'This employee decision has been recorded · Demo data only'}</p>
            </div>
          </div>

            <div className="mt-6 space-y-3"><Badge tone={demoDecision === 'pending' ? 'warning' : demoDecision === 'approved' ? 'success' : 'neutral'}>{decisionLabel(demoDecision)}{demoDecision !== 'pending' ? ' · Demo' : ''}</Badge><p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{demoDecision === 'pending' ? 'Ananya’s 91 Candidate Trust Score and strong resume evidence are supported by measurable React delivery, FastAPI ownership, and SQL evidence. Meera should verify that evidence before deciding on the Atlassian referral.' : demoDecision === 'approved' ? 'Meera approved Ananya’s Atlassian referral after reviewing the 91 Candidate Trust Score, strong resume evidence, and supporting project evidence.' : demoDecision === 'more_info_requested' ? 'Meera requested more information so Ananya can add stronger evidence for the remaining cloud deployment gap before a final decision.' : 'Meera declined Ananya’s Atlassian referral after reviewing the available resume evidence and Trust Card.'}</p></div>

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
            <textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="mt-6 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" placeholder="Add a decision note…" />

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Use concise, evidence-based language.</span>
              <span className="shrink-0">{note.length}/500</span>
            </div>

            <div className="mt-4"><InlineFeedback tone="info">This decision stays inside the isolated demo session and updates both employee and student views.</InlineFeedback></div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Badge tone={demoDecision === 'pending' ? 'warning' : 'success'}>{demoDecision === 'pending' ? 'Ready for decision' : 'Demo decision recorded'}</Badge>
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
