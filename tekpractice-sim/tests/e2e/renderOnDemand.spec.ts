import { expect, test, type Page } from '@playwright/test'

const renders = (page: Page): Promise<number> => page.evaluate(() => window.__audioSim!.renders!())

/** Wait until loading/compiling has gone quiet (slow machines load for longer): 1 s without a render. */
async function quiet(page: Page): Promise<void> {
  await page.waitForTimeout(1500)
  let calm = 0
  let prev = await renders(page)
  for (let i = 0; i < 60 && calm < 5; i++) {
    await page.waitForTimeout(200)
    const now = await renders(page)
    calm = now === prev ? calm + 1 : 0
    prev = now
  }
}

test('legacy a1 orbit: 0 renders over 2 s idle, > 0 while orbit-dragging, inertia glide renders after release', async ({ page }) => {
  await page.goto('/?level=a1')
  await page.waitForFunction(() => !!window.__audioSim?.renders)
  await quiet(page)
  const r0 = await renders(page)
  await page.waitForTimeout(2000)
  expect(await renders(page)).toBe(r0)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  const rDrag = await renders(page)
  expect(rDrag).toBeGreaterThan(r0)
  const a1 = await page.evaluate(() => window.__audioSim!.camera().alpha)
  await page.waitForTimeout(400)
  const a2 = await page.evaluate(() => window.__audioSim!.camera().alpha)
  expect(Math.abs(a2 - a1)).toBeGreaterThan(0.001) // the glide went on after release
})

test('reduced motion: a DOM cube button cuts the camera and the picture is re-rendered', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/?level=a1')
  await page.waitForFunction(() => !!window.__audioSim?.renders)
  await quiet(page)
  const r0 = await renders(page)
  // Mouse click on the DOM cube's Dessus face (no canvas or key event reaches the scheduler).
  await page.locator('#view-cube [data-face="dessus"]').click()
  // A cut writes the pose at once; a frame must follow (≤ 2 frames), then idle again.
  await expect.poll(() => renders(page), { timeout: 1000 }).toBeGreaterThan(r0)
  expect(await page.evaluate(() => window.__audioSim!.camera().beta)).toBeLessThan(0.05)
  const r1 = await renders(page)
  expect(r1 - r0).toBeLessThanOrEqual(2)
  await page.waitForTimeout(1000)
  expect(await renders(page)).toBe(r1)
})

test('Indices toggle (DOM button) produces a render while the camera is idle', async ({ page }) => {
  await page.goto('/?level=sandbox')
  await page.waitForFunction(() => !!window.__audioSim?.renders)
  await quiet(page)
  if ((await page.evaluate(() => window.__audioSim!.explore!().view)) === 'explore') {
    await page.keyboard.press('v') // leave the walk view (it renders continuously by design)
    await quiet(page)
  }
  const r0 = await renders(page)
  await page.locator('#hints-toggle').click()
  await expect.poll(() => renders(page), { timeout: 1000 }).toBeGreaterThan(r0)
})
