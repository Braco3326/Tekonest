import { expect, test } from '@playwright/test'
test('legacy a1 orbit: 0 renders over 2 s idle, > 0 while orbit-dragging, inertia glide renders after release', async ({ page }) => {
  await page.goto('/?level=a1')
  await page.waitForFunction(() => !!window.__audioSim?.renders)
  await page.waitForTimeout(1500) // let models finish loading
  // Wait until loading/compiling has gone quiet (slow machines load for longer): 1 s without a render.
  let quiet = 0
  let prev = await page.evaluate(() => window.__audioSim!.renders!())
  for (let i = 0; i < 60 && quiet < 5; i++) {
    await page.waitForTimeout(200)
    const now = await page.evaluate(() => window.__audioSim!.renders!())
    quiet = now === prev ? quiet + 1 : 0
    prev = now
  }
  const r0 = await page.evaluate(() => window.__audioSim!.renders!())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__audioSim!.renders!())).toBe(r0)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  const rDrag = await page.evaluate(() => window.__audioSim!.renders!())
  expect(rDrag).toBeGreaterThan(r0)
  const a1 = await page.evaluate(() => window.__audioSim!.camera().alpha)
  await page.waitForTimeout(400)
  const a2 = await page.evaluate(() => window.__audioSim!.camera().alpha)
  expect(Math.abs(a2 - a1)).toBeGreaterThan(0.001) // the glide went on after release
})
