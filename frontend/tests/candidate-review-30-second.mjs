import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const snapshot = read('../src/components/dashboard/CandidateReviewSnapshot.tsx')
const authenticated = read('../src/components/dashboard/AuthenticatedCandidateReview.tsx')
const demo = read('../src/pages/CandidateReview.tsx')
const contract = read('../src/lib/employeeDetailContract.ts')
const nextStep = read('../src/components/dashboard/RecommendedNextStep.tsx')

for (const label of ['Candidate Trust Score', 'Analysis Reliability', 'Referral Compatibility', 'Top strengths', 'Key concerns or missing evidence', 'Claim verification warnings']) {
  assert.ok(snapshot.includes(label), `30-second snapshot must show ${label}`)
}
assert.match(snapshot, /Evidence-checked candidate — reviewed before reaching you\./, 'required evidence-check microcopy must be visible')
assert.match(snapshot, /View supporting evidence/, 'summary claims must link to grounded evidence')
assert.ok(authenticated.indexOf('<CandidateReviewSnapshot') < authenticated.indexOf('Employee Review Copilot'), 'evidence snapshot must precede the Copilot and detailed content')
assert.match(authenticated, /Advisory AI/, 'Copilot must be explicitly advisory')
assert.match(authenticated, /Approve for referral[\s\S]*Request more information[\s\S]*Decline request/, 'all employee decision actions must remain available')
assert.match(authenticated, /xl:sticky xl:top-24/, 'decision actions must remain easy to reach without covering content')
assert.match(authenticated, /Open raw resume/, 'raw resume access must remain available as a secondary action')
assert.match(contract, /value\.trustScore === undefined \|\| nullableScore\(value\.trustScore\)/, 'legacy request payloads may omit Trust Score safely')
assert.match(demo, /CandidateReviewSnapshot[\s\S]*Advisory AI · Demo/, 'isolated Demo Mode must use the same evidence-first and advisory presentation')
assert.doesNotMatch(demo, /Reasons to approve|Reasons to reject/, 'Demo Copilot must not frame AI output as a referral decision')
assert.match(nextStep, /pathname\.startsWith\('\/employee\/review\/'\)\) return null/, 'no wrapper card may appear before the evidence snapshot')

console.log('30-second Candidate Review assertions: 16 passed')
