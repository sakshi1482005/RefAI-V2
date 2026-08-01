import { ArrowUpRight, RefreshCw, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ImprovementSimulatorResult } from '../../types'
import { Badge, Card, EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

export default function ImprovementSimulatorPanel() {
  const [result, setResult] = useState<ImprovementSimulatorResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    setLoading(true); setError(null)
    try { const { data } = await api.get<ImprovementSimulatorResult>('/resume/analysis/improvement-simulator'); setResult(data) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Improvement opportunities could not be loaded.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  return <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><TrendingUp className="size-5" /><div><h3 className="text-lg font-semibold">Smart Improvement Simulator</h3><p className="mt-1 text-sm text-slate-500">What would improve my score the most?</p></div></div>
    {loading ? <div className="mt-5 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : null}
    {error ? <div className="mt-5"><InlineFeedback tone="error">{error}</InlineFeedback><SecondaryButton className="mt-3" onClick={load}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></div> : null}
    {result && !result.suggestions.length ? <EmptyState className="mt-5" icon={TrendingUp} title="No remaining component capacity" description="The current deterministic breakdown does not expose additional potential points. Preserve truthful, specific evidence when updating the resume." /> : null}
    {result?.suggestions.length ? <div className="mt-5 space-y-3">{result.suggestions.map((suggestion, index) => <details key={suggestion.componentKey} className="rounded-xl border border-slate-200 p-4" open={index === 0}><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">{suggestion.affectedComponent}</p><p className="mt-1 text-sm font-semibold">{suggestion.recommendedAction}</p></div><Badge tone="info">Up to +{suggestion.maximumPotentialPoints}</Badge></div></summary><div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-600">Missing evidence</p>{suggestion.missingEvidence.map((item) => <p key={item} className="mt-1 text-xs leading-5 text-slate-500">• {item}</p>)}<p className="mt-3 text-[11px] leading-5 text-slate-500">{suggestion.limitation}</p></div></details>)}</div> : null}
    {result?.comparison ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Same-opportunity comparison</p><p className="mt-1 text-sm font-semibold">Previous {result.comparison.previousScore} → Current {result.comparison.currentScore}</p></div><Badge tone={result.comparison.delta >= 0 ? 'success' : 'warning'}>{result.comparison.delta >= 0 ? '+' : ''}{result.comparison.delta} points</Badge></div><div className="mt-3 space-y-2">{result.comparison.componentDeltas.filter((item) => item.delta !== 0 || item.evidenceCausingChange.length).map((item) => <details key={item.componentKey} className="rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold">{item.component}: {item.delta >= 0 ? '+' : ''}{item.delta}</summary>{item.evidenceCausingChange.map((evidence) => <p key={evidence} className="mt-2 text-xs leading-5 text-slate-500"><ArrowUpRight className="mr-1 inline size-3" />{evidence}</p>)}</details>)}</div></div> : null}
    {result ? <div className="mt-4"><p className="text-xs font-medium text-slate-600">Total remaining potential across components: up to {result.totalMaximumPotentialPoints} points</p>{result.limitations.map((item) => <p key={item} className="mt-1 text-[11px] leading-5 text-slate-500">{item}</p>)}</div> : null}
  </Card>
}
