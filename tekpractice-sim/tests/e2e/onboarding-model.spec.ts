/**
 * Package 5, the playable-model route in the browser (onboarding packs, plan T6.3, spec 7.1 / 7.2 / 8.5 / 11.10).
 *
 * `?design=5`: the start screen's answer opens the template `premier-son-pret` (read from the package's `layout.start`, not a package number) instead of the neutral room; the
 * tutorial is the three steps `ecoute`, `debrancher`, `rebrancher` (the start screen says « 3 étapes », the step card « Étape k sur 3 »). The model is already wired and powered, so
 * `ecoute` is the first sound; `debrancher` is the learner's unplug of one console-to-speaker cable, after which ONE voice is left (`audioState().voices`, the scripted count: nothing is
 * claimed about how an unplug SOUNDS); `rebrancher` is the replug. Nothing here unplugs for the learner: the power helper is never offered on this route and never touches an audio cable.
 *
 * The cables are made through `window.__creation.dispatch` (the same `history.do` path as the UI, as in onboarding-tutorial.spec.ts); the sound really starts through the real menu.
 * Exam addresses and the plain address are unchanged: no model, no start screen.
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1366, height: 768 } })

const GUIDE_KEY = 'oscar-guide.onboarding.v1'
const live = (page: Page) => page.locator('.oscar-live')
const count = (page: Page) => page.getByTestId('tutorial-step-count')
const guideRecord = (page: Page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), GUIDE_KEY)
const step = (k: number, n = 3): string => `Parcours « Premiers pas » : étape ${k} sur ${n}.`
const voices = (page: Page): Promise<string[]> => page.evaluate(() => window.__creation!.audioState().voices.map((v) => v.instanceId))
const cables = (page: Page): Promise<number> => page.evaluate(() => window.__creation!.design().rig.connections.length)
const LEFT = { a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }

async function openFresh(page: Page, query: string): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
}
/** « Je découvre », then « Faire le tutoriel » on `?design=5`: the model opens and the request goes up. */
async function takeTutorial(page: Page): Promise<void> {
  await openFresh(page, '?design=5')
  await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
  await page.getByTestId('start-screen').getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
}
async function testSignal(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: 15_000 })
}
const unplug = (page: Page) => page.evaluate((c) => window.__creation!.dispatch({ type: 'UNPLUG', a: c.a, b: c.b }), LEFT)
const replug = (page: Page) => page.evaluate((c) => window.__creation!.dispatch({ type: 'CONNECT', a: c.a, b: c.b }), LEFT)

test('the start screen says « 3 étapes » for package 5 (and « 10 étapes » for package 1)', async ({ page }) => {
  for (const [id, n] of [[5, 3], [1, 10]] as const) {
    await openFresh(page, `?design=${id}`)
    await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
    await expect(page.getByTestId('start-screen').getByRole('button', { name: new RegExp(`^Faire le tutoriel \\(conseillé · ${n} étapes, à votre rythme\\)`) })).toBeVisible()
  }
})

test('« Faire le tutoriel » on ?design=5 opens the playable model (not the empty room): five devices, six cables, step 1 is Écoute on « Étape 1 sur 3 »', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await expect(count(page)).toHaveText('Étape 1 sur 3')
  const d = await page.evaluate(() => ({ ids: window.__creation!.design().rig.instances.map((i) => i.instanceId).sort(), n: window.__creation!.design().rig.connections.length}))
  expect(d).toEqual({ ids: ['k12-d', 'k12-g', 'mains', 'ql1', 'sm58'], n: 6 })
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'running', k: 1, n: 3, step: 'ecoute' })
  expect(await voices(page), 'no sound before the learner asks for one').toEqual([])
})

test('the route: Écoute plays two voices; unplugging one line cable leaves ONE voice and the card says step 3; the replug brings the second back and the card ends', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await testSignal(page)
  await expect(live(page)).toContainText(step(2), { timeout: 10_000 })
  await expect(count(page)).toHaveText('Étape 2 sur 3')
  // the text of step 2 asks for the unplug of ONE speaker's cable and an observation, and claims no result (T6 review C2: what is heard is not verified)
  await expect(live(page)).toContainText('débranchez le câble de la console vers l’une des enceintes, puis écoutez ce qui change.')
  await expect(live(page)).not.toContainText('se tait')
  expect((await voices(page)).sort()).toEqual(['k12-d', 'k12-g'])
  expect((await unplug(page)).ok).toBe(true)
  await page.waitForFunction(() => window.__creation!.audioState().voices.length === 1)
  expect(await voices(page), 'the speaker whose cable was pulled is the one that left').toEqual(['k12-d'])
  expect(await cables(page)).toBe(5)
  await expect(live(page)).toContainText(step(3), { timeout: 10_000 })
  await expect(live(page)).toContainText('Rebranchez-le : la prise proposée est compatible.')
  await expect(count(page)).toHaveText('Étape 3 sur 3')
  expect((await replug(page)).ok).toBe(true)
  await page.waitForFunction(() => window.__creation!.audioState().voices.length === 2)
  expect(await cables(page)).toBe(6)
  await expect.poll(() => guideRecord(page)).toMatchObject({ status: 'done', step: null })
  await expect(page.getByTestId('tutorial-closing')).toBeVisible()
})

