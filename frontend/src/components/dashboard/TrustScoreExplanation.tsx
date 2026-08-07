import { Calculator, ChevronDown, Gauge, Info, Layers, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
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

// Purely presentational verdict copy derived from the score. No new data,
// no new logic — just a friendlier way to say what the number already means.
// Tone is intentionally uniform (monochrome) — weight is carried by wording
// and icon, not by color.
function verdictCopy(score: number): { headline: string } {
  if (score >= 75) return { headline: 'Strong, well-evidenced profile' }
  if (score >= 55) return { headline: 'Solid profile with a few gaps' }
  return { headline: 'Early-stage profile, evidence still thin' }
}

// Quick-scan strip helper: turns each factor into a one-glance chip so a
// recruiter can read the shape of the score before opening any accordion.
// Strength is communicated with fill weight (dark/mid/light), not hue.
function factorGlance(factor: TrustScoreFactor, displayScore: number) {
  const maximum = factor.maximumScore ?? factor.weight
  const pct = factor.basisPercentage ?? Math.round((displayScore / Math.max(1, maximum)) * 100)
  const strong = pct >= 70
  const mid = pct >= 40 && pct < 70
  return { maximum, pct, strong, mid }
}

export default function TrustScoreExplanation({ trustCard, isDemoMode }: { trustCard?: ExplainableTrustScore; isDemoMode: boolean }) {
  const [showFormula, setShowFormula] = useState(false)
  const [showReliability, setShowReliability] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const displayedScores = trustCard?.scoreBreakdown.map((factor) => (
    factor.maximumScore === undefined || factor.maximumScore === null
      ? Math.round(factor.contribution)
      : factor.score
  )) ?? []
  const componentTotal = displayedScores.reduce((sum, score) => sum + score, 0)
  const reconciles = Boolean(trustCard) && displayedScores.length === 5 && componentTotal === trustCard?.trustScore
  const ringPct = trustCard ? Math.max(0, Math.min(100, trustCard.trustScore)) : 0
  const verdict = trustCard ? verdictCopy(trustCard.trustScore) : null
  const strongCount = trustCard ? trustCard.scoreBreakdown.filter((f, i) => factorGlance(f, displayedScores[i]).strong).length : 0

  return (
    <div id="trust-score-explanation" data-testid="trust-score-explanation">
      <Card className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.18)]">

        {/* ── Verdict hero: the 10-second read ── */}
        <div className="relative border-b border-black/10 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.035),transparent_55%)] p-6 sm:p-9 lg:p-12">

          {/* Dial + verdict */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div
              className="relative flex size-[136px] shrink-0 items-center justify-center rounded-full p-[3px] shadow-[0_18px_36px_-18px_rgba(0,0,0,0.45)]"
              style={{ background: `conic-gradient(#000000 ${ringPct * 3.6}deg, #E7E5E4 ${ringPct * 3.6}deg)` }}
            >
              <div className="flex size-full flex-col items-center justify-center rounded-full bg-white ring-1 ring-black/5">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">{trustCard?.trustScore ?? '—'}</span>
                <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">out of 100</span>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45 sm:justify-start">
                <Sparkles className="size-3" aria-hidden="true" />
                Explainable Candidate Trust Score
              </p>
              {verdict ? (
                <>
                  <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-black sm:text-[30px]">{verdict.headline}</h1>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <Badge tone="neutral" className="rounded-full border border-black bg-black px-3 py-1 text-white">
                      <TrendingUp className="mr-1.5 size-3.5" />{strongCount} of {trustCard!.scoreBreakdown.length} components strong
                    </Badge>
                    <Badge tone="neutral" className="rounded-full border border-black/12 bg-white px-3 py-1 text-black/60">{isDemoMode ? 'Isolated demo' : trustCard?.analysisReliability?.label ?? 'Reliability not recorded'}</Badge>
                  </div>
                </>
              ) : (
                <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-black sm:text-[30px]">Score not yet generated</h1>
              )}
              <span className="mt-2.5 block text-xs font-medium text-black/35">{trustCard?.scoreVersion ? `Score version ${trustCard.scoreVersion}` : 'Saved score'}</span>
            </div>
          </div>

          {/* Quick-scan strip: five components at a glance, no reading required.
              Full-width row of its own so every card gets real room to breathe. */}
          {trustCard ? (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {trustCard.scoreBreakdown.map((factor, index) => {
                const glance = factorGlance(factor, displayedScores[index])
                const dot = glance.strong ? 'bg-black' : glance.mid ? 'bg-black/40' : 'bg-black/15'
                return (
                  <div key={factor.key} className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_12px_24px_-16px_rgba(0,0,0,0.35)]">
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-1 size-1.5 shrink-0 rounded-full transition-colors duration-200 ${dot}`} />
                      <p className="text-[10.5px] font-semibold uppercase leading-tight tracking-[0.06em] text-black/45">{factor.label}</p>
                    </div>
                    <p className="mt-3 text-xl font-semibold tracking-[-0.01em] tabular-nums text-black">{displayedScores[index]}<span className="text-xs font-medium text-black/30"> /{glance.maximum}</span></p>
                  </div>
                )
              })}
            </div>
          ) : null}

          {trustCard ? (
            <p className="mt-8 flex items-center gap-1.5 text-sm font-medium text-black/50">Five factors, one score <span aria-hidden="true">→</span> tap any card below to see why.</p>
          ) : null}

          {trustCard?.analysisReliability ? (
            <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.025] p-1.5">
              <button
                type="button"
                aria-expanded={showReliability}
                aria-controls="trust-score-reliability"
                onClick={() => setShowReliability((value) => !value)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-black/[0.03]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-white">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-black">How reliable is this? <span className="font-normal text-black/40">· {trustCard.analysisReliability.label}</span></span>
                <ChevronDown className={`size-4 shrink-0 text-black/40 transition-transform duration-200 ${showReliability ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {showReliability ? (
                <div id="trust-score-reliability" className="animate-in fade-in slide-in-from-top-1 px-4 pb-3.5 pt-1 duration-200">
                  <p className="text-sm leading-6 text-black/60">{trustCard.analysisReliability.basis}</p>
                  <p className="mt-1.5 text-xs leading-5 text-black/45"><span className="font-semibold text-black/70">Limitation:</span> {trustCard.analysisReliability.limitations}</p>
                </div>
              ) : null}
            </div>
          ) : trustCard ? <p className="mt-6 text-xs leading-5 text-black/40">This older saved Trust Card does not include an Analysis Reliability assessment.</p> : null}
        </div>

        {/* ── Component breakdown ── */}
        <div className="bg-white p-6 sm:p-9 lg:p-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                <Layers className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/40">The breakdown</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-black sm:text-2xl">Why this score?</h2>
              </div>
            </div>
            {trustCard ? (
              <button
                type="button"
                aria-expanded={showFormula}
                aria-controls="trust-score-formula"
                onClick={() => setShowFormula((value) => !value)}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-black transition-colors duration-200 hover:border-black hover:bg-black hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                <Calculator className="mr-2 size-4" aria-hidden="true" />Show the math
                <ChevronDown className={`ml-2 size-4 transition-transform duration-200 ${showFormula ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {trustCard ? (
            <>
              {showFormula ? (
                <div id="trust-score-formula" className="mt-5 animate-in fade-in slide-in-from-top-1 rounded-2xl border border-black/10 bg-black/[0.02] p-5 duration-200">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Formula</p>
                  <p className="mt-2 font-mono text-sm font-medium leading-6 text-black/80">{trustCard.scoreFormula || 'The saved component contributions are added to produce the score out of 100.'}</p>
                  <p className="mt-3 text-xs leading-5 text-black/40">Just math — the AI writes the summary, never the number.</p>
                </div>
              ) : null}

              <p className="mt-7 text-sm font-medium text-black/45">Tap a card for the receipts 👇</p>

              <div className="mt-4 space-y-3">
                {trustCard.scoreBreakdown.map((factor, index) => (
                  <TrustScoreComponentPanel key={factor.key} factor={factor} displayScore={displayedScores[index]} reliabilityLabel={trustCard.analysisReliability?.label} />
                ))}
              </div>

              {/* Reconciliation, reframed as a checklist-style confidence callout.
                  Distinguished by icon and border weight rather than color. */}
              <div className={`mt-7 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors duration-200 ${reconciles ? 'border-black bg-black/[0.03]' : 'border-dashed border-black/20 bg-white'}`}>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${reconciles ? 'bg-black text-white' : 'bg-black/5 text-black/35'}`}>
                  <Gauge className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-black">
                  {componentTotal} / 100 {reconciles ? <span className="font-normal text-black/50">— checks out exactly ✓</span> : <span className="font-normal text-black/50">— older card, no full breakdown saved</span>}
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  aria-expanded={showInfo}
                  aria-controls="trust-score-info"
                  onClick={() => setShowInfo((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-full px-1 text-xs font-semibold text-black/40 transition-colors duration-200 hover:text-black"
                >
                  <Info className="size-3.5" aria-hidden="true" />
                  What counts as evidence?
                  <ChevronDown className={`size-3.5 transition-transform duration-200 ${showInfo ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {showInfo ? (
                  <p id="trust-score-info" className="animate-in fade-in slide-in-from-top-1 mt-2 rounded-2xl bg-black/[0.025] p-4 text-xs leading-5 text-black/45 duration-200">Evidence labels describe what RefAI extracted from student-provided records. They do not independently verify a claim. AI-generated narrative wording is advisory and is not presented as verified evidence.</p>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState className="mt-8 rounded-2xl border-black/10 bg-black/[0.02]" icon={ShieldCheck} title="No score yet" description="Run the resume analysis and your Trust Card — score, breakdown, and evidence — shows up right here." />
          )}
        </div>
      </Card>
    </div>
  )
}