import { AlertTriangle, CheckCircle2, ChevronDown, FileQuestion, FileText, Lightbulb, ShieldCheck } from 'lucide-react'
import type { AnalysisReliabilityLabel, TrustScoreEvidenceItem, TrustScoreEvidenceStatus, TrustScoreFactor } from '../../types'
import { Badge, ProgressBar } from './primitives'

type Props = {
  factor: TrustScoreFactor
  displayScore: number
  reliabilityLabel?: AnalysisReliabilityLabel | null
}

const statusLabel = (status: TrustScoreEvidenceStatus) => {
  if (status === 'Resume supported') return 'Extracted resume evidence'
  if (status === 'Self-declared') return 'Self-declared claim'
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
  const isStrong = basisPercentage >= 70
  const formula = factor.formulaOrBasis
    ?? `${factor.reason} Weighted contribution: ${displayScore} of ${maximum} points.`
  const action = factor.improvementAction
    ?? (potential > 0 ? 'Add truthful, role-relevant evidence for this component.' : 'Preserve the supporting evidence in future resume updates.')
  const limitation = factor.limitation
    ?? 'This older saved score contains a summary but not the newer structured evidence references.'

  return (
    <details data-testid={`trust-score-component-${factor.key}`} className="group rounded-xl border border-slate-200 bg-white shadow-sm transition open:border-slate-300 open:shadow-md">
      <summary aria-label={`Review ${factor.label}: ${displayScore} of ${maximum} points`} className="flex cursor-pointer list-none items-start gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset sm:items-center sm:gap-4 sm:p-5">
        <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full sm:mt-0 ${isStrong ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {isStrong ? <CheckCircle2 className="size-4.5" aria-hidden="true" /> : <AlertTriangle className="size-4.5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-950 sm:text-base">{factor.label}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">{factor.reason}</p>
            </div>
            <div className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-right"><p className="text-lg font-semibold leading-none text-slate-950">{displayScore}<span className="text-sm font-medium text-slate-500"> / {maximum}</span></p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">points</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(evidenceStatus)}>{statusLabel(evidenceStatus)}</Badge>
            <span className="text-xs text-slate-500">{reliabilityLabel ?? 'Reliability not recorded'}</span>
            <span className="text-xs text-slate-400">Maximum {maximum} points</span>
          </div>
          <div className="mt-3"><ProgressBar value={basisPercentage} /></div>
        </div>
        <ChevronDown className="mt-2 size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 sm:mt-0" aria-hidden="true" />
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
