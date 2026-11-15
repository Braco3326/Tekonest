/**
 * Task 27 (C18): cables coloured by signal type, a legend at the bottom of Propriétés, and cable hover. The legend lists
 * ONLY the signal types on the scene, collapses with a named button and never overlays the 3D view; hovering a cable
 * highlights it and says what it joins; a port or a device under the pointer wins; an idle page renders nothing.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { SIGNAL_STYLE } from '../../src/creation/cableStyle'
import { cableKey } from '../../src/creation/sceneDiff'
import { IDLE_WINDOW_MS, quietWindow, settleRenders as settle } from './waits'
test.use({ viewport: { width: 1366, height: 768 } })

type Ref = { instance: string; port: string }
const SM58: Ref = { instance: 'sm58', port: 'out-xlr' }
const MIC1: Ref = { instance: 'ql1', port: 'in-mic-1' }
const QL_OUT: Ref = { instance: 'ql1', port: 'out-main-l' }
const K12_IN: Ref = { instance: 'k12-g', port: 'in-line-a' }
const MIC_KEY = cableKey(SM58, MIC1)
const LINE_KEY = cableKey(QL_OUT, K12_IN)

/** The reference template ("Concert simple", one mic cable) on a settled camera. */
const boot = async (page: Page, o: { keepStrip?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // a camera cut: stable screen points
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  // Task 32: the template also holds its power strip `mains` and three mains cables. This spec is about the signal cables and
  // needs the power-in ports free, so it takes the strip away (the powered rig is held by creation-keyboard-patch, the SceneHost
  // test and the powered-rig test of creation-cables.spec.ts).
  if (!o.keepStrip) {
    await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'mains' }))
    await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 4)
  }
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}
const legend = (page: Page) => page.getByTestId('cable-legend')
const items = (page: Page) => page.locator('[data-testid="cable-legend-list"] > li')
const hoverLabel = (page: Page) => page.locator('[data-testid="port-label"]:not([hidden])')
const freePoint = async (page: Page, key: string) => {
  const p = await page.evaluate((k) => window.__creation!.cableFreePoint(k), key)
  expect(p, `a free point on cable ${key}`).not.toBeNull()
  return p!
}
const addLineCable = (page: Page) => page.evaluate(([a, b]) => window.__creation!.dispatch({ type: 'CONNECT', a, b }), [QL_OUT, K12_IN] as const)

/**
 * Founder, 2026-11-15: « the cables are shown underground, they must be on the surface, not under ». Every drawn cable of the reference rig, the line cable added across
 * the room and the powered rig: no point lower than the floor under it, and the two ends on their ports.
 */
test('every cable rests on the floor, never under it, ends on the ports (founder, 2026-11-15)', async ({ page }) => {
  await boot(page, { keepStrip: true })
  await addLineCable(page)
  await page.waitForFunction((k) => window.__creation!.cablePoints(k) !== null, LINE_KEY)
  for (const key of [MIC_KEY, LINE_KEY]) {
    const pts = await page.evaluate((k) => window.__creation!.cablePoints(k), key)
    expect(pts, `cable ${key} is drawn`).not.toBeNull()
    expect(pts!.length).toBeGreaterThan(2)
    for (const [x, y, z] of pts!.slice(1, -1)) {
      const floor = await page.evaluate(([px, pz]) => window.__creation!.floorAtM(px!, pz!), [x, z] as const)
      expect(y, `a point of ${key} at (${x.toFixed(2)}, ${z.toFixed(2)}) is under the floor (${floor})`).toBeGreaterThanOrEqual(floor + 0.0149)
    }
  }
})

/**
 * Mission 3 A, founder 2026-11-15: « Gravity first: no cable may fly anywhere. A cable rests on the floor, on decks and on equipment, and hangs only where
 * it physically must. » The oracle is `cableSupportReport` (the drawn points walked every centimetre against the floor, the decks and the devices resting
 * there): no place under the surface, and every stretch off it short in plan (a connector bend, a vertical drop, a ramp onto a deck or a device, the loop
 * of two close raised ports). The old parabola fails it by metres (tests/scene/cableGravity.test.ts, « the oracle can fail »).
 */
