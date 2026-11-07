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
import { quietWindow } from './waits'

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
  await quietWindow(page, 500)
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

// ── Night 2 wave 5, P1-1: the ENTRY script itself is missing or served as HTML (production did that for hashed assets: 200 text/html) ────────────────────────
// main.js never runs, so the boot-failure alert above cannot show. The inline guard in index.html TELLS the user (role="alert") and offers a link that refreshes the page (?v=<time> on the page address, ignored by the router). It does not
// change the entry script's address: if an edge still serves HTML under it the failure comes back; the cure is site-side (see the wave 5 report). Review C1: it acts only before the app started.
const ENTRY = '**/assets/main-*.js'
for (const [what, fulfill] of [
  ['served as text/html (200)', { status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>home</body></html>' }],
  ['a 404', { status: 404, contentType: 'text/plain', body: 'not found' }],
] as const) {
  test(`P1-1: the entry script ${what}: an alert says so, its link refreshes the page (?v=<time> on the page address; the entry script's own address is the same) and the app then starts once the file is served again`, async ({ page }) => {
    await page.route(ENTRY, (r) => r.fulfill(fulfill))
    await page.goto('/')
    const alert = page.getByTestId('entry-failure')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveAttribute('role', 'alert')
    await expect(alert).toContainText('Le jeu n’a pas pu se charger. Rechargez la page en forçant le rafraîchissement (Ctrl+F5) ou ouvrez-la de nouveau.')
    const link = alert.getByRole('link', { name: 'Recharger la page' })
    await expect(link).toBeFocused()
    await expect(link).toHaveAttribute('href', /^https?:\/\/[^/]+\/\?v=\d+$/) // a full address (never protocol-relative)
    await expect(page.getByTestId('boot-failure'), 'one alert, not two').toHaveCount(0)
    await page.unroute(ENTRY) // the edge now serves the real file
    await link.click()
    await page.waitForFunction(() => !!window.__creation)
    await expect(page).toHaveURL(/\?v=\d+$/)
    await expect(page.getByTestId('place-picker'), 'the router ignores v: Mode Création, not legacy').toBeVisible()
    await expect(page.getByTestId('entry-failure')).toHaveCount(0)
  })
}

test('P1-1: a normal load never shows the guard (Mode Création, and legacy)', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('entry-failure')).toHaveCount(0)
  await page.goto('/?legacy=1')
  await expect(page.locator('#hud')).toBeAttached()
  await quietWindow(page, 1000) // a quiet window: nothing may appear after the load either
  await expect(page.getByTestId('entry-failure')).toHaveCount(0)
})

test('P1-1: the legacy entry (?legacy=1) that cannot load shows the guard too, keeping the other query parameters in the reload link', async ({ page }) => {
  await page.route(ENTRY, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }))
  await page.goto('/?legacy=1')
  const link = page.getByTestId('entry-failure').getByRole('link', { name: 'Recharger la page' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', /^https?:\/\/[^/]+\/\?legacy=1&v=\d+$/)
})

test('P1-1: a lazy chunk that fails to preload shows ONE alert (the boot chunk has its own, the guard stays out of its way)', async ({ page }) => {
  await page.route('**/assets/boot-*.js', (r) => r.abort())
  await page.goto('/')
  await expect(page.getByTestId('boot-failure')).toBeVisible()
  await quietWindow(page, 600) // past the guard's 100 ms wait: it must not add a second alert
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByTestId('entry-failure')).toHaveCount(0)
})

test('C1: the legacy route chunk that cannot load (before the app started) shows the entry guard once, and not the creation boot-failure alert too', async ({ page }) => {
  await page.route('**/assets/legacyMain-*.js', (r) => r.abort())
  await page.goto('/?legacy=1')
  await expect(page.getByTestId('entry-failure')).toBeVisible()
  await expect(page.getByTestId('entry-failure')).toHaveCount(1)
  await quietWindow(page, 400)
  await expect(page.getByTestId('entry-failure')).toHaveCount(1) // once, whatever fires (the import rejection, vite:preloadError)
  await expect(page.getByTestId('boot-failure'), 'one alert, not two').toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(1)
})
