import { CheckCircle2, ChevronDown, Clock3, Database, FileSearch, ListChecks, Network, ShieldCheck, Sigma, Sparkles } from 'lucide-react'
import type { AnalysisSession } from '../../lib/analysisSession'
import { Badge, Card } from './primitives'

type AITransparencyPanelProps = {
  session: AnalysisSession
  audience?: 'student' | 'employee'
  includeEvidenceDetails?: boolean
  className?: string
}

function wordCount(value?: string) {
  return value?.trim() ? value.trim().split(/\s+/).length : 0
}

function processingTime(value?: number) {
  if (value === undefined) return 'Not recorded'
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`
}

export default function AITransparencyPanel({ session, audience = 'student', includeEvidenceDetails = false, className = '' }: AITransparencyPanelProps) {
  const hasResume = Boolean(session.upload?.preview)
  const hasJobDescription = Boolean(session.jobDescription?.trim()) && !session.usedGeneralRoleExpectations
  const analysis = session.analysis
  const hasAnalysis = analysis?.analysisStatus === 'complete'
  const hasTrustCard = Boolean(session.trustCard)
  const stages = [
    { label: 'Resume', status: hasResume ? 'Complete' : 'Awaiting upload', complete: hasResume, model: 'Private PDF parsing', detail: hasResume ? 'Resume text was extracted for this analysis.' : 'Upload a resume to begin.' , icon: FileSearch },
    { label: 'Evidence Extraction', status: hasAnalysis ? 'Complete' : 'Awaiting analysis', complete: hasAnalysis, model: 'Structured evidence rules', detail: hasAnalysis ? `${analysis.evidence.length} evidence item${analysis.evidence.length === 1 ? '' : 's'} and role requirements were structured.` : 'Resume evidence is not yet available.', icon: ListChecks },
    { label: 'Semantic Match', status: hasAnalysis ? 'Context prepared' : 'Awaiting analysis', complete: hasAnalysis, model: 'Role/JD relevance context', detail: hasJobDescription ? 'Submitted JD context is available for relevance checks.' : 'General role context is used when no JD was provided.', icon: Network },
    { label: 'Fuzzy Evaluation', status: 'On demand', complete: false, model: 'Fuzzy Candidate Suitability', detail: 'Academic suitability is a separate on-demand signal; it is not inferred here.', icon: Sigma },
    { label: 'Trust / Hybrid Intelligence', status: hasTrustCard ? 'Trust Score complete' : 'Awaiting Trust Card', complete: hasTrustCard, model: 'Deterministic Trust Score v2', detail: hasTrustCard ? 'Five deterministic components form the saved Trust Score.' : 'Generate the Trust Card to calculate the deterministic score.', icon: ShieldCheck },
    { label: 'Recommendations', status: hasTrustCard ? 'Complete' : 'Awaiting Trust Card', complete: hasTrustCard, model: audience === 'employee' ? 'Advisory review summary' : 'Readiness and action planning', detail: hasTrustCard ? (audience === 'employee' ? 'Advisory review context is available; employees decide manually.' : 'Readiness and next evidence actions are available.') : 'Recommendations appear after the Trust Card is saved.', icon: Sparkles },
  ]
  const technicalFacts = [
    { label: 'Resume source', value: hasResume ? session.upload?.fileName ?? 'Processed resume' : 'Not processed', icon: FileSearch },
    { label: 'Role context', value: hasJobDescription ? `${wordCount(session.jobDescription)} JD words` : session.role || 'Not recorded', icon: Database },
    { label: 'Matched skills', value: hasAnalysis ? String(analysis.matchedSkills.length) : 'Not recorded', icon: ListChecks },
    { label: 'Evidence items', value: hasAnalysis ? String(analysis.evidence.length) : 'Not recorded', icon: CheckCircle2 },
    { label: 'Processing time', value: processingTime(session.processingTimeMs), icon: Clock3 },
    { label: 'Saved score version', value: session.trustCard?.scoreVersion || 'Not recorded', icon: ShieldCheck },
  ]

  return <Card className={`p-5 sm:p-6 ${className}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Explainability record</p><h2 className="mt-1 text-xl font-semibold tracking-tight">How RefAI analysed your profile</h2><p className="mt-1 text-sm text-slate-500">A compact record of the real analysis pipeline and its boundaries.</p></div><Badge tone="success">Authenticated analysis</Badge></div>
    <div className="mt-5 overflow-x-auto pb-1"><ol className="flex min-w-[860px] items-stretch">{stages.map((stage, index) => { const Icon = stage.icon; return <li key={stage.label} className="relative flex min-w-[134px] flex-1 flex-col pr-3 last:pr-0"><div className="flex items-center gap-2"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${stage.complete ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="size-3.5" aria-hidden="true" /></span>{index < stages.length - 1 ? <span className="h-px flex-1 bg-slate-200" aria-hidden="true" /> : null}</div><div className="mt-3"><div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-semibold text-slate-900">{stage.label}</p><span className={`size-1.5 rounded-full ${stage.complete ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" /></div><p className="mt-1 text-[11px] font-medium text-slate-500">{stage.status}</p><p className="mt-1 text-[11px] leading-4 text-slate-400">{stage.model}</p></div></li> })}</ol></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{stages.map((stage) => <div key={`${stage.label}-detail`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-xs font-semibold text-slate-800">{stage.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{stage.detail}</p></div>)}</div>
    <details className="group mt-5 rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset">Technical details<ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><div className="border-t border-slate-200 p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{technicalFacts.map((fact) => { const Icon = fact.icon; return <div key={fact.label} className="rounded-lg bg-slate-50 p-3"><Icon className="size-3.5 text-slate-500" /><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{fact.label}</p><p className="mt-1 text-xs font-medium leading-5 text-slate-800">{fact.value}</p></div> })}</div>{analysis?.analysisReliability ? <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-800">{analysis.analysisReliability.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{analysis.analysisReliability.basis}</p><p className="mt-1 text-[11px] leading-5 text-slate-500"><span className="font-semibold">Limitation:</span> {analysis.analysisReliability.limitations}</p></div> : null}{includeEvidenceDetails ? <div className="mt-3 grid gap-3 md:grid-cols-2"><section className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-800">Evidence sources</p><p className="mt-1 text-xs leading-5 text-slate-600">Resume: {session.upload?.fileName ?? 'Not available'} · Job description: {hasJobDescription ? `${wordCount(session.jobDescription)} submitted words` : 'General role context'}</p></section><section className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-800">Skills and sections</p><p className="mt-1 text-xs leading-5 text-slate-600">{hasAnalysis ? `${analysis.matchedSkills.join(', ') || 'No matched requirements'} · ${analysis.resumeSectionsUsed.join(', ') || 'Sections not recorded'}` : 'Analysis required'}</p></section>{hasAnalysis ? <section className="rounded-lg border border-slate-200 p-3 md:col-span-2"><p className="text-xs font-semibold text-slate-800">Requirement evidence</p><div className="mt-2 flex flex-wrap gap-2">{analysis.evidence.map((point) => <span key={point} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">{point}</span>)}</div></section> : null}</div> : null}</div></details>
  </Card>
}