type Report = NonNullable<ReturnType<NonNullable<Window['__creation']>['cableSupportReport']>>
/** Bend radius 5 cm (cableGravity BEND_R), loop span 40 cm (LOOP_M), ramp slope 5 (a 1.3 m stage gets 26 cm), plus a sample step. */
const MAX_END_SPAN_M = 0.4 + 4 * 0.05
const MAX_MID_SPAN_M = 0.4
const expectGrounded = (key: string, r: Report | null): void => {
  expect(r, `cable ${key} is drawn`).not.toBeNull()
  expect(r!.minAboveM, `${key}: no place under its surface`).toBeGreaterThanOrEqual(-0.002)
  expect(r!.longestMidSpanM, `${key}: off its surface between the ends only on a ramp (${JSON.stringify(r!.spans)})`).toBeLessThanOrEqual(MAX_MID_SPAN_M)
  expect(r!.longestUnsupportedM, `${key}: no flying stretch (${JSON.stringify(r!.spans)})`).toBeLessThanOrEqual(MAX_END_SPAN_M)
}
const allKeys = (page: Page) => page.evaluate(() => window.__creation!.design().rig.connections.map((c) => [c.a, c.b] as const))
const reportsOf = async (page: Page): Promise<[string, Report | null][]> => {
  const out: [string, Report | null][] = []
  for (const [a, b] of await allKeys(page)) {
    const key = cableKey(a, b)
    out.push([key, await page.evaluate((k) => window.__creation!.cableSupportReport(k), key)])
  }
  return out
}

