import type { MatchScore, TrustCardResult } from '../types'

export function matchScoreFromTrustCard(card: TrustCardResult): MatchScore {
  return { overall: card.overallMatch, roleFit: card.roleFit, proof: card.proofScore, gaps: card.gapScore }
}

export type ExplainedInsight = {
  title: string
  description: string
}

export function buildScoreReasons(score: MatchScore, includeDemoEvidence = false) {
  const reasons = [
    `Role Fit is ${score.roleFit}% because that share of meaningful job-description terms appears in the resume.`,
    `Proof is ${score.proof}% because matched requirements are reinforced more than once in the resume.`,
    `${score.gaps}% of target-role terminology remains unmatched and limits the result.`,
    `Overall Match is ${score.overall}%—the average of Role Fit and Proof, not a hiring probability.`,
  ]
  if (includeDemoEvidence) reasons.splice(2, 0, 'Demo evidence includes React delivery, FastAPI ownership, SQL outcomes, and team collaboration.')
  return reasons
}

export function buildResumeInsights(score: MatchScore, role?: string) {
  const roleLabel = role?.trim() || 'the target role'
  const proofDelta = Math.max(0, score.roleFit - score.proof)

  const strength: ExplainedInsight = score.roleFit >= 70
    ? {
        title: 'Strong requirement coverage',
        description: `${score.roleFit}% of the job description’s distinct meaningful terms also appear in the resume. That makes direct alignment with ${roleLabel} the strongest current signal.`,
      }
    : {
        title: 'Existing alignment is measurable',
        description: `${score.roleFit}% of distinct job-description terms are represented in the resume. This identifies a real foundation, while leaving ${score.gaps}% of requirement language unmatched.`,
      }

  const weakness: ExplainedInsight = proofDelta > 0
    ? {
        title: 'Evidence is thinner than keyword coverage',
        description: `Role Fit is ${score.roleFit}%, but Proof is ${score.proof}%—a ${proofDelta}-point difference. The backend only counts proof when matched requirements appear more than once, so relevant terms may be present without enough supporting project or experience evidence.`,
      }
    : {
        title: 'Unmatched requirements remain the main gap',
        description: `${score.gaps}% of distinct job-description terms are not represented in the resume. Those missing terms—not presentation or formatting—are what currently limit the lexical match.`,
      }

  const improvements: ExplainedInsight[] = []
  if (score.gaps > 20) {
    improvements.push({
      title: 'Close requirement-language gaps',
      description: `${score.gaps}% of distinct target-role terms are unmatched. Add only skills and responsibilities you genuinely have, using the same specific language as the job description inside experience or project bullets.`,
    })
  }
  if (proofDelta >= 10 || score.proof < 70) {
    improvements.push({
      title: 'Turn mentions into repeated evidence',
      description: `Proof (${score.proof}%) trails Role Fit (${score.roleFit}%). Support important matched requirements in more than one credible context—for example, one project outcome and one experience bullet—because repeated evidence is what raises this backend signal.`,
    })
  }
  if (score.overall < 60) {
    improvements.push({
      title: 'Strengthen the resume before referral outreach',
      description: `The overall score is ${score.overall}%, below RefAI’s 60% Trust Card readiness threshold. Improving both requirement coverage and repeated proof is more valuable than sending the current profile early.`,
    })
  }
  if (improvements.length === 0) {
    improvements.push({
      title: 'Preserve strong evidence while tailoring',
      description: `Overall alignment is ${score.overall}% with ${score.proof}% proof coverage. Keep the evidence-backed bullets intact and verify that every remaining keyword you add reflects work you can explain in an interview.`,
    })
  }

  const atsTips: ExplainedInsight[] = [
    {
      title: 'Use authentic job-description terminology',
      description: `Role Fit is calculated from normalized term overlap and currently sits at ${score.roleFit}%. Use exact role-relevant terminology where it truthfully describes your work; unrelated keyword stuffing will not create credible proof.`,
    },
    {
      title: 'Repeat critical skills through evidence, not lists',
      description: `Proof is ${score.proof}% because the model rewards matched requirements that recur in the resume. Reinforce priority skills across quantified project and experience bullets instead of repeating them only in a skills section.`,
    },
  ]

  const interviewReadiness: ExplainedInsight = {
    title: score.proof >= 70 ? 'Evidence is ready for interview follow-up' : 'Prepare stronger evidence before interviews',
    description: score.proof >= 70
      ? `Proof coverage is ${score.proof}%. Prepare concise stories for the repeated role-relevant evidence, because interviewers are likely to probe the claims that drive this score.`
      : `Proof coverage is ${score.proof}%. Before interviewing, prepare specific situation-action-result examples for matched requirements so resume terms can be defended with outcomes.`,
  }

  return { strength, weakness, improvements, atsTips, interviewReadiness }
}
