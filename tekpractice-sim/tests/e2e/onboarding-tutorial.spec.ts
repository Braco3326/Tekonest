/**
 * The tutorial « Premiers pas » in the browser (onboarding packs, plan T3.2, spec 6; G8 review C2). Driven on `/?design=1` with an empty storage.
 * The learner's actions are made through the page's own intents (`window.__creation.dispatch`: the same `history.do` path as the UI) for the 3D placement
 * and the cables, and through the real menu for Écoute › Signal de test (the sound really starts: `audioState()`).
 *
 * Pinned: « Faire le tutoriel » rings step 1 (the QL1 card in the open drawer); steps 1 to 10 end on the test signal playing, then the neutral end line;
 * steps done early read « Déjà en place » and are passed; a reload at step 6 keeps step 6 (Aide « Reprendre à l’étape 6 » shows it, ringed); a finished
 * tutorial does not restart after a reload; « Passer le tutoriel » stops it and Aide offers « Premiers pas » again; nothing on `?oscar=0` or an exam address.
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1366, height: 768 } })

const GUIDE_KEY = 'oscar-guide.onboarding.v1'
const live = (page: Page) => page.locator('.oscar-live')
const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')
const step = (k: number, n = 10): string => `Parcours « Premiers pas » : étape ${k} sur ${n}.`
const guideRecord = (page: Page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), GUIDE_KEY)

async function openFresh(page: Page, query = '?design=1'): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** « Je découvre », then « Faire le tutoriel »: the neutral room opens and the request goes up. */
async function takeTutorial(page: Page): Promise<void> {
  await openFresh(page)
  await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
  await page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
}
const act = (page: Page, intents: unknown[]) =>
  page.evaluate((list) => {
    for (const i of list) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, intents)
const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
const SETUP = {
  console: [spawn('yamaha-ql1', 'ql1', 0)],
  micro: [spawn('shure-sm58', 'sm58', 0.8)],
  enceinte: [spawn('qsc-k12-2', 'k12', -1)],
  consoleEnceinte: [connect('ql1', 'out-main-l', 'k12', 'in-line-a')],
  microConsole: [connect('sm58', 'out-xlr', 'ql1', 'in-mic-1')],
  lecture: [{ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }],
  multiprise: [spawn('multiprise-secteur', 'strip', 0.4)],
  courantConsole: [connect('strip', 'out-1', 'ql1', 'power-in')],
  courantEnceinte: [connect('strip', 'out-2', 'k12', 'power-in')],
}
async function testSignal(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: 15_000 })
}
/** The ring's centre comes to rest inside the target (the drawer slides in for 180 ms; the widget follows it on its next resync). */
const centreInside = async (page: Page, selector: string): Promise<void> => {
  await expect
    .poll(
      async () => {
        const r = await ring(page).boundingBox()
        const t = await page.locator(selector).boundingBox()
        if (!r || !t) return false
        const cx = r.x + r.width / 2
        const cy = r.y + r.height / 2
        return cx >= t.x - 2 && cx <= t.x + t.width + 2 && cy >= t.y - 2 && cy <= t.y + t.height + 2
      },
      { timeout: 5_000 },
    )
    .toBe(true)
}
async function aide(page: Page): Promise<string[]> {
  await page.locator('#cr-menu-aide').click()
  const names = await page.locator('#cr-menu-aide-panel [role="menuitem"]').allInnerTexts()
  await page.keyboard.press('Escape')
  return names.map((n) => n.split('\n')[0].trim())
}

test('« Faire le tutoriel » starts it at step 1 and rings the QL1 card; steps 1 to 10 by the learner end on the test signal, then the neutral end line', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await expect(live(page)).toContainText('posez la Yamaha QL1 sur le sol')
  await expect(ring(page)).toBeVisible()
  await centreInside(page, '[data-testid="inventory-drawer"][data-open="true"] [data-testid="inventory-item"][data-device-id="yamaha-ql1"]')
  const order: [keyof typeof SETUP, number][] = [
    ['console', 2],
    ['micro', 3],
    ['enceinte', 4],
    ['consoleEnceinte', 5],
    ['microConsole', 6],
    ['lecture', 7],
    ['multiprise', 8],
    ['courantConsole', 9],
    ['courantEnceinte', 10],
  ]
  for (const [k, next] of order) {
    await act(page, SETUP[k])
    await expect(live(page)).toContainText(step(next), { timeout: 10_000 })
    await expect(live(page)).not.toContainText('Déjà en place')
  }
  expect(await guideRecord(page)).toMatchObject({ status: 'running', k: 10, step: 'ecoute', early: [] })
  await testSignal(page)
  await expect(live(page)).toContainText('Parcours « Premiers pas » : fin des étapes.', { timeout: 10_000 })
  await expect(live(page)).not.toContainText('toutes les étapes')
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'done', step: null })
})

