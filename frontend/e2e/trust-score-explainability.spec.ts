import { expect, test, type Page } from '@playwright/test'

async function openDemoTrustCard(page: Page) {
  await page.goto('/dashboard/resume?demo=1')
  await page.getByRole('button', { name: 'Analyze Resume' }).click()
  await expect(page).toHaveURL(/\/dashboard\/resume-analysis$/)
  await page.getByRole('button', { name: 'Generate Trust Card' }).click()
  await expect(page).toHaveURL(/\/dashboard\/trust-card$/)
  await expect(page.getByTestId('trust-score-explanation')).toBeVisible()
  await expect(page.locator('[data-testid^="trust-score-component-"]')).toHaveCount(5)
}

test('desktop Trust Card centers the deterministic score and exposes structured evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openDemoTrustCard(page)

  const scorePanel = page.getByTestId('trust-score-explanation')
  await expect(scorePanel.getByText('91', { exact: true })).toBeVisible()
  await expect(scorePanel.getByText('Component total: 91 / 100')).toBeVisible()

  const formulaButton = scorePanel.getByRole('button', { name: 'How this score was calculated' })
  await formulaButton.click()
  await expect(scorePanel.getByText('Role Requirement Match 30 + Evidence Strength 25 + Project and Experience Relevance 20 + Skill Depth 15 + Resume Evidence Completeness 10')).toBeVisible()

  const evidenceComponent = page.getByTestId('trust-score-component-evidenceStrength')
  await evidenceComponent.locator('summary').click()
  await expect(evidenceComponent.getByText('Built a FastAPI service used by 240 students.')).toBeVisible()
  await expect(evidenceComponent.getByText('Projects', { exact: true })).toBeVisible()
  await expect(evidenceComponent.getByText('EV-DEMO-STRENGTH-01')).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Claim Verification' })).toBeVisible()
  await expect(page.getByText('Led a team of 10.', { exact: true }).first()).toBeVisible()
  const leadershipClaim = page.getByTestId('claim-verification-needs-clarification')
  await leadershipClaim.locator('summary').click()
  await expect(leadershipClaim.getByText('Self-declared / Needs clarification')).toBeVisible()
  await expect(leadershipClaim.getByText('What was your individual responsibility, the team context, and the observable outcome for this leadership claim?')).toBeVisible()
})

test('mobile Trust Card keeps all components accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDemoTrustCard(page)

  const component = page.getByTestId('trust-score-component-roleRequirementMatch')
  const summary = component.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(component.getByText('System design: No resume line demonstrates system-design decisions.')).toBeVisible()
  await expect(component.getByText('Missing evidence or clarification')).toBeVisible()

  const leadershipClaim = page.getByTestId('claim-verification-needs-clarification')
  const leadershipSummary = leadershipClaim.locator('summary')
  await leadershipSummary.focus()
  await page.keyboard.press('Enter')
  await expect(leadershipClaim.getByText('Exact resume context')).toBeVisible()
  await expect(leadershipClaim.getByText('Led a team of 10.', { exact: true }).last()).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
