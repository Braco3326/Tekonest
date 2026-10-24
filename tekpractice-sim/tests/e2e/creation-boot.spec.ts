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
test('?legacy=1 boots the legacy home (onboarding or dashboard)', async ({ page }) => {
  await page.goto('/?legacy=1')
  await expect(page.locator('#dashboard')).toBeVisible()
})
