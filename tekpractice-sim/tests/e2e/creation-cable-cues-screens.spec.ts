/**
 * Mission 3, cable cues: screenshots on demand only (never in the normal suite). PowerShell:
 *   $env:CABLE_CUES_SCREENS = 'E:\CLAUDE BU\reports\mission3-screens'; $env:CABLE_CUES_TAG = 'after'; npx playwright test tests/e2e/creation-cable-cues-screens.spec.ts
 * One cable of every type the catalogue can connect (analogue balanced and unbalanced, speaker, digital, network, clock, control, mains; DC has no
 * catalogue pair), in the neutral room (dark floor) and in « bar-club-stage-small » (raised stage), design 2 and design 3 (Papier), desktop 1440 x 900 and
 * phone 390 x 844: the default view (« Vue d’ensemble »), a closer view, and the « Légende des câbles ».
 */
import { expect, test, type Page } from '@playwright/test'
import { enterDesign } from './plan2dKit'
import { settleRenders as settle } from './waits'

const OUT = process.env.CABLE_CUES_SCREENS
const TAG = process.env.CABLE_CUES_TAG ?? 'after'
test.skip(!OUT, 'screenshots on demand: set CABLE_CUES_SCREENS to the output folder')
test.describe.configure({ timeout: 180_000 })
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } })

/** [instanceId, deviceId, x, z, yawDeg] relative to the rig's centre. */
const DEVICES: [string, string, number, number, number][] = [
  ['ql1', 'yamaha-ql1', 0, 0, 180],
  ['sm58', 'shure-sm58', -2.2, 1.6, 0],
  ['rio', 'yamaha-rio3224-d2', 2.6, 0.2, 0],
  ['strip', 'multiprise-secteur', 1.2, 2.2, 0],
  ['pc', 'playout-pc', -3, -2.4, 0],
  ['mackie', 'mackie-profx12v3', -0.6, -2.4, 0],
  ['crown', 'crown-xti-4002', 1.8, -2.4, 0],
  ['y10p', 'db-audiotechnik-y10p', 4, -2.4, 0],
  ['axia', 'axia-iq', -3.2, 4, 0],
  ['grace', 'grace-m905', -0.8, 4.2, 0],
  ['litt', 'yellowtec-litt', -3.4, 6, 0],
  ['hdio', 'avid-hd-io', 1.8, 4.4, 0],
  ['mutec', 'mutec-mc-3-plus', 4, 4.6, 0],
]
const CABLES: [string, string, string, string][] = [
  ['sm58', 'out-xlr', 'ql1', 'in-mic-1'], // analogue balanced
  ['pc', 'out-analog-consumer', 'mackie', 'in-stereo-35'], // analogue unbalanced
  ['crown', 'out-spk-1', 'y10p', 'bidir-nl4-1'], // speaker
  ['axia', 'out-program-aes', 'grace', 'in-aes3'], // digital
  ['ql1', 'dante-primary', 'rio', 'dante-primary'], // network
  ['hdio', 'wordclock-out', 'mutec', 'in-wclk'], // clock
  ['axia', 'gpio', 'litt', 'in-gpio'], // control
  ['strip', 'out-1', 'ql1', 'power-in'], // mains
]

async function centreOf(page: Page, place: string): Promise<[number, number]> {
  if (place === 'blank') return [0, -1]
  // The raised stage: centred across it, the console's row 0.5 m inside its front edge, so the back rows stand on the deck and the front rows on the floor.
  return page.evaluate(() => {
    const c = window.__creation!
    let sx = 0
    let n = 0
    let zMax = -Infinity
    for (let x = -15; x <= 15; x += 0.25)
      for (let z = -15; z <= 15; z += 0.25)
        if (c.floorAtM(x, z) > 0.05) {
          sx += x
          n++
          zMax = Math.max(zMax, z)
        }
    return n ? [sx / n, zMax - 0.5] : [0, 0]
  })
}

async function boot(page: Page, design: 2 | 3, place: string): Promise<void> {
  await enterDesign(page, design)
  if (place !== 'blank') {
    await page.evaluate((p) => window.__creation!.choosePlace(p), `room:${place}`)
    await page.waitForFunction((p) => window.__creation!.place() === p, `room:${place}`)
  }
  const [cx, cz] = await centreOf(page, place)
  await page.evaluate(
    ([devices, cables, cx, cz]) => {
      const c = window.__creation!
      for (const [id, deviceId, x, z, yaw] of devices) {
        const [px, pz] = [cx + x, cz + z]
        c.dispatch({ type: 'SPAWN', deviceId, instanceId: id, position: [px, c.floorAtM(px, pz), pz], rotationY: yaw, mount: 'floor' })
      }
      for (const [ai, ap, bi, bp] of cables) c.dispatch({ type: 'CONNECT', a: { instance: ai, port: ap }, b: { instance: bi, port: bp } })
    },
    [DEVICES, CABLES, cx, cz] as const
  )
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0, undefined, { timeout: 60_000 })
  expect(await page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(CABLES.length)
  // the inventory drawer (open on arrival in some packages) would hide half of the view
  const close = page.locator('button:visible', { hasText: /^\s*Fermer\s*$/ }).first()
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.evaluate(() => document.fonts.ready)
}

async function shoot(page: Page, name: string, phone: boolean): Promise<void> {
  // the default view: Vue › Vue d’ensemble
  const vue = page.getByRole('menuitem', { name: 'Vue', exact: true })
  if (phone) await vue.tap()
  else await vue.click()
  const home = page.getByRole('menuitem', { name: /Vue d’ensemble/ })
  if (phone) await home.tap()
  else await home.click()
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.mouse.move(2, 400)
  await settle(page)
  await page.screenshot({ path: `${OUT}/cues-${TAG}-${name}-default.png` })
  // closer: framed on the console, 6 m away
  await page.evaluate(() => window.__creation!.frameDevice('ql1'))
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await page.evaluate(() => window.__creation!.setCameraRadius(6))
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  await page.screenshot({ path: `${OUT}/cues-${TAG}-${name}-close.png` })
  if (!phone) {
    const legend = page.getByTestId('cable-legend')
    if (await legend.isVisible()) {
      await legend.scrollIntoViewIfNeeded()
      await legend.screenshot({ path: `${OUT}/cues-${TAG}-${name}-legend.png` })
    }
  }
}

for (const design of [2, 3] as const)
  for (const place of ['blank', 'bar-club-stage-small']) {
    const room = place === 'blank' ? 'floor' : 'stage'
    test(`desktop 1440 x 900, design ${design}, ${room}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await boot(page, design, place)
      await shoot(page, `d${design}-${room}-desktop`, false)
    })
    test.describe(`phone d${design} ${room}`, () => {
      test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
      test(`phone 390 x 844, design ${design}, ${room}`, async ({ page }) => {
        await boot(page, design, place)
        await shoot(page, `d${design}-${room}-phone`, true)
      })
    })
  }
