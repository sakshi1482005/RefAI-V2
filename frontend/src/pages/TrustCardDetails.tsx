import { ArrowRight, Check, CheckCircle2, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Avatar, Badge, Card, EmptyState, PrimaryButton, ProgressBar, ScoreExplanation, SecondaryButton } from '../components/dashboard/primitives'
import { useDemoMode } from '../context/DemoModeContext'
import { DEMO_ATS_SCORE, demoAnalysisSession, demoEmployeeReview } from '../lib/demoData'
import { useToast } from '../components/feedback/ToastProvider'
import { buildScoreReasons, matchScoreFromTrustCard } from '../lib/aiInsights'
import AITransparencyPanel from '../components/dashboard/AITransparencyPanel'
import TrustScoreExplanation from '../components/dashboard/TrustScoreExplanation'
import AuthenticatedTrustCardDetails from '../components/dashboard/AuthenticatedTrustCardDetails'
import RefAILogo from '../components/branding/RefAILogo'

// TODO: Populate when a candidate Trust Card retrieval API is available.
const signals: Array<{ label: string; value: string; score: number }> = []

export default function TrustCardDetails() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode && requestId) return <AuthenticatedTrustCardDetails requestId={requestId} />
  const candidateName = isDemoMode ? demoEmployeeReview.candidateName : requestId ? `Candidate ${requestId}` : 'Candidate'
  const summary = isDemoMode ? demoAnalysisSession.trustCard?.aiSummary ?? '' : ''
  const trustCard = isDemoMode ? demoAnalysisSession.trustCard : undefined
  const visibleSignals = trustCard ? [
    { label: 'Trust Score', value: String(trustCard.trustScore), score: trustCard.trustScore },
    { label: 'Overall Match', value: `${trustCard.overallMatch}%`, score: trustCard.overallMatch },
    { label: 'ATS Score', value: String(DEMO_ATS_SCORE), score: DEMO_ATS_SCORE },
    { label: 'Role Fit', value: `${trustCard.roleFit}%`, score: trustCard.roleFit },
    { label: 'Proof', value: `${trustCard.proofScore}%`, score: trustCard.proofScore },
    { label: 'Confidence', value: `${trustCard.confidence}%`, score: trustCard.confidence },
    { label: 'Gaps', value: `${trustCard.gapScore}%`, score: trustCard.gapScore },
  ] : signals
  const scoreReasons = trustCard ? buildScoreReasons(matchScoreFromTrustCard(trustCard), true) : []
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      toast({ title: 'Trust Card summary copied', tone: 'success' })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access is unavailable. Try again from a secure browser window.', tone: 'error' })
    }
  }

  return (
    <PageShell
      eyebrow="Trust card details"
      title={`Evaluate ${candidateName}'s referral evidence`}
      description="This Trust Card explains how resume evidence supports the target role. Compare the strengths and gaps, then continue to the decision panel."
      action={
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
          <SecondaryButton onClick={() => navigate(`/employee/resume/${requestId ?? 'sg-001'}`)}>Back to Resume</SecondaryButton>
          <SecondaryButton onClick={copySummary} disabled={!summary} disabledReason="No Trust Card summary is available to copy">{copied ? <><Check className="mr-2 size-4 text-emerald-600" />Copied</> : 'Copy summary'}</SecondaryButton>
          <PrimaryButton onClick={() => navigate(`/employee/decision/${requestId ?? 'sg-001'}`)} disabled={!trustCard} disabledReason="Trust Card evidence is required before making a decision">
            Next: Make Decision
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden bg-slate-950 text-white">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <RefAILogo inverse markClassName="size-10" wordmarkClassName="text-lg font-semibold" subtitle="Candidate Trust Card" subtitleClassName="text-sm text-slate-400" />
              <Badge className="border-white/10 bg-white/10 text-white">{isDemoMode ? 'Demo · Employee view' : 'Employee view'}</Badge>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Avatar initials={isDemoMode ? demoEmployeeReview.initials : '—'} size="lg" className="border-4 border-white/10 bg-white text-black" />
              <div>
                <h2 className="text-2xl font-semibold">{candidateName}</h2>
                <p className="mt-1 text-sm text-slate-400">{trustCard?.role || 'Candidate metadata unavailable'}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trust Score</p>
                <p className="mt-2 text-4xl font-semibold">{trustCard?.trustScore ?? '—'}</p>
              </div>
              <div className="flex size-14 items-center justify-center rounded-full border-4 border-slate-600 text-slate-400">
                <CheckCircle2 className="size-6" />
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-slate-400" />
                <span className="text-sm font-semibold">{trustCard ? 'Demo resume evidence processed' : 'Verification unavailable'}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{trustCard ? 'This sample Trust Card is isolated from authenticated candidate records.' : 'No candidate Trust Card has been returned.'}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Referral evidence summary</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">What supports the candidate's match</h3>
              </div>
              <Badge tone={isDemoMode ? 'warning' : 'neutral'}>
                <ShieldCheck className="mr-1.5 size-3.5" />
                {trustCard?.recommendation ?? 'Awaiting Trust Card'}
              </Badge>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {visibleSignals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">{signal.label}</span>
                    <span className="text-sm font-semibold">{signal.value}</span>
                  </div>
                  <div className="mt-3"><ProgressBar value={signal.score} /></div>
                </div>
              ))}
            </div>
            {scoreReasons.length > 0 ? <ScoreExplanation className="mt-7" title="Why these referral signals?" points={scoreReasons} /> : null}
            {visibleSignals.length === 0 ? <EmptyState className="mt-7" title="Trust signals are not available yet" description="Match, role fit, proof, and gap scores will appear after the candidate Trust Card service returns evidence." icon={ShieldCheck} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Return to Candidate</PrimaryButton><SecondaryButton onClick={() => navigate(`/employee/resume/${requestId ?? 'sg-001'}`)}>Open Resume</SecondaryButton></div>} /> : null}
          </Card>

          {trustCard ? <Card className="p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Risk signals and recommendation</h3><p className="mt-1 text-sm text-slate-500">Decision support returned separately from the candidate’s readiness result.</p></div><Badge tone={trustCard.recommendation === 'Ready for referral' ? 'success' : trustCard.recommendation === 'Review before referring' ? 'warning' : 'neutral'}>{trustCard.recommendation}</Badge></div><ul className="mt-6 space-y-3">{trustCard.riskSignals.map((risk) => <li key={risk} className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{risk}</li>)}</ul></Card> : null}

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">How RefAI interprets the evidence</h3>
                <p className="mt-1 text-sm text-slate-500">Use this summary as decision support, then verify its claims against the resume.</p>
              </div>
            </div>

            {trustCard ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><Badge tone="warning">Demo AI summary</Badge><p className="mt-3 text-sm leading-7 text-slate-700">{summary}</p></div> : <EmptyState className="mt-6" title="AI trust summary is pending" description="RefAI will summarize role alignment, verified evidence, and referral risk when candidate Trust Card data becomes available." icon={Sparkles} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/review/${requestId ?? 'sg-001'}`)}>Review Candidate</PrimaryButton><SecondaryButton onClick={() => navigate('/employee/dashboard')}>Back to Queue</SecondaryButton></div>} />}

          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <UserCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Proof points</h3>
                <p className="mt-1 text-sm text-slate-500">Key signals employees will want to see before approving.</p>
              </div>
            </div>

            {isDemoMode ? <div className="mt-6 space-y-3">{demoEmployeeReview.evidence.map((point) => <div key={point} className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">{point}</div>)}</div> : <EmptyState className="mt-6" title="Proof points are waiting for evidence" description="Verified projects, measurable outcomes, and role-aligned skills will appear when the backend returns candidate evidence." icon={UserCheck} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(`/employee/resume/${requestId ?? 'sg-001'}`)}>Inspect Resume</PrimaryButton><SecondaryButton onClick={() => navigate(`/employee/decision/${requestId ?? 'sg-001'}`)}>Decision Panel</SecondaryButton></div>} />}
          </Card>
        </div>
      </div>
      <TrustScoreExplanation isDemoMode={isDemoMode} trustCard={trustCard} />
      <AITransparencyPanel session={isDemoMode ? demoAnalysisSession : {}} isDemoMode={isDemoMode} audience="employee" includeEvidenceDetails />
    </PageShell>
  )
}
