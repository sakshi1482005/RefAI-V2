import { ArrowRight, CheckCircle2, Clock3, ListChecks } from 'lucide-react'
import type { ActionPlanItem } from '../../types'
import { Badge, Card, EmptyState } from './primitives'

const tones = { critical: 'danger', important: 'warning', optional: 'neutral' } as const

export default function ActionPlanPanel({ plan, allGaps, className = '' }: { plan: ActionPlanItem[]; allGaps: ActionPlanItem[]; className?: string }) {
  const visiblePlan = plan.slice(0, 3)
  return (
    <Card className={`p-6 sm:p-8 ${className}`}>
      <div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ListChecks className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action Plan</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Close the highest-priority evidence gaps</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Start with the top three requirements. Each action explains why the gap matters and what evidence to create before rerunning analysis.</p></div></div>

      {visiblePlan.length ? <div className="mt-7 grid gap-4 xl:grid-cols-3">{visiblePlan.map((item, index) => <article key={`${item.requirement}-${item.priority}`} className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Priority {index + 1}</p><h3 className="mt-2 text-lg font-semibold">{item.requirement}</h3><p className="mt-1 text-xs capitalize text-slate-500">{item.category}</p></div><Badge tone={tones[item.priority]}>{item.priority}</Badge></div>
        <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><div><p className="font-semibold text-slate-900">Why it matters</p><p className="mt-1">{item.whyItMatters}</p></div><div><p className="font-semibold text-slate-900">Practical action</p><p className="mt-1">{item.practicalAction}</p></div><div><p className="font-semibold text-slate-900">Project or evidence suggestion</p><p className="mt-1">{item.evidenceSuggestion}</p></div></div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600"><Clock3 className="size-4" />Estimated effort: {item.estimatedEffort}</div>
        <div className="mt-4 flex gap-2 text-sm leading-6 text-slate-700"><ArrowRight className="mt-1 size-4 shrink-0" /><span><strong>Next step:</strong> {item.nextStep}</span></div>
      </article>)}</div> : <EmptyState className="mt-7" icon={CheckCircle2} title="No priority requirement gaps found" description="Keep the current evidence measurable and rerun analysis when the target job description changes." />}

      {allGaps.length > visiblePlan.length ? <details className="mt-6 rounded-xl border border-slate-200 p-5"><summary className="cursor-pointer font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">View all {allGaps.length} missing requirements</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{allGaps.map((item) => <div key={`all-${item.requirement}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-4"><div><p className="text-sm font-semibold">{item.requirement}</p><p className="mt-1 text-xs capitalize text-slate-500">{item.category}</p></div><Badge tone={tones[item.priority]}>{item.priority}</Badge></div>)}</div></details> : null}
    </Card>
  )
}
