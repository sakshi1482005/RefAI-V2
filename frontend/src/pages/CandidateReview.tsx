import { FileText, Sparkles } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession, demoClaimVerification, demoEmployeeReview } from '../lib/demoData'
import AuthenticatedCandidateReview from '../components/dashboard/AuthenticatedCandidateReview'
import CandidateReviewSnapshot from '../components/dashboard/CandidateReviewSnapshot'

export default function CandidateReview() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision } = useDemoMode()
  if (!isDemoMode) return requestId ? <AuthenticatedCandidateReview requestId={requestId} /> : null

  const reviewId = requestId || demoEmployeeReview.candidateId
  const trustCard = demoAnalysisSession.trustCard
  const claimWarnings = demoClaimVerification.claims
    .filter((item) => ['Partially supported', 'Self-declared', 'Needs clarification'].includes(item.status))
    .map((item) => `${item.claim} — ${item.reason}`)
  const decisionRecorded = demoDecision !== 'pending'
  const statusLabel = demoDecision === 'pending' ? demoEmployeeReview.status : demoDecision === 'approved' ? 'Approved for referral' : demoDecision === 'more_info_requested' ? 'More information requested' : 'Declined'

  return <PageShell compact eyebrow="30-second candidate review" title="Evidence-based referral review" description="Start with the evidence summary. The raw resume remains available for source-level verification." action={<SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Candidates</SecondaryButton>}>
    <CandidateReviewSnapshot
      candidateName={demoEmployeeReview.candidateName}
      initials={demoEmployeeReview.initials}
      targetRole={demoEmployeeReview.role}
      targetCompany={demoEmployeeReview.company}
      statusLabel={statusLabel}
      trustScore={trustCard?.trustScore}
      reliabilityLabel={trustCard?.analysisReliability?.label}
      compatibilityScore={demoEmployeeReview.compatibilityScore}
      compatibilityLabel={demoEmployeeReview.compatibilityLabel}
      strengths={demoEmployeeReview.resumeHighlights}
      concerns={demoEmployeeReview.concerns}
      claimWarnings={claimWarnings}
      evidenceHref={`/employee/trust-card/${reviewId}`}
      demo
    />

    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-5">
        <Card className="border-blue-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2"><Sparkles className="size-5 text-blue-700" aria-hidden="true" /><h2 className="text-lg font-semibold">Employee Review Copilot</h2><Badge tone="info">Advisory AI · Demo</Badge></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Evidence summary only. The employee makes every referral decision.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Suggested review priority</p><p className="mt-2 text-sm font-semibold">Verify core evidence first</p><p className="mt-3 text-xs text-slate-500">Matched core requirements: 5/7</p></div><p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{demoEmployeeReview.aiSummary}</p></div>
          <details className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-black">Useful manual-verification questions</summary><div className="mt-3 space-y-2"><p className="text-sm text-slate-700">• How was the 240-student usage measured, and what did you personally implement?</p><p className="text-sm text-slate-700">• Which system-design and deployment trade-offs did you make?</p></div></details>
        </Card>

        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-black">Student request note and additional evidence</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{demoEmployeeReview.reviewNote}</p><div className="rounded-xl border border-slate-200 p-4">{demoEmployeeReview.verifiedEvidence.map((item) => <p key={item.claim} className="mb-2 text-xs leading-5 text-slate-600"><span className="font-semibold">{item.claim}:</span> {item.evidence}</p>)}</div></div></details>
      </div>

      <aside className="self-start xl:sticky xl:top-24">
        <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Employee decision</p><h2 className="mt-2 text-lg font-semibold">Record your decision</h2><p className="mt-2 text-xs leading-5 text-slate-600">Copilot output is advisory and never submits a decision.</p>
          <div className="mt-4 grid gap-2"><PrimaryButton onClick={() => navigate(`/employee/decision/${reviewId}`)} disabled={decisionRecorded}>Approve for referral</PrimaryButton><SecondaryButton onClick={() => navigate(`/employee/decision/${reviewId}`)} disabled={decisionRecorded}>Request more information</SecondaryButton><SecondaryButton onClick={() => navigate(`/employee/decision/${reviewId}`)} disabled={decisionRecorded}>Decline request</SecondaryButton></div>
          <div className="mt-4 border-t border-slate-200 pt-4"><SecondaryButton className="w-full" onClick={() => navigate(`/employee/resume/${reviewId}`)}><FileText className="mr-2 size-4" />Open raw resume</SecondaryButton><SecondaryButton className="mt-2 w-full" onClick={() => navigate(`/employee/trust-card/${reviewId}`)}>Open full Trust Card</SecondaryButton>{decisionRecorded ? <PrimaryButton className="mt-2 w-full" onClick={() => navigate(`/employee/decision/${reviewId}/confirmation`)}>View decision confirmation</PrimaryButton> : null}</div>
        </Card>
      </aside>
    </div>
  </PageShell>
}
