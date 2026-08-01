import { ExternalLink, Paperclip, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient'
import { friendlyErrorMessage } from '../../lib/requestSafety'
import type { ProofEntry, ProofType } from '../../types'
import { Badge, Card, EmptyState, InlineFeedback, PrimaryButton, SecondaryButton, Skeleton } from './primitives'

const proofTypes: { value: ProofType; label: string }[] = [
  ['github_repository', 'GitHub repository'], ['live_demo', 'Live demo'], ['certification', 'Certification'],
  ['project_screenshot', 'Project screenshot link'], ['internship_letter_reference', 'Internship letter reference'],
  ['portfolio', 'Portfolio'], ['research_paper', 'Research paper'], ['presentation', 'Presentation'],
  ['competition_result', 'Competition result'],
].map(([value, label]) => ({ value: value as ProofType, label }))

type Draft = { proofType: ProofType; title: string; urlOrReference: string; relatedProject: string; relatedSkillClaim: string; description: string }
const emptyDraft: Draft = { proofType: 'github_repository', title: '', urlOrReference: '', relatedProject: '', relatedSkillClaim: '', description: '' }
const labelFor = (type: ProofType) => proofTypes.find((item) => item.value === type)?.label ?? type
const safeHttpUrl = (value: string) => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null } catch { return null } }

