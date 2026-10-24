import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation) // the shell boots from a lazy chunk, after `load`
}

test('viewport ≥ 60 % of the window at 1366×768, nothing overlays it', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  const r = (await page.getByTestId('viewport').boundingBox())!
  expect((r.width * r.height) / (1366 * 768)).toBeGreaterThanOrEqual(0.6)
  const covered = await page.evaluate(({ x, y, w, h }) => {
    const pts: [number, number][] = []
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) pts.push([x + (w * i) / 10, y + (h * j) / 10])
    return pts.filter(([px, py]) => document.elementFromPoint(px, py)?.id !== 'renderCanvas').length
  }, { x: r.x, y: r.y, w: r.width, h: r.height })
  expect(covered).toBeLessThanOrEqual(2) // only the cube corner may cover sample points (Task 17)
  // the canvas fills the viewport (no legacy band above it)
  const c = (await page.locator('#renderCanvas').boundingBox())!
  expect(Math.abs(c.y - r.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(c.height - r.height)).toBeLessThanOrEqual(1)
})

test('the shell owns the full window: menubar at the top, status bar at the bottom, no legacy chrome', async ({ page }) => {
  await boot(page)
  const menubar = (await page.getByTestId('menubar').boundingBox())!
  expect(menubar.y).toBe(0)
  expect(menubar.height).toBe(32)
  const status = (await page.getByTestId('status-bar').boundingBox())!
  expect(status.y + status.height).toBe(768)
  expect(status.height).toBe(28)
  // the back-to-site link lives in the top bar, not floating over the scene
  const back = page.getByRole('link', { name: 'Retour au site Tekonest' })
  await expect(back).toBeVisible()
  expect(await back.evaluate((a) => !!a.closest('[data-testid="menubar"]'))).toBe(true)
  expect(await page.evaluate(() => document.querySelectorAll('#site-link').length)).toBe(1)
})

test('panels collapse and expand with named buttons', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank')) // the start screen covers the panels until a place is chosen (Task 12)
  await page.getByRole('button', { name: 'Replier le panneau Projet' }).click()
  await expect(page.getByRole('button', { name: 'Déplier le panneau Projet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Déplier le panneau Projet' })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Replier le panneau Propriétés' }).click()
  const r = (await page.getByTestId('viewport').boundingBox())!
  expect(r.width).toBeGreaterThan(1366 - 2 * 32 - 2)
  await page.getByRole('button', { name: 'Déplier le panneau Projet' }).click()
  await expect(page.getByRole('button', { name: 'Replier le panneau Projet' })).toBeVisible()
})

test('skip link first, canvas one tab stop with its aria-label', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Tab')
  const skip = page.getByTestId('skip-link')
  await expect(skip).toBeFocused()
  await expect(skip).toHaveText('Aller à la vue 3D')
  const canvas = page.locator('#renderCanvas')
  await expect(canvas).toHaveAttribute('tabindex', '0')
  await expect(canvas).toHaveAttribute('aria-label', /Vue 3D/)
  expect(await canvas.evaluate((c) => c.closest('[data-testid="viewport"]') !== null)).toBe(true)
})

test('menubar follows the WAI-ARIA pattern (arrows, Enter opens, Esc closes and returns focus)', async ({ page }) => {
  await boot(page)
  const bar = page.getByRole('menubar', { name: 'Menu principal' })
  const tops = bar.getByRole('menuitem')
  await expect(tops).toHaveText(['Projet', 'Lieu', 'Matériel', 'Câblage', 'Écoute', 'Vue', 'Aide'])
  // roving tabindex: one top item in the tab order
  expect(await tops.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length)).toBe(1)
  await tops.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tops.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(tops.nth(6)).toBeFocused() // wraps
  await page.keyboard.press('Home')
  await expect(tops.first()).toBeFocused()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Projet' })
  await expect(menu).toBeVisible()
  await expect(tops.first()).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('menuitem', { name: /Annuler/ })).toBeFocused()
  await expect(menu.getByRole('menuitem', { name: /Annuler/ })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: /Rétablir/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(tops.first()).toBeFocused()
  await expect(tops.first()).toHaveAttribute('aria-expanded', 'false')
})

test('Vue menu toggles the Projet panel; Lieu menu changes the place', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Vue' }).click()
  await page.getByRole('menuitem', { name: 'Panneau Projet' }).click()
  await expect(page.getByRole('button', { name: 'Déplier le panneau Projet' })).toBeVisible()
  // Lieu → « Choisir un lieu… » opens the picker (Task 12); a card click changes the place
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  await page.getByRole('option', { name: /Salle vide neutre/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('status-bar')).toContainText('Salle vide neutre')
})

test('axe: 0 serious/critical issues; fonts are Tektur + IBM Plex Sans; square corners', async ({ page }) => {
  await boot(page)
  const res = await new AxeBuilder({ page }).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cr-menubar')!).fontFamily)).toMatch(/IBM Plex Sans/)
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.cr-title')!).fontFamily)).toMatch(/Tektur/)
  // self-hosted fonts actually load (same origin)
  expect(await page.evaluate(async () => (await document.fonts.ready, document.fonts.check('600 14px Tektur') && document.fonts.check('14px "IBM Plex Sans"')))).toBe(true)
  const radii = await page.evaluate(() => [...document.querySelectorAll('.cr *')].map((e) => getComputedStyle(e).borderRadius).filter((r) => r !== '0px'))
  expect(radii).toEqual([])
})

test('200 % zoom (683×384): every menu and the way back to the site stay inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 683, height: 384 })
  await boot(page)
  for (const name of ['Projet', 'Aide']) {
    const b = (await page.getByRole('menuitem', { name }).boundingBox())!
    expect(b.x + b.width).toBeLessThanOrEqual(683)
  }
  const back = (await page.getByRole('link', { name: 'Retour au site Tekonest' }).boundingBox())!
  expect(back.x + back.width).toBeLessThanOrEqual(683)
  expect(back.x).toBeGreaterThanOrEqual(0)
})

test('axe with a place on screen and a menu open', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  const res = await new AxeBuilder({ page }).analyze()
  expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})
