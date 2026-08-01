import { ArrowRight, BriefcaseBusiness, Check, GraduationCap, RefreshCw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import PageShell from '../components/dashboard/PageShell'
import { AnimatedNumber, Avatar, Badge, Card, EmptyState, InlineFeedback, MetricTooltip, PrimaryButton, ProgressBar, ScoreExplanation, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useToast } from '../components/feedback/ToastProvider'
import { useEffect, useMemo, useState } from 'react'
import { useAnalysisSessionResource } from '../hooks/useAnalysisSession'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDemoMode } from '../context/DemoModeContext'
import ConfettiBurst from '../components/feedback/ConfettiBurst'
import AITransparencyPanel from '../components/dashboard/AITransparencyPanel'
import { } from '../lib/demoData'
import TrustScoreExplanation from '../components/dashboard/TrustScoreExplanation'
import { getStudentWorkflowState } from '../lib/studentWorkflow'
import ActionPlanPanel from '../components/dashboard/ActionPlanPanel'
import RefAILogo from '../components/branding/RefAILogo'
import { educationLines } from '../lib/education'
import type { AnalysisSession } from '../lib/analysisSession'
import { friendlyErrorMessage } from '../lib/requestSafety'
import ProofVaultPanel from '../components/dashboard/ProofVaultPanel'
import ClaimVerificationPanel from '../components/dashboard/ClaimVerificationPanel'
import ImprovementSimulatorPanel from '../components/dashboard/ImprovementSimulatorPanel'

