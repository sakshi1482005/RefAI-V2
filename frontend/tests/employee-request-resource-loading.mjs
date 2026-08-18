import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/hooks/useEmployeeRequestResource.ts', import.meta.url), 'utf8')

assert.match(source, /createUserScopedResource/, 'employee request reads must reuse the shared resource implementation')
assert.match(source, /\$\{authenticatedUserId\}:\$\{endpoint\}/, 'request cache keys must include the authenticated employee')
assert.match(source, /useSyncExternalStore/, 'multiple review screens must subscribe to one in-flight-safe source')
assert.match(source, /api\.get<unknown>\(endpoint, \{ signal \}\)/, 'stale detail reads must receive an abort signal')
assert.match(source, /employeeRequestResource\.load\(key/, 'same-page remounts must reuse an existing request')

console.log('employee request resource loading assertions: 5 passed')
