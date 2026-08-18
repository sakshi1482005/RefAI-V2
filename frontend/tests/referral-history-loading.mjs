import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const hook = read('../src/hooks/useReferralHistory.ts')
const timeline = read('../src/components/dashboard/ReferralJourneyTimeline.tsx')
const client = read('../src/lib/apiClient.ts')
const historyContract = read('../src/lib/referralHistoryContract.ts')
const studentDashboard = read('../src/pages/StudentDashboard.tsx')

assert.match(hook, /useReferralHistory\(requestId: string, enabled: boolean\)/, 'history must be scoped to one request and an explicit open state')
assert.match(hook, /if \(authLoading \|\| !enabled \|\| !requestId \|\| !key\) return/, 'closed timelines must not fetch history')
assert.match(hook, /createUserScopedResource/, 'history reads must reuse the existing shared user-scoped resource pattern')
assert.match(hook, /\$\{authenticatedUserId\}:\$\{requestId\}/, 'history cache keys must include the authenticated user and request')
assert.match(hook, /historyResource\.load\(key/, 'history requests must deduplicate through the shared resource')
assert.match(hook, /X-RefAI-No-Retry/, 'history reads must opt out of automatic transient-error retries')
assert.match(timeline, /useReferralHistory\(requestId, open\)/, 'timeline must fetch only after it opens')
assert.match(timeline, /<details/, 'each dashboard row must defer its timeline request behind an explicit disclosure')
assert.match(client, /!retryOptOut/, 'the API client must honour the history retry opt-out')
assert.match(historyContract, /student_responded/, 'the persisted student response event must be recognized by the shared timeline contract')
assert.match(historyContract, /Student Responded/, 'the shared timeline must label a persisted student response clearly')
assert.match(studentDashboard, /MoreInformationResponsePanel/, 'the student dashboard must expose the existing request response action')

console.log('referral history loading assertions: 12 passed')
