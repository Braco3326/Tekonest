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
