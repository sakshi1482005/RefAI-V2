import { CheckCircle2, Circle, Clock3, Database, FileSearch, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'
import type { AnalysisSession } from '../../lib/analysisSession'
import { demoEmployeeReview } from '../../lib/demoData'
import { Badge, Card } from './primitives'

type AITransparencyPanelProps = {
  session: AnalysisSession
  isDemoMode: boolean
  audience?: 'student' | 'employee'
  includeEvidenceDetails?: boolean
  className?: string
}

function wordCount(value?: string) {
  return value?.trim() ? value.trim().split(/\s+/).length : 0
}

function processingTime(value?: number) {
  if (value === undefined) return 'Not recorded for this analysis'
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`
}

export default function AITransparencyPanel({ session, isDemoMode, audience = 'student', includeEvidenceDetails = false, className = '' }: AITransparencyPanelProps) {
  const hasResume = Boolean(session.upload?.preview)
  const hasJobDescription = Boolean(session.jobDescription?.trim()) && !session.usedGeneralRoleExpectations
  const hasMatch = Boolean(session.matchScore)
  const analysis = session.analysis
  const hasAnalysis = analysis?.analysisStatus === 'complete'
  const hasTrustCard = Boolean(session.trustCard)
  const steps = [
    { label: 'Resume Parsed', complete: hasResume, detail: hasResume ? `${session.upload?.chunkCount ?? 0} extracted text chunks` : 'Upload and process a resume to complete this step' },
    { label: 'Skills Extracted', complete: isDemoMode || hasAnalysis, detail: isDemoMode ? `${demoEmployeeReview.skills.length} structured demo skills` : hasAnalysis ? `${analysis.matchedSkills.length} matched and ${analysis.missingSkills.length} missing requirements returned by API` : 'Run the updated resume analysis to extract structured requirements' },
    { label: 'Resume Evidence Checked', complete: hasMatch, detail: isDemoMode ? 'Strong resume evidence · Demo' : hasMatch ? 'Terminology and evidence coverage checked by the match model' : 'Waiting for resume-to-role matching' },
    { label: 'Job Matched', complete: hasMatch, detail: hasMatch ? `${session.matchScore?.overall}% Overall Match calculated` : 'Run resume analysis to calculate the job match' },
    { label: 'Trust Score Generated', complete: hasTrustCard, detail: hasTrustCard ? `${session.trustCard?.trustScore} Trust Score · deterministic weighted calculation${isDemoMode ? ' · Demo' : ''}` : 'Generate the Trust Card after completing resume analysis' },
    audience === 'employee'
      ? { label: 'AI Recommendation Created', complete: hasTrustCard, detail: hasTrustCard ? session.trustCard?.recommendation ?? 'Recommendation unavailable due to a Trust Card error' : 'Generate a Trust Card before employee decision support' }
      : { label: 'Readiness Summary Created', complete: hasTrustCard, detail: hasTrustCard ? session.trustCard?.referralReadiness ?? 'Readiness unavailable due to a Trust Card error' : 'Generate a Trust Card to calculate referral readiness' },
  ]
  const facts = [
    { label: 'Resume processed', value: hasResume ? session.upload?.fileName ?? 'Processed resume' : 'Not processed', icon: FileSearch },
    { label: 'Job Description processed', value: hasJobDescription ? `${wordCount(session.jobDescription)} submitted words` : 'Not processed', icon: Database },
    { label: 'Skills extracted', value: isDemoMode ? `${demoEmployeeReview.skills.length} demo skills` : hasAnalysis ? `${analysis.matchedSkills.length} matched requirements` : 'Analysis required', icon: ListChecks },
    { label: 'Evidence found', value: hasMatch ? `Proof signal: ${session.matchScore?.proof}%` : 'No evidence score returned', icon: CheckCircle2 },
    { label: 'AI reasoning', value: hasMatch ? 'Role Fit, repeated Proof, and unmatched terminology' : 'No reasoning inputs available', icon: Sparkles },
    { label: 'Analysis reliability', value: analysis?.analysisReliability?.label ?? (isDemoMode ? 'High reliability' : 'Not recorded for this saved analysis'), icon: ShieldCheck },
    { label: 'Processing time', value: processingTime(session.processingTimeMs), icon: Clock3 },
  ]

  return (
    <Card className={`p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI processing record</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">How this output was produced</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">This record separates API-returned results, locally measured metadata, and clearly labeled demo evidence.</p>
        </div>
        <Badge tone={isDemoMode ? 'warning' : 'success'}>{isDemoMode ? 'Demo processing' : 'Authenticated analysis'}</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.complete ? CheckCircle2 : Circle
          return <div key={step.label} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><Icon className={`size-4 shrink-0 ${step.complete ? 'text-emerald-600' : 'text-slate-300'}`} /><p className="text-sm font-semibold">{step.label}</p></div><p className="mt-2 text-xs leading-5 text-slate-500">{step.detail}</p></div>
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => {
          const Icon = fact.icon
          return <div key={fact.label} className="rounded-xl bg-slate-50 p-4"><Icon className="size-4 text-slate-500" /><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{fact.label}</p><p className="mt-1 text-sm font-medium leading-5 text-slate-800">{fact.value}</p></div>
        })}
      </div>
      {analysis?.analysisReliability ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">{analysis.analysisReliability.label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.analysisReliability.basis}</p><p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-semibold">Limitations:</span> {analysis.analysisReliability.limitations}</p></div> : null}

      {includeEvidenceDetails ? <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Evidence Sources</p><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><li>Resume: {session.upload?.fileName ?? 'Not available'}</li><li>Job Description: {hasJobDescription ? `${wordCount(session.jobDescription)} submitted words` : 'Not available'}</li></ul></div>
        <div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Matched Skills</p><p className="mt-3 text-sm leading-6 text-slate-600">{isDemoMode ? demoEmployeeReview.skills.join(', ') : hasAnalysis ? analysis.matchedSkills.join(', ') || 'No target requirements matched.' : 'Run the updated resume analysis to view matched requirements.'}</p></div>
        <div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Missing Skills</p><p className="mt-3 text-sm leading-6 text-slate-600">{isDemoMode ? 'System design depth, cloud deployment evidence' : hasAnalysis ? analysis.missingSkills.join(', ') || 'No unmatched target requirements were identified.' : 'Run the updated resume analysis to view missing requirements.'}</p></div>
        <div className="rounded-xl border border-slate-200 p-5"><p className="text-sm font-semibold">Resume Sections Used</p><p className="mt-3 text-sm leading-6 text-slate-600">{isDemoMode ? 'Experience, Projects, Skills, Education · Demo' : hasAnalysis ? analysis.resumeSectionsUsed.join(', ') : 'Run the updated analysis to detect resume sections.'}</p></div>
        <div className="rounded-xl border border-slate-200 p-5 md:col-span-2"><p className="text-sm font-semibold">Requirement Evidence</p>{isDemoMode ? <ul className="mt-3 grid gap-2 md:grid-cols-2">{demoEmployeeReview.evidence.map((point) => <li key={point} className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{point} · Demo</li>)}</ul> : hasAnalysis ? <ul className="mt-3 grid gap-2 md:grid-cols-2">{analysis.evidence.map((point) => <li key={point} className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{point}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-600">Run the updated analysis to load requirement evidence.</p>}</div>
      </div> : null}
    </Card>
  )
}
