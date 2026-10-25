import { expect, test } from '@playwright/test'
test('default URL boots Mode Création on « Choisir un lieu »', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choisir un lieu' })).toBeVisible()
  await expect(page.locator('#dashboard')).toBeHidden()
  await expect(page.locator('a[href*="level="]')).toHaveCount(0)
  expect(errors).toEqual([])
})
test('Mode Création hides every legacy surface', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.locator('#renderCanvas')).toBeHidden()
  await expect(page.locator('#board2d')).toBeHidden()
  await expect(page.locator('#dashboard')).toBeHidden()
  await expect(page.locator('#hud > *')).toHaveCount(0)
})
// The legacy home is a cold page load whose chunk statically imports game.ts, so it parses the
// whole Babylon chunk before it un-hides #dashboard. Under a loaded full run (or a 28× CPU
// throttle) that takes longer than the default 5 s expect timeout: wait for the navigation
// itself, then give the cold boot a budget sized for it.
const LEGACY_BOOT_MS = 30_000
test('legacy HUD back-arrow lands on the legacy dashboard, not Mode Création', async ({ page }) => {
  await page.goto('/?level=a1')
  const back = page.locator('#hud-objectives a[aria-label="Retour au tableau de bord"]')
  await expect(back).toBeVisible()
  await back.click()
  await page.waitForURL((u) => u.searchParams.get('legacy') === '1', { timeout: LEGACY_BOOT_MS })
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: LEGACY_BOOT_MS })
  await expect(page.getByTestId('place-picker')).toHaveCount(0)
})
test('?legacy=1 boots the legacy home (onboarding or dashboard)', async ({ page }) => {
  await page.goto('/?legacy=1')
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: LEGACY_BOOT_MS })
})
