import { expect, test } from '@playwright/test'

test('demo Candidate Review opens with the 30-second evidence summary at 1366x768', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await page.getByRole('link', { name: 'Explore Live Demo' }).click()
  await page.goto('/dashboard')
  await page.evaluate(() => sessionStorage.setItem('refai_demo_journey_stage', 'referral-sent'))
  await page.goto('/employee/review/demo-referral-001')

  await expect(page.getByRole('heading', { name: 'Evidence-based referral review' })).toBeVisible()
  await expect(page.getByText('What to do next')).toHaveCount(0)
  await expect(page.getByText('Evidence-checked candidate — reviewed before reaching you.')).toBeInViewport()
  for (const label of ['Candidate Trust Score', 'Analysis Reliability', 'Referral Compatibility', 'Top strengths', 'Key concerns or missing evidence', 'Claim verification warnings']) {
    await expect(page.getByText(label, { exact: true })).toBeInViewport()
  }
  await expect(page.getByText('Advisory AI · Demo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve for referral' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request more information' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decline request' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open raw resume' })).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  expect(dimensions.scrollHeight).toBeLessThan(1800)
})
