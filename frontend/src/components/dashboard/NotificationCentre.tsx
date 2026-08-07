import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDemoMode } from '../../context/DemoModeContext'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { InAppNotification } from '../../types'
import { EmptyState, InlineFeedback, SecondaryButton, Skeleton } from './primitives'

export default function NotificationCentre() {
  const navigate = useNavigate()
  const { isDemoMode, authenticatedUserId, authLoading } = useDemoMode()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InAppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (isDemoMode || authLoading || !authenticatedUserId) return
    setLoading(true); setError(null)
    try {
      const { data } = await api.get<InAppNotification[]>('/notifications')
      setItems(data); setLoaded(true)
    } catch (loadError) { setError(loadError) }
    finally { setLoading(false) }
  }, [authLoading, authenticatedUserId, isDemoMode])

  useEffect(() => {
    if (!isDemoMode && !authLoading && authenticatedUserId) void load()
  }, [authLoading, authenticatedUserId, isDemoMode, load])
  useEffect(() => { if (open && loaded) void load() }, [open])

  if (isDemoMode || authLoading || !authenticatedUserId) return null

  const unread = items.filter((item) => !item.readAt).length
  const markRead = async (item: InAppNotification) => {
    if (!item.readAt) {
      try {
        const { data } = await api.patch<InAppNotification>(`/notifications/${item.id}/read`)
        setItems((current) => current.map((entry) => entry.id === item.id ? data : entry))
      } catch (readError) { setError(readError); return }
    }
    setOpen(false); navigate(item.targetUrl)
  }
  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      const readAt = new Date().toISOString()
      setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt }))
    } catch (readError) { setError(readError) }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"><Bell className="size-[18px]" />{unread ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-slate-950 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 9 ? '9+' : unread}</span> : null}</button>
    {open ? <div className="absolute right-0 top-12 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><div className="flex items-center justify-between gap-3 px-1 pb-3"><div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-slate-500">In-app updates only</p></div>{unread ? <button type="button" onClick={markAllRead} className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-black"><CheckCheck className="mr-1 size-3.5" />Mark all read</button> : null}</div>
      {loading && !loaded ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
      {error ? <InlineFeedback tone="error">{friendlyErrorMessage(error, 'Notifications are temporarily unavailable.')}<SecondaryButton className="ml-2 h-8 px-2" onClick={load}><RefreshCw className="mr-1 size-3" />Retry</SecondaryButton></InlineFeedback> : null}
      {!loading && !error && items.length === 0 ? <EmptyState className="py-7" icon={Bell} title="No notifications yet" description="Referral and resume updates will appear here." /> : null}
      {items.length ? <div className="max-h-80 space-y-1 overflow-y-auto">{items.map((item) => <button key={item.id} type="button" onClick={() => { void markRead(item) }} className={`w-full rounded-xl p-3 text-left transition hover:bg-slate-50 ${item.readAt ? 'bg-white' : 'bg-slate-50'}`}><div className="flex gap-2"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-slate-900'}`} /><div><p className="text-xs font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p><time dateTime={item.createdAt} className="mt-1 block text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div></div></button>)}</div> : null}
    </div> : null}
  </div>
}
