import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

try {
  const { createUserScopedResource } = await server.ssrLoadModule('/src/lib/userScopedResource.ts')
  const { getStudentWorkflowState } = await server.ssrLoadModule('/src/lib/studentWorkflow.ts')

  const resource = createUserScopedResource(() => ({}))
  resource.activate('saved-user')
  await resource.load('saved-user', async () => ({ analysisId: 'saved', matchScore: { overall: 80 } }))
  assert.equal(getStudentWorkflowState({ profile: { id: 'saved-user' }, session: resource.getSnapshot('saved-user').data }).hasAnalysis, true, 'saved analysis should restore without refresh')

  resource.activate('new-user')
  const notFound = Object.assign(new Error('not found'), { status: 404 })
  await resource.load('new-user', async () => { throw notFound })
  assert.equal(resource.getSnapshot('new-user').notFound, true)
  assert.equal(getStudentWorkflowState({ profile: { id: 'new-user' }, session: resource.getSnapshot('new-user').data }).primaryAction.label, 'Upload Resume', 'new user should reach upload only after loading')

  resource.setData('new-user', { analysisId: 'fresh', matchScore: { overall: 75 } })
  assert.equal(resource.getSnapshot('new-user').data.analysisId, 'fresh', 'successful analysis should update immediately')

  resource.activate('slow-user')
  const slow = deferred()
  const slowLoad = resource.load('slow-user', () => slow.promise)
  assert.equal(resource.getSnapshot('slow-user').loading, true, 'slow latest-analysis read must remain loading')
  assert.equal(resource.getSnapshot('slow-user').notFound, false, 'loading must not masquerade as empty')
  slow.resolve({ analysisId: 'slow-result' })
  await slowLoad

  resource.activate(null)
  resource.activate('next-user')
  assert.deepEqual(resource.getSnapshot('next-user').data, {}, 'logout/account change must not retain prior data')
  resource.setData('next-user', { analysisId: 'next-only' })
  resource.activate('other-user')
  assert.deepEqual(resource.getSnapshot('other-user').data, {}, 'a second account must start with an isolated cache key')

  const stale = deferred()
  const staleLoad = resource.load('other-user', () => stale.promise)
  resource.setData('other-user', { analysisId: 'newer-success' })
  stale.resolve({ analysisId: 'older-delayed' })
  await staleLoad
  assert.equal(resource.getSnapshot('other-user').data.analysisId, 'newer-success', 'older response must not overwrite newer state')

  resource.activate('strict-user')
  let requestCount = 0
  const strictRead = deferred()
  const first = resource.load('strict-user', () => { requestCount += 1; return strictRead.promise })
  const second = resource.load('strict-user', () => { requestCount += 1; return strictRead.promise })
  assert.equal(requestCount, 1, 'Strict Mode-equivalent duplicate reads should share one in-flight request')
  strictRead.resolve({ analysisId: 'deduplicated', trustCard: { trustScore: 88 } })
  await Promise.all([first, second])
  assert.equal(resource.getSnapshot('strict-user').data.trustCard.trustScore, 88, 'Trust Card data must remain part of the restored analysis resource')

  console.log('student state synchronization tests: 9 passed')
} finally {
  await server.close()
}
