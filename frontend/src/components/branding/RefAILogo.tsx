import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RefAILogoProps = {
  inverse?: boolean
  className?: string
  markClassName?: string
  wordmarkClassName?: string
  subtitle?: ReactNode
  subtitleClassName?: string
}

export default function RefAILogo({
  inverse = false,
  className,
  markClassName,
  wordmarkClassName,
  subtitle,
  subtitleClassName,
}: RefAILogoProps) {
  const maskId = useId()

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg className={cn('size-9 shrink-0', markClassName)} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
            <rect x="0" y="0" width="120" height="120" fill="#ffffff" />
            <path d="M34,62 L52,80 L90,36" stroke="#000000" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
        <circle cx="60" cy="60" r="52" fill={inverse ? '#ffffff' : '#161A2E'} mask={`url(#${maskId})`} />
        <circle cx="60" cy="60" r="52" fill="none" stroke="#1E8F6B" strokeWidth="4" />
      </svg>
      <span>
        <span className={cn('block text-xl font-bold tracking-tight', inverse ? 'text-white' : 'text-slate-950', wordmarkClassName)}>RefAI</span>
        {subtitle ? <span className={cn('block', subtitleClassName)}>{subtitle}</span> : null}
      </span>
    </span>
  )
}
