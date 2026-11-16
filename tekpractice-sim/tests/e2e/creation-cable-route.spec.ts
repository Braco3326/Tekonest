/**
 * Mission 3 B stage 2 (spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1, §6): hand-drawn cables in the real app (the all-on build).
 * Select a cable by a click; trace it with the mouse and with the keyboard only; one Ctrl+Z takes the whole tracing back; drag a point, add one on a segment,
 * delete one; « Remettre le tracé automatique »; save and reopen; a phone (touch) tracing with taps and buttons; axe on the panel and the drawing bar; no console error.
 * Oracles: the route the store holds (`cableRoute`, every point on the grid of the chosen step), the drawn path (`cablePoints`: above the floor between the
 * ends, the ends on the two ports), the history size (one entry per tracing / edit).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cableKey } from '../../src/creation/sceneDiff'
import { enterDesign } from './plan2dKit'
import { settleRenders as settle, waitForAutosave } from './waits'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ timeout: 90_000 })

type Ref = { instance: string; port: string }
const QL_OUT: Ref = { instance: 'ql1', port: 'out-main-l' }
const K12_IN: Ref = { instance: 'k12-g', port: 'in-line-a' }
const KEY = cableKey(QL_OUT, K12_IN)
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function watchErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return () => errors
}

/**
 * concert-hall-medium, a console and a speaker on the floor 4 m apart, one line cable between them; the camera settled. `design`: enter that package the way a
 * learner does first (the start screen's first answer, plan2dKit.enterDesign), so its colours are the ones on screen.
 */
async function boot(page: Page, o: { design?: 2 } = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // camera cuts: stable screen points
  if (o.design) await enterDesign(page, o.design)
  else await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(([a, b]) => {
    const c = window.__creation!
    const f = (x: number, z: number) => c.floorAtM(x, z)
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [-1, f(-1, 6), 6], rotationY: 0 })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, f(3, 6), 6], rotationY: 0 })
    c.dispatch({ type: 'CONNECT', a, b })
  }, [QL_OUT, K12_IN] as const)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.waitForFunction((k) => window.__creation!.cablePoints(k) !== null, KEY)
  // frame the pair from above-ish so the floor between them is on screen
  await page.evaluate(() => window.__creation!.frameDevice('ql1'))
  await page.evaluate(() => window.__creation!.setCameraRadius(9))
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.evaluate(() => window.__creation!.cableSelect(null))
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await settle(page)
}

const state = (page: Page) => page.evaluate(() => window.__creation!.cableTrace()!)
const route = (page: Page) => page.evaluate((k) => window.__creation!.cableRoute(k), KEY)
const historySize = (page: Page) => page.evaluate(() => window.__creation!.historySize())
/** The page point of a floor point (x, z). */
async function floorScreen(page: Page, x: number, z: number): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(([px, pz]) => {
    const c = window.__creation!
    return c.worldScreen([px!, c.floorAtM(px!, pz!), pz!])
  }, [x, z] as const)
  expect(p, `floor (${x}, ${z}) is on screen`).not.toBeNull()
  return p!
}
const onGrid = (v: number, step: number): boolean => Math.abs(v / step - Math.round(v / step)) < 1e-6

/** The drawn cable rests above the floor between its ends, and its ends are on the two ports. */
async function expectGroundedOnPorts(page: Page): Promise<void> {
  const pts = (await page.evaluate((k) => window.__creation!.cablePoints(k), KEY))!
  expect(pts.length).toBeGreaterThan(2)
  for (const [x, y, z] of pts.slice(1, -1)) {
    const floor = await page.evaluate(([px, pz]) => window.__creation!.floorAtM(px!, pz!), [x, z] as const)
    expect(y, `a point at (${x.toFixed(2)}, ${z.toFixed(2)}) under the floor`).toBeGreaterThanOrEqual(floor + 0.0149)
  }
  const pa = (await page.evaluate((r) => window.__creation!.portWorld(r), QL_OUT))!
  const pb = (await page.evaluate((r) => window.__creation!.portWorld(r), K12_IN))!
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const d = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
  expect(Math.min(d(first, pa), d(first, pb)), 'one end on a port').toBeLessThan(0.002)
  expect(Math.min(d(last, pa), d(last, pb)), 'the other end on the other port').toBeLessThan(0.002)
  expect(d(first, pa) < 0.002 ? d(last, pb) : d(last, pa)).toBeLessThan(0.002)
}

