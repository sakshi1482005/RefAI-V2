import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/AIApply.tsx', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const navigation = readFileSync(new URL('../src/components/dashboard/StudentNavigation.tsx', import.meta.url), 'utf8')

assert.match(routes, /path="\/dashboard\/ai-apply"/)
assert.match(navigation, /label: 'AI Apply'/)
assert.match(page, /A current resume analysis and Candidate Trust Card are required/)
assert.match(page, /targetRole: targetRole\.trim\(\)/)
assert.match(page, /targetCompany: targetCompany\.trim\(\)/)
assert.match(page, /minimumCompatibility/)
assert.match(page, /numberOfMatches/)
assert.match(page, /idempotencyKey/)
assert.match(page, /api\.get<AIApplyAllowance>\('\/ai-apply\/allowance'\)/)
assert.match(page, /api\.post<AIApplySubmission>\('\/ai-apply\/requests'/)
assert.match(page, /Weekly remaining/)
assert.match(page, /Why employees were excluded/)
assert.match(page, /Requests are never auto-created/)
assert.match(page, /factual integrity, compatibility, employee availability, capacity, your weekly allowance, and one credit/)
assert.match(page, /Demo data is never sent to authenticated matching endpoints/)
assert.doesNotMatch(page, /api\.post[^\n]*\/referral\/requests/)

console.log('AI Apply student goal and review workflow assertions passed.')
