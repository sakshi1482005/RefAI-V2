import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const snapshot = read('../src/components/dashboard/CandidateReviewSnapshot.tsx')
const authenticated = read('../src/components/dashboard/AuthenticatedCandidateReview.tsx')
const contract = read('../src/lib/employeeDetailContract.ts')

for (const label of ['Candidate Trust Score', 'Analysis Reliability', 'Referral Compatibility', 'Top strengths', 'Key concerns or missing evidence', 'Claim verification warnings']) {
  assert.ok(snapshot.includes(label), `30-second snapshot must show ${label}`)
}
assert.match(snapshot, /Evidence-checked candidate — reviewed before reaching you\./, 'required evidence-check microcopy must be visible')
assert.match(snapshot, /View supporting evidence/, 'summary claims must link to grounded evidence')
assert.ok(authenticated.indexOf('<CandidateReviewSnapshot') < authenticated.indexOf('Employee Review Copilot'), 'evidence snapshot must precede the Copilot and detailed content')
assert.match(authenticated, /Advisory AI/, 'Copilot must be explicitly advisory')
assert.match(authenticated, /\?refresh=true/, 'Copilot regeneration must be an explicit request')
assert.match(authenticated, />Regenerate</, 'a generated advisory summary must offer an explicit regenerate action')
assert.match(authenticated, /Approve for referral[\s\S]*Request more information[\s\S]*Decline request/, 'all employee decision actions must remain available')
assert.match(authenticated, /xl:sticky xl:top-24/, 'decision actions must remain easy to reach without covering content')
assert.match(authenticated, /Open raw resume/, 'raw resume access must remain available as a secondary action')
assert.match(contract, /value\.trustScore === undefined \|\| nullableScore\(value\.trustScore\)/, 'legacy request payloads may omit Trust Score safely')
assert.doesNotMatch(authenticated, /Reasons to approve|Reasons to reject/, 'Copilot must not frame AI output as a referral decision')
assert.match(read('../src/pages/CandidateReview.tsx'), /AuthenticatedCandidateReview/, 'the review route must use the authenticated implementation')

console.log('30-second Candidate Review assertions: 17 passed')