async function selectByClick(page: Page): Promise<void> {
  const p = await page.evaluate((k) => window.__creation!.cableFreePoint(k), KEY)
  expect(p, 'a free point on the cable').not.toBeNull()
  await page.mouse.move(p!.x, p!.y)
  await page.mouse.click(p!.x, p!.y)
  await expect.poll(() => state(page).then((s) => s.selected)).toBe(KEY)
}

/** Trace through these floor points with the mouse and finish with « Terminer ». Returns the live length the bar showed just before. */
async function traceWithMouse(page: Page, points: [number, number][]): Promise<number> {
  await page.getByTestId('cable-trace').click()
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  for (const [x, z] of points) {
    const s = await floorScreen(page, x, z)
    await page.mouse.move(s.x, s.y)
    await page.mouse.click(s.x, s.y)
    await page.waitForTimeout(520) // never two clicks within the double-click time
  }
  const live = (await state(page)).tracing!.lengthM
  await expect(page.getByTestId('trace-length')).toHaveText(`Longueur : ${live.toFixed(2).replace('.', ',')} m`)
  await page.getByTestId('trace-finish').click()
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  return live
}

test('a click on a cable selects it: the Papier stroke stays, Propriétés shows its panel; Échap deselects', async ({ page }) => {
  const errors = watchErrors(page)
  await boot(page)
  await selectByClick(page)
  expect(await page.evaluate(() => window.__creation!.cableSelectedStroke())).toBe(KEY)
  const panel = page.getByTestId('cable-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Câble' })).toBeVisible()
  await expect(panel).toContainText('out-main-l')
  await expect(panel).toContainText('in-line-a')
  await expect(panel).toContainText(/Longueur dessinée\s*\d+,\d\d m/)
  await expect(panel.getByRole('button', { name: 'Tracer le câble' })).toBeEnabled()
  await expect(panel.getByRole('button', { name: 'Remettre le tracé automatique' })).toHaveCount(0)
  // the tree marks its row
  await expect(page.getByRole('treeitem', { name: /out-main-l → k12-g in-line-a/ })).toHaveAttribute('aria-selected', 'true')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Escape')
  await expect.poll(() => state(page).then((s) => s.selected)).toBeNull()
  await expect(panel).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.cableSelectedStroke())).toBeNull()
  expect(errors()).toEqual([])
})

test('trace with the mouse: the route is on the 25 cm grid, the cable rests above the floor with its ends on the ports, ONE undo entry; one Ctrl+Z takes it all back', async ({ page }) => {
  const errors = watchErrors(page)
  await boot(page)
  await selectByClick(page)
  const before = await historySize(page)
  const live = await traceWithMouse(page, [[0.1, 7.3], [1.6, 7.6], [2.4, 6.9]])
  const r = (await route(page))!
  expect(r, 'a route is stored').not.toBeNull()
  expect(r.length).toBe(3)
  for (const [x, z] of r) expect(onGrid(x, 0.25) && onGrid(z, 0.25), `(${x}, ${z}) on the grid`).toBe(true)
  expect(r[0]).toEqual([0, 7.25])
  expect(await historySize(page)).toBe(before + 1)
  await expectGroundedOnPorts(page)
  // the panel says the length as drawn, and the hover's figure is the same cable's
  const len = (await page.evaluate((k) => window.__creation!.cableLengthM(k), KEY))!
  expect(len, 'the live length of the bar is the length the cable is drawn with').toBeCloseTo(live, 6)
  await expect(page.getByTestId('cable-panel')).toContainText(`${len.toFixed(2).replace('.', ',')} m`)
  await expect(page.getByTestId('cable-panel')).toContainText('tracée à la main : 3 points')
  // one Ctrl+Z: the whole tracing goes, the automatic shape is back
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(() => route(page)).toBeNull()
  expect(await historySize(page)).toBe(before)
  expect(errors()).toEqual([])
})

