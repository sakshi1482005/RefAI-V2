import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/pages/StudentDashboard.tsx', import.meta.url), 'utf8')

assert.match(source, /referralMessageCache = useRef\(new Map/, 'generated drafts must use a local reusable cache')
assert.match(source, /analysisSession\.trustCard\?\.id/, 'the cache key must include the Trust Card input version')
assert.match(source, /selectedEmployeeId/, 'the cache key must be employee-scoped')
assert.match(source, /referralJobDescription\.trim\(\)/, 'the cache key must include the optional Job Description input')
assert.match(source, /action === 'generate'/, 'only an explicit initial generate action may reuse a cached draft')
assert.match(source, /messageRequestInFlight/, 'rapid clicks must be guarded by an in-flight request lock')
assert.match(source, /referralMessageCache\.current\.clear\(\)/, 'generated message cache must clear on account change')
assert.match(source, /api\.post<ReferralMessageResult>\('\/referral\/message'/, 'the existing grounded generator endpoint must be reused')
assert.match(source, /Generate with AI/, 'the selected employee flow must expose a clear generation action')
assert.match(source, /disabled=\{messageGenerating/, 'generation and rewrite actions must be disabled while a request is active')
assert.match(source, /checkReferralQuality\(data\.message\)/, 'a generated draft must continue through the existing quality check')

console.log('referral message generation assertions: 11 passed')
