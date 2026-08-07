import { ShieldCheck, UserRound } from 'lucide-react'
import type { EmployeeReliabilityBadge as EmployeeReliabilityBadgeData } from '../../types'
import { Badge, MetricTooltip } from './primitives'

export default function EmployeeReliabilityBadge({ badge }: { badge: EmployeeReliabilityBadgeData }) {
  const counts = badge.relevantCounts
  const calculated = new Date(badge.lastCalculatedAt)
  const calculatedLabel = Number.isNaN(calculated.getTime()) ? 'recently' : calculated.toLocaleDateString()
  const explanation = [
    badge.basis,
    `${counts.meaningfulResponses} meaningful response(s), ${counts.completedReferrals} completed referral(s), and ${counts.recentMeaningfulResponses} response(s) in the last 30 days.`,
    `Calculated ${calculatedLabel}.`,
    badge.limitations[0],
  ].filter(Boolean).join(' ')
  const established = badge.badgeType === 'reliable_referrer' || badge.badgeType === 'verified_referrer'

  return <Badge className="employee-reliability-badge" tone={established ? 'success' : badge.badgeType === 'new_referrer' ? 'info' : 'neutral'}>
    {established ? <ShieldCheck className="mr-1 size-3.5" aria-hidden="true" /> : <UserRound className="mr-1 size-3.5" aria-hidden="true" />}
    <MetricTooltip label={badge.label} explanation={explanation} />
  </Badge>
}