test('a double-click on the cable starts its tracing; a double-click on the last point finishes it (one undo entry); no re-pivot', async ({ page }) => {
  const errors = watchErrors(page)
  await boot(page)
  const before = await historySize(page)
  const p = (await page.evaluate((k) => window.__creation!.cableFreePoint(k), KEY))!
  await page.mouse.move(p.x, p.y)
  await page.mouse.dblclick(p.x, p.y)
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  expect((await state(page)).selected).toBe(KEY)
  const a = await floorScreen(page, 0.6, 7.6)
  await page.mouse.click(a.x, a.y)
  await page.waitForTimeout(520)
  const cam = await page.evaluate(() => window.__creation!.camera())
  const b = await floorScreen(page, 1.9, 7.4)
  await page.mouse.dblclick(b.x, b.y)
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  expect(await route(page)).toEqual([[0.5, 7.5], [2, 7.5]])
  expect(await historySize(page)).toBe(before + 1)
  expect(await page.evaluate(() => window.__creation!.camera()), 'the double-click that finishes is not a re-pivot').toEqual(cam)
  expect(errors()).toEqual([])
})

test('« Annuler » and Échap cancel a tracing: nothing is dispatched, the cable keeps its shape', async ({ page }) => {
  await boot(page)
  await selectByClick(page)
  const before = await historySize(page)
  await page.getByTestId('cable-trace').click()
  const s = await floorScreen(page, 1, 7.5)
  await page.mouse.click(s.x, s.y)
  await expect.poll(() => state(page).then((t) => t.tracing?.points.length)).toBe(1)
  await page.getByTestId('trace-cancel').click()
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  expect(await route(page)).toBeNull()
  await page.getByTestId('cable-trace').click()
  await page.mouse.click(s.x, s.y)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  expect(await route(page)).toBeNull()
  expect(await historySize(page)).toBe(before)
})

test('trace with the keyboard only: the tree row, Tab to « Tracer le câble », arrows, Entrée, Retour arrière, Maj+Entrée', async ({ page }) => {
  const errors = watchErrors(page)
  await boot(page)
  // the cable's row in « Câbles », by keyboard: the group row, → opens it, → goes to its first (only) cable, Entrée selects it
  await page.getByRole('treeitem', { name: /^Câbles/ }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('treeitem', { name: /out-main-l → k12-g in-line-a/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => state(page).then((s) => s.selected)).toBe(KEY)
  // Tab until « Tracer le câble »
  let found = false
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press('Tab')
    found = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'cable-trace')
  }
  expect(found, 'Tab reaches « Tracer le câble »').toBe(true)
  const before = await historySize(page)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('renderCanvas') // the keys act on the 3D view
  const start = (await state(page)).tracing!.cursor
  const cam = await page.evaluate(() => window.__creation!.camera())
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.__creation!.camera()), 'the arrows move the cursor, not the camera').toEqual(cam)
  const a = (await state(page)).tracing!.candidate
  expect(Math.hypot(a[0] - start[0], a[1] - start[1])).toBeCloseTo(1, 6) // four 25 cm steps on one axis
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+ArrowUp')
  const b = (await state(page)).tracing!.candidate
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  expect((await state(page)).tracing!.points).toHaveLength(3)
  await page.keyboard.press('Backspace')
  expect((await state(page)).tracing!.points).toEqual([a, b])
  await page.keyboard.press('Shift+Enter')
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  expect(await route(page)).toEqual([a, b])
  expect(await historySize(page)).toBe(before + 1)
  for (const [x, z] of [a, b]) expect(onGrid(x, 0.25) && onGrid(z, 0.25)).toBe(true)
  await expectGroundedOnPorts(page)
  // the camera did not orbit on the arrows
  expect(errors()).toEqual([])
})

