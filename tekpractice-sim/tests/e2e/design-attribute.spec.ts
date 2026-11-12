// T0.1: `html[data-design]` exists only for a valid ?design=1..5 on the Mode Création route.
import { expect, test } from '@playwright/test'

test('no ?design: no data-design attribute, the place picker boots as today', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByTestId('place-picker')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-design'))).toBe(false)
  expect(errors).toEqual([])
})

for (const id of [1, 2, 3, 4, 5]) {
  test(`?design=${id} sets html[data-design="${id}"]`, async ({ page }) => {
    await page.goto(`/?design=${id}`)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-design', String(id))
  })
}

for (const bad of ['?design=0', '?design=6', '?design=abc', '?design=', '?design=1&design=2']) {
  test(`${bad} leaves no data-design attribute`, async ({ page }) => {
    await page.goto(`/${bad}`)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-design'))).toBe(false)
  })
}

// Legacy addresses never reach the creation boot, so they never carry the attribute (a legacy page cold-boots slowly: 30 s budget).
const LEGACY_BOOT_MS = 30_000
const noAttr = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.hasAttribute('data-design'))

test('?legacy=1&design=2: the legacy home boots and carries no data-design attribute', async ({ page }) => {
  await page.goto('/?legacy=1&design=2')
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: LEGACY_BOOT_MS })
  await expect(page.getByTestId('place-picker')).toHaveCount(0)
  expect(await noAttr(page)).toBe(false)
})

test('?level=a1&design=2: the legacy level boots and carries no data-design attribute', async ({ page }) => {
  await page.goto('/?level=a1&design=2')
  await page.waitForFunction(() => !!window.__audioSim, undefined, { timeout: LEGACY_BOOT_MS })
  await expect(page.getByTestId('place-picker')).toHaveCount(0)
  expect(await noAttr(page)).toBe(false)
})

test('?level=a1&mode=exam&design=2: the exam address carries no data-design attribute', async ({ page }) => {
  await page.goto('/?level=a1&mode=exam&design=2')
  await page.waitForFunction(() => !!window.__audioSim, undefined, { timeout: LEGACY_BOOT_MS })
  await expect(page.locator('#exam-timer')).toBeVisible()
  expect(await noAttr(page)).toBe(false)
})

// Not an exam address: decideRoute sends only ?level= and ?legacy=1 to the legacy app, so `mode=exam` alone is Mode Création.
test('?design=2&mode=exam (no level) still routes to Mode Création and carries the attribute', async ({ page }) => {
  await page.goto('/?design=2&mode=exam')
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-design', '2')
})
