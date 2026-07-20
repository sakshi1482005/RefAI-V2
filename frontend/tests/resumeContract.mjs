import { createServer } from 'vite'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { parseResumeAnalysisResponse } = await server.ssrLoadModule('/src/lib/resumeContract.ts')

const actionItem = {
  requirement: 'FastAPI', category: 'framework', priority: 'important',
  whyItMatters: 'Required for the role', practicalAction: 'Build an API',
  evidenceSuggestion: 'Add a project outcome', estimatedEffort: '2 hours', nextStep: 'Update the resume',
}
const valid = {
  overall: 72, roleFit: 80, proof: 64, gaps: 20, analysisStatus: 'complete',
  matchedSkills: ['Python'], missingSkills: ['FastAPI'], missingRequirements: [actionItem], actionPlan: [actionItem],
  strengths: ['Strong Python evidence'], evidence: ['Python appears in projects'], resumeSectionsUsed: ['Projects'],
  readinessSummary: 'Improve API evidence.', learningRecommendations: ['Build an API'], confidence: 81, processingTimeMs: 12,
}
const expectReject = (payload, label) => {
  try { parseResumeAnalysisResponse(payload, 200) } catch { return }
  throw new Error(`${label} was accepted`)
}

try {
  parseResumeAnalysisResponse(valid, 200)
  parseResumeAnalysisResponse({ ...valid, providerMetadata: null }, 200)
  expectReject({ ...valid, confidence: undefined }, 'missing required field')
  expectReject({ ...valid, overall: '72' }, 'numeric string')
  const snakeCase = { ...valid, role_fit: valid.roleFit }; delete snakeCase.roleFit
  expectReject(snakeCase, 'snake_case field')
  expectReject({ ...valid, actionPlan: ['FastAPI'] }, 'string action plan')
  const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const backendRoot = path.resolve(frontendRoot, '..', 'backend')
  const python = path.join(backendRoot, '.venv', 'Scripts', 'python.exe')
  const endpoint = spawnSync(python, ['-c', [
    'import json',
    'from fastapi.testclient import TestClient',
    'from app.main import app',
    'from app.core.security import get_current_user',
    'app.dependency_overrides[get_current_user] = lambda: {"sub": "contract-test-student"}',
    'response = TestClient(app).post("/resume/analyze", json={"resumeText": "Skills: Python FastAPI SQL. Projects: Built a FastAPI service with Python and SQL.", "jobDescription": "Requires Python, FastAPI, SQL, testing, and cloud deployment."}, headers={"Authorization": "Bearer test"})',
    'print(json.dumps({"status": response.status_code, "body": response.json()}))',
  ].join(';')], { cwd: backendRoot, encoding: 'utf8' })
  if (endpoint.status !== 0) throw new Error(endpoint.stderr || 'Backend contract process failed')
  const actual = JSON.parse(endpoint.stdout.trim())
  if (actual.status !== 200) throw new Error(`Backend returned ${actual.status}: ${JSON.stringify(actual.body)}`)
  parseResumeAnalysisResponse(actual.body, actual.status)
  console.log('frontend resume contract tests: 7 passed, including real FastAPI response')
} finally {
  await server.close()
}
