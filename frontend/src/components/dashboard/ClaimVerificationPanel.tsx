import { AlertTriangle, ChevronDown, ExternalLink, FileQuestion, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ClaimVerificationResult, ClaimVerificationStatus } from '../../types'
import { Badge, Card, EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

const toneFor = (status: ClaimVerificationStatus): 'success' | 'info' | 'neutral' | 'warning' => {
  if (status === 'Evidence supported' || status === 'Verified evidence') return 'success'
  if (status === 'Partially supported' || status === 'Resume supported') return 'info'
  if (status === 'Needs clarification') return 'warning'
  return 'neutral'
}

const displayStatus = (status: ClaimVerificationStatus) => {
  if (status === 'Needs clarification') return 'Self-declared / Needs clarification'
  if (status === 'Verified evidence') return 'Evidence supported'
  if (status === 'Resume supported') return 'Partially supported'
  return status
}

const categoryLabel = (category: string) => category.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
const safeUrl = (value: string) => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null } catch { return null } }

type Props = {
  trustCardId?: string
  requestId?: string
  initialResult?: ClaimVerificationResult
}

export default function ClaimVerificationPanel({ trustCardId, requestId, initialResult }: Props) {
  const endpoint = trustCardId ? `/referral/proofs/claim-verifications?trust_card_id=${encodeURIComponent(trustCardId)}` : requestId ? `/referral/employee/requests/${requestId}/claim-verifications` : null
  const [result, setResult] = useState<ClaimVerificationResult | null>(initialResult ?? null)
  const [loading, setLoading] = useState(Boolean(endpoint) && !initialResult)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!endpoint) { setLoading(false); return }
    setLoading(true); setError(null)
    try { const { data } = await api.get<ClaimVerificationResult>(endpoint); setResult(data) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Claim verification could not be loaded.')) }
    finally { setLoading(false) }
  }, [endpoint])

  useEffect(() => {
    if (initialResult) { setResult(initialResult); setLoading(false); return }
    void load()
  }, [initialResult, load])
  useEffect(() => {
    if (!trustCardId || initialResult) return
    const refresh = () => { void load() }
    window.addEventListener('refai:proof-vault-changed', refresh)
    return () => window.removeEventListener('refai:proof-vault-changed', refresh)
  }, [initialResult, load, trustCardId])

  return <Card className="overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm"><ShieldCheck className="size-5" aria-hidden="true" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence grounding</p><h2 className="mt-1 text-xl font-semibold">Claim Verification</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review how significant experience, project, achievement, leadership, and impact statements are supported by the saved resume and Proof Vault.</p></div>
        </div>
        {result ? <Badge tone={result.interpretationSource === 'groq_assisted' ? 'info' : 'neutral'}>{result.interpretationSource === 'groq_assisted' ? 'AI-worded questions' : 'Deterministic review'}</Badge> : null}
      </div>
    </div>

    <div className="p-6 sm:p-8">
      {loading ? <div className="space-y-3" aria-label="Loading claim verification"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : null}
      {error ? <div><InlineFeedback tone="error">{error}</InlineFeedback><SecondaryButton className="mt-3" onClick={load}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></div> : null}
      {!loading && !error && (!result || result.claims.length === 0) ? <EmptyState icon={ShieldCheck} title="No significant claims need review" description="No supported claim metadata or significant experience, project, achievement, leadership, or quantified-impact statement was available. The Candidate Trust Score remains unchanged." /> : null}

      {result?.claims.length ? <div className="space-y-3">{result.claims.map((item) => {
        const caution = item.status === 'Needs clarification' || item.status === 'Self-declared'
        return <details key={item.id || item.claim} data-testid={`claim-verification-${item.status.toLowerCase().replace(/\s+/g, '-')}`} className={`group rounded-xl border ${caution ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'} open:shadow-sm`}>
          <summary aria-label={`Review claim: ${item.claim}. Status: ${displayStatus(item.status)}`} className="flex cursor-pointer list-none items-start gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 sm:p-5">
            <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${caution ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{caution ? <AlertTriangle className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{categoryLabel(item.category || 'skill')}</p><h3 className="mt-1 text-sm font-semibold leading-6 text-slate-950">{item.claim}</h3></div><Badge tone={toneFor(item.status)}>{displayStatus(item.status)}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p></div>
            <ChevronDown className="mt-2 size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-slate-200 px-4 pb-5 pt-4 sm:px-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Exact resume context</p><p className="mt-2 text-xs font-medium text-slate-500">{item.resumeSection || 'Resume section not identified'}</p>{item.resumeContext ? <blockquote className="mt-3 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-700">“{item.resumeContext}”</blockquote> : <p className="mt-3 text-sm text-slate-500">No exact resume context was saved for this legacy claim.</p>}</section>
              <section className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Supporting evidence</p>{item.supportingEvidenceSnippets?.length ? <ul className="mt-3 space-y-2">{item.supportingEvidenceSnippets.map((snippet) => <li key={snippet} className="text-sm leading-6 text-slate-700">“{snippet}”</li>)}</ul> : item.resumeEvidence?.length && (item.status === 'Verified evidence' || item.status === 'Resume supported') ? <ul className="mt-3 space-y-2">{item.resumeEvidence.map((snippet) => <li key={snippet} className="text-sm leading-6 text-slate-700">“{snippet}”</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-500">No separate supporting snippet was identified.</p>}</section>
            </div>

            {item.missingSupport ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800"><FileQuestion className="size-4" aria-hidden="true" />Missing support or clarification</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.missingSupport}</p></div> : null}
            {item.suggestedClarificationQuestion ? <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-800">Suggested clarification question</p><p className="mt-2 text-sm leading-6 text-slate-700">{item.suggestedClarificationQuestion}</p></div> : null}
            {item.proofEvidence.length ? <div className="mt-4"><p className="text-xs font-semibold text-slate-600">Linked Proof Vault evidence</p><div className="mt-2 flex flex-wrap gap-2">{item.proofEvidence.map((proof) => { const url = safeUrl(proof.urlOrReference); return url ? <a key={proof.id} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950" href={url} target="_blank" rel="noopener noreferrer">{proof.title}<ExternalLink className="ml-1 size-3" aria-hidden="true" /></a> : <span key={proof.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">{proof.title}: {proof.urlOrReference}</span> })}</div></div> : null}
          </div>
        </details>
      })}</div> : null}
      {result ? <p className="mt-5 text-xs leading-5 text-slate-500">{result.limitation}</p> : null}
    </div>
  </Card>
}
