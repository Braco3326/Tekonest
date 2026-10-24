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

test('the game page is in French: <html lang="fr">', async ({ page }) => {
  await boot(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
})

test('« Repartir de cet essai » dismisses a pending pick-up undo (it belonged to the replaced stage)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1] })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6] })
  })
  await page.getByRole('button', { name: 'Essais' }).click()
  await freeze(page, 'Premier montage.')
  await expect(page.locator('.es-row')).toHaveCount(1)
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'yamaha-ql1-s2' }))
  await expect(page.locator('.toast-undo')).toHaveCount(1)
  await page.locator('.es-row').first().click()
  await page.locator('#es-restore').click()
  await page.locator('#es-confirm-ok').click() // the live setup is not frozen: confirm
  await expect.poll(() => page.evaluate(() => window.__audioSim!.assets().length)).toBe(2)
  await expect(page.locator('.toast-undo')).toHaveCount(0)
})

test('the Essais chunk fails to load → a « recharger » toast, and the next click tries again (no stuck promise)', async ({ page }) => {
  let block = true
  await page.route(/essaisPanel-[^/]*\.js$/, (route) => (block ? route.abort() : route.continue()))
  await boot(page)
  const failed = page.locator('.toast-error').filter({ hasText: "Le panneau Essais n'a pas pu se charger." })
  await expect(failed.first()).toBeVisible()
  await expect(failed.first()).toContainText('Rechargez la page')
  const before = await failed.count()
  block = false
  await page.getByRole('button', { name: 'Essais' }).click()
  // The import is attempted again: it loads (Firefox, Safari), or Chromium's
  // module map still holds the failure and the toast says so again. Never silent.
  await expect
    .poll(async () => (await page.locator('#essais-panel').isVisible()) || (await failed.count()) > before)
    .toBe(true)
})

test('during a compare, Tab / Enter on the 3D view neither select nor focus a device', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.evaluate(() => {
    const sim = window.__audioSim!
    sim.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', position: [1.2, 0, -1] })
    sim.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', position: [-1.4, 0, 0.6] })
  })
  await page.getByRole('button', { name: 'Essais' }).click()
  await freeze(page, 'Premier montage.')
  await page.evaluate(() => window.__audioSim!.dispatch({ type: 'REMOVE', instanceId: 'shure-sm58-s1' }))
  await freeze(page, 'Sans le micro.')
  await expect(page.locator('.es-row')).toHaveCount(2)
  await page.keyboard.press('KeyB')
  await expect(page.locator('.es-compare')).toBeVisible()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // keys reach the 3D view
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const v = await page.evaluate(() => window.__audioSim!.view())
  expect(v.mode).toBe('ensemble')
  expect(v.selected).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.locator('.es-compare')).toBeHidden()
})

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
