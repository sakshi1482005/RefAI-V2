import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const { default: TrustScoreExplanation } = await vite.ssrLoadModule(
    '/src/components/dashboard/TrustScoreExplanation.tsx',
  )

  const component = (key, label, maximumScore, score, basisPercentage, status, strong) => ({
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
    evidenceMissing: strong ? [] : [`Evidence not observed for ${label}.`],
    evidenceItems: [{
      id: `EV-${key.toUpperCase()}`,
      status,
      factLabel: `${label} fact`,
      snippet: strong || status === 'Self-declared' ? `Exact ${label.toLowerCase()} resume line.` : null,
      resumeSection: strong || status === 'Self-declared' ? 'Projects' : null,
      whyItAffectsScore: strong ? 'This line supports the deterministic tier.' : 'No demonstrated evidence was observed.',
      sourceType: strong || status === 'Self-declared' ? 'resume' : 'missing',
    }],
    improvementAction: strong
      ? `Preserve the observable ${label.toLowerCase()} evidence.`
      : `Add truthful evidence for ${label.toLowerCase()}.`,
    potentialImprovementPoints: maximumScore - score,
    limitation: `${label} uses deterministic observable signals only.`,
  })

  const card = (strong) => {
    const breakdown = strong
      ? [
          component('roleRequirementMatch', 'Role Requirement Match', 30, 28, 93, 'Resume supported', true),
          component('evidenceStrength', 'Evidence Strength', 25, 23, 92, 'Resume supported', true),
          component('projectExperienceRelevance', 'Project and Experience Relevance', 20, 18, 90, 'Resume supported', true),
          component('skillDepth', 'Skill Depth', 15, 14, 93, 'Self-declared', true),
          component('resumeEvidenceCompleteness', 'Resume Evidence Completeness', 10, 8, 80, 'Needs clarification', true),
        ]
      : [
          component('roleRequirementMatch', 'Role Requirement Match', 30, 6, 20, 'Missing evidence', false),
          component('evidenceStrength', 'Evidence Strength', 25, 5, 20, 'Self-declared', false),
          component('projectExperienceRelevance', 'Project and Experience Relevance', 20, 2, 10, 'Missing evidence', false),
          component('skillDepth', 'Skill Depth', 15, 4, 25, 'Missing evidence', false),
          component('resumeEvidenceCompleteness', 'Resume Evidence Completeness', 10, 3, 30, 'Needs clarification', false),
        ]
    return {
      trustScore: breakdown.reduce((sum, item) => sum + item.score, 0),
      scoreVersion: 'trust-score-v4-vector-relevance',
      scoreFormula: 'Role Requirement Match 30 + Evidence Strength 25 + Project and Experience Relevance 20 + Skill Depth 15 + Resume Evidence Completeness 10',
      scoreBreakdown: breakdown,
      analysisReliability: {
        label: strong ? 'High reliability' : 'Low reliability',
        basis: strong ? 'Multiple structured evidence-backed claims were extracted.' : 'Only limited resume evidence was extracted.',
        limitations: 'Student-provided evidence was not independently verified.',
      },
    }
  }

  for (const scenario of ['strong', 'weak']) {
    const trustCard = card(scenario === 'strong')
    const html = renderToStaticMarkup(
      React.createElement(TrustScoreExplanation, { trustCard }),
    )
    assert.equal((html.match(/data-testid="trust-score-component-/g) ?? []).length, 5)
    assert.match(html, new RegExp(`Component total: ${trustCard.trustScore} / 100`))
    assert.ok(html.includes('How this score was calculated'))
    assert.ok(html.includes(trustCard.analysisReliability.label))
    for (const factor of trustCard.scoreBreakdown) {
      assert.ok(html.includes(factor.label))
      assert.ok(html.includes(factor.formulaOrBasis))
      assert.ok(html.includes(factor.improvementAction))
      assert.ok(html.includes(factor.limitation))
      assert.ok(html.includes(`Review ${factor.label}: ${factor.score} of ${factor.maximumScore} points`))
    }
    assert.ok(html.includes(scenario === 'strong' ? 'Extracted resume evidence' : 'Missing evidence'))
  }

  const selfDeclaredHtml = renderToStaticMarkup(
    React.createElement(TrustScoreExplanation, { trustCard: card(true) }),
  )
  assert.ok(selfDeclaredHtml.includes('Self-declared claim'))
  assert.ok(selfDeclaredHtml.includes('Exact skill depth resume line.'))
  assert.ok(selfDeclaredHtml.includes('Resume section:'))
  assert.ok(selfDeclaredHtml.includes('Evidence ref:'))

  const legacy = card(false)
  legacy.scoreBreakdown = legacy.scoreBreakdown.map(({ evidenceItems, ...factor }) => factor)
  legacy.analysisReliability = null
  const legacyHtml = renderToStaticMarkup(
    React.createElement(TrustScoreExplanation, { trustCard: legacy }),
  )
  assert.ok(legacyHtml.includes('does not include an Analysis Reliability assessment'))
  assert.ok(legacyHtml.includes('Saved evidence gap'))
  assert.ok(!legacyHtml.includes('LEGACY-MISSING'))

  console.log('Trust Score explanation UI: strong, weak, self-declared, and legacy scenarios passed')
} finally {
  await vite.close()
}
