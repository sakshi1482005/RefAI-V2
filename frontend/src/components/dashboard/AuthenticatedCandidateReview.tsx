import { AlertTriangle, FileText, GraduationCap, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from './PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from './primitives'
import { useEmployeeRequestResource } from '../../hooks/useEmployeeRequestResource'
import { parseEmployeeRequestDetail } from '../../lib/employeeDetailContract'
import { employeeStatusLabel, getEmployeeWorkflowState } from '../../lib/employeeWorkflow'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import { api } from '../../lib/apiClient'
import type { EmployeeReviewCopilot } from '../../types'
import ProofVaultPanel from './ProofVaultPanel'

export default function AuthenticatedCandidateReview({ requestId }: { requestId: string }) {
  const navigate = useNavigate()
  const resource = useEmployeeRequestResource(`/referral/employee/requests/${requestId}`, parseEmployeeRequestDetail)
  const detail = resource.data
  const [copilot, setCopilot] = useState<EmployeeReviewCopilot | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const workflow = getEmployeeWorkflowState({ hasAssignedRequest: Boolean(detail), resumeExists: detail?.resumeExists, trustCardExists: detail?.trustCardExists, status: detail?.status })

  if (resource.loading) return <PageShell eyebrow="Candidate review" title="Loading assigned candidate" description="Verifying request access and loading the candidate summary."><div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></PageShell>
  if (resource.error || !detail) return <PageShell eyebrow="Candidate review" title="Candidate review unavailable" description="RefAI could not load this assigned referral request."><InlineFeedback tone="error">{friendlyErrorMessage(resource.error, 'This request was not found or is not assigned to your Employee account.')}</InlineFeedback><EmptyState className="mt-6" icon={ShieldCheck} title="Unable to open this assigned request" description="Return to your queue or retry the authorized request." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={resource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} /></PageShell>

  const candidate = detail.candidate
  const name = candidate.studentName || 'Student applicant'
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA'
  const analysis = detail.analysis
  const signals = [
    ['Overall Match', analysis?.overallMatch], ['Role Fit', analysis?.roleFit], ['Proof Score', analysis?.proofScore],
    ['Gap Score', analysis?.gapScore],
  ] as const
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

  return <PageShell eyebrow="Candidate review" title={`Review ${name}'s referral request`} description={`${detail.targetRole} at ${detail.targetCompany}. Review the available evidence before recording a decision.`} action={<div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Candidates</SecondaryButton><PrimaryButton onClick={() => navigate(`/employee/resume/${requestId}`)} disabled={!workflow.canOpenResume} disabledReason="No stored resume is linked to this student"><FileText className="mr-2 size-4" />Open Resume</PrimaryButton></div>}>
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{candidate.profilePhotoUrl ? <img src={candidate.profilePhotoUrl} alt="" className="size-14 rounded-full border-4 border-slate-200 object-cover" /> : <div className="flex size-14 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-100 text-sm font-semibold">{initials}</div>}<div><h2 className="text-xl font-semibold">{name}</h2><p className="mt-1 text-sm text-slate-500">{candidate.college || 'College not provided'}</p></div></div><Badge tone="info">{employeeStatusLabel[detail.status]}</Badge></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Degree</p><p className="mt-2 font-semibold">{candidate.degree || 'Not provided'}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Graduation year</p><p className="mt-2 font-semibold">{candidate.graduationYear || 'Not provided'}</p></div>{signals.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-semibold">{value === null || value === undefined ? 'Unavailable' : `${value}%`}</p></div>)}<div className="rounded-xl border border-slate-200 p-4 sm:col-span-2"><p className="text-sm text-slate-500">Analysis Reliability</p><p className="mt-2 font-semibold">{analysis?.analysisReliability?.label ?? 'Not recorded for this saved analysis'}</p>{analysis?.analysisReliability ? <><p className="mt-2 text-sm leading-6 text-slate-600">{analysis.analysisReliability.basis}</p><p className="mt-2 text-xs leading-5 text-slate-500">{analysis.analysisReliability.limitations}</p></> : null}</div></div>
      </Card>
      <div className="space-y-6">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Sparkles className="size-5" /><h3 className="text-lg font-semibold">Employee AI Review Copilot</h3></div><p className="mt-2 text-sm leading-6 text-slate-500">Advisory evidence summary only. Manual review is always required.</p></div><PrimaryButton onClick={summarizeCandidate} loading={copilotLoading}><Sparkles className="mr-2 size-4" />Summarize Candidate in 30 Seconds</PrimaryButton></div>
          {copilotError ? <div className="mt-4"><InlineFeedback tone="error">{copilotError}</InlineFeedback></div> : null}
          {copilot ? <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Suggested review priority</p><p className="mt-2 text-sm font-semibold">{copilot.suggestedReviewPriority}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Matched core requirements</p><p className="mt-2 text-sm font-semibold">{copilot.matchedCoreRequirementsCount}/{copilot.totalCoreRequirementsCount}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Grounding</p><p className="mt-2 text-sm font-semibold">{copilot.hasJobDescription ? 'Includes Job Description' : 'General role expectations'}</p></div></div>
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{copilot.narrative}</p>
            {([
              ['Why the candidate may fit', copilot.whyCandidateMayFit],
              ['Evidence-backed strengths', copilot.evidenceBackedStrengths],
              ['Concerns or missing evidence', copilot.concernsOrMissingEvidence],
              ['Points requiring verification', copilot.pointsRequiringManualVerification],
            ] as const).map(([title, items]) => <div key={title}><p className="text-sm font-semibold">{title}</p><div className="mt-2 space-y-2">{items.map((item, index) => <div key={`${title}-${index}`} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><p className="text-sm leading-6 text-slate-700">{item.text}</p><Badge tone={item.evidenceType === 'demonstrated_evidence' ? 'success' : item.evidenceType === 'missing_evidence' ? 'warning' : 'neutral'}>{item.evidenceType.replace(/_/g, ' ')}</Badge></div></div>)}</div></div>)}
            <div><p className="text-sm font-semibold">Useful questions to ask</p><ul className="mt-2 space-y-2">{copilot.usefulQuestions.map((question) => <li key={question} className="rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700">{question}</li>)}</ul></div>
            <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Grounding limitations</summary><div className="mt-3 space-y-2">{copilot.usedFallback ? <p className="text-xs text-amber-700">Deterministic fallback summary used.</p> : null}{copilot.limitations.map((item) => <p key={item} className="text-xs leading-5 text-slate-500">{item}</p>)}</div></details>
          </div> : <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">Generate a concise evidence summary when you are ready. The Copilot cannot make the referral decision.</p>}
        </Card>
        <Card className="p-6 sm:p-8"><h3 className="text-lg font-semibold">Student request note</h3><p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{detail.studentMessage}</p></Card>
        <ProofVaultPanel requestId={requestId} />
        {detail.compatibility ? <Card className="p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Referral Compatibility</h3><p className="mt-1 text-xs text-slate-500">Appropriateness snapshot calculated at submission.</p></div><div className="text-right"><p className="text-lg font-semibold">{detail.compatibility.score}/100</p><Badge tone={detail.compatibility.label === 'Strong fit' || detail.compatibility.label === 'Good fit' ? 'success' : 'warning'}>{detail.compatibility.label}</Badge></div></div><details className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">View recorded factors</summary><div className="mt-3 space-y-2">{detail.compatibility.positiveFactors.slice(0, 3).map((factor) => <p key={factor} className="text-xs leading-5 text-emerald-700">✓ {factor}</p>)}{detail.compatibility.missingOrConflictingFactors.slice(0, 3).map((factor) => <p key={factor} className="text-xs leading-5 text-amber-700">Caution: {factor}</p>)}{detail.compatibility.limitations.map((limitation) => <p key={limitation} className="text-[11px] leading-4 text-slate-500">{limitation}</p>)}</div></details></Card> : null}
        <Card className="p-6 sm:p-8"><h3 className="text-lg font-semibold">Continue the review</h3><div className="mt-5 grid gap-3"><SecondaryButton onClick={() => navigate(`/employee/resume/${requestId}`)} disabled={!workflow.canOpenResume} disabledReason="No real resume is available">Open Resume</SecondaryButton><SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId}`)} disabled={!workflow.canOpenTrustCard} disabledReason="No persisted Trust Card is available">Open Trust Card</SecondaryButton><PrimaryButton onClick={() => navigate(`/employee/decision/${requestId}`)} disabled={!workflow.canMakeDecision} disabledReason={detail.trustCardExists ? 'This request already has a recorded outcome' : 'A persisted Trust Card is required'}>{workflow.canMakeDecision ? 'Make referral decision' : 'Decision unavailable'}</PrimaryButton></div></Card>
      </div>
    </div>
    {analysis ? <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><Sparkles className="size-5" /><h3 className="text-lg font-semibold">Strengths and matched skills</h3></div><div className="mt-5 flex flex-wrap gap-2">{analysis.matchedSkills?.map((skill) => <Badge key={skill} tone="success">{skill}</Badge>)}</div><ul className="mt-5 space-y-3">{analysis.strengths?.map((item) => <li key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6">{item}</li>)}</ul></Card><Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><AlertTriangle className="size-5" /><h3 className="text-lg font-semibold">Evidence and gaps</h3></div><ul className="mt-5 space-y-3">{analysis.evidence?.map((item) => <li key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6">{item}</li>)}</ul>{analysis.missingRequirements?.length ? <div className="mt-5"><p className="text-sm font-semibold">Missing requirements</p><div className="mt-3 flex flex-wrap gap-2">{analysis.missingRequirements.map((item) => <Badge key={item.requirement} tone="warning">{item.requirement}</Badge>)}</div></div> : null}</Card><Card className="p-6 sm:p-8 xl:col-span-2"><div className="flex items-center gap-3"><GraduationCap className="size-5" /><h3 className="text-lg font-semibold">Readiness summary</h3></div><p className="mt-4 text-sm leading-7 text-slate-700">{analysis.readinessSummary || 'Readiness summary unavailable.'}</p></Card></div> : <EmptyState className="mt-6" icon={Sparkles} title="Analysis is not available" description="The request is valid, but no persisted analysis summary was found in its Trust Card." />}
  </PageShell>
}