export default function TrustCard() {
  const { profile } = useCurrentUser()
  const { isDemoMode } = useDemoMode()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const routedSession = (location.state as { analysisSession?: AnalysisSession } | null)?.analysisSession
  const analysisResource = useAnalysisSessionResource(routedSession)
  const analysisSession = analysisResource.session
  const workflow = getStudentWorkflowState({ profile, session: analysisSession })
  const { trustCard } = analysisSession
  const [copied, setCopied] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const candidateName = trustCard?.candidateName || profile?.fullName || 'Candidate'
  const summary = trustCard?.aiSummary ?? ''
  const scoreReasons = trustCard?.scoreReasons ?? []
  const education = {
    college: trustCard?.education?.college || profile?.college || null,
    degree: trustCard?.education?.degree || profile?.degree || null,
    branch: trustCard?.education?.branch || profile?.branch || null,
    graduationYear: trustCard?.education?.graduationYear || profile?.graduationYear || null,
  }
  const educationDetails = educationLines(education)
  const signals = useMemo(() => trustCard ? [
    { label: 'Trust Score', value: String(trustCard.trustScore), score: trustCard.trustScore },
    { label: isDemoMode ? 'Resume Match' : 'Overall Match', value: `${trustCard.overallMatch}%`, score: trustCard.overallMatch },
    { label: 'Role Fit', value: `${trustCard.roleFit}%`, score: trustCard.roleFit },
    { label: 'Proof', value: `${trustCard.proofScore}%`, score: trustCard.proofScore },
    { label: 'Gaps', value: `${trustCard.gapScore}%`, score: trustCard.gapScore }
  ] : [], [isDemoMode, trustCard])
  const metricHelp: Record<string, string> = {
    'Overall Match': 'The average of Role Fit and repeated Proof returned by the current matching model.',
    'Resume Match': 'Ananya’s demo resume-to-job match for the Atlassian role.',
    'Trust Score': 'The deterministic five-component Candidate Trust Score returned by the backend.',
    'Role Fit': 'How much meaningful job-description terminology appears in the resume.',
    Proof: 'How consistently matched job requirements are supported by repeated resume evidence.',
    Gaps: 'The percentage of job-description terminology not currently covered by the resume.',
  }

  useEffect(() => {
    if (trustCard && sessionStorage.getItem('refai_trust_card_celebration') === 'pending') {
      sessionStorage.removeItem('refai_trust_card_celebration')
      setCelebrate(true)
    }
  }, [trustCard])

  const shareTrustCard = async () => {
    const shareData = { title: 'RefAI Candidate Trust Card', text: summary, url: window.location.href }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        toast({ title: 'Trust Card shared', tone: 'success' })
        return
      }
      await navigator.clipboard.writeText(`${summary} ${window.location.href}`)
      toast({ title: 'Share link copied', description: 'The Trust Card summary and link are on your clipboard.', tone: 'success' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast({ title: 'Unable to share', description: 'Try copying the summary again.', tone: 'error' })
    }
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      toast({ title: 'Summary copied', tone: 'success' })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access was unavailable.', tone: 'error' })
    }
  }

  if (analysisResource.loading && !trustCard) {
    return <PageShell eyebrow="Trust card" title="Loading Trust Card..." description="RefAI is loading your latest persisted Trust Card.">
      <Card className="p-6 sm:p-8"><div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /><Skeleton className="h-24 w-full" /></div></Card>
    </PageShell>
  }

  if (analysisResource.error && !trustCard) {
    return <PageShell eyebrow="Trust card" title="Could not load Trust Card" description="Your saved Trust Card could not be retrieved from the backend.">
      <InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error, 'Could not load the saved Trust Card. Please retry.')}</InlineFeedback>
      <div className="mt-6 flex flex-wrap gap-3"><PrimaryButton onClick={analysisResource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Back to Analysis</SecondaryButton></div>
    </PageShell>
  }

  return (
    <><ConfettiBurst active={celebrate} onComplete={() => setCelebrate(false)} /><PageShell
      eyebrow="Trust card"
      title="Review the evidence employees will see"
      description="This Trust Card condenses your role fit, supporting proof, and remaining gaps. Check the summary before improving the evidence or sharing it with an employee."
      action={
        <div className="flex flex-wrap gap-3">
          <SecondaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Back to Analysis</SecondaryButton>
          <SecondaryButton onClick={() => navigate('/dashboard#ai-recommendations')}>Next: AI Recommendations</SecondaryButton>
          <SecondaryButton onClick={copySummary} disabled={!summary} disabledReason="Generate a Trust Card first">{copied ? <><Check className="mr-2 size-4 text-emerald-600" />Copied</> : 'Copy summary'}</SecondaryButton>
          <PrimaryButton onClick={shareTrustCard} disabled={!trustCard} disabledReason="Generate a Trust Card first">
            Share with employee
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden bg-slate-950 text-white">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <RefAILogo inverse markClassName="size-10" wordmarkClassName="text-lg font-semibold" subtitle="Candidate Trust Card" subtitleClassName="text-sm text-slate-400" />
              <Badge className="border-white/10 bg-white/10 text-white">{isDemoMode ? 'Demo · Employee view' : 'Employee view'}</Badge>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Avatar initials={profile?.initials ?? '—'} size="lg" className="border-4 border-white/10 bg-white text-black" />
              <div>
                <h2 className="text-2xl font-semibold">{candidateName}</h2>
                <p className="mt-1 text-sm text-slate-400">{trustCard?.role || 'No target role available'}</p>
              </div>
            </div>

            <div className="mt-8 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4 text-slate-400" />
                <span>Target: {trustCard?.role || 'Not available'}</span>
              </div>
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-slate-400" />
                <div>{educationDetails.length ? educationDetails.map((line) => <p key={line}>{line}</p>) : <span>Educational data not available</span>}</div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trust Score</p>
                <p className="mt-2 text-4xl font-semibold">{trustCard ? <AnimatedNumber value={trustCard.trustScore} /> : '—'}</p>
              </div>
              <div className="flex size-14 items-center justify-center rounded-full border-4 border-emerald-400 text-emerald-300">
                <Check className="size-6" />
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span className="text-sm font-semibold">{trustCard ? isDemoMode ? 'Demo resume evidence processed' : 'Resume evidence processed' : 'Trust Card not generated'}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{trustCard ? 'Evidence was processed by the Trust Card API.' : 'No generated Trust Card is available.'}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Employee review summary</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">What supports this referral request</h3>
              </div>
              <Badge tone={isDemoMode ? "warning" : trustCard ? "success" : "neutral"}>
                <ShieldCheck className="mr-1.5 size-3.5" />
                {isDemoMode ? 'Demo evidence' : trustCard ? 'Evidence available' : 'Awaiting analysis'}
              </Badge>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {signals.map((signal) => (
                <div key={signal.label} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500"><MetricTooltip label={signal.label} explanation={metricHelp[signal.label]} /></span>
                    <span className="text-sm font-semibold"><AnimatedNumber value={signal.score} suffix="%" /></span>
                  </div>
                  <div className="mt-3"><ProgressBar value={signal.score} /></div>
                </div>
              ))}
            </div>
            {trustCard?.analysisReliability ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">Analysis Reliability · {trustCard.analysisReliability.label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{trustCard.analysisReliability.basis}</p><p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-semibold">Limitations:</span> {trustCard.analysisReliability.limitations}</p></div> : <p className="mt-4 text-xs text-slate-500">Analysis Reliability was not recorded for this older saved Trust Card.</p>}
            {scoreReasons.length > 0 ? <ScoreExplanation className="mt-7" title="Why these referral signals?" points={scoreReasons} /> : null}
            {signals.length === 0 ? <EmptyState className="mt-7" icon={ShieldCheck} title="Generate your first Trust Card" description="A Trust Card explains your resume match, proof strength, skill gaps, and referral readiness in an employee-friendly summary." action={<PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</PrimaryButton>} /> : null}
            {trustCard ? <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Referral readiness</p><p className="mt-2 text-lg font-semibold">{trustCard.referralReadiness}</p><p className="mt-2 text-sm leading-6 text-slate-600">Ready at 75 or above, improve before requesting from 55–74, and not ready below 55. Current Trust Score: {trustCard.trustScore}.</p></div> : null}

            <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-slate-700" />
                <p className="text-sm font-semibold">How RefAI summarizes the evidence</p>
              </div>
              {summary ? <p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p> : <EmptyState className="mt-4" icon={Sparkles} title="AI summary needs resume evidence" description="Complete a target-role analysis and RefAI will summarize the strongest evidence an employee can review." action={<PrimaryButton onClick={() => navigate(workflow.analysisAction.href)}>{workflow.analysisAction.label}</PrimaryButton>} />}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <UserCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Proof points for employees</h3>
                <p className="mt-1 text-sm text-slate-500">A concise snapshot of your preparation, supporting evidence, and remaining gaps.</p>
              </div>
            </div>

            {trustCard ? <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Strengths</p><ul className="mt-3 space-y-2">{trustCard.strengths.map((item) => <li key={item} className="text-sm leading-6 text-slate-600">• {item}</li>)}</ul></div><div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Missing requirements</p><ul className="mt-3 space-y-2">{trustCard.missingSkills.length ? trustCard.missingSkills.slice(0, 5).map((item) => <li key={item} className="text-sm leading-6 text-slate-600">• {item}</li>) : <li className="text-sm leading-6 text-slate-600">No missing requirements were identified.</li>}</ul></div></div> : <EmptyState className="mt-6" icon={UserCheck} title="Generate a Trust Card to review evidence" description="Complete resume analysis first to load strengths, missing skills, and a focused action plan." action={<PrimaryButton onClick={() => navigate(workflow.analysisAction.href)}>{workflow.analysisAction.label}</PrimaryButton>} />}
          </Card>

        </div>
      </div>
      <ActionPlanPanel className="mt-6" plan={trustCard?.actionPlan ?? []} allGaps={trustCard?.missingRequirements ?? []} />
      {!isDemoMode ? <div className="mt-6"><ProofVaultPanel editable trustCardId={trustCard?.id} /></div> : null}
      {!isDemoMode && trustCard?.id ? <div className="mt-6"><ClaimVerificationPanel trustCardId={trustCard.id} /></div> : null}
      {!isDemoMode && trustCard?.id ? <div className="mt-6"><ImprovementSimulatorPanel /></div> : null}
      <TrustScoreExplanation isDemoMode={isDemoMode} trustCard={trustCard} />
      <AITransparencyPanel session={analysisSession} isDemoMode={isDemoMode} includeEvidenceDetails />
    </PageShell></>
  )
}
