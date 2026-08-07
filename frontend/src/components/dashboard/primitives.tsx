import { useEffect, useId, useState, type FocusEventHandler, type MouseEventHandler, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, HelpCircle, Inbox, Info, LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
export { default as Logo } from '../branding/RefAILogo'

type BadgeTone = 'neutral' | 'dark' | 'success' | 'warning' | 'danger' | 'info'

type ButtonProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  disabledReason?: string
  type?: 'button' | 'submit'
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>
  onFocus?: FocusEventHandler<HTMLButtonElement>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow,transform] duration-200', className)}>
      {children}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
    dark: 'border-black bg-black text-white',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700'
  }

  return (
    <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-200', tones[tone], className)}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, tone = 'dark' }: { value: number; tone?: 'dark' | 'success' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className={cn('h-full rounded-full transition-all duration-700', tone === 'success' ? 'bg-emerald-600' : 'bg-black')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function AnimatedNumber({ value, suffix = '', duration = 650, className }: { value: number; suffix?: string; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return }
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, value])
  return <span className={className} aria-label={`${value}${suffix}`}>{display}{suffix}</span>
}

export function MetricTooltip({ label, explanation }: { label: string; explanation: string }) {
  const tooltipId = useId()
  return <span className="metric-tooltip inline-flex items-center gap-1.5"><span>{label}</span><button type="button" className="metric-tooltip-trigger rounded-full text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black" aria-label={`Explain ${label}`} aria-describedby={tooltipId}><HelpCircle className="size-3.5" /></button><span id={tooltipId} role="tooltip" className="metric-tooltip-content">{explanation}</span></span>
}

export function ScoreExplanation({ points, title = 'Why did RefAI produce this result?', className }: { points: string[]; title?: string; className?: string }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-slate-50 p-4', className)}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p><ul className="mt-3 space-y-2">{points.map((point) => <li key={point} className="flex items-start gap-2 text-sm leading-5 text-slate-700"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" /><span>{point}</span></li>)}</ul></div>
}

export function Avatar({ initials, photoUrl, className, size = 'md' }: { initials: string; photoUrl?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'size-9 text-xs',
    md: 'size-12 text-sm',
    lg: 'size-20 text-xl'
  }

  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 font-semibold', sizes[size], className ?? 'bg-slate-100 text-slate-700')} aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : initials}
    </div>
  )
}

export function PrimaryButton({ children, className, onClick, disabled, loading, disabledReason, type = 'button', onMouseEnter, onFocus }: ButtonProps) {
  return (
    <button type={type} onClick={onClick} onMouseEnter={onMouseEnter} onFocus={onFocus} disabled={disabled || loading} aria-busy={loading || undefined} title={disabled ? disabledReason : undefined} className={cn('inline-flex h-11 cursor-pointer select-none items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-60 disabled:shadow-none', className)}>
      {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className, onClick, disabled, loading, disabledReason, type = 'button', onMouseEnter, onFocus }: ButtonProps) {
  return (
    <button type={type} onClick={onClick} onMouseEnter={onMouseEnter} onFocus={onFocus} disabled={disabled || loading} aria-busy={loading || undefined} title={disabled ? disabledReason : undefined} className={cn('inline-flex h-11 cursor-pointer select-none items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-60 disabled:shadow-none', className)}>
      {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export function IconButton({ children, label, onClick, disabled, disabledReason, expanded, controls }: { children: ReactNode; label: string; onClick?: () => void; disabled?: boolean; disabledReason?: string; expanded?: boolean; controls?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? disabledReason : undefined} aria-label={label} aria-expanded={expanded} aria-controls={controls} className="relative inline-flex size-10 cursor-pointer select-none items-center justify-center rounded-xl text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-black active:translate-y-0 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-45">
      {children}
    </button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-lg bg-slate-200', className)} aria-hidden="true" />
}

export function EmptyState({ title, description, action, icon: Icon = Inbox, className }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn('group rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center transition-colors duration-200 hover:border-slate-300 sm:px-7', className)}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"><Icon className="size-5" /></div>
      <p className="mt-4 text-base font-semibold tracking-tight text-slate-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function InlineFeedback({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  return <div role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'} className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm shadow-sm', tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700')}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1 leading-6">{children}</div></div>
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
