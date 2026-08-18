import { ArrowRight, BarChart3, BrainCircuit, BriefcaseBusiness, Check, ClipboardCheck, FileCheck2, FlaskConical, GraduationCap, Lightbulb, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import PageShell from '../components/dashboard/PageShell'
import { AnimatedNumber, Avatar, Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useToast } from '../components/feedback/ToastProvider'
import { useEffect, useMemo, useState } from 'react'
import { useAnalysisSessionResource } from '../hooks/useAnalysisSession'
import { setAuthenticatedTrustCardResource, useTrustCardResource } from '../hooks/useTrustCardResource'
import { useLocation, useNavigate } from 'react-router-dom'
import ConfettiBurst from '../components/feedback/ConfettiBurst'
import AITransparencyPanel from '../components/dashboard/AITransparencyPanel'
import { useAuthSession } from '../context/AuthSessionContext'
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
import TrustPassportPanel from '../components/dashboard/TrustPassportPanel'
import { api } from '../lib/apiClient'
import { parseTrustCardResponse } from '../lib/resumeContract'

type TrustCardSection = 'score' | 'evidence' | 'action' | 'simulator' | 'passport' | 'processing'

const sections: Array<{ id: TrustCardSection; label: string; icon: typeof BarChart3 }> = [
  { id: 'score', label: 'Score Breakdown', icon: BarChart3 },
  { id: 'evidence', label: 'Evidence & Claims', icon: FileCheck2 },
  { id: 'action', label: 'Action Plan', icon: ClipboardCheck },
  { id: 'simulator', label: 'Improvement Simulator', icon: Lightbulb },
  { id: 'passport', label: 'Trust Passport', icon: ShieldCheck },
  { id: 'processing', label: 'AI Processing', icon: BrainCircuit },
]

export default function TrustCard() {
  const { profile } = useCurrentUser()
  const { authenticatedUserId } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const routedSession = (location.state as { analysisSession?: AnalysisSession } | null)?.analysisSession
  const analysisResource = useAnalysisSessionResource(routedSession)
  const analysisSession = analysisResource.session
  const trustCardResource = useTrustCardResource({ analysisId: analysisSession.analysisId, initialCard: analysisSession.trustCard })
  const workflow = getStudentWorkflowState({ profile, session: analysisSession })
  const trustCard = trustCardResource.card ?? analysisSession.trustCard
  const [copied, setCopied] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [activeSection, setActiveSection] = useState<TrustCardSection>('score')
  const candidateName = trustCard?.candidateName || profile?.fullName || 'Candidate'
  const summary = trustCard?.aiSummary ?? ''
  const education = {
    college: trustCard?.education?.college || profile?.college || null,
    degree: trustCard?.education?.degree || profile?.degree || null,
    branch: trustCard?.education?.branch || profile?.branch || null,
    graduationYear: trustCard?.education?.graduationYear || profile?.graduationYear || null,
  }
  const educationDetails = educationLines(education)
  const topStrength = useMemo(() => trustCard?.strengths[0] || trustCard?.evidence[0] || 'No evidence summary was saved for this card.', [trustCard])
  const topImprovement = useMemo(() => trustCard?.actionPlan[0]?.requirement || trustCard?.missingSkills[0] || 'No priority improvement was identified.', [trustCard])

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

  const regenerateTrustCard = async () => {
    if (!authenticatedUserId || !analysisSession.analysisId || regenerating) return
    setRegenerating(true)
    try {
      const { data, status } = await api.post<unknown>('/trust-card/generate', {
        analysisId: analysisSession.analysisId,
        candidateName: profile?.fullName || profile?.email || 'Candidate',
        forceRegenerate: true,
      }, { timeout: 45_000 })
      const regenerated = parseTrustCardResponse(data, status)
      setAuthenticatedTrustCardResource(authenticatedUserId, analysisSession.analysisId, regenerated)
      toast({ title: 'Trust Card regenerated', description: 'The current analysis inputs were recalculated and saved.', tone: 'success' })
    } catch (error) {
      toast({ title: 'Trust Card could not be regenerated', description: friendlyErrorMessage(error, 'Please retry.'), tone: 'error' })
    } finally {
      setRegenerating(false)
    }
  }

  if ((analysisResource.loading || trustCardResource.loadingPersisted) && !trustCard) {
    return <PageShell eyebrow="Trust card" title="Loading Trust Card..." description="RefAI is loading your latest persisted Trust Card.">
      <Card className="p-6 sm:p-8"><div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /><Skeleton className="h-24 w-full" /></div></Card>
    </PageShell>
  }

  if ((analysisResource.error || trustCardResource.error) && !trustCard) {
    return <PageShell eyebrow="Trust card" title="Could not load Trust Card" description="Your saved Trust Card could not be retrieved from the backend.">
      <InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error || trustCardResource.error, 'Could not load the saved Trust Card. Please retry.')}</InlineFeedback>
      <div className="mt-6 flex flex-wrap gap-3"><PrimaryButton onClick={() => { analysisResource.retry(); void trustCardResource.prefetch() }}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Back to Analysis</SecondaryButton></div>
    </PageShell>
  }

  return (
    <><ConfettiBurst active={celebrate} onComplete={() => setCelebrate(false)} /><PageShell
      eyebrow="Candidate intelligence"
      title="Candidate Intelligence Dashboard"
      description="A compact view of the deterministic Trust Score, evidence, and the next most useful improvement."
      action={
        <div className="flex flex-wrap gap-3">
          <SecondaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Back to Analysis</SecondaryButton>
          <SecondaryButton onClick={() => navigate('/dashboard/intelligence-lab')} disabled={!trustCard} disabledReason="Generate a Trust Card first"><FlaskConical className="mr-2 size-4" />Intelligence Lab</SecondaryButton>
          <SecondaryButton onClick={() => navigate('/dashboard/opportunities')}>Next: AI Recommendations</SecondaryButton>
          <SecondaryButton onClick={copySummary} disabled={!summary} disabledReason="Generate a Trust Card first">{copied ? <><Check className="mr-2 size-4 text-emerald-600" />Copied</> : 'Copy summary'}</SecondaryButton>
          {trustCard ? <SecondaryButton onClick={regenerateTrustCard} loading={regenerating}><RefreshCw className="mr-2 size-4" />Regenerate</SecondaryButton> : null}
          <PrimaryButton onClick={shareTrustCard} disabled={!trustCard} disabledReason="Generate a Trust Card first">
            Share with employee
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
      {!trustCard && trustCardResource.notFound ? <div className="mb-6"><InlineFeedback tone="info">No valid persisted Trust Card is available for this analysis. Return to the completed analysis to generate one.</InlineFeedback></div> : null}
      <Card className="overflow-hidden border-slate-800 bg-slate-950 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:p-10">
          <div>
            <div className="flex items-center justify-between gap-3">
              <RefAILogo inverse markClassName="size-9" wordmarkClassName="text-base font-semibold" subtitle="Candidate Trust Card" subtitleClassName="text-xs text-slate-400" />
              <Badge className="border-white/10 bg-white/10 text-white">Saved employee view</Badge>
            </div>
            <div className="mt-7 flex items-center gap-4">
              <Avatar initials={profile?.initials ?? '—'} size="lg" className="border-4 border-white/10 bg-white text-black" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{candidateName}</h2>
                <p className="mt-1 text-sm text-slate-400">{trustCard?.role || 'No target role available'}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5 text-slate-500" />Target role: {trustCard?.role || 'Not available'}</span>
              <span className="inline-flex items-start gap-1.5"><GraduationCap className="mt-0.5 size-3.5 shrink-0 text-slate-500" />{educationDetails.length ? educationDetails.join(' · ') : 'Education not recorded'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:col-span-1 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Candidate Trust Score</p>
              <div className="mt-2 flex items-end gap-2"><p className="text-5xl font-semibold tracking-tight tabular-nums">{trustCard ? <AnimatedNumber value={trustCard.trustScore} /> : '—'}</p><span className="mb-1 text-sm text-slate-400">/100</span></div>
              <p className="mt-2 text-xs text-slate-400">Five deterministic components. AI never calculates this number.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Reliability</p><p className="mt-2 text-sm font-semibold text-white">{trustCard?.analysisReliability?.label || 'Not recorded'}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Evidence</p><p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-emerald-400" />{trustCard ? 'Processed' : 'Awaiting analysis'}</p></div>
          </div>
        </div>
        <div className="grid border-t border-white/10 bg-black/15 sm:grid-cols-2">
          <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r sm:border-white/10 sm:px-8"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300">Strongest evidence</p><p className="mt-2 text-sm leading-6 text-slate-100">{topStrength}</p></div>
          <div className="p-5 sm:px-8"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-200">Highest-priority improvement</p><p className="mt-2 text-sm leading-6 text-slate-100">{topImprovement}</p></div>
        </div>
      </Card>

      {trustCard?.narrativeSource === 'deterministic_fallback' ? <div className="mt-5"><InlineFeedback tone="info">The deterministic Candidate Trust Score is complete. The optional Groq narrative was unavailable, so RefAI saved a grounded fallback summary.</InlineFeedback></div> : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-100/70 p-1.5" role="tablist" aria-label="Candidate intelligence sections">
        <div className="flex snap-x gap-1 overflow-x-auto pb-0.5">
          {sections.map((section) => {
            const Icon = section.icon
            const active = activeSection === section.id
            return <button key={section.id} id={`trust-card-tab-${section.id}`} type="button" role="tab" aria-selected={active} aria-controls={`trust-card-panel-${section.id}`} onClick={() => setActiveSection(section.id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950'}`}><Icon className="size-4" aria-hidden="true" />{section.label}</button>
          })}
        </div>
      </div>

      <section id={`trust-card-panel-${activeSection}`} role="tabpanel" aria-labelledby={`trust-card-tab-${activeSection}`} className="mt-5">
        {activeSection === 'score' ? <TrustScoreExplanation trustCard={trustCard} /> : null}
        {activeSection === 'evidence' ? <div className="space-y-5">{trustCard?.id ? <ClaimVerificationPanel trustCardId={trustCard.id} importantSkills={analysisSession.analysis?.matchedSkills ?? []} missingRequirements={trustCard.missingRequirements} /> : <EmptyState icon={ShieldCheck} title="No saved evidence to review yet" description="Generate a Trust Card to inspect claim verification and supporting Proof Vault links." action={<PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</PrimaryButton>} />}<ProofVaultPanel editable trustCardId={trustCard?.id} /></div> : null}
        {activeSection === 'action' ? <div className="space-y-5"><ActionPlanPanel plan={trustCard?.actionPlan ?? []} allGaps={trustCard?.missingRequirements ?? []} /><Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-4 text-slate-700" /><div><p className="text-sm font-semibold">Grounded summary</p>{summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p> : <p className="mt-2 text-sm leading-6 text-slate-500">No narrative summary was saved for this Trust Card.</p>}</div></div></Card></div> : null}
        {activeSection === 'simulator' ? trustCard?.id ? <ImprovementSimulatorPanel /> : <EmptyState icon={Lightbulb} title="Generate a Trust Card to use the simulator" description="The simulator uses your saved analysis and Trust Card to estimate potential improvements without changing your profile." /> : null}
        {activeSection === 'passport' ? <TrustPassportPanel trustCardId={trustCard?.id} /> : null}
        {activeSection === 'processing' ? <AITransparencyPanel session={analysisSession} includeEvidenceDetails /> : null}
      </section>
    </PageShell></>
  )
}
