import { CheckCircle2, Clock3, MessageSquareText, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession, demoEmployeeReview, demoReferral } from '../lib/demoData'
import EmployeeReferralMessageGenerator from '../components/dashboard/EmployeeReferralMessageGenerator'
import { useEmployeeRequestResource } from '../hooks/useEmployeeRequestResource'
import { parseEmployeeRequestDetail } from '../lib/employeeDetailContract'
import { friendlyErrorMessage } from '../lib/requestSafety'
import { Skeleton } from '../components/dashboard/primitives'
import { api } from '../lib/apiClient'
import type { EmployeeReferralRequestView } from '../types'

type DecisionRecord = {
  requestId: string
  candidateName: string
  decision: 'approved' | 'declined' | 'more_info_requested' | 'referred'
  note: string
  reason?: string | null
  message?: string | null
  recordedAt: string
  persistence: 'backend' | 'demo'
}

function outcomeLabel(decision: DecisionRecord['decision']) {
  if (decision === 'approved') return 'Approved for referral'
  if (decision === 'referred') return 'Referral submitted'
  if (decision === 'declined') return 'Referral declined'
  return 'More information requested'
}

export default function DecisionConfirmation() {
  const { requestId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision } = useDemoMode()
  const [submissionResult, setSubmissionResult] = useState<EmployeeReferralRequestView | null>(null)
  const [referralDate, setReferralDate] = useState(new Date().toISOString().slice(0, 10))
  const [confirmationNumber, setConfirmationNumber] = useState('')
  const [noteToStudent, setNoteToStudent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const immediateRecord = (location.state as DecisionRecord | null) ?? null
  const resource = useEmployeeRequestResource(
    !isDemoMode && requestId ? `/referral/employee/requests/${requestId}` : null,
    parseEmployeeRequestDetail,
  )
  let record = immediateRecord

  if (isDemoMode && demoDecision !== 'pending') {
    record = { requestId: requestId ?? demoEmployeeReview.candidateId, candidateName: demoEmployeeReview.candidateName, decision: demoDecision, note: demoDecision === 'approved' ? demoReferral.note : demoDecision === 'more_info_requested' ? 'Please add stronger evidence for cloud deployment work before the referral is reconsidered.' : 'The referral was declined after reviewing the available evidence.', recordedAt: new Date().toISOString(), persistence: 'demo' }
  } else if (isDemoMode) {
    record = null
  }
  const persisted = submissionResult ?? resource.data
  if (!isDemoMode && persisted && ['approved', 'declined', 'more_info_requested', 'referred'].includes(persisted.status)) {
    record = {
      requestId: persisted.id,
      candidateName: persisted.candidate.studentName || 'Student applicant',
      decision: persisted.status as DecisionRecord['decision'],
      note: persisted.employeeNote || '', reason: persisted.decisionReason,
      message: persisted.decisionMessage, recordedAt: persisted.referralSubmittedAt || persisted.decisionAt || persisted.updatedAt,
      persistence: 'backend',
    }
  }

  const markSubmitted = async () => {
    if (!requestId || submitting) return
    setSubmitting(true); setSubmissionError(null)
    try {
      const { data } = await api.patch<EmployeeReferralRequestView>(`/referral/employee/requests/${requestId}/referral-submission`, {
        referralDate: referralDate || null,
        confirmationNumber: confirmationNumber.trim() || null,
        noteToStudent: noteToStudent.trim() || null,
      })
      setSubmissionResult(data)
    } catch (error) {
      setSubmissionError(friendlyErrorMessage(error, 'The referral submission could not be recorded. Refresh and try again.'))
    } finally { setSubmitting(false) }
  }

  if (!isDemoMode && resource.loading && !record) {
    return <PageShell eyebrow="Decision confirmation" title="Loading saved decision" description="Verifying the assigned referral request and retrieving its persisted outcome."><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-80 rounded-2xl" /></div></PageShell>
  }

  if (!isDemoMode && resource.error && !record) {
    const status = (resource.error as { response?: { status?: number } })?.response?.status
    const notFound = status === 404
    return <PageShell eyebrow="Decision confirmation" title={notFound ? 'Referral request not found' : 'Decision could not be loaded'} description={notFound ? 'This referral request no longer exists.' : 'RefAI could not retrieve the persisted decision.'}><InlineFeedback tone="error">{friendlyErrorMessage(resource.error, notFound ? 'The referral request was not found.' : 'The saved decision could not be loaded. Please retry.')}</InlineFeedback><EmptyState className="mt-6" icon={ShieldCheck} title={notFound ? 'No referral request is available' : 'Unable to retrieve the decision'} description={notFound ? 'Return to the Employee dashboard to select an assigned request.' : 'Retry the authenticated request or return to your queue.'} action={<div className="flex flex-wrap justify-center gap-2">{!notFound ? <PrimaryButton onClick={resource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton> : null}<SecondaryButton onClick={() => navigate('/employee/dashboard')}>Employee Dashboard</SecondaryButton></div>} /></PageShell>
  }

  return (
    <PageShell
      eyebrow="Decision confirmation"
      title={record ? 'Referral decision recorded' : 'No decision found'}
      description={record ? 'The outcome and supporting note are saved below. Review them, then return to the dashboard or check the updated student referral timeline.' : 'There is no saved outcome for this candidate. Return to the decision panel to review the evidence and choose an outcome.'}
      action={<div className="flex flex-wrap gap-2">{requestId ? <SecondaryButton onClick={() => navigate(`/employee/decision/${requestId}`)}>Back to Decision</SecondaryButton> : null}<PrimaryButton onClick={() => navigate('/employee/dashboard')}>Return to Dashboard</PrimaryButton></div>}
    >
      {record ? <div className="mx-auto max-w-3xl space-y-6">
        <InlineFeedback tone="info">{record.persistence === 'demo' ? 'Demo decision only. This outcome is isolated from authenticated users and was not submitted to a backend.' : 'This decision was saved to the assigned referral request.'}</InlineFeedback>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100"><CheckCircle2 className="size-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recorded outcome</p><h2 className="mt-2 text-2xl font-semibold">{outcomeLabel(record.decision)}</h2><p className="mt-2 text-sm text-slate-600">{record.candidateName}</p></div></div>
            <Badge tone={record.decision === 'approved' ? 'success' : record.decision === 'more_info_requested' ? 'warning' : 'neutral'}>{record.persistence === 'demo' ? `${outcomeLabel(record.decision)} · Demo` : outcomeLabel(record.decision)}</Badge>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4" />Recorded</div><p className="mt-2 text-sm text-slate-600">{new Date(record.recordedAt).toLocaleString()}</p></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" />Persistence</div><p className="mt-2 text-sm text-slate-600">{record.persistence === 'demo' ? 'Isolated demo session' : 'Saved to referral request'}</p></div></div>
          {record.message ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" />Student-facing decision</div><p className="mt-3 text-sm leading-6 text-slate-600">{record.message}</p>{record.reason ? <p className="mt-2 text-xs text-slate-500">Structured reason: {record.reason.replace(/_/g, ' ')}</p> : null}</div> : null}
          <div className="mt-4 rounded-xl border border-slate-200 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" />Private employee note</div><p className="mt-3 text-sm leading-6 text-slate-600">{record.note || 'No private note was recorded.'}</p><p className="mt-2 text-xs text-slate-500">This note is never shown to the student.</p></div>
          {record.decision === 'declined' ? <div className="mt-4"><InlineFeedback tone="info">This decline does not reduce the Candidate Trust Score.</InlineFeedback></div> : null}
        </Card>
        {!isDemoMode && record.decision === 'approved' ? <Card className="p-6 sm:p-8"><h3 className="text-lg font-semibold">Mark Referral as Submitted</h3><p className="mt-1 text-sm text-slate-500">Approval records your decision. Use this only after the referral has actually been submitted externally.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Referral date (optional)<input type="date" max={new Date().toISOString().slice(0, 10)} value={referralDate} onChange={(event) => setReferralDate(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" /></label><label className="text-sm font-medium">Confirmation number (optional)<input value={confirmationNumber} onChange={(event) => setConfirmationNumber(event.target.value)} maxLength={100} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="REF-123" /></label></div><label className="mt-4 block text-sm font-medium">Note to student (optional)<textarea value={noteToStudent} onChange={(event) => setNoteToStudent(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Share respectful next-step guidance." /></label>{submissionError ? <div className="mt-4"><InlineFeedback tone="error">{submissionError}</InlineFeedback></div> : null}<PrimaryButton className="mt-5" onClick={markSubmitted} loading={submitting}><CheckCircle2 className="mr-2 size-4" />Mark Referral as Submitted</PrimaryButton></Card> : null}
        {!isDemoMode && record.decision === 'referred' && persisted ? <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-600" /><h3 className="text-lg font-semibold">Referral submitted</h3></div><p className="mt-3 text-sm text-slate-600">Recorded {persisted.referralDate ? new Date(`${persisted.referralDate}T00:00:00`).toLocaleDateString() : new Date(persisted.referralSubmittedAt || persisted.updatedAt).toLocaleDateString()}.</p>{persisted.referralConfirmationNumber ? <p className="mt-2 text-sm text-slate-600">Confirmation: {persisted.referralConfirmationNumber}</p> : null}{persisted.referralNoteToStudent ? <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{persisted.referralNoteToStudent}</p> : null}</Card> : null}
        {record.decision === 'approved' ? <EmployeeReferralMessageGenerator candidateName={record.candidateName} role={isDemoMode ? demoEmployeeReview.role : ''} trustSummary={isDemoMode ? demoEmployeeReview.aiSummary : ''} recommendation={isDemoMode ? demoAnalysisSession.trustCard?.recommendation ?? 'Review before referring' : 'Review before referring'} isDemoMode={isDemoMode} enabled={isDemoMode} /> : null}
      </div> : <EmptyState icon={ShieldCheck} title="No completed decision is available" description="This referral request does not have a persisted approval, decline, or information request." action={<div className="flex flex-wrap justify-center gap-2">{requestId ? <PrimaryButton onClick={() => navigate(`/employee/decision/${requestId}`)}>Open Decision Panel</PrimaryButton> : null}<SecondaryButton onClick={() => navigate('/employee/dashboard')}>Employee Dashboard</SecondaryButton></div>} />}
    </PageShell>
  )
}
