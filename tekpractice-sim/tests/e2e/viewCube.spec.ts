/**
 * View cube (designer nav, Task 8). Face = audience side, alpha = +π/2 (N3).
 *  1. a1: focus the console, Face, then "Arrière": alpha ≈ front + π, target still the console centre.
 *  2. Numpad7 → top view (beta < 0.05).
 *  3. Visible at 1366×768, no overlap with the top HUD; screenshots in test-results/.
 * Plus: Droite is on the screen-right of the Face view (Babylon is left-handed),
 * Dessous lifts the floor guard until the next orbit, keys are ignored while
 * typing, the cube hides while walking, and an idle camera costs no cube update.
 */
import { expect, test, type Page } from '@playwright/test'

type Cam = { alpha: number; beta: number; radius: number; target: [number, number, number] }
const FRONT = Math.PI / 2
const DEG = Math.PI / 180

const camera = (page: Page): Promise<Cam> => page.evaluate(() => window.__audioSim!.camera())

async function boot(page: Page, url = '/?level=a1&view=orbit'): Promise<void> {
  await page.goto(url)
  await page.waitForFunction(() => !!window.__audioSim)
  await page
    .waitForFunction(() => window.__audioSim!.assets().every((a) => a.status === 'glb'), undefined, { timeout: 5000 })
    .catch(() => undefined)
  await page.waitForTimeout(300)
}

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

/** |shortestAngle(a, b)| */
const angleDiff = (a: number, b: number): number => {
  const d = (((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return Math.abs(d)
}
const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

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

/** a1's console instance (content/levels/a1.json: yamaha-ql1). */
const CONSOLE = 'ql1-1'

test('Task 8: focus the console, Face (Numpad1), then « Arrière »: alpha = front + π, pivot still the console', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await boot(page)
  await clickFocus(page, CONSOLE)
  await settledCamera(page)
  const centre = (await page.evaluate((id) => window.__audioSim!.deviceBodyCenter(id), CONSOLE))!

  await page.keyboard.press('Numpad1')
  const face = await settledCamera(page)
  expect(angleDiff(face.alpha, FRONT)).toBeLessThan(1 * DEG)
  await expect(page.locator('#view-cube .vc-current')).toHaveText('Face')
  await expect(page.locator('#view-cube [data-face="face"]')).toHaveClass(/is-active/)
  await page.locator('#view-cube').screenshot({ path: 'test-results/view-cube-closeup-face.png' })

  // « Arrière » sits on the hidden back of the cube from here: the keyboard path (Tab reaches it).
  const back = page.getByRole('button', { name: 'Vue arrière', exact: true })
  await back.focus()
  await page.keyboard.press('Enter')
  const landed = await settledCamera(page)
  expect(angleDiff(landed.alpha, FRONT + Math.PI)).toBeLessThan(1 * DEG)
  expect(dist(landed.target, centre)).toBeLessThan(0.05)
  expect(Math.abs(landed.radius - face.radius)).toBeLessThan(0.01)
  expect((await page.evaluate(() => window.__audioSim!.view())).mode).toBe('focus')
  await expect(page.getByRole('button', { name: 'Vue arrière, vue actuelle' })).toHaveCount(1)
})

test('Task 8: ↻ from Face lands on Droite, on the screen-RIGHT of the Face view; ↻ again = Arrière (mouse path)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await boot(page)
  await page.keyboard.press('Numpad1')
  const face = await settledCamera(page)
  // Which world side is on screen-right in the Face view (independent of the cube maths):
  const t = face.target
  const side = await page.evaluate(
    ([x, y, z]) => {
      const a = window.__audioSim!.worldScreen([x + 1, y, z])!
      const b = window.__audioSim!.worldScreen([x - 1, y, z])!
      return a.x > b.x ? 1 : -1 // +1: world +x is screen-right
    },
    t,
  )
  await page.getByRole('button', { name: 'Tourner à droite (90°)' }).click()
  const right = await settledCamera(page)
  const eyeX = right.radius * Math.cos(right.alpha) * Math.sin(right.beta)
  expect(Math.sign(eyeX)).toBe(side) // the camera now stands on that screen-right side
  await expect(page.locator('#view-cube .vc-current')).toHaveText('Droite')
  await page.getByRole('button', { name: 'Tourner à droite (90°)' }).click()
  const back = await settledCamera(page)
  expect(angleDiff(back.alpha, FRONT + Math.PI)).toBeLessThan(1 * DEG)
  // Mouse on a visible face: from the back, the « Arrière » face looks at us; Dessus is on top.
  await page.locator('#view-cube [data-face="dessus"]').click()
  expect((await settledCamera(page)).beta).toBeLessThan(0.05)
})

test('Task 8: Numpad7 = top view (beta < 0.05); Dessous lifts the floor guard until the next orbit', async ({ page }) => {
  await boot(page)
  await page.keyboard.press('Numpad7')
  const top = await settledCamera(page)
  expect(top.beta).toBeLessThan(0.05)
  await expect(page.locator('#view-cube .vc-current')).toHaveText('Dessus')

  await page.getByRole('button', { name: 'Vue de dessous', exact: true }).focus()
  await page.keyboard.press('Enter')
  const under = await settledCamera(page)
  expect(under.beta).toBeGreaterThan(Math.PI - 0.05)
  // The learner orbits again: the guard comes back (beta ≤ π/2 − 0.02).
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6 + 40, box.y + box.height * 0.6, { steps: 4 })
  await page.mouse.up()
  expect((await settledCamera(page)).beta).toBeLessThanOrEqual(Math.PI / 2 - 0.02 + 1e-6)
})

