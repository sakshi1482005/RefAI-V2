import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const stored = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key),
  },
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const { default: ClaimVerificationPanel } = await vite.ssrLoadModule(
    '/src/components/dashboard/ClaimVerificationPanel.tsx',
  )
  const { AuthSessionProvider } = await vite.ssrLoadModule('/src/context/AuthSessionContext.tsx')
  const result = {
    statusVersion: 'claim-verification-v2-significant-claims',
    interpretationSource: 'deterministic_fallback',
    limitation: 'Statuses do not make misconduct judgments or independently verify evidence.',
    claims: [
      {
        id: 'CL-SUPPORTED', claim: 'Improved checkout completion by 18% for 240 users using React.', category: 'quantified_impact', status: 'Evidence supported', reason: 'Concrete action and outcome.',
        resumeEvidence: ['Improved checkout completion by 18% for 240 users using React.'], supportingEvidenceSnippets: ['Improved checkout completion by 18% for 240 users using React.'], resumeSection: 'Experience', resumeContext: 'Improved checkout completion by 18% for 240 users using React.', missingSupport: null, suggestedClarificationQuestion: null, proofEvidence: [],
      },
      {
        id: 'CL-PARTIAL', claim: 'Built a Python API for campus events.', category: 'project', status: 'Partially supported', reason: 'Action is present but outcome is incomplete.',
        resumeEvidence: ['Built a Python API for campus events.'], supportingEvidenceSnippets: ['Built a Python API for campus events.'], resumeSection: 'Projects', resumeContext: 'Built a Python API for campus events.', missingSupport: 'Observable outcome is not stated.', suggestedClarificationQuestion: 'What did you personally implement and what result did it produce?', proofEvidence: [],
      },
      {
        id: 'CL-LEADERSHIP', claim: 'Led a team of 10.', category: 'leadership', status: 'Needs clarification', reason: 'This is a meaningful self-declared claim without enough scope.',
        resumeEvidence: ['Led a team of 10.'], supportingEvidenceSnippets: [], resumeSection: 'Leadership', resumeContext: 'Led a team of 10.', missingSupport: 'Project, responsibility, duration, and outcome are not stated.', suggestedClarificationQuestion: 'What was your responsibility and the observable outcome?', proofEvidence: [],
      },
      {
        id: 'CL-SELF', claim: 'Python', category: 'skill', status: 'Self-declared', reason: 'Listed without demonstrated context.',
        resumeEvidence: ['Python'], supportingEvidenceSnippets: [], resumeSection: 'Skills', resumeContext: 'Python', missingSupport: 'No project or experience context.', suggestedClarificationQuestion: 'Which project demonstrates Python?', proofEvidence: [],
      },
    ],
  }

  const renderPanel = (initialResult) => renderToStaticMarkup(React.createElement(AuthSessionProvider, null, React.createElement(ClaimVerificationPanel, { initialResult })))
  const html = renderPanel(result)
  assert.ok(html.includes('Claim Verification'))
  assert.ok(html.includes('Evidence supported'))
  assert.ok(html.includes('Partially supported'))
  assert.ok(html.includes('Self-declared / Needs clarification'))
  assert.ok(html.includes('Self-declared'))
  assert.ok(html.includes('Exact resume context'))
  assert.ok(html.includes('Leadership'))
  assert.ok(html.includes('Led a team of 10.'))
  assert.ok(html.includes('Suggested clarification question'))
  assert.ok(html.includes('Deterministic review'))
  assert.ok(!html.toLowerCase().includes('fraudulent'))
  assert.ok(html.includes('aria-label='))

  const legacy = {
    statusVersion: 'claim-verification-v1',
    limitation: 'Legacy result.',
    claims: [{ claim: 'Python', status: 'Resume supported', reason: 'Saved resume support.', resumeEvidence: ['Built a Python API.'], proofEvidence: [] }],
  }
  const legacyHtml = renderPanel(legacy)
  assert.ok(legacyHtml.includes('Partially supported'))
  assert.ok(legacyHtml.includes('Built a Python API.'))
  assert.ok(legacyHtml.includes('No exact resume context was saved for this legacy claim.'))

  console.log('Claim Verification UI: supported, partial, self-declared, clarification, and legacy scenarios passed')
} finally {
  await vite.close()
}
