import { BrainCircuit, CircleAlert, GraduationCap, Network, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCandidateIntelligence } from '../../hooks/useCandidateIntelligence'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import { Badge, Card, EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

const reliabilityTone = (label: 'Low' | 'Moderate' | 'High') => label === 'High' ? 'success' : label === 'Moderate' ? 'warning' : 'danger'

export default function CandidateIntelligencePanel({ analysisId, enabled }: { analysisId?: string | null; enabled: boolean }) {
  const { data, loading, error, notFound, retry } = useCandidateIntelligence(analysisId, enabled)

  if (!enabled) return null
  if (loading) return <Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><BrainCircuit className="size-5" /><div><h3 className="text-lg font-semibold">Candidate Intelligence</h3><p className="text-sm text-slate-500">Loading current academic signals…</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div><Skeleton className="mt-4 h-36 rounded-xl" /></Card>
  if (error) return <Card className="p-5 sm:p-6"><InlineFeedback tone="error">{friendlyErrorMessage(error, 'Candidate Intelligence could not be loaded.')}<SecondaryButton className="ml-3" onClick={retry}>Retry</SecondaryButton></InlineFeedback></Card>
  if (notFound || !data) return <Card className="p-5 sm:p-6"><EmptyState icon={BrainCircuit} title="Candidate Intelligence is not ready" description="Complete a current resume analysis and Trust Card to view real academic signals." /></Card>

  const metrics = [
    { label: 'Hybrid', value: data.hybrid.hybrid_score, helper: data.hybrid.label },
    { label: 'Trust', value: data.trustScore, helper: data.trustScoreVersion || 'Current' },
    { label: 'Role relevance', value: data.semantic.semantic_match_score, helper: data.semantic.relevance_source === 'job_description' ? 'JD context' : 'Role context' },
    { label: 'Fuzzy suitability', value: data.fuzzy.fuzzy_suitability_score, helper: data.fuzzy.label },
  ]
  const strongest = data.hybrid.positive_factors[0] || data.semantic.strongest_matching_evidence[0]?.resume_evidence || 'No strongest signal was recorded.'
  const biggestGap = data.hybrid.risk_gap_factors[0] || data.skillGaps.recommendations[0]?.skill || data.semantic.missing_skills[0] || 'No primary evidence gap was recorded.'
  const educationValue = data.fuzzy.inputValuesUsed.education
  const projectValue = data.fuzzy.inputValuesUsed.project_relevance
  return <section aria-labelledby="candidate-intelligence-title"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">3 · Candidate Intelligence</p><h2 id="candidate-intelligence-title" className="mt-1 text-2xl font-semibold tracking-tight">Evidence-based academic signals</h2></div><Badge tone={reliabilityTone(data.hybrid.label)}>{data.hybrid.label} result</Badge></div>
    <Card className="overflow-hidden border-slate-200 bg-[#fbfbfc] p-5 sm:p-6"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white/70 p-3.5"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{metric.label}</p><div className="mt-1.5 flex items-end justify-between gap-2"><p className="text-2xl font-semibold tabular-nums text-slate-950">{metric.value}<span className="text-xs font-medium text-slate-400">/100</span></p><span className="max-w-24 truncate text-[11px] font-medium text-slate-500">{metric.helper}</span></div></div>)}</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]"><div className="rounded-xl border border-slate-200 bg-white/70 p-4"><div className="flex items-center gap-2"><Sparkles className="size-4 text-slate-700" /><p className="text-sm font-semibold">Strongest academic signal</p></div><p className="mt-2 text-sm leading-6 text-slate-700">{strongest}</p><div className="mt-3 flex flex-wrap gap-1.5">{data.semantic.matched_skills.slice(0, 5).map((skill) => <Badge key={skill} tone="success">{skill}</Badge>)}{data.semantic.matched_skills.length === 0 ? <span className="text-xs text-slate-500">No matched skills recorded.</span> : null}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4"><div className="flex items-center gap-2"><CircleAlert className="size-4 text-amber-700" /><p className="text-sm font-semibold">Biggest evidence gap</p></div><p className="mt-2 text-sm leading-6 text-slate-700">{biggestGap}</p>{data.skillGaps.recommendations[0] ? <p className="mt-2 text-xs leading-5 text-slate-500">Next: {data.skillGaps.recommendations[0].project_improvement}</p> : null}</div></div>
      <div className="mt-4 grid gap-2 md:grid-cols-3"><MiniSignal icon={<Network className="size-4" />} label="Project relevance" value={projectValue} detail={data.semantic.strongest_matching_evidence[0]?.compared_to || 'No project evidence recorded'} /><MiniSignal icon={<ShieldCheck className="size-4" />} label="Skill evidence" value={data.semantic.matched_skills.length} detail={`${data.semantic.matched_skills.length} matched skill${data.semantic.matched_skills.length === 1 ? '' : 's'}`} unit="signals" /><MiniSignal icon={<GraduationCap className="size-4" />} label="Education signal" value={educationValue} detail={data.fuzzy.inputSources.education || 'Saved education evidence'} /></div>
      <details className="mt-4 rounded-xl border border-slate-200 bg-white/60 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black">Why these signals?</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><p className="text-xs leading-5 text-slate-600">{data.hybrid.explanation}</p><div className="space-y-2">{data.fuzzy.activated_rules.slice(0, 2).map((rule) => <p key={rule.id} className="text-xs leading-5 text-slate-600"><span className="font-semibold">{rule.consequent}:</span> {rule.rule}</p>)}{data.semantic.limitations.slice(0, 1).map((item) => <p key={item} className="text-[11px] leading-4 text-slate-500">Limit: {item}</p>)}</div></div></details>
    </Card></section>
}

function MiniSignal({ icon, label, value, detail, unit = '/100' }: { icon: ReactNode; label: string; value: number | undefined; detail: string; unit?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/55 p-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</div><div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{label} <span className="tabular-nums text-slate-500">{value ?? '—'}{value === undefined ? '' : unit}</span></p><p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p></div></div>
}