test('edit afterwards: drag a point, add one on a segment, delete one, then « Remettre le tracé automatique » (one undo entry each)', async ({ page }) => {
  const errors = watchErrors(page)
  await boot(page)
  await page.evaluate((k) => window.__creation!.dispatch({ type: 'SET_ROUTE', key: k, points: [[0, 7.5], [2, 7.5]] }), KEY)
  await page.evaluate(() => window.__creation!.cableSelect(null))
  await selectByClick(page)
  await expect.poll(() => state(page).then((s) => s.handles.length)).toBe(2)
  await expect.poll(() => state(page).then((s) => s.tracerLoaded)).toBe(true)
  let h = await historySize(page)
  // drag point 1 to (0.5, 8)
  const handle = (await state(page)).handles[0]!
  const to = await floorScreen(page, 0.5, 8)
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move((handle.x + to.x) / 2, (handle.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => route(page)).toEqual([[0.5, 8], [2, 7.5]])
  expect(await historySize(page)).toBe(++h)
  expect((await state(page)).selectedPoint).toBe(0)
  // a click on the selected cable adds a point on the nearest segment
  const free = await page.evaluate((k) => window.__creation!.cableFreePoint(k), KEY)
  expect(free).not.toBeNull()
  await page.mouse.click(free!.x, free!.y)
  await page.evaluate(() => window.__creation!.cableTraceFlushAdd())
  await expect.poll(() => route(page).then((r) => r?.length)).toBe(3)
  expect(await historySize(page)).toBe(++h)
  for (const [x, z] of (await route(page))!) expect(onGrid(x, 0.25) && onGrid(z, 0.25)).toBe(true)
  // delete the chosen point: by keyboard in « Points du tracé » (Page suiv. to choose, Suppr), then by its button
  const zone = page.getByTestId('cable-points')
  await zone.focus()
  await page.keyboard.press('PageDown')
  await page.keyboard.press('Delete')
  await expect.poll(() => route(page).then((r) => r?.length)).toBe(2)
  expect(await historySize(page)).toBe(++h)
  expect(await page.evaluate(() => window.__creation!.design().rig.instances.length), 'Suppr in the panel never deletes a device').toBe(2)
  // an arrow moves the chosen point one step (one undo entry)
  const was = (await route(page))!
  await zone.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => route(page)).not.toEqual(was)
  expect(await historySize(page)).toBe(++h)
  await page.getByRole('button', { name: 'Supprimer le point' }).click()
  await expect.poll(() => route(page).then((r) => r?.length)).toBe(1)
  expect(await historySize(page)).toBe(++h)
  await expectGroundedOnPorts(page)
  await page.getByRole('button', { name: 'Remettre le tracé automatique' }).click()
  await expect.poll(() => route(page)).toBeNull()
  expect(await historySize(page)).toBe(++h)
  await expect(page.getByTestId('cable-panel')).toContainText('automatique, posée entre ses deux prises')
  expect(errors()).toEqual([])
})

test('save and reopen: the route is in the saved project and comes back after a reload', async ({ page }) => {
  await boot(page)
  await selectByClick(page)
  await traceWithMouse(page, [[0.5, 7.6], [2, 7.4]])
  const r = await route(page)
  expect(r).toEqual([[0.5, 7.5], [2, 7.5]])
  // a named project (Ctrl+S asks the name the first time)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  const dialog = page.getByTestId('cr-name-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('input').fill('Tracé main')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  const saved = await page.evaluate(() => localStorage.getItem('audio-sim/creation-projects.v1') ?? '')
  expect(saved).toContain('"routes"')
  await waitForAutosave(page)
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'room:concert-hall-medium')
  await page.waitForFunction((k) => window.__creation!.cablePoints(k) !== null, KEY)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0) // the .glb ports are where the cable ends
  expect(await route(page)).toEqual(r)
  await expectGroundedOnPorts(page)
})