test('Task 8: cube keys never fire while typing; the cube hides while walking (Explore)', async ({ page }) => {
  await boot(page)
  const before = await settledCamera(page)
  await page.evaluate(() => {
    const i = document.createElement('input')
    i.id = 'probe-input'
    document.body.appendChild(i)
    i.focus()
  })
  await page.keyboard.press('Numpad7')
  await page.waitForTimeout(600)
  expect(angleDiff((await camera(page)).beta, before.beta)).toBeLessThan(1e-3)
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())

  await expect(page.locator('#view-cube')).toBeVisible()
  await page.keyboard.press('KeyV')
  await page.waitForFunction(() => window.__audioSim!.explore?.().view === 'explore')
  await expect(page.locator('#view-cube')).toBeHidden()
  await page.keyboard.press('KeyV')
  await page.waitForFunction(() => window.__audioSim!.explore?.().view === 'orbit')
  await expect(page.locator('#view-cube')).toBeVisible()
})

test('Task 8 perf: an idle camera never re-orients the cube; a flight does', async ({ page }) => {
  await boot(page)
  await settledCamera(page)
  const count = (ms: number): Promise<number> =>
    page.evaluate(
      (wait) =>
        new Promise<number>((resolve) => {
          const cube = document.querySelector('#view-cube .vc-cube')!
          let n = 0
          const mo = new MutationObserver((recs) => (n += recs.length))
          mo.observe(cube, { attributes: true, attributeFilter: ['style'] })
          setTimeout(() => {
            mo.disconnect()
            resolve(n)
          }, wait)
        }),
      ms,
    )
  expect(await count(800)).toBe(0)
  const during = count(500)
  await page.keyboard.press('Numpad1')
  expect(await during).toBeGreaterThan(0)
})

test('Task 8 a11y: every cube button has a name; Tab reaches the cube; the focus ring shows', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await boot(page)
  const unnamed = await page.$$eval('#view-cube button', (bs) =>
    bs.filter((b) => !(b.getAttribute('aria-label') ?? '').trim()).map((b) => b.outerHTML),
  )
  expect(unnamed).toEqual([])
  expect(await page.locator('#view-cube button').count()).toBe(13) // 6 faces + 4 edges + ↺ ⌂ ↻
  // On the canvas, Tab cycles devices (ADR-0008); inside the HUD it moves natively.
  // Start on the first HUD control and Tab until a cube button takes focus.
  await page.locator('#hud a, #hud button').first().focus()
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(() => !!document.activeElement?.closest('#view-cube'))
  }
  expect(reached).toBe(true)
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const cs = getComputedStyle(el)
    const stage = getComputedStyle(el.closest('.vc-stage') ?? el)
    return { el: el.getAttribute('aria-label'), outline: cs.outlineStyle, width: cs.outlineWidth, stage: stage.outlineStyle }
  })
  expect(ring.outline).toBe('solid')
  expect(ring.stage === 'solid' || ring.outline === 'solid').toBe(true)
  await page.locator('#view-cube').screenshot({ path: 'test-results/view-cube-focus-ring.png' })
})

for (const vp of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`Task 8: the cube is visible at ${vp.width}×${vp.height}, overlaps no other HUD; screenshot`, async ({ page }, info) => {
    await page.setViewportSize(vp)
    await boot(page)
    const cube = page.locator('#view-cube')
    await expect(cube).toBeVisible()
    const size = await page.locator('#view-cube .vc-stage').evaluate((el) => el.getBoundingClientRect().width)
    expect(size).toBe(vp.width < 1366 ? 72 : 96)
    const overlaps = await page.evaluate(() => {
      const dock = document.getElementById('view-dock')!
      const d = dock.getBoundingClientRect()
      const hit = (r: DOMRect): boolean => r.left < d.right && r.right > d.left && r.top < d.bottom && r.bottom > d.top
      const others = [
        '#hud-objectives',
        '#explore-toolbar',
        '.board2d-toggle',
        '#exam-timer',
        '#hud-controls',
        '#hud-shelf',
      ]
      const out: string[] = []
      for (const sel of others)
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0 && !dock.contains(el) && hit(r)) out.push(sel)
        }
      // Top-right HUD: anything in the right half of the top band.
      for (const el of document.querySelectorAll<HTMLElement>('#hud *')) {
        if (dock.contains(el) || el.contains(dock)) continue
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0 && r.left > innerWidth / 2 && r.top < innerHeight * 0.3 && hit(r)) out.push(el.id || el.className)
      }
      return { out, dock: [d.left, d.top, d.right, d.bottom], inView: d.bottom <= innerHeight && d.right <= innerWidth }
    })
    expect(overlaps.out).toEqual([])
    expect(overlaps.inView).toBe(true)
    await page.screenshot({ path: `test-results/view-cube-${vp.width}x${vp.height}.png` })
    await cube.screenshot({ path: `test-results/view-cube-closeup-${vp.width}.png` })
    info.annotations.push({ type: 'dock', description: JSON.stringify(overlaps.dock) })
  })
}
