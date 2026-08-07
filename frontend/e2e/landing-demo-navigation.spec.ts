import { expect, test, type Page } from '@playwright/test'

const demoStorageKeys = [
  'refai_demo_mode',
  'refai_demo_decision',
  'refai_demo_journey_stage',
]

async function openSignedOutLanding(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Explore Live Demo' })).toBeVisible()
}

test('signed-out primary CTA enters the isolated demo and survives refresh and browser history', async ({ page }) => {
  await openSignedOutLanding(page)

  const demoCalls: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/resume/') || url.includes('/referral/') || url.includes('/trust-card')) demoCalls.push(url)
  })

  const liveDemo = page.getByRole('link', { name: 'Explore Live Demo' })
  await expect(liveDemo).toHaveAttribute('href', '/dashboard?demo=1')
  await liveDemo.click()

  await expect(page).toHaveURL(/\/dashboard(?:\?demo=1)?$/)
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('refai_demo_mode'))).toBe('true')
  expect(demoCalls).toEqual([])

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()
  expect(demoCalls).toEqual([])

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Explore Live Demo' })).toBeVisible()
})

test('direct demo fallback URL enters Demo Mode and remains refresh-safe', async ({ page }) => {
  await page.goto('/dashboard?demo=1')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('refai_demo_mode'))).toBe('true')

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()
})

test('exiting Demo Mode clears isolated state and restores normal signed-out routing', async ({ page }) => {
  await openSignedOutLanding(page)
  await page.getByRole('link', { name: 'Explore Live Demo' }).click()
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()

  const judgeModeSwitch = page.getByRole('switch', { name: 'Disable Judge Mode' })
  await expect(judgeModeSwitch).toBeVisible()
  await judgeModeSwitch.click()

  await expect(page).toHaveURL(/\/auth$/)
  const storedDemoState = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, sessionStorage.getItem(key)])), demoStorageKeys)
  expect(storedDemoState).toEqual(Object.fromEntries(demoStorageKeys.map((key) => [key, null])))

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth$/)
})

test('How It Works supports direct fragments and keyboard navigation with the sticky header offset', async ({ page }) => {
  await openSignedOutLanding(page)

  const howItWorks = page.locator('.hero-actions').getByRole('link', { name: 'See How It Works', exact: true })
  await expect(howItWorks).toHaveAttribute('href', '/#how-it-works')
  await howItWorks.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/#how-it-works$/)
  await expect.poll(() => page.locator('#how-it-works').evaluate((section) => Math.round(section.getBoundingClientRect().top))).toBeLessThanOrEqual(100)
  await expect.poll(() => page.locator('#how-it-works').evaluate((section) => Math.round(section.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0)

  await page.goto('/#how-it-works')
  await expect.poll(() => page.locator('#how-it-works').evaluate((section) => Math.round(section.getBoundingClientRect().top))).toBeLessThanOrEqual(100)
})

test('mobile landing CTAs use the same internal demo and explanation routes without video configuration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSignedOutLanding(page)

  const liveDemo = page.getByRole('link', { name: 'Explore Live Demo' })
  await expect(liveDemo).toBeVisible()
  await expect(liveDemo).toHaveAttribute('href', '/dashboard?demo=1')

  const navbarDemo = page.getByRole('link', { name: 'Get Started' })
  await expect(navbarDemo).toBeVisible()
  await expect(navbarDemo).toHaveAttribute('href', '/dashboard?demo=1')

  await liveDemo.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dashboard(?:\?demo=1)?$/)
  await expect(page.getByRole('switch', { name: 'Disable Judge Mode' })).toBeVisible()
})
