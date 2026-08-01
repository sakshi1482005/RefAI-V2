import { ShieldCheck } from 'lucide-react'
import type { TrustCardResult } from '../../types'
import { Badge, Card, EmptyState } from './primitives'
import TrustScoreComponentPanel from './TrustScoreComponentPanel'

export default function TrustScoreExplanation({ trustCard, isDemoMode }: { trustCard?: TrustCardResult; isDemoMode: boolean }) {
  const displayedScores = trustCard?.scoreBreakdown.map((factor) => (
    factor.maximumScore === undefined || factor.maximumScore === null
      ? Math.round(factor.contribution)
      : factor.score
  )) ?? []
  if (trustCard && displayedScores.length) {
    const difference = trustCard.trustScore - displayedScores.reduce((sum, score) => sum + score, 0)
    displayedScores[displayedScores.length - 1] += difference
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Explain Score</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">How the Trust Score is calculated</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Trust Score is a deterministic weighted result returned by the backend. It is separate from Overall Match, Analysis Reliability, and readiness.</p>
        </div>
        <Badge tone={trustCard ? isDemoMode ? 'warning' : 'success' : 'warning'}>{trustCard ? `Trust Score · ${trustCard.trustScore}${isDemoMode ? ' · Demo' : ''}` : 'Awaiting Trust Card'}</Badge>
      </div>

      {trustCard ? <>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Formula</p><p className="mt-2 text-sm font-medium leading-6 text-slate-800">{trustCard.scoreFormula}</p></div>
        <div className="mt-7 space-y-3">
          {trustCard.scoreBreakdown.map((factor, index) => <TrustScoreComponentPanel key={factor.key} factor={factor} displayScore={displayedScores[index]} />)}
        </div>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div><p className="font-semibold text-emerald-950">Weighted result: {displayedScores.reduce((sum, score) => sum + score, 0)} / 100</p><p className="mt-1 text-sm leading-6 text-emerald-800">The five displayed component scores add exactly to the Candidate Trust Score. Indicators summarize observed evidence and do not imply certainty.</p></div></div></div>
      </> : <EmptyState className="mt-7" icon={ShieldCheck} title="Generate a Trust Card to calculate the score" description="Complete resume analysis first. RefAI will then return the Trust Score, its weighted factors, readiness, and employee recommendation together." />}
    </Card>
  )
}