test('out of order: steps whose result is already there read « Déjà en place » and are passed', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  // the learner places the three devices and switches « Lecture console » on (the status bar asks for it) before the tutorial gets there
  await act(page, [...SETUP.enceinte, ...SETUP.micro, ...SETUP.console]) // the QL1 last: steps 2 and 3 are already there when step 1 ends
  await expect(live(page)).toContainText(step(4), { timeout: 10_000 })
  await expect(live(page)).toContainText('Déjà en place : étape 2, étape 3.')
  await act(page, [...SETUP.lecture, ...SETUP.consoleEnceinte])
  await expect(live(page)).toContainText(step(5), { timeout: 10_000 })
  await act(page, SETUP.microConsole)
  await expect(live(page)).toContainText(step(7), { timeout: 10_000 })
  await expect(live(page)).toContainText('Déjà en place : étape 6.')
  expect((await guideRecord(page)).early).toEqual(expect.arrayContaining(['micro', 'enceinte', 'lecture-console']))
})

test('a reload at step 6: step 6 is still current, Aide offers « Reprendre à l’étape 6 », which shows it ringed', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  for (const k of ['console', 'micro', 'enceinte', 'consoleEnceinte', 'microConsole'] as const) await act(page, SETUP[k])
  await expect(live(page)).toContainText(step(6), { timeout: 10_000 })
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'running', k: 6, step: 'lecture-console' })
  expect(await aide(page)).toEqual(['Reprendre à l’étape 6', 'Recommencer le tutoriel', 'Passer le tutoriel', 'Raccourcis clavier', 'Retour au site Tekonest'])
  await page.locator('#cr-menu-aide').click()
  await page.getByRole('menuitem', { name: 'Reprendre à l’étape 6', exact: true }).click()
  await expect(live(page)).toContainText(step(6), { timeout: 10_000 })
  await expect(ring(page)).toBeVisible()
  expect((await guideRecord(page)).handledRequest).toBe(2)
})

test('finished, then reloaded: it does not start again', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await act(page, Object.values(SETUP).flat())
  await expect(live(page)).toContainText(step(10), { timeout: 10_000 })
  await testSignal(page)
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'done' })
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await page.waitForTimeout(1500) // three bridge polls
  await expect(live(page)).not.toContainText('Premiers pas »')
  expect(await guideRecord(page)).toMatchObject({ status: 'done' })
  expect(await aide(page)).toContain('Premiers pas')
})

test('« Passer le tutoriel » stops it (no nag after a reload); Aide offers « Premiers pas » again, which starts it at step 1', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await act(page, SETUP.console)
  await expect(live(page)).toContainText(step(2), { timeout: 10_000 })
  await page.locator('#cr-menu-aide').click()
  await page.getByRole('menuitem', { name: 'Passer le tutoriel', exact: true }).click()
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'skipped' })
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await page.waitForTimeout(1500)
  await expect(live(page)).not.toContainText('Premiers pas »')
  expect((await aide(page))[0]).toBe('Premiers pas')
  await page.locator('#cr-menu-aide').click()
  await page.getByRole('menuitem', { name: 'Premiers pas', exact: true }).click()
  // step 1 is already on the bench (the QL1): « déjà en place », step 2 current
  await expect(live(page)).toContainText(step(2), { timeout: 10_000 })
  await expect(live(page)).toContainText('Déjà en place : étape 1.')
})

for (const query of ['?design=1&oscar=0', '?design=1&mode=exam']) {
  test(`${query}: no tutorial (no guide, no Aide « Premiers pas », nothing written by the guide)`, async ({ page }) => {
    await openFresh(page, query)
    await page.waitForTimeout(1500)
    await expect(page.locator('.oscar-icon')).toHaveCount(0)
    expect(await aide(page)).not.toContain('Premiers pas')
    expect(await guideRecord(page)).toBeNull()
  })
}
