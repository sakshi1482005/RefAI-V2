import { ChevronDown, ExternalLink, FileQuestion, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ClaimVerificationResult, ClaimVerificationStatus } from '../../types'
import { Badge, Card, EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'
import { useAuthSession } from '../../context/AuthSessionContext'
import EvidenceStrengthMap from './EvidenceStrengthMap'
import type { ActionPlanItem } from '../../types'

const verificationCache = new Map<string, ClaimVerificationResult>()
const verificationInFlight = new Map<string, Promise<ClaimVerificationResult>>()

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

type ClaimGroup = 'verified' | 'partial' | 'needs_evidence'

const groupFor = (status: ClaimVerificationStatus): ClaimGroup => {
  if (status === 'Evidence supported' || status === 'Verified evidence') return 'verified'
  if (status === 'Partially supported' || status === 'Resume supported') return 'partial'
  return 'needs_evidence'
}

const sourceFor = (claim: ClaimVerificationResult['claims'][number]) => {
  if (claim.proofEvidence.length) return 'Proof Vault'
  if (claim.supportingEvidenceSnippets?.length || claim.resumeEvidence?.length || claim.resumeContext) return 'Resume evidence'
  return 'No linked source'
}

const groupMeta: Record<ClaimGroup, { title: string; description: string; tone: 'success' | 'info' | 'warning' }> = {
  verified: { title: 'Verified', description: 'Clear supporting evidence or Proof Vault link', tone: 'success' },
  partial: { title: 'Partially Supported', description: 'Relevant resume context, with room for stronger proof', tone: 'info' },
  needs_evidence: { title: 'Needs Evidence', description: 'Self-declared or needs clarification', tone: 'warning' },
}

type Props = {
  trustCardId?: string
  requestId?: string
  initialResult?: ClaimVerificationResult
  importantSkills?: string[]
  missingRequirements?: ActionPlanItem[]
}

export default function ClaimVerificationPanel({ trustCardId, requestId, initialResult, importantSkills, missingRequirements }: Props) {
  const { authenticatedUserId } = useAuthSession()
  const endpoint = trustCardId ? `/referral/proofs/claim-verifications?trust_card_id=${encodeURIComponent(trustCardId)}` : requestId ? `/referral/employee/requests/${requestId}/claim-verifications` : null
  const cacheKey = endpoint && authenticatedUserId ? `${authenticatedUserId}:${endpoint}` : null
  const [result, setResult] = useState<ClaimVerificationResult | null>(initialResult ?? null)
  const [loading, setLoading] = useState(Boolean(endpoint) && !initialResult)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!endpoint) { setLoading(false); return }
    setLoading(true); setError(null)
    const cached = cacheKey ? verificationCache.get(cacheKey) : null
    if (cached) { setResult(cached); setLoading(false); return }
    try {
      const request = cacheKey && verificationInFlight.get(cacheKey)
        ? verificationInFlight.get(cacheKey)!
        : api.get<ClaimVerificationResult>(endpoint).then(({ data }) => {
          if (cacheKey) verificationCache.set(cacheKey, data)
          return data
        })
      if (cacheKey) verificationInFlight.set(cacheKey, request)
      setResult(await request)
    }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Claim verification could not be loaded.')) }
    finally { if (cacheKey) verificationInFlight.delete(cacheKey); setLoading(false) }
  }, [cacheKey, endpoint])

  useEffect(() => {
    if (initialResult) { setResult(initialResult); setLoading(false); return }
    void load()
  }, [initialResult, load])
  useEffect(() => {
    if (!trustCardId || initialResult) return
    const refresh = () => { if (cacheKey) verificationCache.delete(cacheKey); void load() }
    window.addEventListener('refai:proof-vault-changed', refresh)
    return () => window.removeEventListener('refai:proof-vault-changed', refresh)
  }, [cacheKey, initialResult, load, trustCardId])

  const groupedClaims = result?.claims.reduce<Record<ClaimGroup, ClaimVerificationResult['claims']>>((groups, claim) => {
    groups[groupFor(claim.status)].push(claim)
    return groups
  }, { verified: [], partial: [], needs_evidence: [] })

  return <Card className="overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm"><ShieldCheck className="size-5" aria-hidden="true" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence grounding</p><h2 className="mt-1 text-xl font-semibold">Claim Verification</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A quick checklist of significant claims and their saved evidence.</p></div>
        </div>
        {result ? <Badge tone={result.interpretationSource === 'groq_assisted' ? 'info' : 'neutral'}>{result.interpretationSource === 'groq_assisted' ? 'AI-worded questions' : 'Deterministic review'}</Badge> : null}
      </div>
    </div>

    <div className="p-6 sm:p-8">
      {loading ? <div className="space-y-3" aria-label="Loading claim verification"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : null}
      {error && !result ? <div><InlineFeedback tone="error">{error}</InlineFeedback><SecondaryButton className="mt-3" onClick={load}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></div> : null}
      {error && result ? <InlineFeedback tone="info">Saved claim verification is shown. RefAI could not refresh it just now. <button type="button" className="font-semibold underline" onClick={load}>Retry</button></InlineFeedback> : null}
      {!loading && !error && (!result || result.claims.length === 0) ? <EmptyState icon={ShieldCheck} title="No significant claims need review" description="No supported claim metadata or significant experience, project, achievement, leadership, or quantified-impact statement was available. The Candidate Trust Score remains unchanged." /> : null}

      {result?.claims.length && groupedClaims ? <>{importantSkills?.length || missingRequirements?.length ? <div className="mb-5"><EvidenceStrengthMap result={result} skills={importantSkills ?? []} missingRequirements={missingRequirements ?? []} /></div> : null}<div className="mb-5 flex flex-wrap gap-2 text-xs font-medium text-slate-600"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{groupedClaims.verified.length} verified</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">{groupedClaims.partial.length} partially supported</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{groupedClaims.needs_evidence.length} need stronger evidence</span></div><div className="space-y-5">{(Object.keys(groupMeta) as ClaimGroup[]).map((group) => { const claims = groupedClaims[group]; const meta = groupMeta[group]; return claims.length ? <section key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h3 className="text-sm font-semibold text-slate-900">{meta.title}</h3><p className="mt-0.5 text-xs text-slate-500">{meta.description}</p></div><Badge tone={meta.tone}>{claims.length}</Badge></div><div className="divide-y divide-slate-200">{claims.map((item) => <details key={item.id || item.claim} data-testid={`claim-verification-${item.status.toLowerCase().replace(/\s+/g, '-')}`} className="group bg-white/80 open:bg-white"><summary aria-label={`Review claim: ${item.claim}. Status: ${displayStatus(item.status)}`} className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{item.claim}</p><span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{categoryLabel(item.category || 'skill')}</span></div><p className="mt-1 truncate text-xs leading-5 text-slate-500" title={item.reason}>{item.reason}</p></div><span className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:col-start-2 sm:row-start-1">{sourceFor(item)}</span><div className="col-start-2 row-start-1 flex items-center gap-2 sm:col-start-3"><Badge tone={toneFor(item.status)}>{displayStatus(item.status)}</Badge><ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" /></div></summary><div className="border-t border-slate-200 px-4 pb-4 pt-3"><div className="grid gap-3 lg:grid-cols-2"><section className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Exact resume context</p><p className="mt-1 text-xs font-medium text-slate-500">{item.resumeSection || 'Resume section not identified'}</p>{item.resumeContext ? <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-700">“{item.resumeContext}”</blockquote> : <p className="mt-2 text-sm text-slate-500">No exact resume context was saved for this legacy claim.</p>}</section><section className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Supporting evidence</p>{item.supportingEvidenceSnippets?.length ? <ul className="mt-2 space-y-1.5">{item.supportingEvidenceSnippets.map((snippet) => <li key={snippet} className="text-sm leading-6 text-slate-700">“{snippet}”</li>)}</ul> : item.resumeEvidence?.length && (item.status === 'Verified evidence' || item.status === 'Resume supported') ? <ul className="mt-2 space-y-1.5">{item.resumeEvidence.map((snippet) => <li key={snippet} className="text-sm leading-6 text-slate-700">“{snippet}”</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-slate-500">No separate supporting snippet was identified.</p>}</section></div>{item.missingSupport ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800"><FileQuestion className="size-3.5" aria-hidden="true" />Missing support or clarification</p><p className="mt-1.5 text-sm leading-6 text-slate-700">{item.missingSupport}</p></div> : null}{item.suggestedClarificationQuestion ? <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-800">Suggested clarification question</p><p className="mt-1.5 text-sm leading-6 text-slate-700">{item.suggestedClarificationQuestion}</p></div> : null}{item.proofEvidence.length ? <div className="mt-3"><p className="text-xs font-semibold text-slate-600">Linked Proof Vault evidence</p><div className="mt-2 flex flex-wrap gap-2">{item.proofEvidence.map((proof) => { const url = safeUrl(proof.urlOrReference); return url ? <a key={proof.id} className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950" href={url} target="_blank" rel="noopener noreferrer">{proof.title}<ExternalLink className="ml-1 size-3" aria-hidden="true" /></a> : <span key={proof.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">{proof.title}: {proof.urlOrReference}</span> })}</div></div> : null}</div></details>)}</div></section> : null })}</div></> : null}
      {result ? <p className="mt-5 text-xs leading-5 text-slate-500">{result.limitation}</p> : null}
    </div>
  </Card>
}
