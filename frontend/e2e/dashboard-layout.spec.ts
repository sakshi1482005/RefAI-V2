import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
]

async function expectNoPageOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth, `${label} should not scroll horizontally`).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function enterDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Explore Live Demo' }).click()
  await expect(page).toHaveURL(/\/dashboard(?:\?demo=1)?$/)
}

test('student dashboard stays concise and overflow-free at major breakpoints', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await enterDemo(page)
    await expect(page.getByRole('button', { name: 'Analyse New Opportunity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What would improve your evidence most' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Latest workspace activity' })).toHaveCount(0)
    await expect(page.getByLabel(/Notifications/)).toHaveCount(0)
    await expect(page.getByLabel('Open profile menu')).toHaveCount(1)
    await expectNoPageOverflow(page, viewport.label)
  }

  await page.getByLabel('Open profile menu').click()
  await expect(page.getByRole('menuitem', { name: 'Settings' })).toHaveCount(1)
  await page.keyboard.press('Escape')

  const primaryAction = page.getByRole('button', { name: 'Analyse New Opportunity' })
  await primaryAction.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dashboard\/resume$/)
})

test('employee dashboard removes repeated controls and remains overflow-free', async ({ page }) => {
  await enterDemo(page)
  await page.goto('/employee/dashboard')

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('heading', { name: 'Referral review workspace' })).toBeVisible()
    await expect(page.getByText('Recent decisions')).toHaveCount(0)
    await expect(page.getByLabel('Employee settings unavailable')).toHaveCount(0)
    await expect(page.getByLabel(/Notifications/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explain Reliable Referrer' })).toBeVisible()
    await expectNoPageOverflow(page, viewport.label)
  }

  const filters = page.getByLabel('Queue filters')
  await expect(filters).toBeVisible()
  await expect(filters.getByRole('button', { name: 'Recently submitted' })).toHaveAttribute('aria-pressed', 'true')
})

test('student employee discovery shows the shared reliability badge without mobile overflow', async ({ page }) => {
  await enterDemo(page)
  await page.goto('/dashboard')
  await page.evaluate(() => sessionStorage.setItem('refai_demo_journey_stage', 'trust-card-generated'))
  await page.reload()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard#find-referrers')
  await expect(page.getByRole('button', { name: 'Explain Reliable Referrer' })).toBeVisible()
  await expect(page.getByText('Top Referrer')).toHaveCount(0)
  await expectNoPageOverflow(page, 'mobile employee discovery badge')
})
