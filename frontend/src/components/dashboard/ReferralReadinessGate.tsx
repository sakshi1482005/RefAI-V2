import { ArrowRight, ShieldCheck } from 'lucide-react'
import type { ReferralReadinessGateResult } from '../../lib/referralReadiness'
import { Badge, InlineFeedback, PrimaryButton, SecondaryButton } from './primitives'

export default function ReferralReadinessGate({ readiness, submitting, onImprove, onContinue }: {
  readiness: ReferralReadinessGateResult
  submitting: boolean
  onImprove: () => void
  onContinue: () => void
}) {
  const weaker = readiness.label !== 'Strong'
  return <div className={`mt-5 rounded-xl border p-5 ${weaker ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Referral readiness</p><h3 className="mt-1 text-lg font-semibold">Review before final submission</h3></div><Badge tone={readiness.label === 'Strong' ? 'success' : 'warning'}>{readiness.label}</Badge></div>
    <p className="mt-3 text-sm leading-6 text-slate-700">{readiness.basis}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <ReadinessFacts title="Strongest evidence" values={readiness.strongestEvidence} empty="No concise evidence summary was recorded." />
      <ReadinessFacts title="Major missing evidence" values={readiness.majorMissingEvidence} empty="No major evidence gap was recorded." />
      <ReadinessFacts title="Required skills unsupported" values={readiness.unsupportedRequiredSkills} empty="No unsupported required skill was recorded." />
    </div>
    <div className="mt-4"><InlineFeedback tone="info"><ShieldCheck className="mr-2 inline size-4" />This readiness check is advisory. Improving first or continuing now has no negative effect on the Candidate Trust Score.</InlineFeedback></div>
    <div className="mt-4 flex flex-wrap gap-3">{weaker ? <SecondaryButton onClick={onImprove}>Improve profile first</SecondaryButton> : null}<PrimaryButton onClick={onContinue} loading={submitting}>{weaker ? 'Continue anyway' : 'Continue to submit'}<ArrowRight className="ml-2 size-4" /></PrimaryButton></div>
  </div>
}

function ReadinessFacts({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div className="rounded-lg border border-white/80 bg-white/80 p-3"><p className="text-xs font-semibold text-slate-700">{title}</p>{values.length ? values.map((value) => <p key={value} className="mt-1 text-xs leading-5 text-slate-600">• {value}</p>) : <p className="mt-1 text-xs leading-5 text-slate-500">{empty}</p>}</div>
}

