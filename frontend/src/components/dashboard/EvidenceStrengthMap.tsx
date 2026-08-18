import { ChevronDown, CircleAlert, ShieldCheck } from 'lucide-react'
import type { ActionPlanItem, ClaimVerificationResult, ClaimVerificationStatus } from '../../types'
import { Badge, Card } from './primitives'

type Group = 'strong' | 'needs' | 'missing'
type StrengthItem = { skill: string; group: Group; strength: string; status: ClaimVerificationStatus | 'Missing evidence'; sources: number; importance: string; proof: string | null; missing: string; clarification: string | null }

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim()
const claimMatches = (skill: string, claim: string) => {
  const query = normalized(skill); const source = normalized(claim)
  return Boolean(query) && (source.includes(query) || query.split(' ').filter((word) => word.length > 2).every((word) => source.includes(word)))
}
const statusRank: Record<string, number> = { 'Evidence supported': 4, 'Verified evidence': 4, 'Partially supported': 3, 'Resume supported': 3, 'Self-declared': 2, 'Needs clarification': 1 }

function buildItems(result: ClaimVerificationResult, skills: string[], missingRequirements: ActionPlanItem[]): StrengthItem[] {
  const required = missingRequirements.map((item) => item.requirement).filter(Boolean)
  const labels = [...skills, ...required].filter((skill, index, all) => skill.trim() && all.findIndex((item) => normalized(item) === normalized(skill)) === index).slice(0, 10)
  return labels.map((skill) => {
    const related = result.claims.filter((claim) => claimMatches(skill, claim.claim)).sort((a, b) => (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0))
    const best = related[0]
    const requiredGap = required.some((item) => normalized(item) === normalized(skill))
    if (!best) return { skill, group: 'missing', strength: 'No linked evidence', status: 'Missing evidence', sources: 0, importance: requiredGap ? 'Required role evidence' : 'Role-aligned skill', proof: null, missing: requiredGap ? 'No saved resume or Proof Vault evidence is linked to this required skill.' : 'No saved evidence source is linked to this skill.', clarification: `Add a truthful project, experience, or proof reference showing how you used ${skill}.` }
    const sources = new Set([...best.resumeEvidence, ...best.supportingEvidenceSnippets, ...best.proofEvidence.map((proof) => proof.id)]).size
    const verified = best.status === 'Evidence supported' || best.status === 'Verified evidence'
    const partial = best.status === 'Partially supported' || best.status === 'Resume supported'
    return { skill, group: verified ? 'strong' : partial ? 'needs' : 'needs', strength: verified ? 'Strong evidence' : partial ? 'Resume-supported' : 'Self-declared', status: best.status, sources, importance: requiredGap ? 'Required role evidence' : 'Role-aligned skill', proof: best.proofEvidence[0]?.title ?? best.supportingEvidenceSnippets[0] ?? best.resumeEvidence[0] ?? null, missing: best.missingSupport ?? best.reason, clarification: best.suggestedClarificationQuestion }
  })
}

const meta: Record<Group, { title: string; tone: 'success' | 'warning' | 'neutral'; description: string }> = {
  strong: { title: 'Strong Evidence', tone: 'success', description: 'Resume context or linked Proof Vault evidence supports these skills.' },
  needs: { title: 'Needs Stronger Proof', tone: 'warning', description: 'Relevant evidence exists, but stronger scope, outcomes, or linked proof would help.' },
  missing: { title: 'Missing Evidence', tone: 'neutral', description: 'No linked saved evidence was found. This is not a claim that the candidate lacks the skill.' },
}

export default function EvidenceStrengthMap({ result, skills, missingRequirements }: { result: ClaimVerificationResult; skills: string[]; missingRequirements: ActionPlanItem[] }) {
  const items = buildItems(result, skills, missingRequirements)
  if (!items.length) return null
  return <Card className="overflow-hidden"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm"><ShieldCheck className="size-4" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence grounding</p><h2 className="mt-1 text-lg font-semibold">Evidence Strength Map</h2><p className="mt-1 text-sm text-slate-600">A deterministic view of the saved sources behind important role skills.</p></div></div></div><div className="divide-y divide-slate-200">{(Object.keys(meta) as Group[]).map((group) => { const groupItems = items.filter((item) => item.group === group); const info = meta[group]; return groupItems.length ? <section key={group} className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{info.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{info.description}</p></div><Badge tone={info.tone}>{groupItems.length}</Badge></div><div className="mt-3 space-y-2">{groupItems.map((item) => <details key={item.skill} className="group rounded-xl border border-slate-200 bg-white open:bg-slate-50"><summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.skill}</p><p className="mt-1 text-xs text-slate-500">{item.strength} · {item.sources} source{item.sources === 1 ? '' : 's'} · {item.importance}</p></div><div className="flex items-center gap-2"><Badge tone={item.group === 'strong' ? 'success' : item.group === 'needs' ? 'warning' : 'neutral'}>{item.status}</Badge><ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></div></summary><div className="border-t border-slate-200 px-3.5 pb-4 pt-3"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Strongest saved proof</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.proof ? `“${item.proof}”` : 'No linked proof was saved.'}</p></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Missing or weak evidence</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.missing}</p></div></div><div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-blue-900"><CircleAlert className="size-3.5" />How to strengthen this</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.clarification ?? `Add a truthful, specific example showing how you used ${item.skill}.`}</p></div></div></details>)}</div></section> : null })}</div></Card>
}