export default function ProofVaultPanel({ trustCardId, requestId, editable = false }: { trustCardId?: string; requestId?: string; editable?: boolean }) {
  const endpoint = editable ? `/referral/proofs?trust_card_id=${encodeURIComponent(trustCardId ?? '')}` : `/referral/employee/requests/${requestId}/proofs`
  const [entries, setEntries] = useState<ProofEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [validation, setValidation] = useState<string | null>(null)
  const enabled = editable ? Boolean(trustCardId) : Boolean(requestId)

  const load = async () => {
    if (!enabled) { setLoading(false); return }
    setLoading(true); setError(null)
    try { const { data } = await api.get<ProofEntry[]>(endpoint); setEntries(data) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Evidence could not be loaded.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [endpoint, enabled])

  const groupedCount = useMemo(() => new Set(entries.map((entry) => entry.relatedSkillClaim).filter(Boolean)).size, [entries])
  const resetForm = () => { setDraft(emptyDraft); setEditingId(null); setValidation(null); setShowForm(false) }
  const validate = () => {
    if (!draft.title.trim()) return 'Add a short evidence title.'
    const reference = draft.urlOrReference.trim()
    if (!reference) return 'Add a URL or safe reference.'
    if (reference.includes(':') && !safeHttpUrl(reference)) return 'Use only a complete http or https link. Unsafe protocols are not allowed.'
    if (/[<>\r\n]/.test(reference)) return 'This reference contains unsafe characters.'
    return null
  }
  const save = async () => {
    const problem = validate(); setValidation(problem); if (problem || !trustCardId) return
    setSaving(true); setError(null); setNotice(null)
    const payload = { trustCardId, ...draft }
    try {
      const { data } = editingId ? await api.put<ProofEntry>(`/referral/proofs/${editingId}`, payload) : await api.post<ProofEntry>('/referral/proofs', payload)
      setEntries((current) => editingId ? current.map((entry) => entry.id === editingId ? data : entry) : [data, ...current])
      setNotice(editingId ? 'Evidence updated.' : 'Evidence attached to this Trust Card.')
      window.dispatchEvent(new CustomEvent('refai:proof-vault-changed', { detail: { trustCardId } }))
      resetForm()
    } catch (cause) { setError(friendlyErrorMessage(cause, 'Evidence could not be saved.')) }
    finally { setSaving(false) }
  }
  const edit = (entry: ProofEntry) => {
    setDraft({ proofType: entry.proofType, title: entry.title, urlOrReference: entry.urlOrReference, relatedProject: entry.relatedProject ?? '', relatedSkillClaim: entry.relatedSkillClaim ?? '', description: entry.description ?? '' })
    setEditingId(entry.id); setValidation(null); setShowForm(true)
  }
  const remove = async (entry: ProofEntry) => {
    if (!window.confirm(`Remove “${entry.title}” from this Trust Card?`)) return
    setError(null); setNotice(null)
    try { await api.delete(`/referral/proofs/${entry.id}`); setEntries((current) => current.filter((item) => item.id !== entry.id)); setNotice('Evidence removed. Employees will no longer see this entry.'); window.dispatchEvent(new CustomEvent('refai:proof-vault-changed', { detail: { trustCardId } })) }
    catch (cause) { setError(friendlyErrorMessage(cause, 'Evidence was already removed or could not be deleted.')) }
  }

  return <Card className="p-6 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Paperclip className="size-5" /><h3 className="text-lg font-semibold">{editable ? 'Proof Vault' : 'View Evidence'}</h3></div><p className="mt-2 text-sm leading-6 text-slate-500">Private links and structured metadata only. RefAI does not verify documents or claims.</p></div>{editable && enabled ? <PrimaryButton onClick={() => { setShowForm(true); setNotice(null) }}><Plus className="mr-2 size-4" />Attach Evidence</PrimaryButton> : null}</div>
    {loading ? <div className="mt-5 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
    {error ? <div className="mt-4"><InlineFeedback tone="error">{error}</InlineFeedback><SecondaryButton className="mt-3" onClick={load}><RefreshCw className="mr-2 size-4" />Retry</SecondaryButton></div> : null}
    {notice ? <div className="mt-4"><InlineFeedback tone="success">{notice}</InlineFeedback></div> : null}
    {!enabled && editable ? <EmptyState className="mt-5" icon={Paperclip} title="Create a Trust Card first" description="Evidence is attached to a persisted Trust Card so it is shared only with an assigned employee." /> : null}
    {showForm ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Proof type<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={draft.proofType} onChange={(event) => setDraft({ ...draft, proofType: event.target.value as ProofType })}>{proofTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="text-sm font-medium">Title<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="text-sm font-medium sm:col-span-2">URL or safe reference<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={1000} placeholder="https://… or certificate/reference number" value={draft.urlOrReference} onChange={(event) => setDraft({ ...draft, urlOrReference: event.target.value })} /></label>
      <label className="text-sm font-medium">Related project (optional)<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={200} value={draft.relatedProject} onChange={(event) => setDraft({ ...draft, relatedProject: event.target.value })} /></label>
      <label className="text-sm font-medium">Related skill or claim (optional)<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={200} value={draft.relatedSkillClaim} onChange={(event) => setDraft({ ...draft, relatedSkillClaim: event.target.value })} /></label>
      <label className="text-sm font-medium sm:col-span-2">Description (optional)<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    </div>{validation ? <p className="mt-3 text-sm text-red-700">{validation}</p> : null}<div className="mt-4 flex gap-2"><PrimaryButton onClick={save} loading={saving}>{editingId ? 'Save changes' : 'Attach Evidence'}</PrimaryButton><SecondaryButton onClick={resetForm}><X className="mr-2 size-4" />Cancel</SecondaryButton></div></div> : null}
    {!loading && !error && enabled && entries.length === 0 ? <EmptyState className="mt-5" icon={Paperclip} title={editable ? 'No evidence attached yet' : 'No evidence available'} description={editable ? 'Attach a repository, demo, certification, portfolio, or another supported reference.' : 'The student has not attached evidence to this Trust Card, or previously attached evidence was removed.'} /> : null}
    {entries.length ? <><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><span>{entries.length} evidence {entries.length === 1 ? 'entry' : 'entries'}</span>{groupedCount ? <span>· {groupedCount} linked skill {groupedCount === 1 ? 'claim' : 'claims'}</span> : null}</div><div className="mt-3 grid gap-3">{entries.map((entry) => { const url = safeHttpUrl(entry.urlOrReference); return <div key={entry.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{entry.title}</p><Badge tone="neutral">{labelFor(entry.proofType)}</Badge></div>{entry.relatedProject ? <p className="mt-2 text-xs text-slate-500">Project: {entry.relatedProject}</p> : null}{entry.relatedSkillClaim ? <p className="mt-1 text-xs text-slate-500">Skill or claim: {entry.relatedSkillClaim}</p> : null}{entry.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{entry.description}</p> : null}{url ? <a className="mt-3 inline-flex items-center text-sm font-medium text-blue-700 hover:underline" href={url} target="_blank" rel="noreferrer">Open evidence <ExternalLink className="ml-1 size-3.5" /></a> : <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 text-xs text-slate-700">Reference: {entry.urlOrReference}</p>}</div>{editable ? <div className="flex gap-1"><button type="button" className="rounded-lg p-2 hover:bg-slate-100" aria-label={`Edit ${entry.title}`} onClick={() => edit(entry)}><Pencil className="size-4" /></button><button type="button" className="rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label={`Remove ${entry.title}`} onClick={() => remove(entry)}><Trash2 className="size-4" /></button></div> : null}</div></div>})}</div></> : null}
  </Card>
}