test('axe: the cable panel and the drawing bar have no serious or critical violation (design 2)', async ({ page }) => {
  await boot(page, { design: 2 })
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-design'))).toBe('2')
  await page.evaluate((k) => window.__creation!.dispatch({ type: 'SET_ROUTE', key: k, points: [[0, 7.5], [2, 7.5]] }), KEY)
  await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)
  await expect(page.getByTestId('cable-points')).toBeVisible()
  const scan = async (sel: string) => {
    const r = await new AxeBuilder({ page }).include(sel).withTags(TAGS).analyze()
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  }
  expect(await scan('[data-testid="cable-panel"]')).toEqual([])
  await page.getByTestId('cable-trace').click()
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  expect(await scan('[data-testid="trace-bar"]')).toEqual([])
  expect(await scan('[data-testid="cable-panel"]')).toEqual([])
})

test('where the 3D view is covered (the place picker) the tracing ends: no bar, no selection, nothing dispatched', async ({ page }) => {
  await boot(page)
  await selectByClick(page)
  const before = await historySize(page)
  await page.getByTestId('cable-trace').click()
  const s = await floorScreen(page, 1, 7.5)
  await page.mouse.click(s.x, s.y)
  await page.getByRole('menuitem', { name: 'Lieu', exact: true }).click()
  await page.getByRole('menuitem', { name: /Choisir un lieu/ }).click()
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  const st = await state(page)
  expect(st.tracing).toBeNull()
  expect(st.selected).toBeNull()
  expect(await route(page)).toBeNull()
  expect(await historySize(page)).toBe(before)
  // a click on a cable under the picker selects nothing
  expect(await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)).toBe(false)
})

test('« Raccourcis clavier » lists the tracing keys in their own group', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('h')
  const list = page.getByTestId('shortcuts-list')
  await expect(list).toBeVisible()
  await expect(list).toContainText('Tracé d’un câble')
  await expect(list.locator('[data-row="trace-finish"]')).toHaveText('Maj+Entrée')
  await expect(list.locator('[data-row="trace-remove"]')).toHaveText('Retour arrière')
})

// Classic-look check (2026-11-16): the room a tracing makes is for narrow screens only; a wide window keeps Propriétés as the learner left it.
test('a wide window keeps Propriétés open while tracing', async ({ page }) => {
  await boot(page)
  await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)
  if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').click()
  await page.getByTestId('cable-trace').click()
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('cable-panel')).toBeVisible()
  await page.getByTestId('trace-cancel').click()
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
})

