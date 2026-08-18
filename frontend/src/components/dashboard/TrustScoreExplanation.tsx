import { Calculator, ChevronDown, Gauge, Info, Layers, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { AnalysisReliability, TrustScoreFactor, TrustCardResult } from '../../types'
import { Badge, Card, EmptyState } from './primitives'
import TrustScoreComponentPanel from './TrustScoreComponentPanel'

type ExplainableTrustScore = Pick<TrustCardResult, 'trustScore'> & {
  scoreBreakdown: TrustScoreFactor[]
  scoreFormula?: string | null
  scoreVersion?: string | null
  analysisReliability?: AnalysisReliability | null
}

function contributionTone(percentage: number) {
  if (percentage >= 70) return 'bg-slate-950'
  if (percentage >= 40) return 'bg-slate-500'
  return 'bg-slate-300'
}

export default function TrustScoreExplanation({ trustCard }: { trustCard?: ExplainableTrustScore }) {
  const [showFormula, setShowFormula] = useState(false)
  const [showReliability, setShowReliability] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const displayedScores = trustCard?.scoreBreakdown.map((factor) => (
    factor.maximumScore === undefined || factor.maximumScore === null ? Math.round(factor.contribution) : factor.score
  )) ?? []
  const componentTotal = displayedScores.reduce((sum, score) => sum + score, 0)
  const reconciles = Boolean(trustCard) && displayedScores.length === 5 && componentTotal === trustCard?.trustScore

  return <div id="trust-score-explanation" data-testid="trust-score-explanation"><Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><Layers className="size-4" aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Score Breakdown</p><h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950">Five components, one deterministic score</h2></div></div><div className="flex flex-wrap gap-2">{trustCard?.analysisReliability ? <Badge tone="neutral">{trustCard.analysisReliability.label}</Badge> : null}{trustCard ? <button type="button" aria-expanded={showFormula} aria-controls="trust-score-formula" onClick={() => setShowFormula((value) => !value)} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"><Calculator className="mr-1.5 size-3.5" aria-hidden="true" />Formula<ChevronDown className={`ml-1.5 size-3.5 transition-transform ${showFormula ? 'rotate-180' : ''}`} aria-hidden="true" /></button> : null}</div></div>
      {showFormula ? <div id="trust-score-formula" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Saved formula</p><p className="mt-2 font-mono text-xs leading-5 text-slate-700">{trustCard?.scoreFormula || 'The saved component contributions are added to produce the score out of 100.'}</p><p className="mt-2 text-xs text-slate-500">AI may word summaries but never calculates this score.</p></div> : null}
      {trustCard?.analysisReliability ? <div className="mt-3"><button type="button" aria-expanded={showReliability} aria-controls="trust-score-reliability" onClick={() => setShowReliability((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"><ShieldCheck className="size-3.5" aria-hidden="true" />Reliability details<ChevronDown className={`size-3.5 transition-transform ${showReliability ? 'rotate-180' : ''}`} aria-hidden="true" /></button>{showReliability ? <div id="trust-score-reliability" className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p>{trustCard.analysisReliability.basis}</p><p className="mt-1"><span className="font-semibold text-slate-700">Limitation:</span> {trustCard.analysisReliability.limitations}</p></div> : null}</div> : null}
    </div>
    {trustCard ? <div className="p-5 sm:p-6"><div className="grid grid-cols-5 gap-2" aria-label="Component contribution chart">{trustCard.scoreBreakdown.map((factor, index) => { const maximum = factor.maximumScore ?? factor.weight; const score = displayedScores[index]; const percentage = factor.basisPercentage ?? Math.round((score / Math.max(1, maximum)) * 100); return <div key={factor.key} className="min-w-0"><div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`h-full rounded-full ${contributionTone(percentage)}`} style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div><p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500" title={factor.label}>{factor.label}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-950">{score}<span className="text-[11px] font-medium text-slate-400">/{maximum}</span></p></div> })}</div>
      <div className="mt-5 space-y-2.5">{trustCard.scoreBreakdown.map((factor, index) => <TrustScoreComponentPanel key={factor.key} factor={factor} displayScore={displayedScores[index]} reliabilityLabel={trustCard.analysisReliability?.label} />)}</div>
      <div className={`mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${reconciles ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-dashed border-slate-300 text-slate-500'}`}><Gauge className="size-3.5 shrink-0" aria-hidden="true" /><span className="font-semibold tabular-nums">{componentTotal} / 100</span><span>{reconciles ? 'Component contributions reconcile with the Trust Score.' : 'Older card: the full component breakdown was not saved.'}</span></div>
      <div className="mt-3"><button type="button" aria-expanded={showInfo} aria-controls="trust-score-info" onClick={() => setShowInfo((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"><Info className="size-3.5" aria-hidden="true" />What counts as evidence?<ChevronDown className={`size-3.5 transition-transform ${showInfo ? 'rotate-180' : ''}`} aria-hidden="true" /></button>{showInfo ? <p id="trust-score-info" className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Evidence labels describe what RefAI extracted from student-provided records. They do not independently verify a claim. AI-generated narrative wording is advisory and is not presented as verified evidence.</p> : null}</div>
    </div> : <EmptyState className="m-5" icon={ShieldCheck} title="No score yet" description="Run the resume analysis and your Trust Card — score, breakdown, and evidence — shows up here." />}
  </Card></div>
}
