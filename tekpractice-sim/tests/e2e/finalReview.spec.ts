/**
 * Final whole-branch review, minor items (feature/tekpractice-designer-nav):
 * page language, pending undo dismissed by every applyDesign, Essais chunk
 * failure, keyboard focus blocked during a compare, in-app reduced motion.
 */
import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page): Promise<void> {
  await page.goto('/?level=sandbox')
  await page.waitForFunction(() => !!window.__audioSim)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
}

async function freeze(page: Page, prediction: string): Promise<void> {
  await page.locator('#es-prediction').fill(prediction)
  await page.locator('#es-prediction').blur()
  await page.keyboard.press('KeyG')
}

test('in-app « Mouvements réduits » toggles the root class (CSS animations off)', async ({ page }) => {
  await boot(page)
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/reduced-motion/)
  await page.locator('#explore-toolbar [data-act="settings"]').click()
  const select = page.locator('.ex-panel[data-panel="settings"] select[name="reducedMotion"]')
  await select.selectOption('on')
  await expect(html).toHaveClass(/reduced-motion/)
  await select.selectOption('off')
  await expect(html).not.toHaveClass(/reduced-motion/)
  await select.selectOption('on')
  // persisted: a reload keeps it
  await page.reload()
  await page.waitForFunction(() => !!window.__audioSim)
  await expect(html).toHaveClass(/reduced-motion/)
})
