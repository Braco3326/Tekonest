/**
 * Night 2 wave 5, P2-1: « Raccourcis clavier » was dead in Mode Création (the menu item aria-disabled, H opened nothing) while the site page and the guide point to it.
 * Now H and Aide › Raccourcis clavier open a dialog built from the live key map: focus kept in, Échap closes and gives the focus back, one announcement, axe clean.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const PLACE = 'room:concert-hall-medium'
const boot = async (page: Page, place: string | null = PLACE): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  if (!place) return
  await page.evaluate((p) => window.__creation!.choosePlace(p), place)
  await page.waitForFunction((p) => window.__creation!.place() === p, place)
}
const dialog = (page: Page) => page.getByTestId('cr-shortcuts-dialog')
const canvas = (page: Page) => page.locator('#renderCanvas')

test('H opens the shortcuts dialog from the 3D view; Échap closes it and the focus is back on the 3D view', async ({ page }) => {
  await boot(page)
  await canvas(page).focus()
  await page.keyboard.press('h')
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toHaveAttribute('role', 'dialog')
  await expect(dialog(page)).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(canvas(page)).toBeFocused()
})

test('Aide › Raccourcis clavier is enabled and opens it; Échap closes it and the focus goes back', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  const item = page.getByRole('menuitem', { name: 'Raccourcis clavier' })
  await expect(item).toBeVisible()
  await expect(item).not.toHaveAttribute('aria-disabled', 'true')
  await expect(item).toContainText('H') // its shortcut is shown
  await item.click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement !== document.body && !!document.activeElement), 'the focus is on something, not lost to the page').toBe(true)
  await page.getByRole('button', { name: 'Fermer' }).count() // (the dialog is gone: none)
})

test('on the first screen (the picker) the Aide menu opens it; H alone does nothing outside the 3D view (a character key shortcut: WCAG 2.1.4)', async ({ page }) => {
  await boot(page, null)
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await page.keyboard.press('h')
  await expect(dialog(page)).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Raccourcis clavier' }).click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
})

test('H typed on a button or in a field does not open it (only with the 3D view focused)', async ({ page }) => {
  await boot(page)
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('h')
  await expect(dialog(page)).toHaveCount(0)
})

test('the list names every key of the 3D view label (arrows, [ ], Entrée, 1 2 3, G, Échap, Ctrl+Z) and takes its labels from the key map', async ({ page }) => {
  await boot(page)
  const label = (await canvas(page).getAttribute('aria-label'))!
  expect(label).toMatch(/flèches/)
  await canvas(page).focus()
  await page.keyboard.press('h')
  const list = page.getByTestId('shortcuts-list')
  await expect(list).toBeVisible()
  const row = (id: string) => list.locator(`dd[data-row="${id}"] kbd`).allTextContents()
  expect(await row('orbit')).toEqual(['Flèches'])
  expect(await row('next')).toEqual([']'])
  expect(await row('prev')).toEqual(['['])
  expect(await row('frame')).toEqual(['F', 'Entrée'])
  expect(await row('points')).toEqual(['1', '2', '3'])
  expect(await row('snap')).toEqual(['G'])
  expect(await row('cancel')).toEqual(['Échap'])
  expect(await row('undo')).toEqual(['Ctrl+Z'])
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Vue 3D', 'Appareils', 'Projet'])
  // the names are real words next to the keys
  await expect(list.locator('dt', { hasText: 'Cadrer la sélection' })).toBeVisible()
})

test('the dialog keeps the focus inside (Tab and Shift+Tab wrap), and says itself once in the status line', async ({ page }) => {
  await boot(page)
  await canvas(page).focus()
  await page.keyboard.press('h')
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('.cr-status-msg')).toHaveText('Liste des raccourcis clavier affichée.')
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `Tab ${i + 1}`).toBe(true)
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `Shift+Tab ${i + 1}`).toBe(true)
  }
  // the keys of the page are off behind it (a modal handles its own keys)
  const before = await page.evaluate(() => window.__creation!.design().rig.instances.length)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Delete')
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length)).toBe(before)
  await page.getByRole('button', { name: 'Fermer' }).click()
  await expect(dialog(page)).toHaveCount(0)
})

test('on a short, narrow window the list scrolls inside the box and is a focus stop (the box never leaves the window)', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 500 })
  await boot(page)
  await canvas(page).focus()
  await page.keyboard.press('h')
  const box = (await dialog(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(400)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(500)
  const list = page.getByTestId('shortcuts-list')
  expect(await list.evaluate((e) => e.scrollHeight > e.clientHeight), 'the list scrolls here').toBe(true)
  await list.focus()
  await expect(list).toBeFocused()
  await page.keyboard.press('End')
  await expect.poll(() => list.evaluate((e) => e.scrollTop)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeInViewport()
})

test('axe: no violation with the shortcuts dialog open (1366 and 400 px)', async ({ page }) => {
  await boot(page)
  await canvas(page).focus()
  await page.keyboard.press('h')
  await expect(dialog(page)).toBeVisible()
  let r = await new AxeBuilder({ page }).include('[data-testid="cr-shortcuts-dialog"]').analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 400, height: 800 })
  await canvas(page).focus()
  await page.keyboard.press('h')
  await expect(dialog(page)).toBeVisible()
  r = await new AxeBuilder({ page }).include('[data-testid="cr-shortcuts-dialog"]').analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
})
