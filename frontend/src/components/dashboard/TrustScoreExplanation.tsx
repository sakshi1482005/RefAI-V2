import { FileText, ShieldCheck } from 'lucide-react'
import type { TrustCardResult } from '../../types'
import { Badge, Card, EmptyState, ProgressBar } from './primitives'

export default function TrustScoreExplanation({ trustCard, isDemoMode }: { trustCard?: TrustCardResult; isDemoMode: boolean }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Explain Score</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">How the Trust Score is calculated</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Trust Score is a deterministic weighted result returned by the backend. It is separate from Overall Match, confidence, and readiness.</p>
        </div>
        <Badge tone={trustCard ? isDemoMode ? 'warning' : 'success' : 'warning'}>{trustCard ? `Trust Score · ${trustCard.trustScore}${isDemoMode ? ' · Demo' : ''}` : 'Awaiting Trust Card'}</Badge>
      </div>

      {trustCard ? <>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Formula</p><p className="mt-2 text-sm font-medium leading-6 text-slate-800">{trustCard.scoreFormula}</p></div>
        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {trustCard.scoreBreakdown.map((factor) => <article key={factor.key} className="rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{factor.label}</h3><p className="mt-1 text-xs text-slate-500">Weight {factor.weight}% · contributes {factor.contribution.toFixed(2)} points</p></div><div className="text-right"><p className="text-2xl font-semibold">{factor.score}</p><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Input score</p></div></div>
            <div className="mt-4"><ProgressBar value={factor.score} /></div>
            <div className="mt-5 rounded-lg bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><FileText className="size-3.5" />Why it contributes</p><p className="mt-2 text-sm leading-6 text-slate-700">{factor.reason}</p></div>
          </article>)}
        </div>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Weighted result: {trustCard.trustScore}</p><p className="mt-1 text-sm leading-6 text-emerald-800">The six weights total 100%. Readiness is assigned separately from this rounded weighted score.</p></div></div></div>
      </> : <EmptyState className="mt-7" icon={ShieldCheck} title="Generate a Trust Card to calculate the score" description="Complete resume analysis first. RefAI will then return the Trust Score, its weighted factors, readiness, and employee recommendation together." />}
    </Card>
  )
}
