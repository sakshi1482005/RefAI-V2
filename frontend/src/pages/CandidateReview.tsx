import { AlertTriangle, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, FileCheck2, FileText, GraduationCap, MessageSquareText, ShieldCheck, Sparkles, UserCheck, XCircle } from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Avatar, Badge, Card, EmptyState, PrimaryButton, ScoreExplanation, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { DEMO_ATS_SCORE, demoAnalysisSession, demoEmployeeReview } from '../lib/demoData'
import { buildScoreReasons, matchScoreFromTrustCard } from '../lib/aiInsights'
import AuthenticatedCandidateReview from '../components/dashboard/AuthenticatedCandidateReview'

// TODO: Populate when a candidate-detail API is available.
const reviewSignals: Array<{ label: string; value: string }> = []

export default function CandidateReview() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision } = useDemoMode()
  if (!isDemoMode && requestId) return <AuthenticatedCandidateReview requestId={requestId} />
  const candidateName = isDemoMode ? demoEmployeeReview.candidateName : requestId ? `Candidate ${requestId}` : 'Candidate'
  const signals = isDemoMode ? [
    { label: 'Target role', value: demoEmployeeReview.role },
    { label: 'Company', value: demoEmployeeReview.company },
    { label: 'Resume match', value: `${demoEmployeeReview.match}%` },
    { label: 'Trust Score', value: String(demoAnalysisSession.trustCard?.trustScore ?? '—') },
    { label: 'ATS Score', value: String(DEMO_ATS_SCORE) },
    { label: 'AI recommendation', value: demoAnalysisSession.trustCard?.recommendation ?? 'Not ready yet' },
    { label: 'Review status', value: demoDecision === 'pending' ? demoEmployeeReview.status : demoDecision === 'approved' ? 'Approved' : demoDecision === 'more_info_requested' ? 'More information requested' : 'Declined' },
  ] : reviewSignals
  const scoreReasons = isDemoMode && demoAnalysisSession.trustCard ? buildScoreReasons(matchScoreFromTrustCard(demoAnalysisSession.trustCard), true) : []

  return (
    <PageShell
      eyebrow="Candidate review"
      title={`Start ${candidateName}'s referral review`}
      description="Confirm the target role, match status, and available context here. Next, inspect the resume evidence before opening the Trust Card."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Candidates</SecondaryButton>
          <PrimaryButton onClick={() => navigate(`/employee/resume/${requestId ?? 'sg-001'}`)} disabled={!isDemoMode} disabledReason="Candidate resume data is not available"><FileText className="mr-2 size-4" />Next: Open Resume</PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar initials={isDemoMode ? demoEmployeeReview.initials : '—'} size="lg" className="border-4 border-slate-200 bg-slate-100 text-slate-800" />
              <div>
                <h2 className="text-xl font-semibold">{candidateName}</h2>
                <p className="mt-1 text-sm text-slate-500">{isDemoMode ? `${demoEmployeeReview.role} · ${demoEmployeeReview.company}` : 'Candidate details are not available from the current API.'}</p>
              </div>
            </div>
            <Badge tone={isDemoMode ? 'warning' : 'neutral'}>
              <ShieldCheck className="mr-1.5 size-3.5" />
              {isDemoMode ? 'Demo candidate' : 'Data unavailable'}
            </Badge>
          </div>

          {!isDemoMode ? <EmptyState className="mt-6" title="Candidate evidence is not available yet" description="Resume signals, role fit, and verification details will appear when the candidate-detail service returns this profile." icon={ShieldCheck} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate('/employee/dashboard')}>Back to Review Queue</PrimaryButton><SecondaryButton onClick={() => navigate(`/employee/resume/${requestId ?? 'sg-001'}`)}>Open Resume Viewer</SecondaryButton></div>} /> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {signals.map((signal) => (
              <div key={signal.label} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">{signal.label}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{signal.value}</p>
              </div>
            ))}
          </div>
          {scoreReasons.length > 0 ? <ScoreExplanation className="mt-6" title="Why this resume match?" points={scoreReasons} /> : null}
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <MessageSquareText className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">What to verify</h3>
                <p className="mt-1 text-sm text-slate-500">Use this note to focus the resume and Trust Card review.</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {isDemoMode ? demoEmployeeReview.reviewNote : 'No review note is available because the backend does not expose candidate review data.'}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Badge tone="warning">
                <Clock3 className="mr-1.5 size-3.5" />
                {isDemoMode ? demoDecision === 'pending' ? 'Awaiting employee review' : `${demoDecision === 'approved' ? 'Approved' : demoDecision === 'more_info_requested' ? 'More information requested' : 'Declined'} · Demo` : 'Status unavailable'}
              </Badge>
              <Badge>
                <UserCheck className="mr-1.5 size-3.5" />
                {isDemoMode ? 'Resume evidence reviewed' : 'Verification unavailable'}
              </Badge>
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FileText className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Continue the review</h3>
                <p className="mt-1 text-sm text-slate-500">Inspect the supporting evidence before recording a decision.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Link to={`/employee/resume/${requestId}`} className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                <span className="text-sm font-semibold text-slate-700">Open resume viewer</span>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to={`/employee/trust-card/${requestId}`} className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                <span className="text-sm font-semibold text-slate-700">Open trust-card details</span>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to={`/employee/decision/${requestId}`} className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
                <span className="text-sm font-semibold text-slate-700">Make referral decision</span>
                <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {isDemoMode ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FileCheck2 className="size-5" /></div>
              <div><h3 className="text-lg font-semibold">Resume highlights</h3><p className="mt-1 text-sm text-slate-500">The strongest claims to verify before making a referral decision.</p></div>
            </div>
            <ul className="mt-6 space-y-3">
              {demoEmployeeReview.resumeHighlights.map((highlight) => <li key={highlight} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>{highlight}</span></li>)}
            </ul>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck className="size-5" /></div>
              <div><h3 className="text-lg font-semibold">Verified evidence</h3><p className="mt-1 text-sm text-slate-500">Resume claims linked to the sections that support them.</p></div>
            </div>
            <div className="mt-6 space-y-3">
              {demoEmployeeReview.verifiedEvidence.map((item) => <div key={item.claim} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{item.claim}</p><Badge tone="success">Verified · Demo</Badge></div><p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{item.source}</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.evidence}</p></div>)}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><BriefcaseBusiness className="size-5" /></div>
              <div><h3 className="text-lg font-semibold">Skills found and projects</h3><p className="mt-1 text-sm text-slate-500">Capabilities found in the resume and the work that supports them.</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">{demoEmployeeReview.skills.map((skill) => <Badge key={skill} tone="success">{skill} · Demo</Badge>)}</div>
            <div className="mt-5 space-y-3">{demoEmployeeReview.projects.map((project) => <div key={project.name} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">{project.name}</p><p className="mt-2 text-sm leading-6 text-slate-600">{project.detail}</p></div>)}</div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><GraduationCap className="size-5" /></div>
              <div><h3 className="text-lg font-semibold">Education and role fit</h3><p className="mt-1 text-sm text-slate-500">Background and alignment with the requested position.</p></div>
            </div>
            <div className="mt-6 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">{demoEmployeeReview.education.college}</p><p className="mt-2 text-sm text-slate-600">{demoEmployeeReview.education.degree}</p><p className="mt-1 text-sm text-slate-500">{demoEmployeeReview.education.graduation}</p></div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Role fit · 94%</p><p className="mt-2 text-sm leading-6 text-slate-700">{demoEmployeeReview.roleFit}</p></div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><CheckCircle2 className="size-5" /></div><div><h3 className="text-lg font-semibold">Reasons to approve</h3><p className="mt-1 text-sm text-slate-500">Evidence that supports moving forward with the referral.</p></div></div>
            <ul className="mt-6 space-y-3">{demoEmployeeReview.reasonsToApprove.map((reason) => <li key={reason} className="flex gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" /><span>{reason}</span></li>)}</ul>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><XCircle className="size-5" /></div><div><h3 className="text-lg font-semibold">Reasons to reject</h3><p className="mt-1 text-sm text-slate-500">Conditions that may make this referral inappropriate.</p></div></div>
            <ul className="mt-6 space-y-3">{demoEmployeeReview.reasonsToReject.map((reason) => <li key={reason} className="flex gap-3 text-sm leading-6 text-slate-700"><XCircle className="mt-1 size-4 shrink-0 text-slate-500" /><span>{reason}</span></li>)}</ul>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><AlertTriangle className="size-5" /></div><div><h3 className="text-lg font-semibold">Potential concerns</h3><p className="mt-1 text-sm text-slate-500">Open questions to validate rather than assume.</p></div></div>
            <ul className="mt-6 space-y-3">{demoEmployeeReview.concerns.map((concern) => <li key={concern} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><span>{concern}</span></li>)}</ul>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Sparkles className="size-5" /></div><div><h3 className="text-lg font-semibold">AI summary</h3><p className="mt-1 text-sm text-slate-500">A balanced recommendation based on the displayed resume evidence.</p></div></div>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><Badge tone="warning">Demo AI analysis</Badge><p className="mt-3 text-sm leading-7 text-slate-700">{demoEmployeeReview.aiSummary}</p></div>
          </Card>
        </div>
      ) : null}
    </PageShell>
  )
}
