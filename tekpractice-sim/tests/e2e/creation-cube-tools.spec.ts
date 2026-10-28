/**
 * Phase 2 review (Task 21): the brief §3 pieces around the view cube.
 * - ↺ ↻ ⌂: three named DOM buttons beside the cube square (council T2.3 / Q4). ↻ turns the view
 *   90° clockwise seen from above (Face → Droite, the cube's OCTANTS order), ↺ the other way,
 *   ⌂ = « Vue d’ensemble » (as Alt+H). Vue › « Tourner la vue à gauche / à droite », keys on the
 *   3D view only (WCAG 2.1.4). Hidden while walking, inert under the place picker.
 * - Double-click on the floor re-pivots there (council T2.5; the designer-nav Task 4 e2e, ported).
 * - Minors: a cube click announces its view; a camera request during a listening-point flight
 *   ends « standing on the point » (an ear-height change never snaps the camera back).
 */
import { expect, test, type Page } from '@playwright/test'
import { nearestZone, zoneAngles, zoneLabel } from '../../src/camera/cubeZones'
test.use({ viewport: { width: 1366, height: 768 } })

const boot = async (page: Page, reduced = true): Promise<void> => {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
}
type Cam = { alpha: number; beta: number; radius: number; target: number[] }
const camera = async (page: Page): Promise<Cam> => (await page.evaluate(() => window.__creation!.camera()))!
const settled = async (page: Page): Promise<Cam> => {
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving()), { timeout: 10_000 }).toBe(false)
  return camera(page)
}
const angleDiff = (a: number, b: number): number => Math.abs(((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const renders = (page: Page) => page.evaluate(() => window.__creation!.renders())
const idleRenders = async (page: Page): Promise<number> => {
  await page.waitForTimeout(300)
  const r0 = await renders(page)
  await page.waitForTimeout(2000)
  return (await renders(page)) - r0
}
const FACE = zoneAngles({ x: 0, y: 0, z: 1 })
const DROITE = zoneAngles({ x: 1, y: 0, z: 0 })
const GAUCHE = zoneAngles({ x: -1, y: 0, z: 0 })
const LEFT = 'Tourner de 90° à gauche'
const RIGHT = 'Tourner de 90° à droite'
const HOME = 'Vue d’ensemble'

test('↺ ↻ ⌂ sit beside the cube square, inside the viewport: named, ≥ 24 px, square, Ambre focus ring, clear of the caption', async ({ page }) => {
  await boot(page)
  const cube = await page.evaluate(() => window.__creation!.cubeRect())
  const view = (await page.getByTestId('viewport').boundingBox())!
  const tools = page.getByTestId('view-cube-tools')
  await page.locator('#renderCanvas').focus()
  for (const name of [LEFT, RIGHT, HOME]) {
    const b = tools.getByRole('button', { name, exact: true })
    await expect(b).toBeVisible()
    const box = (await b.boundingBox())!
    expect(box.width, name).toBeGreaterThanOrEqual(24)
    expect(box.height, name).toBeGreaterThanOrEqual(24)
    // beside the square (right of it, within its height), inside the viewport
    expect(box.x, name).toBeGreaterThanOrEqual(cube.x + cube.width)
    expect(box.x + box.width, name).toBeLessThan(cube.x + cube.width + 48)
    expect(box.y, name).toBeGreaterThanOrEqual(cube.y)
    expect(box.y + box.height, name).toBeLessThanOrEqual(cube.y + cube.height)
    expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width)
    await page.keyboard.press('Tab') // keyboard focus: the :focus-visible ring
    await expect(b).toBeFocused()
    const st = await b.evaluate((e) => {
      const c = getComputedStyle(e)
      return { br: c.borderTopLeftRadius, ow: c.outlineWidth, os: c.outlineStyle, oc: c.outlineColor }
    })
    expect(st, name).toMatchObject({ br: '0px', ow: '2px', os: 'solid', oc: 'rgb(221, 147, 73)' })
  }
  // the hover caption, under the square, never meets a button
  const capTop = cube.y + cube.height + 4
  const last = (await tools.boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual(capTop)
})

test('↻ turns the view 90° clockwise seen from above (Face → Droite), ↺ back; click and keyboard (Tab + Entrée); announced; idle after', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const tools = page.getByTestId('view-cube-tools')
  const b0 = (await camera(page)).beta
  await tools.getByRole('button', { name: RIGHT }).click()
  let c = await camera(page)
  expect(angleDiff(c.alpha, DROITE.alpha)).toBeLessThan(0.01)
  expect(Math.abs(c.beta - b0)).toBeLessThan(1e-6)
  await expect(page.getByRole('status')).toHaveText(`Vue : ${zoneLabel(nearestZone(c.alpha, c.beta))}`)
  await tools.getByRole('button', { name: LEFT }).click()
  expect(angleDiff((await camera(page)).alpha, FACE.alpha)).toBeLessThan(0.01)
  // keyboard: from the 3D view, Tab reaches ↺ first, then ↻, then ⌂
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Tab')
  await expect(tools.getByRole('button', { name: LEFT })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(angleDiff((await camera(page)).alpha, GAUCHE.alpha)).toBeLessThan(0.01)
  await page.keyboard.press('Tab')
  await expect(tools.getByRole('button', { name: RIGHT })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(angleDiff((await camera(page)).alpha, FACE.alpha)).toBeLessThan(0.01)
  await page.keyboard.press('Tab')
  await expect(tools.getByRole('button', { name: HOME })).toBeFocused()
  expect(await idleRenders(page)).toBe(0)
})

test('⌂ = « Vue d’ensemble » (the opening pose, as Alt+H); Vue › Tourner la vue à gauche / à droite with their keys (3D view only)', async ({ page }) => {
  await boot(page)
  const open = await camera(page)
  const tools = page.getByTestId('view-cube-tools')
  await tools.getByRole('button', { name: RIGHT }).click()
  await tools.getByRole('button', { name: HOME }).click()
  let c = await camera(page)
  expect(angleDiff(c.alpha, open.alpha)).toBeLessThan(0.01)
  expect(Math.abs(c.beta - open.beta)).toBeLessThan(0.01)
  expect(Math.abs(c.radius - open.radius)).toBeLessThan(0.01)
  expect(dist(c.target, open.target)).toBeLessThan(0.01)
  await expect(page.getByRole('status')).toHaveText(`Vue : ${HOME}`)
  // the menu items, with their shortcut, hand focus to the 3D view
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  const right = page.getByRole('menuitem', { name: /Tourner la vue à droite/ })
  await expect(right).toContainText('6')
  await expect(page.getByRole('menuitem', { name: /Tourner la vue à gauche/ })).toContainText('4')
  await right.click()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  c = await camera(page)
  expect(angleDiff(c.alpha, DROITE.alpha)).toBeLessThan(0.01)
  await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
  await page.getByRole('menuitem', { name: /Tourner la vue à gauche/ }).click()
  expect(angleDiff((await camera(page)).alpha, FACE.alpha)).toBeLessThan(0.01)
  // keys: on the 3D view only
  // Num Lock off (the test browser's case): keypad 6 also reports « ArrowRight » / keyCode 39.
  // Babylon's arrow orbit must not add its own turn: the view lands exactly and stays there.
  await page.keyboard.press('Numpad6')
  await page.waitForTimeout(300)
  expect(angleDiff((await camera(page)).alpha, DROITE.alpha)).toBeLessThan(1e-6)
  await page.keyboard.press('Numpad4')
  await page.waitForTimeout(300)
  expect(angleDiff((await camera(page)).alpha, FACE.alpha)).toBeLessThan(1e-6)
  await page.getByTestId('tree-collapse').focus()
  await page.keyboard.press('Numpad6')
  await page.waitForTimeout(150)
  expect(angleDiff((await camera(page)).alpha, FACE.alpha)).toBeLessThan(0.01)
  expect(await idleRenders(page)).toBe(0)
})

test('the buttons hide while walking and are inert under the place picker', async ({ page }) => {
  await boot(page)
  const tools = page.getByTestId('view-cube-tools')
  await expect(tools).toBeVisible()
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('explore')
  await expect(tools).toBeHidden()
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('orbit')
  await expect(tools).toBeVisible()
  await page.getByRole('menuitem', { name: 'Lieu' }).click()
  await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
  expect(await tools.evaluate((e) => !!e.closest('[inert]'))).toBe(true)
})

test('a cube click announces its view in the status bar (as the menu and V do)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2) // the centre patch of the Face pose
  const z = await page.evaluate(({ x, y }) => window.__creation!.cubeZoneAt(x, y), { x: r.x + r.width / 2, y: r.y + r.height / 2 })
  expect(z).toBe('face')
  await expect(page.getByRole('status')).toHaveText('Vue : Face')
})

/** ArcRotateCamera eye position for a pose. */
const eyeOf = (c: Cam): [number, number, number] => [
  c.target[0] + c.radius * Math.cos(c.alpha) * Math.sin(c.beta),
  c.target[1] + c.radius * Math.cos(c.beta),
  c.target[2] + c.radius * Math.sin(c.alpha) * Math.sin(c.beta),
]
/** Distance from point p to the line through a and b. */
function distToLine(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const cx = ab[1] * ap[2] - ab[2] * ap[1]
  const cy = ab[2] * ap[0] - ab[0] * ap[2]
  const cz = ab[0] * ap[1] - ab[1] * ap[0]
  return Math.hypot(cx, cy, cz) / Math.hypot(ab[0], ab[1], ab[2])
}

test('double-click on the floor re-pivots there; angle and distance are kept (designer-nav Task 4, ported)', async ({ page }) => {
  await boot(page)
  const before = await settled(page)
  const floor: [number, number, number] = [3, 0, 2] // a bare patch of the hall floor
  const at = (await page.evaluate((p) => window.__creation!.worldScreen(p), floor))!
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, at)).toBe('renderCanvas')
  expect(await page.evaluate(({ x, y }) => window.__creation!.pickAt(x, y), at)).toBeNull()
  await page.mouse.dblclick(at.x, at.y)
  const after = await settled(page)
  // the new pivot is the floor point under the cursor: on the ray eye → aimed point, at floor height
  // (the opening pose stands ~26 m away: one CSS pixel of the rounded pointer is ~3 cm there)
  expect(distToLine(after.target, eyeOf(before), floor)).toBeLessThan(0.05)
  expect(dist(after.target, floor)).toBeLessThan(0.3)
  expect(Math.abs(after.target[1])).toBeLessThan(0.15)
  expect(angleDiff(after.alpha, before.alpha)).toBeLessThan(0.01)
  expect(angleDiff(after.beta, before.beta)).toBeLessThan(0.01)
  expect(Math.abs(after.radius - before.radius)).toBeLessThan(0.01)
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  await expect(page.getByTestId('toast')).toBeHidden() // a double-click is no miss: no « Rien ici »
  await expect(page.getByTestId('toast')).toHaveText('')
  expect(await idleRenders(page)).toBe(0)
})

test('double-click re-pivot: never on the cube, never while walking', async ({ page }) => {
  await boot(page)
  const before = await settled(page)
  // on the cube: the click lands a view (target and distance kept), never a re-pivot
  const r = await page.evaluate(() => window.__creation!.cubeRect())
  await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2)
  const c = await settled(page)
  expect(dist(c.target, before.target)).toBeLessThan(1e-6)
  // walking: the orbit camera stays where it is
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift+V')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('explore')
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * 0.8)
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.__creation!.view())).toBe('orbit')
  expect(dist((await settled(page)).target, c.target)).toBeLessThan(1e-6)
})

