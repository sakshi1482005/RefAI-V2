import { createServer } from 'vite'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

try {
  const { createUserScopedResource } = await server.ssrLoadModule('/src/lib/userScopedResource.ts')
  const resource = createUserScopedResource(() => null)
  const key = 'student-a:analysis-a'
  resource.activate(key)

  let requestCount = 0
  const pending = deferred()
  const loader = () => { requestCount += 1; return pending.promise }
  const dashboardPrefetch = resource.load(key, loader)
  const hoverPrefetch = resource.load(key, loader)
  const pageNavigation = resource.load(key, loader)
  assert.equal(requestCount, 1, 'dashboard, hover, and navigation must share one in-flight request')
  assert.equal(resource.getSnapshot(key).loading, true, 'a slow persisted-card request must expose loading state')
  assert.equal(resource.getSnapshot(key).notFound, false, 'loading must not appear as an empty Trust Card')
  pending.resolve({ id: 'card-a', inputKey: 'versioned-key' })
  await Promise.all([dashboardPrefetch, hoverPrefetch, pageNavigation])
  assert.equal(resource.getSnapshot(key).data.id, 'card-a')

  await resource.load(key, loader)
  assert.equal(requestCount, 1, 'normal navigation must reuse the loaded persisted card')

  resource.activate('student-b:analysis-b')
  assert.equal(resource.getSnapshot('student-b:analysis-b').data, null, 'account switching must not expose another student card')

  const dashboardSource = fs.readFileSync(new URL('../src/pages/StudentDashboard.tsx', import.meta.url), 'utf8')
  const resultSource = fs.readFileSync(new URL('../src/pages/ResumeAnalysisResult.tsx', import.meta.url), 'utf8')
  const cardSource = fs.readFileSync(new URL('../src/pages/TrustCard.tsx', import.meta.url), 'utf8')
  assert.match(dashboardSource, /prefetchTrustCard/, 'dashboard should prefetch the shared Trust Card resource')
  assert.match(resultSource, /onMouseEnter=.*prefetch/, 'Trust Card action should prefetch on hover')
  assert.match(resultSource, /onFocus=.*prefetch/, 'Trust Card action should prefetch on keyboard focus')
  assert.match(cardSource, /loadingPersisted/, 'Trust Card page should distinguish persisted-card loading')
  assert.match(cardSource, /deterministic_fallback/, 'Trust Card page should identify deterministic narrative fallback')

  console.log('Trust Card performance resource tests: 12 passed')
} finally {
  await server.close()
}
