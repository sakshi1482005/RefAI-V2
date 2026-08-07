import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Gauge, Search, Sparkles, Target, Zap, FileText, RefreshCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { AnimatedNumber, Card, EmptyState, InlineFeedback, MetricTooltip, PrimaryButton, ScoreExplanation, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useAnalysisSessionResource } from '../hooks/useAnalysisSession'
import { setAuthenticatedTrustCardResource, useTrustCardResource } from '../hooks/useTrustCardResource'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { demoEmployeeReview } from '../lib/demoData'
import AITransparencyPanel from '../components/dashboard/AITransparencyPanel'
import { useToast } from '../components/feedback/ToastProvider'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/apiClient'
import { FriendlyRequestError, friendlyErrorMessage, requireOnline } from '../lib/requestSafety'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { getStudentWorkflowState } from '../lib/studentWorkflow'
import ActionPlanPanel from '../components/dashboard/ActionPlanPanel'
import type { AnalysisSession } from '../lib/analysisSession'
import { parseTrustCardResponse } from '../lib/resumeContract'


export default function ResumeAnalysisResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { profile } = useCurrentUser()
  const routedSession = (location.state as { analysisSession?: AnalysisSession } | null)?.analysisSession
  const analysisResource = useAnalysisSessionResource(routedSession)
  const { session } = analysisResource
  const { isDemoMode, authenticatedUserId, demoJourneyStage, setDemoJourneyStage } = useDemoMode()
  const [generatingTrustCard, setGeneratingTrustCard] = useState(false)
  const trustCardActionInFlight = useRef(false)
  const trustCardResource = useTrustCardResource({ analysisId: session.analysisId, initialCard: session.trustCard, autoLoad: false })

  const trustCardErrorMessage = (error: unknown) => {
    if (!(error instanceof FriendlyRequestError)) {
      return friendlyErrorMessage(error, 'Trust Card generation failed. Please retry.')
    }
    if (error.status === 401) return 'Authentication expired. Please sign in again.'
    if (error.status === 404 && error.detail === 'Persisted resume analysis was not found.') {
      return 'No completed resume analysis found.'
    }
    if (error.kind === 'network') return 'Unable to connect to the RefAI backend.'
    if (error.detail) return `Trust Card generation failed: ${error.detail}`
    return error.message
  }

  useEffect(() => {
    if (routedSession) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, routedSession])

  const workflow = getStudentWorkflowState({ profile, session })
  const scoreReasons = session.analysis?.scoreReasons ?? []
  const metrics = [
    { label: 'Resume', value: session.upload ? 'Processed' : 'Unavailable', description: isDemoMode ? `${session.upload?.fileName} · Demo` : session.upload?.fileName ?? 'Upload a resume to begin', icon: FileText },
    { label: 'Extracted chunks', value: session.upload ? String(session.upload.chunkCount) : '—', score: session.upload?.chunkCount, description: isDemoMode ? 'Sample analyzed sections' : 'Returned by the resume upload API', icon: CheckCircle2 },
    { label: 'Resume Match', value: session.matchScore ? `${session.matchScore.overall}%` : '—', score: session.matchScore?.overall, suffix: '%', description: isDemoMode ? 'Demo match result' : session.matchScore ? 'Returned by the match API' : 'No completed match analysis', icon: Target },
    ...(session.trustCard ? [{ label: 'Trust Score', value: String(session.trustCard.trustScore), score: session.trustCard.trustScore, description: 'Backend-calculated weighted Trust Score', icon: Sparkles }] : []),
    { label: 'Target Role', value: session.role || '—', description: session.role ? 'Saved analysis target' : 'No target-role API is available', icon: Zap }
  ]
  const metricHelp: Record<string, string> = {
    Resume: 'Shows whether RefAI has processed a resume for this analysis session.',
    'Extracted chunks': 'The number of resume text sections created for analysis—not a quality score.',
    'Resume Match': 'The combined role-fit and repeated-evidence score for this job description.',
    'Trust Score': 'The standardized demo Trust Score shown across Ananya’s referral journey.',
    'Target Role': 'The role used to frame this analysis and its recommendations.',
  }

  const continueToTrustCard = async () => {
    if (isDemoMode && session.matchScore && !hasReachedDemoStage(demoJourneyStage, 'trust-card-generated')) {
      setDemoJourneyStage('trust-card-generated')
      sessionStorage.setItem('refai_trust_card_celebration', 'pending')
      toast({ title: 'Trust Card generated', description: 'Ananya’s 91 Trust Score is ready for review.', tone: 'success' })
      navigate('/dashboard/trust-card')
      return
    }
    if (session.trustCard || trustCardResource.card) {
      navigate('/dashboard/trust-card')
      return
    }
    if (!session.matchScore || !session.analysisId) {
      toast({ title: 'Resume analysis required', description: 'Complete the Resume workflow before generating a Trust Card.', tone: 'info' })
      navigate('/dashboard/resume')
      return
    }
    if (generatingTrustCard || trustCardActionInFlight.current) return
    trustCardActionInFlight.current = true
    setGeneratingTrustCard(true)
    try {
      requireOnline()
      const persisted = await trustCardResource.prefetch()
      if (persisted.card) {
        navigate('/dashboard/trust-card')
        return
      }
      if (persisted.error || !persisted.notFound) {
        toast({ title: 'Trust Card could not be loaded', description: friendlyErrorMessage(persisted.error, 'The saved Trust Card could not be checked. Please retry.'), tone: 'error' })
        return
      }
      const { data, status } = await api.post<unknown>('/trust-card/generate', {
        candidateName: profile?.fullName || profile?.email || 'Candidate',
        analysisId: session.analysisId,
      }, { timeout: 45_000 })
      const trustCard = parseTrustCardResponse(data, status)
      const nextSession = { ...session, trustCard }
      if (authenticatedUserId && session.analysisId) setAuthenticatedTrustCardResource(authenticatedUserId, session.analysisId, trustCard)
      sessionStorage.setItem('refai_trust_card_celebration', 'pending')
      toast({ title: 'Trust Card generated', description: 'Review the AI summary and supporting match signals before continuing.', tone: 'success' })
      navigate('/dashboard/trust-card', { state: { analysisSession: nextSession } })
    } catch (error) {
      toast({ title: 'Trust Card could not be generated', description: trustCardErrorMessage(error), tone: 'error' })
    } finally {
      setGeneratingTrustCard(false)
      trustCardActionInFlight.current = false
    }
  }

  if (analysisResource.loading && !session.matchScore) {
    return <PageShell eyebrow="Analysis result" title="Loading analysis..." description="RefAI is loading your latest completed resume analysis.">
      <Card className="p-6 sm:p-8"><div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></Card>
    </PageShell>
  }

  if (analysisResource.error) {
    return <PageShell eyebrow="Analysis result" title="Could not load resume analysis" description="Your saved analysis could not be retrieved from the backend.">
      <InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error, 'Could not load resume analysis. Please retry.')}</InlineFeedback>
      <div className="mt-6 flex flex-wrap gap-3"><PrimaryButton onClick={analysisResource.retry}><RefreshCw className="mr-2 size-4" />Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard')}>Back to Dashboard</SecondaryButton></div>
    </PageShell>
  }

  if (analysisResource.notFound || !session.matchScore) {
    return <PageShell eyebrow="Analysis result" title="No completed analysis found" description="The backend confirmed that this student account has no completed resume analysis.">
      <EmptyState icon={FileText} title="No completed analysis found" description="Upload and analyze a resume first." action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Upload Resume</PrimaryButton>} />
    </PageShell>
  }

  return (
    <PageShell
      eyebrow="Analysis result"
      title="Review your resume-to-role evidence"
      description="RefAI compared your resume with the target role. Review what raised or limited the score, then open the Trust Card."
      action={
        <div className="flex flex-wrap gap-3">
          <SecondaryButton onClick={() => navigate('/dashboard/resume')}>Back to Resume</SecondaryButton>
          <SecondaryButton onClick={() => window.print()}>Print / save report</SecondaryButton>
          <PrimaryButton onClick={continueToTrustCard} onMouseEnter={() => { void trustCardResource.prefetch() }} onFocus={() => { void trustCardResource.prefetch() }} loading={generatingTrustCard}>
            {workflow.trustCardAction.label}
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
      {!isDemoMode && session.usedGeneralRoleExpectations ? <div className="mb-6"><InlineFeedback tone="info">Analysis is based on general expectations for this role. Add a job description for more personalized insights.</InlineFeedback></div> : null}
      <AITransparencyPanel session={session} isDemoMode={isDemoMode} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-black text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">What RefAI found</h2>
              <p className="mt-1 text-sm text-slate-500">Target role: {session.role || 'not provided'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div key={metric.label} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-xl font-semibold">{metric.score !== undefined ? <AnimatedNumber value={metric.score} suffix={metric.suffix} /> : metric.value}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold"><MetricTooltip label={metric.label} explanation={metricHelp[metric.label]} /></p>
                  <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
                </div>
              )
            })}
          </div>
          {scoreReasons.length > 0 ? <ScoreExplanation className="mt-6" points={scoreReasons} /> : null}

          <div id="evidence" className="mt-6 scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-slate-700" />
              <p className="text-sm font-semibold">Evidence extracted</p>
            </div>
            {isDemoMode ? <div className="mt-4 space-y-2">{demoEmployeeReview.evidence.map((point) => <p key={point} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{point} · Demo</p>)}</div> : session.analysis ? <div className="mt-4 space-y-2">{session.analysis.strengths.map((point) => <p key={point} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{point}</p>)}</div> : <p className="mt-4 text-sm text-slate-500">Run the updated resume analysis to load structured evidence.</p>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Why this role is a fit</h3>
                <p className="mt-1 text-sm text-slate-500">The strongest evidence is tied to recent projects and role-relevant experience.</p>
              </div>
            </div>

            {session.analysis ? <div className="mt-6 space-y-3">{session.analysis.strengths.map((strength) => <div key={strength} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm leading-6 text-emerald-900">{strength}</p></div>)}{session.analysis.weaknesses.map((weakness) => <div key={weakness} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-900">{weakness}</p></div>)}<div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Readiness summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{session.analysis.readinessSummary}</p></div></div> : <EmptyState className="mt-6" title="Build role-fit evidence" description="Upload a current resume and compare it with a complete job description. RefAI will explain the strongest score and the limiting weakness." icon={CheckCircle2} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Open Resume Workspace</PrimaryButton>} />}
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Search className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">What to improve next</h3>
                <p className="mt-1 text-sm text-slate-500">Address these evidence gaps before requesting a referral.</p>
              </div>
            </div>

            {session.analysis ? <div className="mt-6 space-y-3">{session.analysis.learningRecommendations.map((recommendation, index) => <div key={recommendation} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">{index + 1}</div><p className="text-sm leading-6 text-slate-700">{recommendation}</p></div>)}</div> : <EmptyState className="mt-6" title="Unlock targeted recommendations" description="Complete a role analysis to identify exactly which score is limiting readiness and why the suggested change should improve it." icon={Search} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Analyze Target Role</PrimaryButton>} />}
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Zap className="size-5" /></div><div><h3 className="text-lg font-semibold">Resume evidence guidance</h3><p className="mt-1 text-sm text-slate-500">Tips tied directly to RefAI’s lexical coverage model.</p></div></div>
            {session.analysis ? <div className="mt-6 space-y-3">{session.analysis.atsGuidance.map((tip) => <div key={tip.title} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{tip.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{tip.description}</p></div>)}</div> : <EmptyState className="mt-6" title="Resume evidence guidance needs a target role" description="Upload a resume and provide a job description so RefAI can explain terminology coverage and repeated proof using your actual scores." icon={Zap} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Analyze Resume</PrimaryButton>} />}
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Gauge className="size-5" /></div><div><h3 className="text-lg font-semibold">Interview and hiring signals</h3><p className="mt-1 text-sm text-slate-500">Readiness guidance without unsupported outcome claims.</p></div></div>
            {session.analysis ? <div className="mt-6 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{session.analysis.interviewReadiness.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{session.analysis.interviewReadiness.description}</p></div> : null}
            <EmptyState className="mt-4" title="Outcome prediction is not available" description="RefAI evaluates observable resume and role evidence. It does not predict employment outcomes." icon={BriefcaseBusiness} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate('/dashboard/trust-card')}>Review Referral Readiness</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard#ai-recommendations')}>Prepare for Interviews</SecondaryButton></div>} />
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Building2 className="size-5" /></div><div><h3 className="text-lg font-semibold">Company-specific recommendations</h3><p className="mt-1 text-sm text-slate-500">Advice grounded in a specific company and role.</p></div></div>
            {isDemoMode ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-semibold">Atlassian collaboration evidence · Demo</p><p className="mt-2 text-sm leading-6 text-slate-600">Emphasize the five-person product-team example and explain how technical trade-offs were communicated. Why: the demo role explicitly values cross-functional collaboration, while the 82% proof score indicates this evidence is present but less measurable than the technical delivery examples.</p></div> : session.company ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-semibold">Target company: {session.company}</p><p className="mt-2 text-sm leading-6 text-slate-600">The recommendations on this page use the submitted job description for this company. RefAI does not infer undocumented company preferences or hiring outcomes.</p></div> : <EmptyState className="mt-6" title="Company context has not been provided" description="Add the target company in the Resume workspace so this analysis is tied to one clear application context." icon={Building2} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Add Target Company</PrimaryButton>} />}
          </Card>
        </div>
      </div>
      <div id="action-plan" className="scroll-mt-24"><ActionPlanPanel className="mt-6" plan={session.trustCard?.actionPlan ?? session.analysis?.actionPlan ?? []} allGaps={session.trustCard?.missingRequirements ?? session.analysis?.missingRequirements ?? []} /></div>
    </PageShell>
  )
}
