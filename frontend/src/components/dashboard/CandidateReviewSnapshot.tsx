import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Skeleton } from './primitives'

type ReviewSnapshotProps = {
  candidateName: string
  initials: string
  photoUrl?: string | null
  targetRole: string
  targetCompany: string
  statusLabel: string
  trustScore?: number | null
  reliabilityLabel?: string | null
  compatibilityScore?: number | null
  compatibilityLabel?: string | null
  strengths: string[]
  concerns: string[]
  claimWarnings: string[]
  claimWarningsLoading?: boolean
  evidenceHref: string
}

function EvidenceList({ title, items, empty, href, tone }: { title: string; items: string[]; empty: string; href: string; tone: 'positive' | 'caution' }) {
  const Icon = tone === 'positive' ? CheckCircle2 : AlertTriangle
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2"><Icon className={`size-4 shrink-0 ${tone === 'positive' ? 'text-emerald-600' : 'text-amber-600'}`} aria-hidden="true" /><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">{title}</h3></div>
    <ul className="mt-3 space-y-2">{items.length ? items.slice(0, 2).map((item) => <li key={item} className="text-xs leading-5 text-slate-700"><span className="line-clamp-2">{item}</span><Link to={href} className="mt-1 inline-flex font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-black">View supporting evidence</Link></li>) : <li className="text-xs leading-5 text-slate-500">{empty}</li>}</ul>
  </section>
}

export default function CandidateReviewSnapshot(props: ReviewSnapshotProps) {
  return <Card className="overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {props.photoUrl ? <img src={props.photoUrl} alt="" className="size-12 shrink-0 rounded-full border-2 border-white object-cover shadow-sm" /> : <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">{props.initials}</div>}
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-semibold">{props.candidateName}</h2><Badge tone="info">{props.statusLabel}</Badge></div><p className="mt-1 truncate text-sm text-slate-600">{props.targetRole} · {props.targetCompany}</p></div>
        </div>
        <p className="flex items-center gap-2 text-xs font-medium text-slate-600"><ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />Evidence-checked candidate — reviewed before reaching you.</p>
      </div>
    </div>

    <div className="p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-950 p-4 text-white"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300">Candidate Trust Score</p><p className="mt-2 text-2xl font-semibold">{props.trustScore == null ? 'Unavailable' : `${props.trustScore}/100`}</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Analysis Reliability</p><p className="mt-2 text-base font-semibold">{props.reliabilityLabel || 'Not recorded'}</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Referral Compatibility</p><div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{props.compatibilityScore == null ? 'Unavailable' : `${props.compatibilityScore}/100`}</p>{props.compatibilityLabel ? <Badge tone={props.compatibilityLabel === 'Strong fit' || props.compatibilityLabel === 'Good fit' ? 'success' : 'warning'}>{props.compatibilityLabel}</Badge> : null}</div></div>
      </div>

      <div id="review-evidence-summary" className="mt-4 grid gap-3 lg:grid-cols-3">
        <EvidenceList title="Top strengths" items={props.strengths} empty="No strengths were recorded for this saved request." href={props.evidenceHref} tone="positive" />
        <EvidenceList title="Key concerns or missing evidence" items={props.concerns} empty="No specific evidence gaps were recorded." href={props.evidenceHref} tone="caution" />
        {props.claimWarningsLoading ? <section className="rounded-xl border border-slate-200 p-4" aria-label="Loading claim verification warnings"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Claim verification warnings</p><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-3/4" /></section> : <EvidenceList title="Claim verification warnings" items={props.claimWarnings} empty="No claim clarification warnings were identified." href={`${props.evidenceHref}#claim-verification`} tone="caution" />}
      </div>
    </div>
  </Card>
}
