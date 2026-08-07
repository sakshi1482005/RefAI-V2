import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const hook = read('../src/hooks/useReferralHistory.ts')
const timeline = read('../src/components/dashboard/ReferralJourneyTimeline.tsx')
const client = read('../src/lib/apiClient.ts')

assert.match(hook, /useReferralHistory\(requestId: string, enabled: boolean\)/, 'history must be scoped to one request and an explicit open state')
assert.match(hook, /if \(!enabled \|\| !requestId\)/, 'closed timelines must not fetch history')
assert.match(hook, /\[enabled, requestId, refreshVersion\]/, 'history reads must be stable until the request changes or the user retries')
assert.match(hook, /X-RefAI-No-Retry/, 'history reads must opt out of automatic transient-error retries')
assert.match(timeline, /useReferralHistory\(requestId, open\)/, 'timeline must fetch only after it opens')
assert.match(timeline, /<details/, 'each dashboard row must defer its timeline request behind an explicit disclosure')
assert.match(client, /!retryOptOut/, 'the API client must honour the history retry opt-out')

console.log('referral history loading assertions: 7 passed')