for (const template of [/Concert simple/, /Premier son/]) {
  test(`gravity first: on the reference rig « ${template.source} » no cable flies, none goes under its surface (founder, 2026-11-15)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('template-grid').getByRole('option', { name: template }).click()
    await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 5 && window.__creation!.design().rig.connections.length > 0)
    await page.waitForFunction(() => window.__creation!.modelsPending() === 0) // the .glb ports are where the cables start
    const reports = await reportsOf(page)
    expect(reports.length).toBeGreaterThanOrEqual(4)
    for (const [key, r] of reports) expectGrounded(key, r)
  })
}

test('gravity first: a console on a table (0.75 m) to a speaker on the floor: the cable drops from the console straight down, lies on the floor, and rises to the speaker', async ({ page }) => {
  await boot(page)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  const floorAt = (x: number, z: number) => page.evaluate(([px, pz]) => window.__creation!.floorAtM(px!, pz!), [x, z] as const)
  const deskFloor = await floorAt(0, 6)
  const spkFloor = await floorAt(3, 8.5)
  await page.evaluate(
    ([d, s]) => {
      const c = window.__creation!
      c.dispatch({ type: 'SET_POSE', instanceId: 'ql1', position: [0, d + 0.75, 6], yawDeg: 0, tiltDeg: 0, mount: 'stand' })
      c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [3, s, 8.5], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
    },
    [deskFloor, spkFloor] as const
  )
  expect((await addLineCable(page)).ok).toBe(true)
  await page.waitForFunction((k) => window.__creation!.cablePoints(k) !== null, LINE_KEY)
  expectGrounded(LINE_KEY, await page.evaluate((k) => window.__creation!.cableSupportReport(k), LINE_KEY))
  const pts = (await page.evaluate((k) => window.__creation!.cablePoints(k), LINE_KEY))!
  const port = pts[0]!
  expect(port[1], 'the console output is up on the table').toBeGreaterThan(deskFloor + 0.75)
  // the drop: two consecutive points one above the other (same plan point), within 15 cm (plan) of the console's connector, falling most of the way
  const drop = pts.findIndex((p, i) => i > 0 && i < pts.length - 1 && Math.hypot(pts[i + 1]![0] - p[0], pts[i + 1]![2] - p[2]) < 1e-6 && p[1] - pts[i + 1]![1] > 0.5)
  expect(drop, `a vertical drop near the console (${JSON.stringify(pts.slice(0, 8))})`).toBeGreaterThan(0)
  expect(Math.hypot(pts[drop]![0] - port[0], pts[drop]![2] - port[2])).toBeLessThanOrEqual(0.15)
  // and between the drop and the speaker it lies on the floor: the middle of the run is at the floor plus the clearance
  // (the speaker stands in front of the console, its rear panel toward it, as it would be cabled)
  const mid = pts.filter((p) => Math.hypot(p[0] - 1.5, p[2] - 7.2) < 1.2)
  for (const p of mid) expect(p[1] - (await floorAt(p[0], p[2]))).toBeLessThan(0.02)
  // the length shown is the drawn one: drop + run + rise, at least the plan distance plus the drop
  const len = (await page.evaluate((k) => window.__creation!.cableLengthM(k), LINE_KEY))!
  expect(len).toBeGreaterThan(Math.hypot(3, 2.5) + 0.75 - 0.3)
  // moving the speaker redraws the cable on its new floor, still grounded
  await page.evaluate((s) => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [-3, s, 8.5], yawDeg: 0, tiltDeg: 0, mount: 'floor' }), spkFloor)
  await page.waitForFunction((k) => Math.abs(window.__creation!.cablePoints(k)!.at(-1)![0] + 3) < 0.6, LINE_KEY)
  expectGrounded(LINE_KEY, await page.evaluate((k) => window.__creation!.cableSupportReport(k), LINE_KEY))
})

test('the template mic cable is drawn in the mic colour and the legend names it (only that signal)', async ({ page }) => {
  await boot(page)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), MIC_KEY)).toBe(SIGNAL_STYLE['mic-level']!.color)
  await expect(legend(page)).toBeVisible()
  await expect(items(page)).toHaveCount(1)
  await expect(items(page).first()).toHaveText('Niveau micro')
  await expect(items(page).first()).toHaveAttribute('data-signal', 'mic-level')
  // the swatch carries the cable colour (a solid stroke: this signal is not dashed)
  const stroke = await items(page).first().locator('line').evaluate((l) => ({ stroke: l.getAttribute('stroke'), dash: l.getAttribute('stroke-dasharray') }))
  expect(stroke).toEqual({ stroke: SIGNAL_STYLE['mic-level']!.color, dash: null })
})

test('the powered reference rig: three mains cables in the mains colour, and the legend lists « Secteur 230 V » dashed (Task 32: reachable with verified gear)', async ({ page }) => {
  await boot(page, { keepStrip: true })
  const keys = [cableKey({ instance: 'mains', port: 'out-1' }, { instance: 'ql1', port: 'power-in' }), cableKey({ instance: 'mains', port: 'out-2' }, { instance: 'k12-g', port: 'power-in' }), cableKey({ instance: 'mains', port: 'out-3' }, { instance: 'k12-d', port: 'power-in' })]
  for (const k of keys) expect(await page.evaluate((key) => window.__creation!.cableColor(key), k), k).toBe(SIGNAL_STYLE['mains-power']!.color)
  await expect(items(page)).toHaveCount(2)
  await expect(items(page).nth(0)).toHaveAttribute('data-signal', 'mic-level')
  const power = items(page).nth(1)
  await expect(power).toHaveAttribute('data-signal', 'mains-power')
  await expect(power).toContainText('Secteur 230 V')
  await expect(power).toContainText('pointillés')
  expect(await power.locator('line').getAttribute('stroke-dasharray')).toMatch(/^\d+ \d+$/)
  expect(await items(page).nth(0).locator('line').getAttribute('stroke-dasharray')).toBeNull()
})

test('the legend lists the signal types present: a second type appears with its own colour, and goes with undo', async ({ page }) => {
  await boot(page)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBeNull() // not drawn yet
  const r = await addLineCable(page)
  expect(r.ok).toBe(true)
  await expect(items(page)).toHaveCount(2)
  await expect(items(page).nth(0)).toHaveText('Niveau micro')
  await expect(items(page).nth(1)).toHaveText('Niveau ligne pro (+4 dBu)')
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBe(SIGNAL_STYLE['line-level-pro']!.color)
  expect(SIGNAL_STYLE['line-level-pro']!.color).not.toBe(SIGNAL_STYLE['mic-level']!.color)
  await page.evaluate(() => window.__creation!.undo())
  await expect(items(page)).toHaveCount(1)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBeNull()
  // no cable at all: the block is gone, not an empty box
  await page.evaluate((r) => window.__creation!.dispatch({ type: 'UNPLUG', a: r[0], b: r[1] }), [SM58, MIC1] as const)
  await expect(legend(page)).toBeHidden()
})

test('the legend is at the bottom of Propriétés, never over the 3D view; it collapses with a named button that has a visible focus ring and no transition', async ({ page }) => {
  await boot(page)
  const box = (await legend(page).boundingBox())!
  const props = (await page.getByTestId('properties').boundingBox())!
  const view = (await page.getByTestId('viewport').boundingBox())!
  // inside Propriétés, flush with its bottom edge, and clear of the viewport
  expect(box.x).toBeGreaterThanOrEqual(props.x - 0.5)
  expect(box.x + box.width).toBeLessThanOrEqual(props.x + props.width + 0.5)
  expect(Math.abs(box.y + box.height - (props.y + props.height))).toBeLessThanOrEqual(1)
  expect(box.x).toBeGreaterThanOrEqual(view.x + view.width - 0.5)
  expect(await legend(page).evaluate((el) => el.closest('[data-testid="properties"]') !== null)).toBe(true)

  const toggle = page.getByRole('button', { name: 'Replier la légende des câbles' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(items(page).first()).toBeVisible()
  await toggle.click()
  const expand = page.getByRole('button', { name: 'Déplier la légende des câbles' })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expect(items(page).first()).toBeHidden()
  await expect(legend(page)).toBeVisible() // the title stays: only the list folds
  await expand.click()
  await expect(items(page).first()).toBeVisible()

  // keyboard: the button is reachable, Entrée folds, and its focus ring is 2 px Ambre with a Nuit inner ring
  await page.getByTestId('cable-legend-toggle').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('cable-legend-toggle')).toBeFocused()
  const ring = await page.getByTestId('cable-legend-toggle').evaluate((el) => {
    const c = getComputedStyle(el)
    return { width: c.outlineWidth, style: c.outlineStyle, color: c.outlineColor, shadow: c.boxShadow, transition: c.transitionDuration }
  })
  expect(ring.width).toBe('2px')
  expect(ring.style).toBe('solid')
  expect(ring.color).toBe('rgb(221, 147, 73)') // Ambre #DD9349
  expect(ring.shadow).toContain('rgb(19, 17, 20)') // Nuit #131114
  expect(parseFloat(ring.transition)).toBeLessThanOrEqual(0.001) // none (reduced motion rounds a 0 duration up to 1e-5 s)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cable-legend-toggle')).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cable-legend-toggle')).toHaveAttribute('aria-expanded', 'true')

  // folding Propriétés takes the list and the toggle away; the rail button (night wave 1, item 4) keeps the legend reachable
  await page.getByRole('button', { name: 'Replier le panneau Propriétés' }).click()
  await expect(page.getByTestId('cable-legend-toggle')).toBeHidden()
  await expect(items(page).first()).toBeHidden()
  await expect(page.getByTestId('cable-legend-rail')).toBeVisible()
  await page.getByRole('button', { name: 'Déplier le panneau Propriétés' }).click()
  await expect(legend(page)).toBeVisible()
  await expect(page.getByTestId('cable-legend-rail')).toBeHidden()
})

test('the legend and the hover label pass axe (no serious or critical violation)', async ({ page }) => {
  await boot(page)
  await addLineCable(page)
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toBeVisible()
  const results = await new AxeBuilder({ page }).include('[data-testid="properties"]').include('[data-testid="viewport"]').exclude('#renderCanvas').disableRules(['region']).analyze()
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('hovering a cable highlights it and says what it joins; leaving clears both; an idle page renders nothing', async ({ page }) => {
  await boot(page)
  const p = await freePoint(page, MIC_KEY)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toHaveText(/^sm58 out-xlr → ql1 in-mic-1 · Niveau micro · \d+,\d m$/)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(MIC_KEY)
  // The length is the drawn cable's: the polyline length in metres (>= the straight line between the two connectors, a little more for the sag)
  const shown = parseFloat((await hoverLabel(page).innerText()).match(/(\d+),(\d) m$/)!.slice(1).join('.'))
  const drawn = (await page.evaluate((k) => window.__creation!.cableLengthM(k), MIC_KEY))!
  const straight = (await page.evaluate(([a, b]) => window.__creation!.portDistanceM(a, b), [SM58, MIC1] as const))!
  expect(drawn, 'the drawn cable is at least as long as the straight line between its connectors').toBeGreaterThanOrEqual(straight - 1e-6)
  // gravity first (mission 3 A): the cable drops from the mic to the stage, runs on it and down to the floor; still well under 1.3 x the straight line
  expect(drawn, 'and not much longer (its drops and runs on the surface)').toBeLessThan(straight * 1.3 + 0.2)
  expect(Math.abs(shown - drawn), 'the hover shows the drawn length, rounded to 0.1 m').toBeLessThanOrEqual(0.05 + 1e-9)
  // the label sits at the pointer (a bubble above it, kept inside the 3D view)
  const label = (await hoverLabel(page).boundingBox())!
  expect(Math.abs(label.x + label.width / 2 - p.x)).toBeLessThanOrEqual(label.width / 2 + 8)
  expect(Math.abs(label.y + label.height - p.y)).toBeLessThanOrEqual(40)

  // away from every cable: the highlight and the label go
  const view = (await page.getByTestId('viewport').boundingBox())!
  await page.mouse.move(view.x + 6, view.y + view.height - 6)
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  // idle: no frame at all for 2 s once the hover has ended
  await settle(page)
  const before = await page.evaluate(() => window.__creation!.renders())
  await quietWindow(page, IDLE_WINDOW_MS)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(before)
})

test('a port under the pointer wins over the cable at its end: the port label shows, the cable is not hovered, never two labels', async ({ page }) => {
  await boot(page)
  const at = await page.evaluate((r) => window.__creation!.portScreen(r), SM58)
  expect(at).not.toBeNull()
  await page.mouse.move(at!.x, at!.y)
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('out-xlr')
  await expect(hoverLabel(page)).not.toContainText('→')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  // sliding from the cable onto the port keeps ONE label, and it is the port's
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toContainText('→')
  await page.mouse.move(at!.x, at!.y, { steps: 6 })
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('out-xlr')
  await expect(hoverLabel(page)).not.toContainText('→')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('an orbit drag (button held) shows no cable hover and ends it', async ({ page }) => {
  await boot(page)
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toBeVisible()
  await page.mouse.down()
  await page.mouse.move(p.x + 30, p.y + 10, { steps: 4 })
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  await page.mouse.up()
})

/** The camera is cut under a resting pointer (no mouse event): the hover must follow what is under the pointer NOW. */
const hoverAt = async (page: Page, key: string) => {
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  const q = await freePoint(page, key)
  await page.mouse.move(q.x, q.y)
  await expect(hoverLabel(page)).toBeVisible()
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(key)
  return q
}
const cut = async (page: Page, move: { radius?: (current: number) => number; turn?: number }) => {
  const current = (await page.evaluate(() => window.__creation!.camera()))!.radius
  if (move.radius) await page.evaluate((r) => window.__creation!.setCameraRadius(r), move.radius(current))
  if (move.turn) await page.evaluate((d) => window.__creation!.turnCamera(d), move.turn)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}

test('a camera cut that moves the cable away from the resting pointer removes the highlight and the label', async ({ page }) => {
  await boot(page)
  const q = await hoverAt(page, MIC_KEY)
  await cut(page, { turn: 0.5 })
  // the independent oracle: after the cut, the cable is NOT under the pointer any more
  expect(await page.evaluate(([x, y]) => window.__creation!.cableAtPage(x, y), [q.x, q.y] as const)).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('a camera cut that leaves the cable under the resting pointer keeps the highlight and the label', async ({ page }) => {
  await boot(page)
  const q = await hoverAt(page, MIC_KEY)
  await cut(page, { radius: (r) => r * 1.002 }) // a hair: the cable moves well under the 7 px tolerance
  expect(await page.evaluate(([x, y]) => window.__creation!.cableAtPage(x, y), [q.x, q.y] as const)).toBe(MIC_KEY)
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('sm58 out-xlr → ql1 in-mic-1')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(MIC_KEY)
})

test('undo of the hovered cable under a still pointer drops the highlight and the label', async ({ page }) => {
  await boot(page)
  await addLineCable(page)
  await expect(items(page)).toHaveCount(2)
  await settle(page)
  const p = await freePoint(page, LINE_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toContainText('ql1 out-main-l → k12-g in-line-a · Niveau ligne pro (+4 dBu)')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(LINE_KEY)
  await page.evaluate(() => window.__creation!.undo())
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('a mains-power entry is drawn dashed with its « pointillés » note, a solid one is not; an empty legend hides the block', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.legendPreview(['mains-power', 'mic-level']))
  await expect(items(page)).toHaveCount(2)
  const mains = items(page).nth(0)
  await expect(mains).toHaveAttribute('data-signal', 'mains-power')
  await expect(mains).toContainText('Secteur 230 V')
  await expect(mains).toContainText('pointillés')
  const line = mains.locator('line')
  expect(await line.getAttribute('stroke-dasharray')).toMatch(/^\d+ \d+$/)
  expect(await line.getAttribute('stroke')).toBe(SIGNAL_STYLE['mains-power']!.color)
  const mic = items(page).nth(1)
  expect(await mic.locator('line').getAttribute('stroke-dasharray')).toBeNull()
  await expect(mic.locator('.cr-legend-note')).toHaveCount(0)
  // the toggle still folds and unfolds it, with the state and the name in step
  const toggle = page.getByTestId('cable-legend-toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-label', 'Déplier la légende des câbles')
  await expect(page.getByTestId('cable-legend-list')).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('cable-legend-list')).toBeVisible()
  // no entry: the block is hidden, not an empty box
  await page.evaluate(() => window.__creation!.legendPreview([]))
  await expect(legend(page)).toBeHidden()
})

test('a click on the hovered cable is no missed click: no « Rien ici » toast, the selection is kept (final review, minor)', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 6 && (await page.evaluate(() => window.__creation!.selection())) !== 'sm58'; i++) await page.keyboard.press(']') // the mic: the framed view shows its cable
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('sm58') // a miss would clear it
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  const sel = await page.evaluate(() => window.__creation!.selection())
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toBeVisible()
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(MIC_KEY)
  await page.mouse.click(p.x, p.y)
  await quietWindow(page, 300) // past the 100 ms before a message would be set
  await expect(page.getByTestId('toast')).toBeHidden()
  await expect(page.getByTestId('toast')).toHaveText('')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(sel)
})
