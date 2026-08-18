import { ChevronDown, FileQuestion, FileText, Lightbulb, ShieldCheck } from 'lucide-react'
import type { AnalysisReliabilityLabel, TrustScoreEvidenceItem, TrustScoreEvidenceStatus, TrustScoreFactor } from '../../types'
import { Badge, ProgressBar } from './primitives'

type Props = {
  factor: TrustScoreFactor
  displayScore: number
  reliabilityLabel?: AnalysisReliabilityLabel | null
}

const statusLabel = (status: TrustScoreEvidenceStatus) => {
  if (status === 'Verified evidence') return 'Verified'
  if (status === 'Resume supported') return 'Resume evidence'
  if (status === 'Self-declared') return 'Self-declared'
  if (status === 'Needs clarification') return 'Needs clarity'
  return status
}

const statusTone = (status: TrustScoreEvidenceStatus): 'success' | 'info' | 'warning' | 'neutral' => {
  if (status === 'Verified evidence') return 'success'
  if (status === 'Resume supported') return 'info'
  if (status === 'Needs clarification' || status === 'Missing evidence') return 'warning'
  return 'neutral'
}

function legacyEvidence(factor: TrustScoreFactor): TrustScoreEvidenceItem[] {
  const found = factor.evidenceFound ?? []
  const missing = factor.evidenceMissing ?? []
  return [
    ...found.map((item, index) => ({
      id: `LEGACY-FOUND-${index + 1}`,
      status: item.startsWith('Resume:') ? 'Resume supported' as const : 'Self-declared' as const,
      factLabel: 'Saved evidence summary',
      snippet: item.startsWith('Resume:') ? item.slice('Resume:'.length).trim() : null,
      resumeSection: null,
      whyItAffectsScore: item,
      sourceType: item.startsWith('Resume:') ? 'resume' as const : 'derived' as const,
    })),
    ...missing.map((item, index) => ({
      id: `LEGACY-MISSING-${index + 1}`,
      status: 'Missing evidence' as const,
      factLabel: 'Saved evidence gap',
      snippet: null,
      resumeSection: null,
      whyItAffectsScore: item,
      sourceType: 'missing' as const,
    })),
  ]
}

function componentStatus(items: TrustScoreEvidenceItem[]): TrustScoreEvidenceStatus {
  if (items.some((item) => item.status === 'Needs clarification')) return 'Needs clarification'
  if (items.some((item) => item.status === 'Verified evidence')) return 'Verified evidence'
  if (items.some((item) => item.status === 'Resume supported')) return 'Resume supported'
  if (items.some((item) => item.status === 'Self-declared')) return 'Self-declared'
  return 'Missing evidence'
}

export default function TrustScoreComponentPanel({ factor, displayScore, reliabilityLabel }: Props) {
  const maximum = factor.maximumScore ?? factor.weight
  const basisPercentage = factor.basisPercentage ?? Math.round((displayScore / Math.max(1, maximum)) * 100)
  const evidenceItems = factor.evidenceItems?.length ? factor.evidenceItems : legacyEvidence(factor)
  const found = evidenceItems.filter((item) => item.status !== 'Missing evidence')
  const missing = evidenceItems.filter((item) => item.status === 'Missing evidence')
  const evidenceStatus = componentStatus(evidenceItems)
  const potential = factor.potentialImprovementPoints ?? Math.max(0, maximum - displayScore)
  const status = basisPercentage >= 70 ? 'Strong' : basisPercentage >= 40 ? 'Developing' : 'Needs improvement'
  const formula = factor.formulaOrBasis
    ?? `${factor.reason} Weighted contribution: ${displayScore} of ${maximum} points.`
  const action = factor.improvementAction
    ?? (potential > 0 ? 'Add truthful, role-relevant evidence for this component.' : 'Preserve the supporting evidence in future resume updates.')
  const limitation = factor.limitation
    ?? 'This older saved score contains a summary but not the newer structured evidence references.'

  return (
    <details data-testid={`trust-score-component-${factor.key}`} className="group rounded-xl border border-slate-200 bg-white transition open:border-slate-300 open:shadow-sm">
      <summary aria-label={`Review ${factor.label}: ${displayScore} of ${maximum} points`} className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_minmax(145px,0.7fr)_auto_auto] sm:items-center sm:gap-x-4">
        <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-slate-950">{factor.label}</h3><span className={`size-1.5 shrink-0 rounded-full ${basisPercentage >= 70 ? 'bg-emerald-500' : basisPercentage >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`} aria-hidden="true" /></div><p className="mt-1 truncate text-xs leading-5 text-slate-500" title={factor.reason}>{factor.reason}</p></div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"><ProgressBar value={basisPercentage} /></div>
        <div className="flex items-center gap-2 sm:col-start-3 sm:row-start-1"><Badge tone={statusTone(evidenceStatus)}>{statusLabel(evidenceStatus)}</Badge><span className="text-[11px] font-medium text-slate-500">{reliabilityLabel ? `${status} · ${reliabilityLabel}` : status}</span></div>
        <div className="col-start-2 row-start-1 flex items-center gap-2 sm:col-start-4"><span className="text-sm font-semibold tabular-nums text-slate-950">{displayScore}<span className="text-xs font-medium text-slate-400">/{maximum}</span></span><ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" /></div>
      </summary>

      <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><FileText className="size-3.5" aria-hidden="true" />Calculation basis</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{formula}</p>
          </section>
          <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700"><Lightbulb className="size-3.5" aria-hidden="true" />Improvement action</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{action}</p>
            <p className="mt-2 text-xs font-medium text-blue-800">Up to {potential} potential point{potential === 1 ? '' : 's'}; not guaranteed.</p>
          </section>
        </div>

        <section className="mt-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600"><ShieldCheck className="size-3.5" aria-hidden="true" />Supporting evidence</p>
          {found.length ? <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {found.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{item.factLabel}</p><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></div>
              {item.snippet ? <blockquote className="mt-3 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-700">“{item.snippet}”</blockquote> : <p className="mt-3 text-sm leading-6 text-slate-500">No direct resume line was saved for this derived signal.</p>}
              <dl className="mt-3 grid gap-1 text-xs leading-5 text-slate-500">
                <div><dt className="inline font-semibold text-slate-600">Resume section: </dt><dd className="inline">{item.resumeSection ?? 'Derived across resume structure'}</dd></div>
                <div><dt className="inline font-semibold text-slate-600">Why it matters: </dt><dd className="inline">{item.whyItAffectsScore}</dd></div>
                {!item.id.startsWith('LEGACY-') ? <div><dt className="inline font-semibold text-slate-600">Evidence ref: </dt><dd className="inline font-mono">{item.id}</dd></div> : null}
              </dl>
            </article>)}
          </div> : <p className="mt-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-600">No supporting snippet was saved for this component.</p>}
        </section>

        <section className="mt-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-700"><FileQuestion className="size-3.5" aria-hidden="true" />Missing evidence or clarification</p>
          {missing.length ? <ul className="mt-2 space-y-2">
            {missing.map((item) => <li key={item.id} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm leading-5 text-slate-700"><span className="font-semibold">{item.factLabel}:</span> {item.whyItAffectsScore}</li>)}
          </ul> : <p className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">No missing evidence was identified by this deterministic check.</p>}
        </section>

        <p className="mt-4 text-xs leading-5 text-slate-500"><span className="font-semibold">Limitation:</span> {limitation}</p>
      </div>
    </details>
  )
}
