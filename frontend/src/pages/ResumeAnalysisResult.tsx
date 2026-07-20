import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Gauge, Search, Sparkles, Target, Zap, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { AnimatedNumber, Card, EmptyState, MetricTooltip, PrimaryButton, ScoreExplanation, SecondaryButton } from '../components/dashboard/primitives'
import { useAnalysisSession } from '../hooks/useAnalysisSession'
import { buildResumeInsights, buildScoreReasons } from '../lib/aiInsights'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { DEMO_ATS_SCORE, demoEmployeeReview } from '../lib/demoData'
import AITransparencyPanel from '../components/dashboard/AITransparencyPanel'
import { useToast } from '../components/feedback/ToastProvider'
import { useState } from 'react'
import { api } from '../lib/apiClient'
import { friendlyErrorMessage, requireOnline } from '../lib/requestSafety'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { getStudentWorkflowState } from '../lib/studentWorkflow'
import ActionPlanPanel from '../components/dashboard/ActionPlanPanel'


export default function ResumeAnalysisResult() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profile } = useCurrentUser()
  const session = useAnalysisSession()
  const { isDemoMode, demoJourneyStage, setDemoJourneyStage } = useDemoMode()
  const [generatingTrustCard, setGeneratingTrustCard] = useState(false)
  const workflow = getStudentWorkflowState({ profile, session })
  const insights = session.matchScore ? buildResumeInsights(session.matchScore, session.role) : null
  const scoreReasons = session.matchScore ? buildScoreReasons(session.matchScore, isDemoMode) : []
  const metrics = [
    { label: 'Resume', value: session.upload ? 'Processed' : 'Unavailable', description: isDemoMode ? `${session.upload?.fileName} · Demo` : session.upload?.fileName ?? 'Upload a resume to begin', icon: FileText },
    { label: 'Extracted chunks', value: session.upload ? String(session.upload.chunkCount) : '—', score: session.upload?.chunkCount, description: isDemoMode ? 'Sample analyzed sections' : 'Returned by the resume upload API', icon: CheckCircle2 },
    { label: 'Resume Match', value: session.matchScore ? `${session.matchScore.overall}%` : '—', score: session.matchScore?.overall, suffix: '%', description: isDemoMode ? 'Demo match result' : session.matchScore ? 'Returned by the match API' : 'No completed match analysis', icon: Target },
    ...(isDemoMode ? [
      { label: 'ATS Score', value: String(DEMO_ATS_SCORE), score: DEMO_ATS_SCORE, description: 'Standardized Ananya Rao demo value', icon: Gauge },
    ] : []),
    ...(session.trustCard ? [{ label: 'Trust Score', value: String(session.trustCard.trustScore), score: session.trustCard.trustScore, description: 'Backend-calculated weighted Trust Score', icon: Sparkles }] : []),
    { label: 'Target Role', value: session.role || '—', description: session.role ? 'Saved analysis target' : 'No target-role API is available', icon: Zap }
  ]
  const metricHelp: Record<string, string> = {
    Resume: 'Shows whether RefAI has processed a resume for this analysis session.',
    'Extracted chunks': 'The number of resume text sections created for analysis—not a quality score.',
    'Resume Match': 'The combined role-fit and repeated-evidence score for this job description.',
    'ATS Score': 'The standardized demo ATS readability score for Ananya’s resume.',
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
    if (session.trustCard) {
      navigate('/dashboard/trust-card')
      return
    }
    if (!session.matchScore || !session.analysisId) {
      toast({ title: 'Resume analysis required', description: 'Complete the Resume workflow before generating a Trust Card.', tone: 'info' })
      navigate('/dashboard/resume')
      return
    }
    if (generatingTrustCard) return
    setGeneratingTrustCard(true)
    try {
      requireOnline()
      await api.post('/trust-card/generate', {
        candidateName: profile?.fullName || profile?.email || 'Candidate',
        analysisId: session.analysisId,
      }, { timeout: 45_000 })
      sessionStorage.setItem('refai_trust_card_celebration', 'pending')
      toast({ title: 'Trust Card generated', description: 'Review the AI summary and supporting match signals before continuing.', tone: 'success' })
      navigate('/dashboard/trust-card')
    } catch (error) {
      toast({ title: 'Trust Card could not be generated', description: friendlyErrorMessage(error, 'The AI summary service is temporarily unavailable. Your resume analysis is still saved.'), tone: 'error' })
    } finally {
      setGeneratingTrustCard(false)
    }
  }

  return (
    <PageShell
      eyebrow="Analysis result"
      title={session.matchScore ? 'Review your resume-to-role evidence' : 'Resume analysis is not available yet'}
      description={session.matchScore ? 'RefAI compared your resume with the target role. Review what raised or limited the score, then open the Trust Card.' : 'Upload a resume and add a job description first. RefAI needs both before it can explain role fit, proof, and gaps.'}
      action={
        <div className="flex flex-wrap gap-3">
          <SecondaryButton onClick={() => navigate('/dashboard/resume')}>Back to Resume</SecondaryButton>
          <SecondaryButton onClick={() => window.print()}>Print / save report</SecondaryButton>
          <PrimaryButton onClick={continueToTrustCard} loading={generatingTrustCard}>
            {workflow.trustCardAction.label}
            <ArrowRight className="ml-2 size-4" />
          </PrimaryButton>
        </div>
      }
    >
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

            {session.analysis ? <div className="mt-6 space-y-3">{session.analysis.strengths.map((strength) => <div key={strength} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm leading-6 text-emerald-900">{strength}</p></div>)}<div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Readiness summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{session.analysis.readinessSummary}</p></div></div> : insights ? <div className="mt-6 space-y-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-950">{insights.strength.title}</p><p className="mt-2 text-sm leading-6 text-emerald-800">{insights.strength.description}</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">{insights.weakness.title}</p><p className="mt-2 text-sm leading-6 text-amber-800">{insights.weakness.description}</p></div></div> : <EmptyState className="mt-6" title="Build role-fit evidence" description="Upload a current resume and compare it with a complete job description. RefAI will explain the strongest score and the limiting weakness." icon={CheckCircle2} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Open Resume Workspace</PrimaryButton>} />}
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

            {session.analysis ? <div className="mt-6 space-y-3">{session.analysis.learningRecommendations.map((recommendation, index) => <div key={recommendation} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">{index + 1}</div><p className="text-sm leading-6 text-slate-700">{recommendation}</p></div>)}</div> : insights ? <div className="mt-6 space-y-3">{insights.improvements.map((item, index) => <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">{index + 1}</div><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></div></div>)}</div> : <EmptyState className="mt-6" title="Unlock targeted recommendations" description="Complete a role analysis to identify exactly which score is limiting readiness and why the suggested change should improve it." icon={Search} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Analyze Target Role</PrimaryButton>} />}
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Zap className="size-5" /></div><div><h3 className="text-lg font-semibold">ATS guidance</h3><p className="mt-1 text-sm text-slate-500">Tips tied directly to RefAI’s lexical coverage model.</p></div></div>
            {insights ? <div className="mt-6 space-y-3">{insights.atsTips.map((tip) => <div key={tip.title} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{tip.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{tip.description}</p></div>)}</div> : <EmptyState className="mt-6" title="ATS guidance needs a target job" description="Upload a resume and provide a job description so RefAI can explain terminology coverage and repeated proof using your actual scores." icon={Zap} action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Analyze for ATS</PrimaryButton>} />}
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Gauge className="size-5" /></div><div><h3 className="text-lg font-semibold">Interview and hiring signals</h3><p className="mt-1 text-sm text-slate-500">Readiness guidance without unsupported outcome claims.</p></div></div>
            {insights ? <div className="mt-6 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{insights.interviewReadiness.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{insights.interviewReadiness.description}</p></div> : null}
            <EmptyState className="mt-4" title="Hiring probability is not available" description="RefAI has no historical hiring-outcome model or labeled company decision data. Match scores describe resume-to-job coverage and must not be presented as a probability of being hired." icon={BriefcaseBusiness} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate('/dashboard/trust-card')}>Review Referral Readiness</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard#ai-recommendations')}>Prepare for Interviews</SecondaryButton></div>} />
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
