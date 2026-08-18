import { ArrowLeft, Beaker, BrainCircuit, CheckCircle2, FileSearch, GitBranch, Info, Sigma } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, ProgressBar, SecondaryButton, Skeleton } from '../components/dashboard/primitives'
import { useAnalysisSessionResource } from '../hooks/useAnalysisSession'
import { useModelComparison } from '../hooks/useModelComparison'
import { friendlyErrorMessage } from '../lib/requestSafety'
import type { ModelComparisonComponent, ModelComparisonResult } from '../types'

const MODEL_STYLE = {
  trust_score_v2: { icon: CheckCircle2, tone: 'success' as const },
  fuzzy_suitability: { icon: Sigma, tone: 'info' as const },
  semantic_job_match: { icon: BrainCircuit, tone: 'warning' as const },
  hybrid_candidate_intelligence: { icon: GitBranch, tone: 'dark' as const },
}

function valueLabel(component: ModelComparisonComponent) {
  if (component.unit === 'membership') return component.value.toFixed(2)
  if (component.unit === 'count') return String(Math.round(component.value))
  return component.maximumScore == null ? String(Math.round(component.value)) : `${Math.round(component.value)} / ${Math.round(component.maximumScore)}`
}

function CompactTable({ components, empty = 'No saved component data is available.' }: { components: ModelComparisonComponent[]; empty?: string }) {
  if (!components.length) return <p className="text-sm text-slate-500">{empty}</p>
  return <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60">
    {components.map((component) => <div key={component.key} className="grid gap-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{component.label}</p><p className="mt-0.5 truncate text-xs text-slate-500" title={component.basis}>{component.basis}</p></div>
      <div className="flex items-center gap-2 sm:justify-end"><span className="min-w-12 text-right text-sm font-semibold tabular-nums text-slate-950">{valueLabel(component)}</span>{component.maximumScore != null && component.unit !== 'count' ? <div className="w-16"><ProgressBar value={component.maximumScore ? (component.value / component.maximumScore) * 100 : 0} /></div> : null}</div>
    </div>)}
  </div>
}

function SkillChips({ title, skills, tone }: { title: string; skills: string[]; tone: 'success' | 'warning' }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p><div className="mt-2 flex flex-wrap gap-2">{skills.length ? skills.map((skill) => <Badge key={skill} tone={tone}>{skill}</Badge>) : <span className="text-sm text-slate-500">None recorded</span>}</div></div>
}

function ModelOverview({ data }: { data: ModelComparisonResult }) {
  return <section aria-label="Model outputs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {data.models.map((model) => {
      const style = MODEL_STYLE[model.key]
      const Icon = style.icon
      return <Card key={model.key} className="relative overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon className="size-4" aria-hidden="true" /></div><Badge tone={style.tone}>{model.algorithmVersion}</Badge></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">{model.label}</p>
        <div className="mt-2 flex items-end gap-1"><p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-950">{Math.round(model.score)}</p><span className="mb-1 text-sm text-slate-500">/100</span></div>
        <div className="mt-4"><ProgressBar value={model.score} /></div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{model.measures}</p>
      </Card>
    })}
  </section>
}

