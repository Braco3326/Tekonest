/**
 * Phase 1 review (Important 1): Mode Création is the default URL, so a computer
 * without WebGL, or a chunk that fails to load, must never leave the learner on
 * « Choisissez un lieu pour commencer. » with nothing to click. A persistent
 * alert says why and gives the way out (the 2D version, or a reload).
 * Review minor: while « Choisir un lieu » is open, « Annuler » / « Rétablir » and
 * the creation shortcuts are off (they never edit the rig under the picker); the
 * menus themselves stay usable (Exporter…, Ouvrir…, Vue, Aide on a first visit).
 */
import { expect, test, type Page } from '@playwright/test'

const pageErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test('no WebGL: a persistent alert « Vue 3D indisponible » links to the 2D version, which works; 0 page errors', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    const stub = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest)
    }
    HTMLCanvasElement.prototype.getContext = stub as typeof orig
  })
  const errors = pageErrors(page)
  await page.goto('/')
  const alert = page.getByRole('alert').filter({ hasText: 'Vue 3D indisponible' })
  await expect(alert).toBeVisible()
  const link = alert.getByRole('link', { name: 'Ouvrir la version 2D' })
  await expect(link).toHaveAttribute('href', '?level=a1&render=2d')
  await expect(link).toBeFocused()
  await expect(page.getByTestId('place-picker')).toHaveCount(0)
  await page.waitForTimeout(500)
  await expect(alert).toBeVisible() // persistent: no close button, nothing replaces it
  await expect(alert.getByRole('button')).toHaveCount(0)
  expect(errors).toEqual([])
  // The way out really works without WebGL: the 2D board.
  await link.click()
  await expect(page.locator('#board2d .board2d')).toBeVisible()
  expect(errors).toEqual([])
})

for (const [what, pattern] of [
  ['the place-picker chunk', '**/assets/placePicker-*.js'],
  ['the Mode Création chunk itself', '**/assets/boot-*.js'],
] as const) {
  test(`${what} fails to load: an alert says so with « Recharger la page »; 0 page errors`, async ({
    page,
  }) => {
    await page.route(pattern, (r) => r.abort())
    const errors = pageErrors(page)
    await page.goto('/')
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Le Mode Création n’a pas pu se charger' })
    await expect(alert).toBeVisible()
    const reload = alert.getByRole('button', { name: 'Recharger la page' })
    await expect(reload).toBeFocused()
    expect(errors).toEqual([])
    // The reload button reloads (the chunk is back once the route is gone).
    await page.unroute(pattern)
    await reload.click()
    await page.waitForFunction(() => !!window.__creation)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Le Mode Création n’a pas pu se charger' })
    ).toHaveCount(0)
  })
}

test('« Choisir un lieu » open over a rig: « Annuler » is disabled and Ctrl+Z does nothing; closed, both work again', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() =>
    window.__creation!.dispatch({
      type: 'SPAWN',
      deviceId: 'yamaha-ql1',
      instanceId: 'ql1',
      position: [0, 0, 8],
    })
  )
  const undoSize = (): Promise<number> => page.evaluate(() => window.__creation!.historySize())
  const instances = (): Promise<number> =>
    page.evaluate(() => window.__creation!.design().rig.instances.length)
  const u0 = await undoSize()

  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: /^Choisir un lieu/ }).click()
  const picker = page.getByTestId('place-picker')
  await expect(picker).toBeVisible()
  // Shortcuts: Ctrl+Z / Ctrl+Y do nothing under the picker (the keys stay the browser's)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+y')
  expect(await instances()).toBe(1)
  expect(await undoSize()).toBe(u0)
  // Menus stay usable (Exporter…, Ouvrir…, Vue, Aide: the first visit needs them), but
  // « Annuler » / « Rétablir » are disabled and a click on them changes nothing
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  const undoItem = page
    .getByRole('menu', { name: 'Projet' })
    .getByRole('menuitem', { name: /^Annuler/ })
  await expect(undoItem).toHaveAttribute('aria-disabled', 'true')
  await undoItem.click({ force: true })
  expect(await instances()).toBe(1)
  expect(await undoSize()).toBe(u0)
  await page.keyboard.press('Escape') // closes the menu

  await picker.getByRole('button', { name: 'Fermer' }).click() // closable: a place is on screen
  await expect(picker).toBeHidden()
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await expect(
    page.getByRole('menu', { name: 'Projet' }).getByRole('menuitem', { name: /^Annuler/ })
  ).not.toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(instances).toBe(0)
})