test('a camera request during a listening-point flight ends « on the point »: an ear-height change never snaps back to it', async ({ page }) => {
  await boot(page, false) // real flights (450 ms)
  const open = await settled(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Digit1') // fly to the Régie
  await settled(page)
  // Écoute open on its radio items; then, in ONE task: Alt+H starts the flight home and
  // « debout » changes the ear height while that flight runs.
  await page.getByRole('menuitem', { name: 'Écoute' }).click()
  await expect(page.getByRole('menuitemradio', { name: /debout 1,7 m/ })).toBeVisible()
  await page.evaluate(() => {
    const canvas = document.getElementById('renderCanvas')!
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', altKey: true, bubbles: true, cancelable: true }))
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((e) => /debout 1,7 m/.test(e.textContent ?? ''))!
    item.click()
  })
  expect(await page.evaluate(() => window.__creation!.earHeight())).toBe(1.7)
  const c = await settled(page)
  expect(angleDiff(c.alpha, open.alpha)).toBeLessThan(0.01)
  expect(Math.abs(c.beta - open.beta)).toBeLessThan(0.01)
  expect(Math.abs(c.radius - open.radius)).toBeLessThan(0.05)
  expect(dist(c.target, open.target)).toBeLessThan(0.05)
})

test('a double-click on the floor shows no « Rien ici » toast and keeps the selection; the re-pivot still happens (final review 2)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  const before = await settled(page)
  const dev = (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  const at = { x: dev.x, y: dev.y + 150 } // the floor in front of the selected device (the camera is framed on it)
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, at)).toBe('renderCanvas')
  expect(await page.evaluate(({ x, y }) => window.__creation!.pickAt(x, y), at)).toBeNull()
  const toast = page.getByTestId('toast')
  await page.mouse.dblclick(at.x, at.y)
  const after = await settled(page)
  expect(dist(after.target, before.target)).toBeGreaterThan(0.1) // it re-pivoted
  await page.waitForTimeout(400) // past the 100 ms before a message is set
  await expect(toast).toBeHidden()
  await expect(toast).toHaveText('')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1') // the first click's miss cleared it; the double-click gives it back
})

