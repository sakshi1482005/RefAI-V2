import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ClaimVerificationResult, ClaimVerificationStatus } from '../../types'
import { Badge, Card, EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

const toneFor = (status: ClaimVerificationStatus): 'success' | 'info' | 'neutral' | 'warning' => {
  if (status === 'Verified evidence') return 'success'
  if (status === 'Resume supported') return 'info'
  if (status === 'Needs clarification') return 'warning'
  return 'neutral'
}
const safeUrl = (value: string) => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null } catch { return null } }

export default function ClaimVerificationPanel({ trustCardId, requestId }: { trustCardId?: string; requestId?: string }) {
  const endpoint = trustCardId ? `/referral/proofs/claim-verifications?trust_card_id=${encodeURIComponent(trustCardId)}` : requestId ? `/referral/employee/requests/${requestId}/claim-verifications` : null
  const [result, setResult] = useState<ClaimVerificationResult | null>(null)
  const [loading, setLoading] = useState(Boolean(endpoint))
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!endpoint) { setLoading(false); return }
    setLoading(true); setError(null)
    try { const { data } = await api.get<ClaimVerificationResult>(endpoint); setResult(data) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Claim support statuses could not be loaded.')) }
    finally { setLoading(false) }
  }, [endpoint])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!trustCardId) return
    const refresh = () => { void load() }
    window.addEventListener('refai:proof-vault-changed', refresh)
    return () => window.removeEventListener('refai:proof-vault-changed', refresh)
  }, [load, trustCardId])

  return <Card className="p-6 sm:p-8"><div className="flex items-center gap-3"><ShieldCheck className="size-5" /><div><h3 className="text-lg font-semibold">Claim Verification</h3><p className="mt-1 text-sm text-slate-500">Deterministic support status from saved resume evidence and student-supplied Proof Vault links.</p></div></div>
    {loading ? <div className="mt-5 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
    {error ? <div className="mt-5"><InlineFeedback tone="error">{error}</InlineFeedback><SecondaryButton className="mt-3" onClick={load}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></div> : null}
    {!loading && !error && (!result || result.claims.length === 0) ? <EmptyState className="mt-5" icon={ShieldCheck} title="Claim statuses unavailable" description="This older Trust Card has no matched skills or linked claim metadata to classify. Its saved score remains unchanged." /> : null}
    {result?.claims.length ? <div className="mt-5 space-y-3">{result.claims.map((item) => <details key={item.claim} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{item.claim}</span><Badge tone={toneFor(item.status)}>{item.status}</Badge></div><p className="mt-2 text-xs leading-5 text-slate-600">{item.reason}</p></summary><div className="mt-3 border-t border-slate-100 pt-3">{item.resumeEvidence.length ? <div><p className="text-xs font-semibold text-slate-600">Resume evidence</p>{item.resumeEvidence.map((evidence) => <p key={evidence} className="mt-1 text-xs leading-5 text-slate-500">“{evidence}”</p>)}</div> : null}{item.proofEvidence.length ? <div className="mt-3"><p className="text-xs font-semibold text-slate-600">Linked Proof Vault evidence</p><div className="mt-2 flex flex-wrap gap-2">{item.proofEvidence.map((proof) => { const url = safeUrl(proof.urlOrReference); return url ? <a key={proof.id} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-50" href={url} target="_blank" rel="noreferrer">{proof.title}<ExternalLink className="ml-1 size-3" /></a> : <span key={proof.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">{proof.title}: {proof.urlOrReference}</span> })}</div></div> : null}</div></details>)}</div> : null}
    {result ? <p className="mt-4 text-[11px] leading-5 text-slate-500">{result.limitation}</p> : null}
  </Card>
}
