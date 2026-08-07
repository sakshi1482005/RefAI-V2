import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const auth = read('../src/pages/auth.tsx')
const dashboard = read('../src/pages/EmployeeDashboard.tsx')
const studentDashboard = read('../src/pages/StudentDashboard.tsx')
const types = read('../src/types/index.ts')

assert.match(auth, /role === "employee"[\s\S]*Enter your current company/, 'employee signup must require a company')
assert.match(auth, /company_name: company\?\.value\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/, 'signup metadata must use the normalized company_name compatibility key')
assert.match(auth, /id="su-company"[\s\S]*autoComplete="organization"/, 'employee onboarding must expose an organization field')

assert.match(dashboard, /company\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)/, 'employee profile updates must normalize company whitespace')
assert.match(types, /employeeCompanySnapshot: string \| null/, 'referral contracts must expose the immutable employee-company snapshot')
assert.match(studentDashboard, /request\.employeeCompanySnapshot \|\| employee\?\.company \|\| null/, 'saved referrals must prefer the immutable company snapshot')
assert.match(studentDashboard, /request\.employeeCompany \|\| 'Company not listed'/, 'the absent-company label must only be used after canonical and snapshot values are exhausted')

console.log('Employee company consistency assertions: 7 passed')