test.describe('a tablet (820 x 1180, touch): both panels open', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true })
  test('« Tracer le câble » folds Propriétés (the 3D view had 44 % of the width), keeps Projet, and opens Propriétés again at the end', async ({ page }) => {
    await boot(page)
    await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)
    if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').tap()
    await expect(page.getByTestId('tree-collapse')).toHaveAttribute('aria-expanded', 'true')
    await page.getByTestId('cable-trace').tap()
    await expect(page.getByTestId('trace-bar')).toBeVisible()
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('tree-collapse')).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(async () => (await page.locator('#renderCanvas').boundingBox())!.width).toBeGreaterThanOrEqual(0.6 * 820)
    await page.getByTestId('trace-cancel').tap()
    await expect(page.getByTestId('trace-bar')).toHaveCount(0)
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('a phone (390 x 844, touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('trace with taps and the buttons; every control of the bar is at least 44 px', async ({ page }) => {
    const errors = watchErrors(page)
    await boot(page)
    // a tap on the cable selects it (a finger gets a wider hit than the mouse)
    const p = await page.evaluate((k) => window.__creation!.cableFreePoint(k), KEY)
    expect(p).not.toBeNull()
    await page.touchscreen.tap(p!.x, p!.y)
    await expect.poll(() => state(page).then((s) => s.selected)).toBe(KEY)
    // Propriétés is folded on a phone: open it, start the tracing, fold it again for room
    await page.getByTestId('props-collapse').tap()
    await page.getByTestId('cable-trace').tap()
    await expect(page.getByTestId('trace-bar')).toBeVisible()
    if (await page.getByTestId('props-collapse').getAttribute('aria-expanded') === 'true') await page.getByTestId('props-collapse').tap()
    for (const id of ['trace-place', 'trace-remove', 'trace-finish', 'trace-cancel', 'trace-right-angles']) {
      const box = (await page.getByTestId(id).boundingBox())!
      expect(box.height, id).toBeGreaterThanOrEqual(44)
      expect(box.width, id).toBeGreaterThanOrEqual(44)
    }
    const sel = (await page.getByTestId('trace-bar').locator('select').boundingBox())!
    expect(sel.height).toBeGreaterThanOrEqual(44)
    // the bar sits under the menu bar, not over the 3D view
    const bar = (await page.getByTestId('trace-bar').boundingBox())!
    const view = (await page.locator('#renderCanvas').boundingBox())!
    expect(bar.y + bar.height).toBeLessThanOrEqual(view.y + 0.5)
    await page.getByTestId('trace-right-angles').tap()
    expect(await state(page).then((s) => s.rightAngles)).toBe(true)
    let placed = 0
    for (const [x, z] of [[0.5, 7.4], [1.5, 7.6]] as [number, number][]) {
      const s = await floorScreen(page, x, z)
      await page.touchscreen.tap(s.x, s.y)
      await page.waitForTimeout(550)
      placed++
      await expect.poll(() => state(page).then((t) => t.tracing?.points.length)).toBe(placed)
    }
    await page.getByTestId('trace-remove').tap()
    await expect.poll(() => state(page).then((t) => t.tracing?.points.length)).toBe(1)
    await page.getByTestId('trace-place').tap() // the cursor is still where the last tap was: placed again
    await page.getByTestId('trace-finish').tap()
    await expect(page.getByTestId('trace-bar')).toHaveCount(0)
    const r = (await route(page))!
    expect(r.length).toBeGreaterThanOrEqual(1)
    for (const [x, z] of r) expect(onGrid(x, 0.25) && onGrid(z, 0.25)).toBe(true)
    await expectGroundedOnPorts(page)
    expect(errors()).toEqual([])
  })
  // Classic-look check (2026-11-16): with Propriétés open the 3D view was ~140 px wide and the floor the cable runs over was under the panel (the taps landed on it).
  test('« Tracer le câble » folds Propriétés so the floor is under the finger, and opens it again when the tracing ends', async ({ page }) => {
    const errors = watchErrors(page)
    await boot(page)
    await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)
    await page.getByTestId('props-collapse').tap()
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
    await page.getByTestId('cable-trace').tap()
    await expect(page.getByTestId('trace-bar')).toBeVisible()
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#renderCanvas')).toBeFocused()
    await expect.poll(async () => (await page.locator('#renderCanvas').boundingBox())!.width).toBeGreaterThanOrEqual(0.6 * 390)
    const s = await floorScreen(page, 0.5, 7.4)
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id, [s.x, s.y] as const), 'the floor point is on the 3D view').toBe('renderCanvas')
    await page.touchscreen.tap(s.x, s.y)
    await expect.poll(() => state(page).then((t) => t.tracing?.points.length)).toBe(1)
    await page.getByTestId('trace-finish').tap()
    await expect(page.getByTestId('trace-bar')).toHaveCount(0)
    await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('cable-panel')).toBeVisible()
    expect(errors()).toEqual([])
  })
})
