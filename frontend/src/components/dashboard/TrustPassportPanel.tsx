import { Copy, ExternalLink, Globe2, Link2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import { Badge, Card, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from './primitives'

type Visibility = 'identity' | 'role' | 'scores' | 'evidence' | 'reliability'
type PassportStatus = { enabled: boolean; visibility: Visibility[]; expiresAt: string | null; accessCount?: number; shareToken?: string }

const choices: Array<{ key: Visibility; label: string; detail: string }> = [
  { key: 'identity', label: 'Candidate name', detail: 'Your name only—never email or phone.' },
  { key: 'role', label: 'Target role', detail: 'The role recorded on this Trust Card.' },
  { key: 'scores', label: 'Score summary', detail: 'Only saved deterministic/academic scores.' },
  { key: 'evidence', label: 'Verified evidence', detail: 'Counts, skills, and short approved evidence labels.' },
  { key: 'reliability', label: 'Reliability summary', detail: 'Parsing and evidence limitations, not predictions.' },
]

export default function TrustPassportPanel({ trustCardId }: { trustCardId?: string }) {
  const [status, setStatus] = useState<PassportStatus | null>(null)
  const [selected, setSelected] = useState<Visibility[]>(['role', 'scores', 'evidence', 'reliability'])
  const [loading, setLoading] = useState(Boolean(trustCardId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const load = async () => {
    if (!trustCardId) return
    setLoading(true); setError(null)
    try {
      const { data } = await api.get<PassportStatus>(`/trust-card/passport?trustCardId=${encodeURIComponent(trustCardId)}`)
      setStatus(data)
      if (data.visibility.length) setSelected(data.visibility)
    } catch (cause) { setError(friendlyErrorMessage(cause, 'Trust Passport settings could not be loaded.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [trustCardId])

  const expires = useMemo(() => status?.expiresAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(status.expiresAt)) : null, [status?.expiresAt])
  const toggle = (key: Visibility) => setSelected((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key])
  const create = async () => {
    if (!trustCardId || !selected.length || saving) return
    setSaving(true); setError(null)
    try {
      const { data } = await api.post<PassportStatus>('/trust-card/passport', { trustCardId, visibility: selected, expiresInDays: 30 })
      setStatus(data); setShareUrl(`${window.location.origin}/passport/${data.shareToken}`)
    } catch (cause) { setError(friendlyErrorMessage(cause, 'Trust Passport could not be enabled.')) }
    finally { setSaving(false) }
  }
  const revoke = async () => {
    if (!trustCardId || saving) return
    setSaving(true); setError(null)
    try { await api.delete(`/trust-card/passport/${encodeURIComponent(trustCardId)}`); setStatus({ enabled: false, visibility: [], expiresAt: null }); setShareUrl(null) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Trust Passport could not be revoked.')) }
    finally { setSaving(false) }
  }
  const copy = async () => { if (shareUrl) await navigator.clipboard.writeText(shareUrl) }

  if (!trustCardId) return <Card className="p-6"><p className="text-sm text-slate-600">Generate and save a Trust Card before enabling a shareable Trust Passport.</p></Card>
  if (loading) return <Card className="p-6"><Skeleton className="h-6 w-48" /><Skeleton className="mt-5 h-28 w-full" /></Card>
  return <Card className="overflow-hidden border-slate-800 bg-slate-950 text-white shadow-[0_20px_50px_-34px_rgba(15,23,42,0.9)]"><div className="p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Globe2 className="size-4 text-emerald-300" /><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Privacy-controlled credential</p></div><h2 className="mt-2 text-xl font-semibold">Trust Passport</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create a revocable public view of only the information you choose. Your resume, contact details, internal IDs, and private Proof Vault links are never included.</p></div>{status?.enabled ? <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><ShieldCheck className="mr-1 size-3.5" />Sharing enabled</Badge> : <Badge className="border-white/10 bg-white/[0.06] text-slate-300">Private by default</Badge>}</div>
    {error ? <div className="mt-5"><InlineFeedback tone="error">{error}</InlineFeedback></div> : null}
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{choices.map((choice) => <label key={choice.key} className={`cursor-pointer rounded-xl border p-4 transition ${selected.includes(choice.key) ? 'border-emerald-300/40 bg-white/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}><span className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(choice.key)} onChange={() => toggle(choice.key)} className="mt-1 size-4 accent-emerald-400" /><span><span className="block text-sm font-semibold">{choice.label}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{choice.detail}</span></span></span></label>)}</div>
    {status?.enabled ? <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] p-4"><p className="text-sm font-semibold">Active passport{expires ? ` · expires ${expires}` : ''}</p><p className="mt-1 text-xs leading-5 text-slate-400">{status.accessCount ?? 0} recorded view{status.accessCount === 1 ? '' : 's'}. Public access is logged safely without storing visitor details.</p>{shareUrl ? <div className="mt-4 flex flex-wrap gap-2"><SecondaryButton onClick={copy}><Copy className="mr-2 size-4" />Copy link</SecondaryButton><a href={shareUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Preview <ExternalLink className="ml-2 size-4" /></a></div> : <p className="mt-3 text-xs text-slate-400">For security, reopen this panel and select Regenerate link to issue a new copyable link.</p>}</div> : null}
    <div className="mt-6 flex flex-wrap gap-3">{status?.enabled ? <><PrimaryButton onClick={create} loading={saving} disabled={!selected.length}><RotateCcw className="mr-2 size-4" />Regenerate link</PrimaryButton><SecondaryButton onClick={revoke} loading={saving}><XCircle className="mr-2 size-4" />Revoke link</SecondaryButton></> : <PrimaryButton onClick={create} loading={saving} disabled={!selected.length}><Link2 className="mr-2 size-4" />Enable sharing</PrimaryButton>}</div></div></Card>
}