test('a slow double-click (the two clicks > 500 ms apart: an OS accessibility setting) still gives the selection back: a second miss does not erase the record', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  const before = await settled(page)
  const dev = (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  const at = { x: dev.x, y: dev.y + 150 }
  expect(await page.evaluate(({ x, y }) => window.__creation!.pickAt(x, y), at)).toBeNull()
  await page.mouse.click(at.x, at.y) // miss 1: clears the selection
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBeNull()
  await page.waitForTimeout(560) // the stimulus: past the 500 ms double-click window, inside the 1 s restore window
  await page.mouse.dblclick(at.x, at.y) // its first click is miss 2 (clicks = 1), then the dblclick event
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(dist((await settled(page)).target, before.target)).toBeGreaterThan(0.1) // and it re-pivoted
})

test('a double-click event while a device follows the pointer (the drop already happened elsewhere) does not re-pivot', async ({ page }) => {
  await boot(page)
  const before = await settled(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  await expect(page.getByRole('tab', { selected: true })).toBeFocused() // the drawer has taken focus: now move to the first item
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tabpanel').getByTestId('inventory-item').first()).toBeFocused()
  await page.keyboard.press('Enter') // the first device: it follows the pointer
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
  const at = (await page.evaluate((p) => window.__creation!.worldScreen(p), [3, 0, 2] as [number, number, number]))!
  await page.evaluate(({ x, y }) => {
    document.getElementById('renderCanvas')!.dispatchEvent(new MouseEvent('dblclick', { clientX: x, clientY: y, button: 0, bubbles: true }))
  }, at)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect(dist((await settled(page)).target, before.target)).toBeLessThan(1e-6)
})
