import { CheckCircle2, Clock3, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession, demoEmployeeReview, demoReferral } from '../lib/demoData'
import EmployeeReferralMessageGenerator from '../components/dashboard/EmployeeReferralMessageGenerator'

type DecisionRecord = {
  requestId: string
  candidateName: string
  decision: 'approved' | 'declined' | 'more_info_requested'
  note: string
  recordedAt: string
  persistence: 'backend' | 'demo'
}

function outcomeLabel(decision: DecisionRecord['decision']) {
  if (decision === 'approved') return 'Referral approved'
  if (decision === 'declined') return 'Referral declined'
  return 'More information requested'
}

export default function DecisionConfirmation() {
  const { requestId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision } = useDemoMode()
  let record = (location.state as DecisionRecord | null) ?? null

  if (isDemoMode && demoDecision !== 'pending') {
    record = { requestId: requestId ?? demoEmployeeReview.candidateId, candidateName: demoEmployeeReview.candidateName, decision: demoDecision, note: demoDecision === 'approved' ? demoReferral.note : demoDecision === 'more_info_requested' ? 'Please add stronger evidence for cloud deployment work before the referral is reconsidered.' : 'The referral was declined after reviewing the available evidence.', recordedAt: new Date().toISOString(), persistence: 'demo' }
  } else if (isDemoMode) {
    record = null
  }

  return (
    <PageShell
      eyebrow="Decision confirmation"
      title={record ? 'Referral decision recorded' : 'No decision found'}
      description={record ? 'The outcome and supporting note are saved below. Review them, then return to the dashboard or check the updated student referral timeline.' : 'There is no saved outcome for this candidate. Return to the decision panel to review the evidence and choose an outcome.'}
      action={<div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => navigate(`/employee/decision/${requestId ?? 'sg-001'}`)}>Back to Decision</SecondaryButton><PrimaryButton onClick={() => navigate('/employee/dashboard')}>Return to Dashboard</PrimaryButton></div>}
    >
      {record ? <div className="mx-auto max-w-3xl space-y-6">
        <InlineFeedback tone="info">{record.persistence === 'demo' ? 'Demo decision only. This outcome is isolated from authenticated users and was not submitted to a backend.' : 'This decision was saved to the assigned referral request.'}</InlineFeedback>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100"><CheckCircle2 className="size-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recorded outcome</p><h2 className="mt-2 text-2xl font-semibold">{outcomeLabel(record.decision)}</h2><p className="mt-2 text-sm text-slate-600">{record.candidateName}</p></div></div>
            <Badge tone={record.decision === 'approved' ? 'success' : record.decision === 'more_info_requested' ? 'warning' : 'neutral'}>{record.persistence === 'demo' ? `${outcomeLabel(record.decision)} · Demo` : outcomeLabel(record.decision)}</Badge>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4" />Recorded</div><p className="mt-2 text-sm text-slate-600">{new Date(record.recordedAt).toLocaleString()}</p></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" />Persistence</div><p className="mt-2 text-sm text-slate-600">{record.persistence === 'demo' ? 'Isolated demo session' : 'Saved to referral request'}</p></div></div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" />Decision note</div><p className="mt-3 text-sm leading-6 text-slate-600">{record.note || 'No note was added to this draft.'}</p></div>
        </Card>
        {record.decision === 'approved' ? <EmployeeReferralMessageGenerator candidateName={record.candidateName} role={isDemoMode ? demoEmployeeReview.role : ''} trustSummary={isDemoMode ? demoEmployeeReview.aiSummary : ''} recommendation={isDemoMode ? demoAnalysisSession.trustCard?.recommendation ?? 'Review before referring' : 'Review before referring'} isDemoMode={isDemoMode} enabled={isDemoMode} /> : null}
      </div> : <EmptyState icon={ShieldCheck} title="No decision confirmation is available" description="Open the decision panel, review the candidate evidence, and save an approval or decline draft first." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/decision/${requestId ?? 'sg-001'}`)}>Open Decision Panel</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Employee Dashboard</SecondaryButton></div>} />}
    </PageShell>
  )
}
