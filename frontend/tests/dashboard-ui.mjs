import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const student = read('../src/pages/StudentDashboard.tsx')
const employee = read('../src/pages/EmployeeDashboard.tsx')
const pageShell = read('../src/components/dashboard/PageShell.tsx')
const profileMenu = read('../src/components/dashboard/ProfileMenu.tsx')
const notifications = read('../src/components/dashboard/NotificationCentre.tsx')

assert.equal((student.match(/<NotificationCentre\s*\/>/g) ?? []).length, 1, 'student dashboard must mount one notification centre')
assert.equal((student.match(/<ProfileMenu\b/g) ?? []).length, 1, 'student dashboard must mount one profile/settings menu')
assert.match(student, /navigate\('\/dashboard\/resume'\)[\s\S]*Analyse New Opportunity/, 'primary opportunity action must open the resume workspace')
assert.doesNotMatch(student, /No recent activity/, 'empty recent activity section should not consume dashboard space')

assert.doesNotMatch(pageShell, /Employee settings unavailable|label=.*Settings/, 'shared page chrome must not duplicate or disable Settings controls')
assert.equal((profileMenu.match(/> Settings\s*</g) ?? []).length, 1, 'profile menu must remain the single Settings entry')
assert.match(notifications, /if \(isDemoMode\) return null/, 'Demo Mode must not render a non-functional notification control')

assert.doesNotMatch(employee, /Recent decisions|Candidate Trust Score:/, 'employee dashboard must not repeat queue information')
assert.match(employee, /aria-label="Queue filters"/, 'queue filters must remain accessible')
assert.match(employee, /aria-pressed=\{queueFilter === value\}/, 'queue filters must expose their selected state')
assert.match(employee, /flex-wrap gap-2/, 'queue filters must wrap instead of creating horizontal overflow')
assert.match(employee, /h-40 rounded-xl/, 'employee queue must use stable loading skeleton rows')

console.log('Dashboard UI cleanup assertions: 13 passed')
