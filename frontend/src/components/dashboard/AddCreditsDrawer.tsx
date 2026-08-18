import { CheckCircle2, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import { InlineFeedback, PrimaryButton } from './primitives'

export type CreditPlanId = 'starter' | 'boost' | 'pro'

const plans = [
  { id: 'starter' as const, name: 'Starter', price: '₹19', credits: 10 },
  { id: 'boost' as const, name: 'Boost', price: '₹39', credits: 25, bestValue: true },
  { id: 'pro' as const, name: 'Pro', price: '₹79', credits: 60 },
]

type AddCreditsDrawerProps = {
  open: boolean
  balance: number | null
  selectedPlan: CreditPlanId
  onClose: () => void
  onPlanChange: (plan: CreditPlanId) => void
  onPurchased: (result: { balance: number; purchasedCredits: number; plan: CreditPlanId }) => void
}

const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function AddCreditsDrawer({ open, balance, selectedPlan, onClose, onPlanChange, onPurchased }: AddCreditsDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ purchasedCredits: number; updatedBalance: number } | null>(null)
  const inFlight = useRef(false)
  if (!open) return null
  const selected = plans.find((plan) => plan.id === selectedPlan) ?? plans[1]
  const purchase = async () => {
    if (inFlight.current) return
    const idempotencyKey = createIdempotencyKey()
    inFlight.current = true; setLoading(true); setError(null)
    try {
      const { data } = await api.post<{ balance: number; purchasedCredits: number; plan: CreditPlanId }>('/referral/credits/purchase', { plan: selected.id, idempotencyKey })
      setSuccess({ purchasedCredits: data.purchasedCredits, updatedBalance: data.balance })
      onPurchased(data)
    } catch (cause) {
      setError(friendlyErrorMessage(cause, 'The simulated purchase could not be completed. Please try again.'))
    } finally { inFlight.current = false; setLoading(false) }
  }
  return <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="add-credits-title">
    <section className="w-full max-w-xl rounded-t-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Demo / Simulated Payment</p><h2 id="add-credits-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Add AI credits</h2><p className="mt-1 text-sm text-slate-600">No card, UPI, or payment details are collected.</p></div><button type="button" onClick={onClose} disabled={loading} aria-label="Close Add Credits" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"><X className="size-5" /></button></div>
      {success ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2 font-semibold text-emerald-950"><CheckCircle2 className="size-5" />Credits added</div><p className="mt-2 text-sm text-emerald-900">{success.purchasedCredits} credits added. Your updated balance is {success.updatedBalance}.</p><PrimaryButton className="mt-4" onClick={onClose}>Done</PrimaryButton></div> : <><div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><span className="text-slate-500">Current balance</span><span className="float-right font-semibold tabular-nums text-slate-950">{balance ?? '—'} credits</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{plans.map((plan) => <button key={plan.id} type="button" onClick={() => onPlanChange(plan.id)} aria-pressed={selectedPlan === plan.id} className={`relative rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${selectedPlan === plan.id ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-950 hover:border-slate-400'}`}>{plan.bestValue ? <span className="absolute -top-2 left-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">Best Value</span> : null}<p className="text-sm font-semibold">{plan.name}</p><p className="mt-2 text-2xl font-semibold">{plan.price}</p><p className={`mt-1 text-xs ${selectedPlan === plan.id ? 'text-slate-300' : 'text-slate-500'}`}>{plan.credits} credits</p></button>)}</div><div className="mt-5 rounded-xl border border-slate-200 bg-slate-100 p-4"><p className="text-sm font-semibold text-slate-950">{selected.name} summary</p><p className="mt-1 text-sm text-slate-600">{selected.price} for {selected.credits} simulated AI credits.</p></div>{error ? <div className="mt-4"><InlineFeedback tone="error">{error}</InlineFeedback></div> : null}<PrimaryButton className="mt-5 w-full" onClick={purchase} loading={loading} disabled={loading}><Plus className="mr-2 size-4" />Add {selected.credits} credits — {selected.price}</PrimaryButton></>}
    </section>
  </div>
}
