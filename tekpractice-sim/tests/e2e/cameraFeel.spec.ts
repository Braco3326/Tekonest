/**
 * Designer navigation (night build 2026-10-24, Tasks 3–4).
 *  Task 3: the orbit has inertia — a wheel notch dollies over several frames,
 *          not in one instant jump.
 *  Task 4: a single click focuses with the device as pivot (N1); a drag then
 *          orbits around it; Alt+H flies home to the Ensemble pose.
 */
import { expect, test, type Page } from '@playwright/test'

type Cam = { alpha: number; beta: number; radius: number; target: [number, number, number] }

const camera = (page: Page): Promise<Cam> => page.evaluate(() => window.__audioSim!.camera())

async function boot(page: Page, url = '/?level=a1&view=orbit'): Promise<void> {
  await page.goto(url)
  await page.waitForFunction(() => !!window.__audioSim)
  // Models land async and re-anchor; never interact mid-landing.
  await page
    .waitForFunction(() => window.__audioSim!.assets().every((a) => a.status === 'glb'), undefined, { timeout: 5000 })
    .catch(() => undefined)
  await page.waitForTimeout(300)
}

/** Sample the camera on consecutive animation frames (inside the page: no IPC gaps). */
function sampleFrames(page: Page, frames: number): Promise<Cam[]> {
  return page.evaluate(
    (n) =>
      new Promise<Cam[]>((resolve) => {
        const out: Cam[] = []
        const step = (): void => {
          out.push(window.__audioSim!.camera())
          if (out.length >= n) resolve(out)
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    frames,
  )
}

/** Poll until the camera stops moving (flight + inertia over). */
async function settledCamera(page: Page): Promise<Cam> {
  let last: Cam | null = null
  for (let i = 0; i < 60; i++) {
    const c = await camera(page)
    if (
      last &&
      Math.abs(c.alpha - last.alpha) < 1e-4 &&
      Math.abs(c.beta - last.beta) < 1e-4 &&
      Math.abs(c.radius - last.radius) < 1e-4 &&
      Math.hypot(c.target[0] - last.target[0], c.target[1] - last.target[1], c.target[2] - last.target[2]) < 1e-4
    )
      return c
    last = c
    await page.waitForTimeout(80)
  }
  return last!
}

const angleDiff = (a: number, b: number): number => {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return Math.abs(d)
}

const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** First candidate (fractions of the viewport) where the canvas itself is under the pointer. */
async function canvasPoint(page: Page, fractions: [number, number][]): Promise<{ x: number; y: number }> {
  const box = (await page.locator('#renderCanvas').boundingBox())!
  for (const [fx, fy] of fractions) {
    const p = { x: box.x + box.width * fx, y: box.y + box.height * fy }
    if (await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id === 'renderCanvas', p)) return p
  }
  throw new Error('no bare canvas point among the candidates')
}

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

/**
 * SINGLE click a device into focus (N1). If the click landed on a port
 * pick-sphere (cable picked up instead), drop it with Esc and re-aim higher.
 */
async function clickFocus(page: Page, instanceId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pos = await page.evaluate((id) => window.__audioSim!.deviceScreen(id), instanceId)
    if (!pos) throw new Error(`no screen position for ${instanceId}`)
    await page.mouse.click(pos.x, pos.y - attempt * 14)
    const ok = await page
      .waitForFunction((id) => window.__audioSim!.view().mode === 'focus' && window.__audioSim!.view().focused === id, instanceId, {
        timeout: 1000,
      })
      .catch(() => null)
    if (ok) return
    if ((await page.evaluate(() => window.__audioSim!.view().held)) !== null) await page.keyboard.press('Escape')
  }
  throw new Error(`could not focus ${instanceId} with a single click`)
}

test('Task 4: one click focuses the console, pivot = its body centre; a drag orbits around it; Alt+H flies home', async ({
  page,
}) => {
  await boot(page)
  const home = await settledCamera(page)

  // 1. Single click → focus, target on the console's BODY centre (N9, ± 5 cm).
  await clickFocus(page, 'ql1-1')
  const focused = await settledCamera(page)
  // Independent oracle (game.ts debugBodyCenter), never the code under test (focusFrame).
  const centre = (await page.evaluate(() => window.__audioSim!.deviceBodyCenter('ql1-1')))!
  expect(dist(focused.target, centre)).toBeLessThan(0.05)

  // 2. Horizontal drag: the pivot stays, the angle turns. (Start on bare canvas:
  // HUD panels sit over parts of it.)
  const start = await canvasPoint(page, [
    [0.5, 0.55],
    [0.4, 0.6],
    [0.6, 0.45],
  ])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 260, start.y, { steps: 12 })
  await page.mouse.up()
  const dragged = await settledCamera(page)
  expect(dist(dragged.target, focused.target)).toBeLessThan(0.01)
  expect(angleDiff(dragged.alpha, focused.alpha)).toBeGreaterThan(0.1)
  expect((await page.evaluate(() => window.__audioSim!.view())).mode).toBe('focus')

  // 3. Alt+H: back to the Ensemble pose (± 0.05 rad), and plain-H help did NOT open.
  await page.keyboard.press('Alt+KeyH')
  await page.waitForFunction(() => window.__audioSim!.view().mode === 'ensemble')
  const back = await settledCamera(page)
  expect(angleDiff(back.alpha, home.alpha)).toBeLessThan(0.05)
  expect(angleDiff(back.beta, home.beta)).toBeLessThan(0.05)
  expect(Math.abs(back.radius - home.radius)).toBeLessThan(0.05)
  expect(dist(back.target, home.target)).toBeLessThan(0.05)
  await expect(page.locator('.ex-panel[data-panel="help"]')).toHaveCount(0)
})