test('Ctrl+Z after the unplug puts the cable back (the app’s own undo, unchanged): two voices again, and the replug step is done by it', async ({ page }) => {
  await takeTutorial(page)
  await testSignal(page)
  await expect(live(page)).toContainText(step(2), { timeout: 10_000 })
  await unplug(page)
  await page.waitForFunction(() => window.__creation!.audioState().voices.length === 1)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  await page.waitForFunction(() => window.__creation!.audioState().voices.length === 2)
  expect(await cables(page)).toBe(6)
})

test('the power helper (« Je branche pour vous ») is never offered on the route, and never unplugs or plugs an audio cable for the learner', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  const offered = (): Promise<boolean> => page.evaluate(() => window.__creation!.helperOffered())
  expect(await offered(), 'step 1').toBe(false)
  await testSignal(page)
  await expect(live(page)).toContainText(step(2), { timeout: 10_000 })
  expect(await offered(), 'step 2').toBe(false)
  await unplug(page)
  await expect(live(page)).toContainText(step(3), { timeout: 10_000 })
  expect(await offered(), 'step 3: an audio cable is not the helper’s to plug').toBe(false)
  await expect(page.getByTestId('checklist-power')).toHaveCount(0) // no helper row: the list is not even shown while one speaker still plays
  expect(await cables(page), 'the helper changed nothing').toBe(5)
  expect(await page.evaluate(() => window.__creation!.helperUses().n)).toBe(0)
})

test('an unplug and a replug before the sound never move the run: the cable events are not the events of step 1 (no false tick on the later steps)', async ({ page }) => {
  await takeTutorial(page)
  await expect(live(page)).toContainText(step(1), { timeout: 10_000 })
  await unplug(page) // before the sound: step 1 is still current, the unplug is not its event
  await expect(count(page)).toHaveText('Étape 1 sur 3')
  await replug(page)
  await expect(count(page)).toHaveText('Étape 1 sur 3')
  await page.waitForTimeout(800)
  expect(await guideRecord(page)).toMatchObject({ status: 'running', step: 'ecoute' })
})

// The first room is framed for the MODEL (packages.ts `modelFraming`): all five devices are in view, above the inventory drawer the profile opens, on a 768 and a 650 px window.
for (const height of [768, 650]) {
  test(`1366 x ${height}: the model's five devices are inside the 3D view and above the open drawer, and the stage reads as a stage`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height })
    await takeTutorial(page)
    await expect(count(page)).toHaveText('Étape 1 sur 3', { timeout: 10_000 })
    await page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
    const canvas = (await page.locator('#renderCanvas').boundingBox())!
    const drawer = page.getByTestId('inventory-drawer')
    expect(await drawer.getAttribute('data-open'), 'the profile opens the drawer on the first room').toBe('true')
    const drawerTop = (await drawer.boundingBox())!.y
    const at = await page.evaluate(() => {
      const c = window.__creation!
      return Object.fromEntries(['ql1', 'sm58', 'k12-g', 'k12-d', 'mains'].map((id) => [id, c.deviceBodyCenter(id) ? c.worldScreen(c.deviceBodyCenter(id)!) : null]))
    })
    for (const [id, p] of Object.entries(at)) {
      expect(p, `${id} is projected`).not.toBeNull()
      expect(p!.x, `${id} x`).toBeGreaterThan(canvas.x + 24)
      expect(p!.x, `${id} x`).toBeLessThan(canvas.x + canvas.width - 24)
      expect(p!.y, `${id} y`).toBeGreaterThan(canvas.y + 24)
      expect(p!.y, `${id} above the drawer (top ${drawerTop.toFixed(0)})`).toBeLessThan(drawerTop - 12)
    }
    // the two speakers are apart by more than 150 px (the stage reads as a stage), the console is below them (nearer the viewer)
    expect(Math.abs(at['k12-g']!.x - at['k12-d']!.x)).toBeGreaterThan(150)
    expect(at.ql1!.y).toBeGreaterThan(at['k12-g']!.y)
  })
}

for (const query of ['?design=5&mode=exam', '?design=5&MODE=practice', '?design=5&mode=exam&oscar=0']) {
  test(`${query}: exam address, no model, no start screen, no tutorial`, async ({ page }) => {
    await openFresh(page, query)
    await page.waitForTimeout(1200)
    await expect(page.getByTestId('start-screen')).toHaveCount(0)
    await expect(page.getByTestId('tutorial-slot')).toHaveCount(0)
    expect(await guideRecord(page)).toBeNull()
    expect(await page.evaluate(() => window.__creation?.place() ?? null)).not.toBe('blank')
  })
}

test('the plain address is untouched: no start screen, no model', async ({ page }) => {
  await openFresh(page, '')
  await page.waitForTimeout(800)
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation?.design().rig.instances.length ?? 0)).toBe(0)
})
