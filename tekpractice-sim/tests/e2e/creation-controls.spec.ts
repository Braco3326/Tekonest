import { expect, test, type Page } from '@playwright/test'

/**
 * Interactive controls (faders, keys, knobs, live screen) on the QL1 of the reference rig: the surface is built when the model loads, a
 * fader follows the pointer, a key that stands for a simulation setting changes that setting (one undoable step) and undo puts the key back,
 * and a double-click on the glass takes the camera into the screen.
 */
test.use({ viewport: { width: 1366, height: 768 } })

const pageErrors: string[] = []

const boot = async (page: Page): Promise<void> => {
  pageErrors.length = 0
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  // the QL1 is selected and framed: only the selected (or a near) device draws its surface
  await page.evaluate(() => window.__creation!.frameDevice('ql1'))
  await page.waitForFunction(() => window.__creation!.controlValues('ql1') !== null, null, { timeout: 20_000 })
}

const values = (page: Page) => page.evaluate(() => window.__creation!.controlValues('ql1')!)
const at = (page: Page, control: string) => page.evaluate((c) => window.__creation!.controlScreen('ql1', c), control)

test('(a) the QL1 gets its surface: 18 faders, the keys, the encoders, the screen, all at their starting values', async ({ page }) => {
  await boot(page)
  const v = await values(page)
  expect(Object.keys(v).filter((k) => /^fader-/.test(k))).toHaveLength(18)
  expect(v['fader-1']).toBeCloseTo(0.75, 6) // 0 dB
  expect(v['ch1-on']).toBe(1)
  expect(v['user-1']).toBe(0)
  expect(await at(page, 'fader-1')).not.toBeNull()
  expect(pageErrors).toEqual([])
})

test('(b) dragging a fader cap moves it; the cap\'s pad follows it on screen', async ({ page }) => {
  await boot(page)
  const before = (await at(page, 'fader-3'))!
  await page.mouse.move(before.x, before.y)
  await page.mouse.down()
  await page.mouse.move(before.x, before.y + 30, { steps: 6 })
  await page.mouse.up()
  const v = await values(page)
  expect(v['fader-3']).not.toBeCloseTo(0.75, 2)
  const after = (await at(page, 'fader-3'))!
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(2)
  // the neighbours did not move
  expect(v['fader-2']).toBeCloseTo(0.75, 6)
  expect(v['fader-4']).toBeCloseTo(0.75, 6)
})

test('(c) a key that stands for a simulation setting changes it, once and undoably, and undo puts the key back', async ({ page }) => {
  await boot(page)
  // the user keys sit on the sloped rear section: from behind the console the back housing hides them, so look from the operator's side
  await page.evaluate(() => {
    window.__creation!.turnCamera(Math.PI)
    window.__creation!.setCameraRadius(0.9)
  })
  await page.waitForTimeout(300)
  const k = (await at(page, 'user-1'))!
  const before = await page.evaluate(() => ({ h: window.__creation!.historySize(), usb: window.__creation!.design().rig.controls['ql1']['playback-usb'] }))
  expect(before.usb).toBe(false)
  await page.mouse.click(k.x, k.y)
  await page.waitForFunction(() => window.__creation!.design().rig.controls['ql1']['playback-usb'] === true)
  expect((await values(page))['user-1']).toBe(1)
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(before.h + 1)
  await page.evaluate(() => window.__creation!.undo())
  await page.waitForFunction(() => window.__creation!.design().rig.controls['ql1']['playback-usb'] === false)
  expect((await values(page))['user-1']).toBe(0)
})

test('(d) the Properties panel moves the key too (the setting is the one source of truth)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true }))
  // mute master is the ST strip's ON key, inverted: muted = the key is off
  await page.waitForFunction(() => window.__creation!.controlValues('ql1')!['st-on'] === 0)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: false }))
  await page.waitForFunction(() => window.__creation!.controlValues('ql1')!['st-on'] === 1)
})

test('(e) a double-click on the glass takes the camera into the screen', async ({ page }) => {
  await boot(page)
  const r0 = await page.evaluate(() => window.__creation!.camera()!.radius)
  expect(await page.evaluate(() => window.__creation!.focusScreen('ql1', 'screen'))).toBe(true)
  await page.waitForFunction((r) => window.__creation!.camera()!.radius < r, r0, { timeout: 5_000 })
  expect(await page.evaluate(() => window.__creation!.camera()!.radius)).toBeLessThan(1)
  expect(await page.evaluate(() => window.__creation!.focusScreen('ql1', 'nope'))).toBe(false)
})
