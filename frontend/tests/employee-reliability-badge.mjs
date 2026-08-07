import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const student = read('../src/pages/StudentDashboard.tsx')
const employee = read('../src/pages/EmployeeDashboard.tsx')
const badge = read('../src/components/dashboard/EmployeeReliabilityBadge.tsx')
const types = read('../src/types/index.ts')

assert.match(types, /reliabilityBadge: EmployeeReliabilityBadge/, 'directory and profile contracts must expose the stable badge summary')
assert.match(types, /'new_referrer' \| 'verified_referrer' \| 'reliable_referrer' \| 'developing_referrer'/, 'badge types must be closed and deterministic')
assert.ok((student.match(/<EmployeeReliabilityBadge\b/g) ?? []).length >= 3, 'student discovery, profile preview/selection, and referral gate must use the shared badge')
assert.match(employee, /<EmployeeReliabilityBadge badge=\{reliabilityBadge\}/, 'employee dashboard header must show the same badge')
assert.match(badge, /MetricTooltip/, 'badge must provide an accessible explanation tooltip')
assert.match(badge, /meaningful response\(s\)/, 'tooltip must explain safe aggregate response evidence')
assert.doesNotMatch(student, /reliability\.metrics/, 'student UI must not expose the private five-metric analytics breakdown')
assert.doesNotMatch(student, /Top Referrer/, 'student UI must not create a public employee ranking label')

console.log('Employee reliability badge assertions: 8 passed')
