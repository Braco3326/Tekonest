/**
 * Task 28 fix round 1: a press on a NON-interactive part of any Mode Création dialog (its title, its text, its padding, the backdrop)
 * must not take focus out of it: after it, Échap and the arrows still reach the dialog (modal.ts).
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}
const inDialog = (page: Page) => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)

test('Projet name dialog: a press on its title, its padding or the backdrop keeps focus in it; Échap then closes it', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  const dialog = page.getByTestId('cr-name-dialog')
  await expect(dialog).toBeVisible()
  const field = page.getByRole('textbox', { name: 'Nom du projet' })
  await expect(field).toBeFocused()
  await dialog.locator('.cr-dialog-title').click()
  expect(await inDialog(page), 'after a press on the title').toBe(true)
  await dialog.click({ position: { x: 3, y: 3 } }) // the box's own padding
  expect(await inDialog(page), 'after a press on the padding').toBe(true)
  await page.mouse.click(5, 400) // the backdrop
  expect(await inDialog(page), 'after a press on the backdrop').toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('a focusable ancestor ABOVE the dialog (an app container with a tabindex) does not take the focus on a press on the title', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => document.body.setAttribute('tabindex', '-1'))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  const dialog = page.getByTestId('cr-name-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('.cr-dialog-title').click()
  expect(await inDialog(page), 'after a press on the title').toBe(true)
  await page.mouse.click(5, 400) // the backdrop
  expect(await inDialog(page), 'after a press on the backdrop').toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('« Ouvrir… » dialog: a press on its text keeps focus in it; Échap closes it', async ({ page }) => {
  await boot(page)
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Ouvrir/ }).click()
  const dialog = page.getByTestId('cr-open-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('.cr-dialog-body').click()
  expect(await inDialog(page), 'after a press on the body text').toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('a control still takes focus on a press (the input, a button): only non-interactive parts are kept from it', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  const dialog = page.getByTestId('cr-name-dialog')
  await dialog.getByRole('button', { name: 'Annuler' }).focus()
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Nom du projet' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)
})
