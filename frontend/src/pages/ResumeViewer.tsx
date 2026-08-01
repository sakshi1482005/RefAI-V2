import { ArrowRight, FileText, GraduationCap, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession, demoEmployeeReview } from '../lib/demoData'
import AuthenticatedResumeViewer from '../components/dashboard/AuthenticatedResumeViewer'

export default function ResumeViewer() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode) return requestId ? <AuthenticatedResumeViewer requestId={requestId} /> : null
  const trustCardHref = `/employee/trust-card/${requestId || demoEmployeeReview.candidateId}`
  const candidateName = demoEmployeeReview.candidateName

  return (
    <PageShell
      eyebrow="Resume viewer"
      title={`Verify the evidence in ${candidateName}'s resume`}
      description="This view highlights role-related experience and measurable outcomes. Confirm the claims here, then review how the Trust Card summarizes them."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate(`/employee/review/${requestId || demoEmployeeReview.candidateId}`)}>Back to Candidate</SecondaryButton>
          <SecondaryButton onClick={() => window.print()}>Print / save PDF</SecondaryButton>
          <PrimaryButton onClick={() => navigate(trustCardHref)}>
            Next: Review Trust Card
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Candidate resume</p>
                <h2 className="mt-2 text-2xl font-semibold">{candidateName}</h2>
              <p className="mt-2 text-sm text-slate-600">{demoAnalysisSession.upload?.fileName} · {demoAnalysisSession.upload?.chunkCount} analyzed sections</p>
              </div>
              <Badge tone="warning">
                <ShieldCheck className="mr-1.5 size-3.5" />
                Demo resume
              </Badge>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileText className="size-4" />
                Summary of experience
              </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm leading-7 text-slate-700">{demoEmployeeReview.resumeSummary}</p><p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Demo document preview</p></div>

            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Evidence relevant to the role</h3>
                <p className="mt-1 text-sm text-slate-500">Check whether each claim shows clear ownership, scope, or a measurable result.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
          {demoEmployeeReview.evidence.map((item) => <div key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{item}</div>)}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Evidence tags</h3>
                <p className="mt-1 text-sm text-slate-500">Structured skills and proof points from the resume will appear here.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">{demoEmployeeReview.skills.map((skill) => <Badge key={skill} tone="success">{skill} · Demo</Badge>)}</div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserCheck className="size-4 text-emerald-600" />
                Referral evidence
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Ananya’s 88% Resume Match is supported by 94% role fit and 82% repeated proof for Atlassian. Her demo Candidate Trust Score is 91 with strong resume evidence.</p>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
