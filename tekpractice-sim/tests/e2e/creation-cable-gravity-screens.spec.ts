/**
 * Mission 3 A (« gravity first ») screenshots, on demand only (never in the normal suite, so e2e runs never write files). PowerShell:
 *   $env:CABLE_SCREENS = 'C:\path\to\folder'; npx playwright test tests/e2e/creation-cable-gravity-screens.spec.ts
 * Two views of the reference rig « Concert simple »: a console on a table (0.75 m) cabled to a speaker standing on the floor, and a rack drop (a stage
 * box on the floor beside the console, joined by their Dante ports).
 */
import { expect, test, type Page } from '@playwright/test'

const OUT = process.env.CABLE_SCREENS
test.skip(!OUT, 'screenshots on demand: set CABLE_SCREENS to the output folder')
test.use({ viewport: { width: 1366, height: 768 }, launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } })

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'mains' }))
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SET_POSE', instanceId: 'ql1', position: [0, c.floorAtM(0, 6) + 0.75, 6], yawDeg: 0, tiltDeg: 0, mount: 'stand' })
    c.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [2.5, c.floorAtM(2.5, 4.5), 4.5], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  })
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.evaluate(() => document.fonts.ready)
}
const shot = async (page: Page, name: string): Promise<void> => {
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.mouse.move(1300, 420)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

test('a console on a table to a floor speaker; a rack drop', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.frameDevice('k12-g'))
  await page.evaluate(() => {
    window.__creation!.setCameraRadius(5.5)
    window.__creation!.turnCamera(0.9)
  })
  await shot(page, 'mission3A-console-table-to-floor-speaker')
  const key = await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-rio3224-d2', instanceId: 'rio', position: [-0.8, c.floorAtM(-0.8, 5.9), 5.9], rotationY: 0, mount: 'floor' })
    const r = c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'dante-primary' }, b: { instance: 'rio', port: 'dante-primary' } })
    return JSON.stringify(r)
  })
  console.log('[rack drop CONNECT]', key)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.evaluate(() => window.__creation!.frameDevice('rio'))
  await page.evaluate(() => {
    window.__creation!.setCameraRadius(2.8)
    window.__creation!.turnCamera(2.6)
  })
  await shot(page, 'mission3A-rack-drop')
  for (const k of await page.evaluate(() => window.__creation!.design().rig.connections.map((c) => `${c.a.instance}:${c.a.port}|${c.b.instance}:${c.b.port}`))) console.log('[connection]', k)
})
