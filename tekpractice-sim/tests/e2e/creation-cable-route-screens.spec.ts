/**
 * Mission 3 B stage 2 screenshots, on demand only (never in the normal suite). PowerShell:
 *   $env:CABLE_ROUTE_SCREENS = 'E:\CLAUDE BU\reports\mission3-screens'; npx playwright test tests/e2e/creation-cable-route-screens.spec.ts
 * Design 2 (entered as a learner does), desktop 1366 x 768 and phone 390 x 844: a tracing in progress (grid, dots, dashed preview, the drawing bar) and the
 * finished routed cable selected (its handles, the cable panel).
 */
import { expect, test, type Page } from '@playwright/test'
import { cableKey } from '../../src/creation/sceneDiff'
import { enterDesign } from './plan2dKit'
import { settleRenders as settle } from './waits'

const OUT = process.env.CABLE_ROUTE_SCREENS
test.skip(!OUT, 'screenshots on demand: set CABLE_ROUTE_SCREENS to the output folder')
test.describe.configure({ timeout: 120_000 })
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } })

const QL_OUT = { instance: 'ql1', port: 'out-main-l' }
const K12_IN = { instance: 'k12-g', port: 'in-line-a' }
const KEY = cableKey(QL_OUT, K12_IN)

async function boot(page: Page, radius: number): Promise<void> {
  await enterDesign(page, 2)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(([a, b]) => {
    const c = window.__creation!
    const f = (x: number, z: number) => c.floorAtM(x, z)
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [-1, f(-1, 6), 6], rotationY: 0 })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, f(3, 6), 6], rotationY: 0 })
    c.dispatch({ type: 'CONNECT', a, b })
  }, [QL_OUT, K12_IN] as const)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
  await page.evaluate(() => window.__creation!.frameDevice('ql1'))
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('dessus-arriere')) // an oblique view from above: the floor between the two is in sight
  await page.evaluate((r) => window.__creation!.setCameraRadius(r), radius)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
}

async function floorScreen(page: Page, x: number, z: number) {
  return (await page.evaluate(([px, pz]) => {
    const c = window.__creation!
    return c.worldScreen([px!, c.floorAtM(px!, pz!), pz!])
  }, [x, z] as const))!
}

async function scenario(page: Page, tag: string, touch: boolean): Promise<void> {
  const openProps = !touch
  await page.evaluate((k) => window.__creation!.cableSelect(k), KEY)
  if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').click()
  await page.getByTestId('cable-trace').click()
  await expect(page.getByTestId('trace-bar')).toBeVisible()
  if (touch && (await page.getByTestId('props-collapse').getAttribute('aria-expanded')) === 'true') await page.getByTestId('props-collapse').click()
  for (const [x, z] of [[0, 7.4], [1.5, 7.6]] as [number, number][]) {
    const s = await floorScreen(page, x, z)
    if (touch) await page.touchscreen.tap(s.x, s.y)
    else await page.mouse.click(s.x, s.y)
    await page.waitForTimeout(550)
  }
  if (!touch) {
    const s = await floorScreen(page, 2.2, 6.9)
    await page.mouse.move(s.x, s.y)
  }
  await settle(page)
  await page.screenshot({ path: `${OUT}/${tag}-tracing.png` })
  await page.getByTestId('trace-finish').click()
  await expect(page.getByTestId('trace-bar')).toHaveCount(0)
  if (openProps && (await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').click()
  await expect.poll(() => page.evaluate(() => window.__creation!.cableTrace()!.tracerLoaded)).toBe(true)
  await page.mouse.move(5, 300)
  await settle(page)
  await page.screenshot({ path: `${OUT}/${tag}-routed.png` })
}

test('desktop (1366 x 768), design 2', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page, 8)
  await scenario(page, 'desktop', false)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('phone (390 x 844, touch), design 2', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await boot(page, 9)
    await scenario(page, 'phone', true)
    // and the cable panel open on the phone
    await page.getByTestId('props-collapse').click()
    await settle(page)
    await page.screenshot({ path: `${OUT}/phone-panel.png` })
  })
})
