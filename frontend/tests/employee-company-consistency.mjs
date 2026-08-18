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
assert.doesNotMatch(studentDashboard, /company: employee\.company \|\| 'Company not listed'/, 'employee selection cards must not fabricate an employer label')
assert.doesNotMatch(studentDashboard, /designation: employee\.designation \|\| 'Employee'/, 'employee selection cards must not fabricate a title')
assert.match(studentDashboard, /employeeDirectoryIdentity\(employee\)/, 'selection cards must use the neutral identity formatter for missing real fields')

console.log('Employee company consistency assertions: 9 passed')