export default function IntelligenceLab() {
  const navigate = useNavigate()
  const analysisResource = useAnalysisSessionResource()
  const session = analysisResource.session
  const cardVersion = session.trustCard?.inputKey || session.trustCard?.generatedAt || session.trustCard?.id || null
  const comparison = useModelComparison(session.analysisId, cardVersion, Boolean(session.analysisId && session.trustCard))
  const data = comparison.data
  const trust = data?.models.find((model) => model.key === 'trust_score_v2')
  const fuzzy = data?.models.find((model) => model.key === 'fuzzy_suitability')
  const semantic = data?.models.find((model) => model.key === 'semantic_job_match')
  const fuzzyInputs = fuzzy?.components.filter((component) => component.unit === 'normalized_input') ?? []
  const fuzzyMemberships = fuzzy?.components.filter((component) => component.unit === 'membership') ?? []

  if (analysisResource.loading || comparison.loading) return <PageShell compact eyebrow="Capstone explainability" title="RefAI Intelligence Lab" description="Loading the saved academic model comparison for your current candidate profile."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}</div><Skeleton className="h-80 rounded-2xl" /></PageShell>

  if (analysisResource.error || comparison.error) return <PageShell compact eyebrow="Capstone explainability" title="RefAI Intelligence Lab" description="The academic comparison could not be loaded from your saved analysis."><InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error || comparison.error, 'Please retry the comparison.')}</InlineFeedback><div className="mt-5 flex gap-2"><PrimaryButton onClick={() => { analysisResource.retry(); comparison.retry() }}>Retry</PrimaryButton><SecondaryButton onClick={() => navigate('/dashboard/trust-card')}>Back to Trust Card</SecondaryButton></div></PageShell>

  if (!session.analysisId || !session.trustCard || !data) return <PageShell compact eyebrow="Capstone explainability" title="RefAI Intelligence Lab" description="This is a separate academic view of saved intelligence outputs, not a normal student workflow."><EmptyState icon={Beaker} title="A saved Trust Card is required" description="Complete resume analysis and generate a Trust Card before opening the model comparison." action={<PrimaryButton onClick={() => navigate('/dashboard/trust-card')}>Open Trust Card</PrimaryButton>} /></PageShell>

  return <PageShell compact eyebrow="Capstone explainability & evaluation" title="RefAI Intelligence Lab" description={`Read-only algorithm comparison for the current ${data.targetRole || 'candidate'} profile. It explains saved deterministic outputs; it does not predict hiring, referrals, or model accuracy.`} action={<SecondaryButton onClick={() => navigate('/dashboard/trust-card')}><ArrowLeft className="mr-2 size-4" />Back to Trust Card</SecondaryButton>}>
    <InlineFeedback tone="info"><span className="font-semibold">Evaluation scope:</span> {data.methodologyNote} No labelled evaluation dataset is connected, so accuracy, precision, recall, and similar performance claims are intentionally not shown.</InlineFeedback>
    <ModelOverview data={data} />

    <section className="grid gap-5 xl:grid-cols-[0.94fr_1.06fr]">
      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /><div><h2 className="text-base font-semibold text-slate-950">Trust Score v2 contributions</h2><p className="mt-1 text-sm leading-6 text-slate-600">The canonical five-component evidence score remains unchanged.</p></div></div><div className="mt-5"><CompactTable components={trust?.components ?? []} /></div>{trust?.limitations.map((item) => <p key={item} className="mt-3 text-xs leading-5 text-slate-500">{item}</p>)}</Card>
      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><Sigma className="mt-0.5 size-5 text-slate-700" /><div><h2 className="text-base font-semibold text-slate-950">Fuzzy suitability inputs & memberships</h2><p className="mt-1 text-sm leading-6 text-slate-600">Low, Medium and High memberships are fuzzy degrees, not probabilities.</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Normalized inputs</p><CompactTable components={fuzzyInputs} /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Membership degrees</p><CompactTable components={fuzzyMemberships} /></div></div>{data.fuzzyExplanation ? <p className="mt-4 text-sm leading-6 text-slate-600">{data.fuzzyExplanation}</p> : null}</Card>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><BrainCircuit className="mt-0.5 size-5 text-slate-700" /><div><h2 className="text-base font-semibold text-slate-950">Semantic Job Match</h2><p className="mt-1 text-sm leading-6 text-slate-600">Compared against {data.relevanceSource === 'job_description' ? 'the supplied Job Description' : 'general expectations for the selected role'}.</p></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><SkillChips title="Matched skills" skills={data.semanticMatchedSkills} tone="success" /><SkillChips title="Missing evidence" skills={data.semanticMissingSkills} tone="warning" /></div><div className="mt-5"><CompactTable components={semantic?.components ?? []} /></div>{data.semanticEvidence.length ? <div className="mt-5 space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Strongest grounded comparisons</p>{data.semanticEvidence.map((item, index) => <div key={`${item.resume_evidence}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"><p className="font-medium text-slate-800">{item.resume_evidence}</p><p className="mt-1 text-xs leading-5 text-slate-500">Compared with: {item.compared_to}{item.normalized_similarity == null ? '' : ` · similarity ${Math.round(item.normalized_similarity)}/100`}</p></div>)}</div> : null}{data.semanticExplanation ? <p className="mt-4 text-sm leading-6 text-slate-600">{data.semanticExplanation}</p> : null}{data.semanticWeakEvidence.length ? <p className="mt-3 text-xs leading-5 text-slate-500">Limitations: {data.semanticWeakEvidence.join(' · ')}</p> : null}</Card>
      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><GitBranch className="mt-0.5 size-5 text-slate-700" /><div><h2 className="text-base font-semibold text-slate-950">Hybrid Intelligence formula</h2><p className="mt-1 text-sm leading-6 text-slate-600">A separate academic composite; it does not replace the Candidate Trust Score.</p></div></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="pb-2 pr-3 font-semibold">Component</th><th className="pb-2 pr-3 text-right font-semibold">Score</th><th className="pb-2 pr-3 text-right font-semibold">Weight</th><th className="pb-2 text-right font-semibold">Contribution</th></tr></thead><tbody className="divide-y divide-slate-100">{data.hybridContributions.map((item) => <tr key={item.key}><td className="py-3 pr-3"><p className="font-medium text-slate-800">{item.label}</p><p className="mt-0.5 max-w-sm text-xs leading-5 text-slate-500">{item.basis}</p></td><td className="py-3 pr-3 text-right tabular-nums">{Math.round(item.score)}</td><td className="py-3 pr-3 text-right tabular-nums">{item.weight}%</td><td className="py-3 text-right font-semibold tabular-nums">{item.contribution.toFixed(1)}</td></tr>)}</tbody></table></div>{data.hybridExplanation ? <p className="mt-4 text-sm leading-6 text-slate-600">{data.hybridExplanation}</p> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2"><SkillChips title="Positive factors" skills={data.hybridPositiveFactors} tone="success" /><SkillChips title="Risk / gap factors" skills={data.hybridRiskGapFactors} tone="warning" /></div></Card>
    </section>

      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><FileSearch className="mt-0.5 size-5 text-slate-700" /><div><h2 className="text-base font-semibold text-slate-950">Activated fuzzy rules</h2><p className="mt-1 text-sm leading-6 text-slate-600">Only rules with a non-zero activation from the saved input values appear here.</p></div></div>{data.activatedFuzzyRules.length ? <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">{data.activatedFuzzyRules.map((rule) => <div key={rule.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"><Badge tone={rule.consequent === 'High' ? 'success' : rule.consequent === 'Moderate' ? 'warning' : 'dark'}>{rule.id} · {rule.consequent}</Badge><p className="text-sm leading-6 text-slate-700">{rule.rule}</p><span className="text-sm font-semibold tabular-nums text-slate-900">{rule.activation.toFixed(2)}</span></div>)}</div> : <p className="mt-5 text-sm text-slate-500">No activated fuzzy rules were persisted for this analysis.</p>}</Card>
    <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Info className="mt-0.5 size-3.5 shrink-0" />Algorithm versions are displayed in each model card. This lab exposes only the current candidate’s authorised saved outputs and never exposes raw resumes, provider prompts, or private evidence links.</p>
  </PageShell>
}