test('Task 4: the « Vue d’ensemble » button flies home too', async ({ page }) => {
  await boot(page)
  const home = await settledCamera(page)
  await clickFocus(page, 'ql1-1')
  await settledCamera(page)
  const btn = page.locator('#explore-toolbar [data-act="home"]')
  await expect(btn).toBeVisible()
  await expect(btn).toHaveAttribute('aria-label', "Revenir à la vue d'ensemble de la salle")
  await btn.click()
  await page.waitForFunction(() => window.__audioSim!.view().mode === 'ensemble')
  const back = await settledCamera(page)
  expect(angleDiff(back.alpha, home.alpha)).toBeLessThan(0.05)
  expect(dist(back.target, home.target)).toBeLessThan(0.05)
})

test('Task 4: double-click on the floor re-pivots there; angle and distance are kept', async ({ page }) => {
  await boot(page)
  const before = await settledCamera(page)
  // A bare patch of the plateau floor, clear of every a1 device. (The plateau
  // env set brings its own floor a few cm under y = 0: the pick lands on it.)
  const floor: [number, number, number] = [2.2, 0, -0.8]
  const at = (await page.evaluate((p) => window.__audioSim!.worldScreen(p), floor))!
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, at)).toBe('renderCanvas')
  await page.mouse.dblclick(at.x, at.y)
  const after = await settledCamera(page)
  // The new pivot is the surface point under the cursor: on the ray eye → aimed point, near the floor.
  expect(distToLine(after.target, eyeOf(before), floor)).toBeLessThan(0.02)
  expect(dist(after.target, floor)).toBeLessThan(0.3)
  expect(Math.abs(after.target[1])).toBeLessThan(0.15)
  expect(angleDiff(after.alpha, before.alpha)).toBeLessThan(0.01)
  expect(angleDiff(after.beta, before.beta)).toBeLessThan(0.01)
  expect(Math.abs(after.radius - before.radius)).toBeLessThan(0.01)
  expect((await page.evaluate(() => window.__audioSim!.view())).mode).toBe('ensemble')
})

test('Task 3: Shift + left-drag pans (target moves, angle kept); a plain left-drag orbits', async ({ page }) => {
  await boot(page)
  const before = await settledCamera(page)
  const start = await canvasPoint(page, [
    [0.5, 0.55],
    [0.4, 0.6],
    [0.6, 0.45],
  ])
  await page.keyboard.down('Shift')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 200, start.y, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  const panned = await settledCamera(page)
  expect(dist(panned.target, before.target)).toBeGreaterThan(0.2)
  expect(angleDiff(panned.alpha, before.alpha)).toBeLessThan(1e-3)
  expect(angleDiff(panned.beta, before.beta)).toBeLessThan(1e-3)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 200, start.y, { steps: 10 })
  await page.mouse.up()
  const orbited = await settledCamera(page)
  expect(angleDiff(orbited.alpha, panned.alpha)).toBeGreaterThan(0.1)
  expect(dist(orbited.target, panned.target)).toBeLessThan(1e-3)
})

test('Task 3: a wheel notch dollies in over several frames (inertia, not an instant jump)', async ({ page }) => {
  await boot(page)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const before = await settledCamera(page)

  await page.mouse.wheel(0, -240) // wheel up = dolly in
  const frames = await sampleFrames(page, 8)
  const radii = frames.map((f) => f.radius)

  // It moved in, and it was still moving several frames after the event.
  expect(radii[radii.length - 1]).toBeLessThan(before.radius)
  let decreasingSteps = 0
  for (let i = 1; i < radii.length; i++) if (radii[i] < radii[i - 1] - 1e-6) decreasingSteps++
  expect(decreasingSteps).toBeGreaterThanOrEqual(3)
})
