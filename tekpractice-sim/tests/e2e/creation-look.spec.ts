/**
 * Task 14b « Look 3D Mode Création »: the viewport in the chrome's palette.
 * Screenshots (blank room, the « Concert simple (référence) » template, a
 * selected device) at 1366×768 and 1920×1080 are committed under
 * docs/creative/screens/task-14b-*.png (our own game, original styling).
 * Plus: hover is Papier and never the selection, and costs no idle frame.
 */
import { expect, test, type Page } from '@playwright/test'

const SHOTS = 'docs/creative/screens'

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // camera flights are cuts: stable shots
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('place-picker')).toBeVisible()
}

/** Pointer off the canvas, .glb loads done, render loop idle. */
const settle = async (page: Page): Promise<void> => {
  await page.mouse.move(2, 2)
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(async () => {
    const a = await page.evaluate(() => window.__creation!.renders())
    await page.waitForTimeout(400)
    return (await page.evaluate(() => window.__creation!.renders())) - a
  }, { timeout: 15000 }).toBe(0)
}

const template = async (page: Page): Promise<void> => {
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.waitForFunction(() => !!window.__creation!.deviceScreen('k12-g'))
}

for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
  test(`screenshots ${w}×${h}: blank room, template, selected device`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await boot(page)
    await page.evaluate(() => window.__creation!.choosePlace('blank'))
    await page.waitForFunction(() => window.__creation!.place() === 'blank')
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/task-14b-blank-${w}x${h}.png` })

    await page.getByRole('menuitem', { name: 'Lieu' }).click()
    await page.getByRole('menuitem', { name: 'Choisir un lieu…' }).click()
    await template(page)
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/task-14b-template-${w}x${h}.png` })

    // select a device with a click in the 3D view (the pick path), the camera cuts to it
    const first = await page.evaluate(() => window.__creation!.design().rig.instances[0].instanceId)
    const p = (await page.evaluate((id) => window.__creation!.deviceScreen(id), first))!
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe(first)
    expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([first])
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/task-14b-selected-${w}x${h}.png` })
  })
}

test('placeholder look (a .glb that fails): token body, family top tint, port markers, Plex labels', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.route('**/assets/yamaha-ql1.glb', (r) => r.abort())
  await boot(page)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']') // select + frame it
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await settle(page)
  await page.screenshot({ path: `${SHOTS}/task-14b-placeholder-selected-1366x768.png` })
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.__creation!.selection())).toBeNull()
  await settle(page)
  await page.screenshot({ path: `${SHOTS}/task-14b-placeholder-1366x768.png` })
})

test('hover: Papier outline on the device under the pointer, never the selection; idle after = 0 renders', async ({ page }) => {
  await boot(page)
  await template(page)
  await settle(page)
  const p = (await page.evaluate(() => window.__creation!.deviceScreen('k12-g')))!
  await page.mouse.move(p.x, p.y)
  await expect.poll(() => page.evaluate(() => window.__creation!.hovered())).toBe('k12-g')
  expect(await page.evaluate(() => window.__creation!.outlined())).toEqual([]) // hover is not a selection
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  // the pointer rests on the device: no frame while nothing moves
  await expect.poll(async () => {
    const a = await page.evaluate(() => window.__creation!.renders())
    await page.waitForTimeout(400)
    return (await page.evaluate(() => window.__creation!.renders())) - a
  }, { timeout: 15000 }).toBe(0)
  const r0 = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(r0)
  // leaving the canvas clears it
  await page.mouse.move(2, 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.hovered())).toBeNull()
})
