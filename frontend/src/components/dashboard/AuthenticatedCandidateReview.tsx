import { AlertTriangle, FileText, GraduationCap, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageShell from './PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from './primitives'
import { useEmployeeRequestResource } from '../../hooks/useEmployeeRequestResource'
import { parseEmployeeRequestDetail } from '../../lib/employeeDetailContract'
import { employeeStatusLabel, getEmployeeWorkflowState } from '../../lib/employeeWorkflow'
import { friendlyErrorMessage } from '../../lib/requestSafety'

export default function AuthenticatedCandidateReview({ requestId }: { requestId: string }) {
  const navigate = useNavigate()
  const resource = useEmployeeRequestResource(`/referral/employee/requests/${requestId}`, parseEmployeeRequestDetail)
  const detail = resource.data
  const workflow = getEmployeeWorkflowState({ hasAssignedRequest: Boolean(detail), resumeExists: detail?.resumeExists, trustCardExists: detail?.trustCardExists, status: detail?.status })

  if (resource.loading) return <PageShell eyebrow="Candidate review" title="Loading assigned candidate" description="Verifying request access and loading the candidate summary."><div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div></PageShell>
  if (resource.error || !detail) return <PageShell eyebrow="Candidate review" title="Candidate review unavailable" description="RefAI could not load this assigned referral request."><InlineFeedback tone="error">{friendlyErrorMessage(resource.error, 'This request was not found or is not assigned to your Employee account.')}</InlineFeedback><EmptyState className="mt-6" icon={ShieldCheck} title="Unable to open this assigned request" description="Return to your queue or retry the authorized request." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={resource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} /></PageShell>

  const candidate = detail.candidate
  const name = candidate.studentName || 'Student applicant'
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA'
  const analysis = detail.analysis
  const signals = [
    ['Overall Match', analysis?.overallMatch], ['Role Fit', analysis?.roleFit], ['Proof Score', analysis?.proofScore],
    ['Gap Score', analysis?.gapScore], ['Confidence', analysis?.confidence],
  ] as const

  return <PageShell eyebrow="Candidate review" title={`Review ${name}'s referral request`} description={`${detail.targetRole} at ${detail.targetCompany}. Review the available evidence before recording a decision.`} action={<div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Candidates</SecondaryButton><PrimaryButton onClick={() => navigate(`/employee/resume/${requestId}`)} disabled={!workflow.canOpenResume} disabledReason="No stored resume is linked to this student"><FileText className="mr-2 size-4" />Open Resume</PrimaryButton></div>}>
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{candidate.profilePhotoUrl ? <img src={candidate.profilePhotoUrl} alt="" className="size-14 rounded-full border-4 border-slate-200 object-cover" /> : <div className="flex size-14 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-100 text-sm font-semibold">{initials}</div>}<div><h2 className="text-xl font-semibold">{name}</h2><p className="mt-1 text-sm text-slate-500">{candidate.college || 'College not provided'}</p></div></div><Badge tone="info">{employeeStatusLabel[detail.status]}</Badge></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Degree</p><p className="mt-2 font-semibold">{candidate.degree || 'Not provided'}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">Graduation year</p><p className="mt-2 font-semibold">{candidate.graduationYear || 'Not provided'}</p></div>{signals.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-semibold">{value === null || value === undefined ? 'Unavailable' : `${value}%`}</p></div>)}</div>
      </Card>
      <div className="space-y-6">
        <Card className="p-6 sm:p-8"><h3 className="text-lg font-semibold">Student request note</h3><p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{detail.studentMessage}</p></Card>
        <Card className="p-6 sm:p-8"><h3 className="text-lg font-semibold">Continue the review</h3><div className="mt-5 grid gap-3"><SecondaryButton onClick={() => navigate(`/employee/resume/${requestId}`)} disabled={!workflow.canOpenResume} disabledReason="No real resume is available">Open Resume</SecondaryButton><SecondaryButton onClick={() => navigate(`/employee/trust-card/${requestId}`)} disabled={!workflow.canOpenTrustCard} disabledReason="No persisted Trust Card is available">Open Trust Card</SecondaryButton><PrimaryButton onClick={() => navigate(`/employee/decision/${requestId}`)} disabled={!workflow.canMakeDecision} disabledReason={detail.trustCardExists ? 'This request already has a recorded outcome' : 'A persisted Trust Card is required'}>{workflow.canMakeDecision ? 'Make referral decision' : 'Decision unavailable'}</PrimaryButton></div></Card>
      </div>
    </div>
    {analysis ? <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><Sparkles className="size-5" /><h3 className="text-lg font-semibold">Strengths and matched skills</h3></div><div className="mt-5 flex flex-wrap gap-2">{analysis.matchedSkills?.map((skill) => <Badge key={skill} tone="success">{skill}</Badge>)}</div><ul className="mt-5 space-y-3">{analysis.strengths?.map((item) => <li key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6">{item}</li>)}</ul></Card><Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><AlertTriangle className="size-5" /><h3 className="text-lg font-semibold">Evidence and gaps</h3></div><ul className="mt-5 space-y-3">{analysis.evidence?.map((item) => <li key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6">{item}</li>)}</ul>{analysis.missingRequirements?.length ? <div className="mt-5"><p className="text-sm font-semibold">Missing requirements</p><div className="mt-3 flex flex-wrap gap-2">{analysis.missingRequirements.map((item) => <Badge key={item.requirement} tone="warning">{item.requirement}</Badge>)}</div></div> : null}</Card><Card className="p-6 sm:p-8 xl:col-span-2"><div className="flex items-center gap-3"><GraduationCap className="size-5" /><h3 className="text-lg font-semibold">Readiness summary</h3></div><p className="mt-4 text-sm leading-7 text-slate-700">{analysis.readinessSummary || 'Readiness summary unavailable.'}</p></Card></div> : <EmptyState className="mt-6" icon={Sparkles} title="Analysis is not available" description="The request is valid, but no persisted analysis summary was found in its Trust Card." />}
  </PageShell>
}
