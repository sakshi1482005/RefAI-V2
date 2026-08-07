import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { referralHistoryEventLabel, referralJourneyLabel } from '../../lib/referralHistoryContract'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ReferralStatus } from '../../types'
import { useReferralHistory } from '../../hooks/useReferralHistory'
import { Badge, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

export default function ReferralJourneyTimeline({ requestId, currentStatus }: { requestId: string; currentStatus: ReferralStatus }) {
  const [open, setOpen] = useState(false)
  const { events, loading, error, retry } = useReferralHistory(requestId, open)

  return <details className="group" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Referral journey</span><span className="flex items-center gap-2"><Badge tone={currentStatus === 'declined' || currentStatus === 'expired' ? 'danger' : currentStatus === 'approved' || currentStatus === 'referred' ? 'success' : 'info'}>Current · {referralJourneyLabel[currentStatus]}</Badge><span aria-hidden="true" className="text-slate-400 transition group-open:rotate-180">⌄</span></span></summary>
    <div className="mt-3" aria-label={`Referral journey. Current state: ${referralJourneyLabel[currentStatus]}`}>
    {loading ? <div aria-label="Loading referral journey" className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-12 w-full" /></div> : null}
    {error ? <InlineFeedback tone="error"><span>{friendlyErrorMessage(error, 'Referral history is temporarily unavailable.')}</span><SecondaryButton className="ml-2 h-8 px-2" onClick={retry}><RefreshCw className="mr-1 size-3" />Retry</SecondaryButton></InlineFeedback> : null}
    {!loading && !error && events.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">No persisted journey events are available yet.</p> : null}
    {!loading && !error && events.length > 0 ? <ol className="space-y-0">
      {events.map((event, index) => {
        const current = index === events.length - 1 && event.newStatus === currentStatus
        return <li key={event.id} className="relative flex gap-3 pb-3 last:pb-0">{index < events.length - 1 ? <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" /> : null}<span className={`relative mt-1 size-3 shrink-0 rounded-full border-2 ${current ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3"><p className={`text-xs font-semibold ${current ? 'text-slate-900' : 'text-slate-700'}`}>{referralHistoryEventLabel(event)}</p><time className="text-[11px] text-slate-500" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div></div></li>
      })}
    </ol> : null}
    </div>
  </details>
}
