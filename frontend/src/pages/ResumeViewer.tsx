import { ArrowRight, FileText, GraduationCap, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession, demoEmployeeReview } from '../lib/demoData'
import AuthenticatedResumeViewer from '../components/dashboard/AuthenticatedResumeViewer'

export default function ResumeViewer() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode && requestId) return <AuthenticatedResumeViewer requestId={requestId} />
  const trustCardHref = `/employee/trust-card/${requestId ?? 'sg-001'}`
  const candidateName = isDemoMode ? demoEmployeeReview.candidateName : requestId ? `Candidate ${requestId}` : 'Candidate'

  return (
    <PageShell
      eyebrow="Resume viewer"
      title={`Verify the evidence in ${candidateName}'s resume`}
      description="This view highlights role-related experience and measurable outcomes. Confirm the claims here, then review how the Trust Card summarizes them."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Back to Candidate</SecondaryButton>
          <SecondaryButton onClick={() => window.print()}>Print / save PDF</SecondaryButton>
          <PrimaryButton onClick={() => navigate(trustCardHref)} disabled={!isDemoMode} disabledReason="A candidate resume is required before reviewing a Trust Card">
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
                <p className="mt-2 text-sm text-slate-600">{isDemoMode ? `${demoAnalysisSession.upload?.fileName} · ${demoAnalysisSession.upload?.chunkCount} analyzed sections` : 'Resume metadata is not available from the current backend.'}</p>
              </div>
              <Badge tone={isDemoMode ? 'warning' : 'neutral'}>
                <ShieldCheck className="mr-1.5 size-3.5" />
                {isDemoMode ? 'Demo resume' : 'Data unavailable'}
              </Badge>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileText className="size-4" />
                Summary of experience
              </div>
              {/* TODO: Populate when a candidate resume retrieval API is available. */}
              {isDemoMode ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm leading-7 text-slate-700">{demoEmployeeReview.resumeSummary}</p><p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Demo document preview</p></div> : <EmptyState className="mt-5" title="Resume preview is not available" description="The candidate’s uploaded resume, supported document preview, and extracted experience will appear when retrieval data is available." icon={FileText} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Return to Review</PrimaryButton><SecondaryButton onClick={() => navigate(trustCardHref)}>Open Trust Card</SecondaryButton></div>} />}

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
              {isDemoMode ? demoEmployeeReview.evidence.map((item) => <div key={item} className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{item}</div>) : <EmptyState title="No resume signals yet" description="Role-specific projects, outcomes, and experience signals will appear after the candidate resume is retrieved and analyzed." icon={Sparkles} action={<PrimaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Review Candidate</PrimaryButton>} />}
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

            {isDemoMode ? <div className="mt-6 flex flex-wrap gap-2">{demoEmployeeReview.skills.map((skill) => <Badge key={skill} tone="success">{skill} · Demo</Badge>)}</div> : <EmptyState className="mt-6" title="Evidence tags are pending" description="Verified skills and proof tags will appear when structured resume evidence is returned for this candidate." icon={GraduationCap} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(trustCardHref)}>View Trust Card</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} />}

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserCheck className="size-4 text-emerald-600" />
                Referral confidence
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{isDemoMode ? 'Ananya’s 88% Resume Match is supported by 94% role fit and 82% repeated proof for Atlassian. Her demo Trust Score is 91 and ATS Score is 93.' : 'Referral confidence is not available.'}</p>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
