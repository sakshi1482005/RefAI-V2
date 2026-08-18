import { Paperclip, Send } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ProofEntry, ReferralRequestDetail, ReferralRequestSummary } from '../../types'
import { InlineFeedback, PrimaryButton, SecondaryButton } from './primitives'

type Props = {
  request: ReferralRequestSummary
  onSubmitted: (request: ReferralRequestDetail) => void
}

export default function MoreInformationResponsePanel({ request, onSubmitted }: Props) {
  const [response, setResponse] = useState('')
  const [proofs, setProofs] = useState<ProofEntry[]>([])
  const [selectedProofIds, setSelectedProofIds] = useState<string[]>([])
  const [showEvidence, setShowEvidence] = useState(false)
  const [loadingProofs, setLoadingProofs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProofs = async () => {
    setShowEvidence(true)
    if (proofs.length || loadingProofs) return
    setLoadingProofs(true); setError(null)
    try {
      const { data } = await api.get<ProofEntry[]>(`/referral/proofs?trust_card_id=${encodeURIComponent(request.trustCardId)}`)
      setProofs(data)
    } catch (cause) {
      setError(friendlyErrorMessage(cause, 'Your available evidence could not be loaded.'))
    } finally { setLoadingProofs(false) }
  }

  const submit = async () => {
    if (!response.trim()) { setError('Write a response before sending it to the employee.'); return }
    setSubmitting(true); setError(null)
    try {
      const { data } = await api.post<ReferralRequestDetail>(`/referral/requests/${request.id}/more-information-response`, {
        response: response.trim(), proofEntryIds: selectedProofIds,
      })
      onSubmitted(data)
    } catch (cause) {
      setError(friendlyErrorMessage(cause, 'Your response could not be saved.'))
    } finally { setSubmitting(false) }
  }

  if (request.studentResponse) return <div className="md:col-span-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
    <p className="font-semibold">More information sent</p><p className="mt-1">{request.studentResponse}</p>
    {request.studentResponseProofEntries.length ? <p className="mt-2 text-xs">Evidence attached: {request.studentResponseProofEntries.map((entry) => entry.title).join(', ')}</p> : null}
    <p className="mt-2 text-xs text-emerald-800">The request is back under employee review.</p>
  </div>

  if (request.status !== 'more_info_requested') return null
  return <div className="md:col-span-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm font-semibold text-slate-900">Employee question</p>
    <p className="mt-1 text-sm leading-6 text-slate-700">{request.moreInformationQuestion || request.decisionMessage || 'The employee requested additional information.'}</p>
    <label className="mt-4 block text-sm font-medium text-slate-800">Your response<textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={2000} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder="Share a concrete example, clarification, or relevant context." /></label>
    <p className="mt-1 text-xs text-slate-500">{response.length}/2000</p>
    <div className="mt-3"><SecondaryButton onClick={loadProofs} disabled={submitting}><Paperclip className="mr-2 size-4" />Attach existing Proof Vault evidence</SecondaryButton></div>
    {showEvidence ? <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
      {loadingProofs ? <p className="text-xs text-slate-500">Loading available evidence…</p> : proofs.length ? <div className="space-y-2">{proofs.map((proof) => <label key={proof.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={selectedProofIds.includes(proof.id)} onChange={(event) => setSelectedProofIds((current) => event.target.checked ? [...current, proof.id] : current.filter((id) => id !== proof.id))} /><span><span className="font-medium">{proof.title}</span>{proof.relatedSkillClaim ? <span className="text-xs text-slate-500"> · {proof.relatedSkillClaim}</span> : null}</span></label>)}</div> : <p className="text-xs text-slate-500">No Proof Vault evidence is available yet. You can still send a text response.</p>}
    </div> : null}
    {error ? <div className="mt-3"><InlineFeedback tone="error">{error}</InlineFeedback></div> : null}
    <PrimaryButton className="mt-4" onClick={submit} loading={submitting}><Send className="mr-2 size-4" />Send response</PrimaryButton>
  </div>
}
