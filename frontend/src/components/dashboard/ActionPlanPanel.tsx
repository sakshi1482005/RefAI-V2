import { ArrowRight, CheckCircle2, ListChecks } from 'lucide-react'
import type { ActionPlanItem } from '../../types'
import { Badge, Card, EmptyState } from './primitives'

const tones = { critical: 'danger', important: 'warning', optional: 'neutral' } as const
const groups = [
  { priority: 'critical' as const, title: 'Do First', description: 'Highest-value evidence gaps', impact: 'High' },
  { priority: 'important' as const, title: 'Do Next', description: 'Useful follow-up evidence', impact: 'Medium' },
  { priority: 'optional' as const, title: 'Optional', description: 'Helpful when time allows', impact: 'Low' },
]

export default function ActionPlanPanel({ plan, allGaps, className = '' }: { plan: ActionPlanItem[]; allGaps: ActionPlanItem[]; className?: string }) {
  const visiblePlan = plan.slice(0, 5)
  return <Card className={`p-5 sm:p-6 ${className}`}>
    <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ListChecks className="size-4" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Action Plan</p><h2 className="mt-1 text-xl font-semibold tracking-tight">A focused evidence roadmap</h2><p className="mt-1 text-sm text-slate-500">Prioritized next steps from your saved analysis — not guaranteed outcomes.</p></div></div>

    {visiblePlan.length ? <div className="mt-5 space-y-4">{groups.map((group) => {
      const actions = visiblePlan.filter((item) => item.priority === group.priority)
      return actions.length ? <section key={group.priority} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h3 className="text-sm font-semibold text-slate-900">{group.title}</h3><p className="mt-0.5 text-xs text-slate-500">{group.description}</p></div><Badge tone={tones[group.priority]}>{group.impact} impact</Badge></div><div className="divide-y divide-slate-200">{actions.map((item) => <article key={`${item.requirement}-${item.priority}`} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.65fr)] sm:gap-x-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-950">{item.requirement}</h4><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{item.category}</span></div><p className="mt-1 truncate text-xs leading-5 text-slate-500" title={item.whyItMatters}>{item.whyItMatters}</p></div><div className="flex items-start gap-2 text-xs leading-5 text-slate-600"><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-slate-400" /><span><span className="font-semibold text-slate-700">Next:</span> {item.nextStep || item.practicalAction || item.evidenceSuggestion}</span></div></article>)}</div></section> : null
    })}</div> : <EmptyState className="mt-5" icon={CheckCircle2} title="No priority requirement gaps found" description="Keep the current evidence measurable and rerun analysis when the target job description changes." />}

    {allGaps.length > visiblePlan.length ? <details className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">View all {allGaps.length} recorded gaps</summary><div className="mt-3 flex flex-wrap gap-2">{allGaps.map((item) => <Badge key={`all-${item.requirement}`} tone={tones[item.priority]}>{item.requirement}</Badge>)}</div></details> : null}
  </Card>
}
