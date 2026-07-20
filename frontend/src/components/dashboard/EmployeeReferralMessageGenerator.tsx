import { Check, Copy, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/apiClient'
import { demoEmployeeReferralMessage } from '../../lib/demoData'
import { friendlyErrorMessage, requireOnline } from '../../lib/requestSafety'
import { useToast } from '../feedback/ToastProvider'
import { Badge, Card, PrimaryButton, SecondaryButton } from './primitives'

type Props = {
  candidateName: string
  role: string
  trustSummary: string
  recommendation: string
  isDemoMode: boolean
  enabled: boolean
}

export default function EmployeeReferralMessageGenerator({ candidateName, role, trustSummary, recommendation, isDemoMode, enabled }: Props) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    if (!enabled || generating) return
    if (isDemoMode) {
      setMessage(demoEmployeeReferralMessage)
      toast({ title: 'Employee referral message prepared', description: 'Review and edit the demo message before using it.', tone: 'success' })
      return
    }
    setGenerating(true)
    try {
      requireOnline()
      const response = await api.post<{ message: string }>('/referral/message', { candidateName, role, trustSummary })
      setMessage(response.data.message)
      toast({ title: 'Employee referral message prepared', tone: 'success' })
    } catch (error) {
      toast({ title: 'Could not prepare the referral message', description: friendlyErrorMessage(error, 'The employee referral-message service is unavailable. Please try again.'), tone: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast({ title: 'Referral message copied', tone: 'success' })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Copy failed', description: 'Your browser did not allow clipboard access.', tone: 'error' })
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquareText className="size-5" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Referral Message Generator</p><h3 className="mt-1 text-lg font-semibold">Prepare the employee referral message</h3><p className="mt-1 text-sm leading-6 text-slate-500">Available to the employee while preparing or completing a referral. Review every claim before use.</p></div>
        </div>
        <Badge tone={recommendation === 'Ready for referral' ? 'success' : recommendation === 'Review before referring' ? 'warning' : 'neutral'}>{recommendation}</Badge>
      </div>

      {message ? <><label htmlFor="employee-referral-message" className="sr-only">Employee referral message</label><textarea id="employee-referral-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={800} className="mt-6 min-h-40 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" /><div className="mt-2 text-right text-xs text-slate-500">{message.length}/800</div></> : <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Generate a draft only after reviewing the Candidate Trust Card, matched skills, missing skills, and supporting evidence.</div>}

      <div className="mt-5 flex flex-wrap gap-3">
        <PrimaryButton onClick={generate} loading={generating} disabled={!enabled} disabledReason="Candidate evidence is required before preparing a referral message">
          {!generating ? message ? <RefreshCw className="mr-2 size-4" /> : <Sparkles className="mr-2 size-4" /> : null}
          {message ? 'Regenerate' : 'Generate Message'}
        </PrimaryButton>
        <SecondaryButton onClick={copy} disabled={!message} disabledReason="Generate a message first">{copied ? <Check className="mr-2 size-4 text-emerald-600" /> : <Copy className="mr-2 size-4" />}{copied ? 'Copied' : 'Copy'}</SecondaryButton>
      </div>
    </Card>
  )
}
