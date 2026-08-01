import type { TrustCardResult } from '../types'

export type ReferralReadinessLabel = 'Strong' | 'Developing' | 'Needs More Evidence'

export type ReferralReadinessGateResult = {
  label: ReferralReadinessLabel
  strongestEvidence: string[]
  majorMissingEvidence: string[]
  unsupportedRequiredSkills: string[]
  basis: string
}

const unique = (values: Array<string | null | undefined>) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]

export function calculateReferralReadiness(card: TrustCardResult): ReferralReadinessGateResult {
  const strongestEvidence = unique([
    ...card.evidence,
    ...card.strengths,
    ...card.scoreBreakdown.flatMap((component) => component.evidenceFound ?? []),
  ]).slice(0, 3)
  const criticalGaps = card.missingRequirements.filter((item) => item.priority === 'critical')
  const unsupportedRequiredSkills = unique([
    ...criticalGaps.map((item) => item.requirement),
    ...card.scoreBreakdown
      .filter((component) => component.key === 'roleRequirementMatch')
      .flatMap((component) => component.evidenceMissing ?? []),
  ]).slice(0, 5)
  const majorMissingEvidence = unique([
    ...card.missingRequirements.map((item) => item.requirement),
    ...card.scoreBreakdown
      .filter((component) => component.contribution < component.weight * 0.6)
      .flatMap((component) => component.evidenceMissing ?? []),
  ]).slice(0, 4)
  const lowEvidenceComponents = card.scoreBreakdown.filter((component) => component.contribution < component.weight * 0.5).length

  let label: ReferralReadinessLabel = 'Developing'
  if (card.trustScore >= 75 && strongestEvidence.length >= 3 && unsupportedRequiredSkills.length === 0 && criticalGaps.length === 0) {
    label = 'Strong'
  } else if ((card.trustScore < 50 && strongestEvidence.length < 2) || unsupportedRequiredSkills.length >= 3 || criticalGaps.length >= 3 || lowEvidenceComponents >= 3) {
    label = 'Needs More Evidence'
  }

  const basis = label === 'Strong'
    ? 'The Trust Card combines a strong deterministic score with multiple evidence-backed strengths and no recorded critical requirement gaps.'
    : label === 'Developing'
      ? 'The Trust Card contains useful evidence, with some role requirements or supporting details still open for improvement.'
      : 'The Trust Card records limited supporting evidence or several important evidence gaps. You may improve these first or continue after reviewing them.'

  return { label, strongestEvidence, majorMissingEvidence, unsupportedRequiredSkills, basis }
}

