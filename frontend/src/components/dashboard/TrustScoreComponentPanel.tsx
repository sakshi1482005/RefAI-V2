import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Lightbulb } from 'lucide-react'
import type { TrustScoreFactor } from '../../types'
import { ProgressBar } from './primitives'

type Props = {
  factor: TrustScoreFactor
  displayScore: number
}

export default function TrustScoreComponentPanel({ factor, displayScore }: Props) {
  const maximum = factor.maximumScore ?? factor.weight
  const basisPercentage = factor.basisPercentage ?? Math.round((displayScore / Math.max(1, maximum)) * 100)
  const found = factor.evidenceFound?.length ? factor.evidenceFound : [factor.reason]
  const missing = factor.evidenceMissing ?? []
  const potential = factor.potentialImprovementPoints ?? Math.max(0, maximum - displayScore)
  const isStrong = basisPercentage >= 70
  const formula = factor.formulaOrBasis
    ?? `${factor.reason} Weighted contribution: ${displayScore} of ${maximum} points.`
  const action = factor.improvementAction
    ?? (potential > 0 ? 'Add truthful, role-relevant evidence for this component.' : 'Preserve the supporting evidence in future resume updates.')
  const limitation = factor.limitation
    ?? 'This older saved score contains a summary but not the newer structured explanation fields.'

  return (
    <details className="group rounded-xl border border-slate-200 bg-white open:border-slate-300 open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:p-5">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isStrong ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {isStrong ? <CheckCircle2 className="size-4.5" /> : <AlertTriangle className="size-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-950">{factor.label}</h3>
            <p className="font-semibold text-slate-950">{displayScore} / {maximum}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">{basisPercentage}% calculation basis · up to {potential} more point{potential === 1 ? '' : 's'}</p>
          <div className="mt-3"><ProgressBar value={basisPercentage} /></div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><FileText className="size-3.5" />Calculation</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{formula}</p>
          </section>
          <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700"><Lightbulb className="size-3.5" />Improvement action</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{action}</p>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Evidence found</p>
            <ul className="mt-2 space-y-2">
              {found.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm leading-5 text-slate-700">{item}</li>)}
            </ul>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">Evidence not observed</p>
            {missing.length ? <ul className="mt-2 space-y-2">
              {missing.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm leading-5 text-slate-700">{item}</li>)}
            </ul> : <p className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">No missing evidence was identified by this deterministic check.</p>}
          </section>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500"><span className="font-semibold">Limitation:</span> {limitation}</p>
      </div>
    </details>
  )
}
