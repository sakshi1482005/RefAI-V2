import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const { default: TrustScoreExplanation } = await vite.ssrLoadModule(
    '/src/components/dashboard/TrustScoreExplanation.tsx',
  )

  const component = (key, label, maximumScore, score, basisPercentage, strong) => ({
    key,
    label,
    weight: maximumScore,
    score,
    maximumScore,
    basisPercentage,
    contribution: score,
    reason: `${label} deterministic summary.`,
    details: {},
    formulaOrBasis: `${basisPercentage}% deterministic basis weighted to ${score}/${maximumScore}.`,
    evidenceFound: strong ? [`Resume: Observable ${label.toLowerCase()} evidence.`] : [],
    evidenceMissing: strong ? [] : [`JD fact not observed for ${label}.`],
    improvementAction: strong
      ? `Preserve the observable ${label.toLowerCase()} evidence.`
      : `Add truthful evidence for ${label.toLowerCase()}.`,
    potentialImprovementPoints: maximumScore - score,
    limitation: `${label} uses deterministic observable signals only.`,
  })

  const card = (strong) => {
    const breakdown = strong
      ? [
          component('roleRequirementMatch', 'Role Requirement Match', 30, 28, 93, true),
          component('evidenceStrength', 'Evidence Strength', 25, 23, 92, true),
          component('projectExperienceRelevance', 'Project and Experience Relevance', 20, 18, 90, true),
          component('skillDepth', 'Skill Depth', 15, 14, 93, true),
          component('resumeEvidenceCompleteness', 'Resume Evidence Completeness', 10, 8, 80, true),
        ]
      : [
          component('roleRequirementMatch', 'Role Requirement Match', 30, 6, 20, false),
          component('evidenceStrength', 'Evidence Strength', 25, 5, 20, false),
          component('projectExperienceRelevance', 'Project and Experience Relevance', 20, 2, 10, false),
          component('skillDepth', 'Skill Depth', 15, 4, 25, false),
          component('resumeEvidenceCompleteness', 'Resume Evidence Completeness', 10, 3, 30, false),
        ]
    return {
      id: strong ? 'strong-card' : 'weak-card',
      candidateName: 'Test Candidate',
      role: 'Backend Engineer',
      overallMatch: strong ? 90 : 18,
      roleFit: strong ? 92 : 20,
      proofScore: strong ? 88 : 10,
      gapScore: strong ? 8 : 80,
      confidence: 80,
      trustScore: breakdown.reduce((sum, item) => sum + item.score, 0),
      scoreVersion: 'trust-score-v3-explainable',
      referralReadiness: strong ? 'Ready to request referral' : 'Not ready yet',
      recommendation: strong ? 'Ready for referral' : 'Not ready yet',
      strengths: [],
      weaknesses: [],
      missingSkills: [],
      missingRequirements: [],
      actionPlan: [],
      evidence: [],
      riskSignals: [],
      scoreFormula: 'Five deterministic weighted components',
      scoreBreakdown: breakdown,
      scoreReasons: [],
      aiSummary: '',
      education: { college: null, degree: null, branch: null, graduationYear: null },
    }
  }

  for (const scenario of ['strong', 'weak']) {
    const trustCard = card(scenario === 'strong')
    const html = renderToStaticMarkup(
      React.createElement(TrustScoreExplanation, { trustCard, isDemoMode: false }),
    )
    assert.equal((html.match(/<details/g) ?? []).length, 5)
    assert.match(html, new RegExp(`Weighted result: ${trustCard.trustScore} / 100`))
    for (const factor of trustCard.scoreBreakdown) {
      assert.ok(html.includes(factor.label))
      assert.ok(html.includes(factor.formulaOrBasis))
      assert.ok(html.includes(factor.improvementAction))
      assert.ok(html.includes(factor.limitation))
    }
    assert.ok(html.includes(scenario === 'strong' ? 'Evidence found' : 'Evidence not observed'))
  }

  console.log('Trust Score explanation UI: strong and weak scenarios passed')
} finally {
  await vite.close()
}
