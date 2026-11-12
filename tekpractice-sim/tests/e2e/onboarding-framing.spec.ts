/**
 * First-sound framing (onboarding packs, plan T2.5, spec 5): the neutral room opens CLOSE after a start-screen choice (or Aide « Premiers pas »), so that
 * the three devices of the first sound, a QL1, an SM58 and a K12.2 placed in view, are each at least 40 px on their widest axis at 1366 x 768.
 * The plain game (`/`, no `?design`) keeps the 19.2 m overview, and so does every other way into a room.
 *
 * A GEOMETRY test (allowed by the plan): the size is the screen box of the eight corners of the device's body box (`bodyBoundsInRoot`, the frame of the
 * placement) projected by the scene's own camera (`worldScreen`). The box is the body's own bounding box, so a thin shape (the SM58) is measured by its
 * silhouette's box, never larger than the box of its corners.
 */
import { expect, test, type Page } from '@playwright/test'
import { packageById } from '../../src/design/packages'

test.use({ viewport: { width: 1366, height: 768 } })

const MIN_PX = 40
/**
 * The devices of the first sound, each placed in view of the framed camera, on the floor, inside the zone the framing is tuned for: x within 1.2 m and z within 0.5 m of the
 * target (0, 0.4, 0). The SM58 is the smallest of the three and sits behind the target (the camera looks from +z), the hardest cell.
 */
const DEVICES = [
  { id: 'ql1', deviceId: 'yamaha-ql1', position: [0, 0, 0.2] },
  { id: 'sm58', deviceId: 'shure-sm58', position: [-1.0, 0, -0.4] },
  { id: 'k12', deviceId: 'qsc-k12-2', position: [1.2, 0, -0.2] },
] as const

async function openNeutralRoomByStart(page: Page, query = '?design=1', key = '2'): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('start-screen').waitFor()
  await page.keyboard.press(key)
  await page.getByRole('button', { name: 'Passer, je connais', exact: true }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
}
const settled = (page: Page): Promise<unknown> => page.waitForFunction(() => !window.__creation!.cameraMoving() && window.__creation!.modelsPending() === 0)
const camera = (page: Page) => page.evaluate(() => window.__creation!.camera()!)

/** Size in px of each device's body box on screen, and where its centre is. */
async function measure(page: Page): Promise<Record<string, { w: number; h: number; widest: number; cx: number; cy: number }>> {
  return page.evaluate((devs) => {
    const c = window.__creation!
    const out: Record<string, { w: number; h: number; widest: number; cx: number; cy: number }> = {}
    for (const d of devs) {
      const b = c.bodyBoundsInRoot(d.id)!
      const xs: number[] = []
      const ys: number[] = []
      for (const x of [b.lo[0], b.hi[0]])
        for (const y of [b.lo[1], b.hi[1]])
          for (const z of [b.lo[2], b.hi[2]]) {
            const p = c.worldScreen([d.position[0] + x, d.position[1] + y, d.position[2] + z])!
            xs.push(p.x)
            ys.push(p.y)
          }
      const w = Math.max(...xs) - Math.min(...xs)
      const h = Math.max(...ys) - Math.min(...ys)
      out[d.id] = { w, h, widest: Math.max(w, h), cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2 }
    }
    return out
  }, DEVICES.map((d) => ({ id: d.id, position: [...d.position] })))
}
async function placeAll(page: Page): Promise<void> {
  await page.evaluate((devs) => {
    for (const d of devs) window.__creation!.dispatch({ type: 'SPAWN', deviceId: d.deviceId, instanceId: d.id, position: [...d.position], rotationY: 0 })
  }, DEVICES)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
}

for (const design of [1, 2, 3, 4, 5] as const) {
  test(`package ${design}: after a start-screen choice the camera is at the package framing, and QL1, SM58 and K12.2 placed in view are each >= ${MIN_PX} px on their widest axis`, async ({ page }) => {
    await openNeutralRoomByStart(page, `?design=${design}`, '2')
    const f = packageById(design).framing
    const cam = await camera(page)
    expect(cam.radius, 'radius').toBeCloseTo(f.radius, 2)
    expect(cam.alpha, 'alpha').toBeCloseTo(f.alpha, 3)
    expect(cam.beta, 'beta').toBeCloseTo(f.beta, 3)
    expect(cam.target.map((v) => Math.round(v * 1000) / 1000)).toEqual([...f.target].map((v) => Math.round(v * 1000) / 1000))
    expect(cam.radius, 'the framing may not go under the camera\'s 2 m lower limit').toBeGreaterThanOrEqual(2)
    await placeAll(page)
    const canvas = (await page.locator('#renderCanvas').boundingBox())!
    const m = await measure(page)
    for (const d of DEVICES) {
      const r = m[d.id]
      expect(r.widest, `${d.id}: widest axis ${r.widest.toFixed(1)} px (${r.w.toFixed(1)} x ${r.h.toFixed(1)})`).toBeGreaterThanOrEqual(MIN_PX)
      expect(r.cx, `${d.id} is in view (x)`).toBeGreaterThan(canvas.x)
      expect(r.cx, `${d.id} is in view (x)`).toBeLessThan(canvas.x + canvas.width)
      expect(r.cy, `${d.id} is in view (y)`).toBeGreaterThan(canvas.y)
      expect(r.cy, `${d.id} is in view (y)`).toBeLessThan(canvas.y + canvas.height)
    }
  })
}

test('no ?design: the plain game keeps the 19.2 m overview of the blank room, whichever way the room opens', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
  const cam = await camera(page)
  expect(cam.radius).toBeCloseTo(19.2, 2)
  expect(cam.target).toEqual([0, 1, 0])
  // and the same devices are small there (why the framing exists): the SM58 is about 7 px, far under the 40 px of the first sound
  await placeAll(page)
  expect((await measure(page)).sm58.widest).toBeLessThan(MIN_PX)
})

test('?design but not through the start screen or the tutorial: « Tous les lieux » then the blank card keeps the overview; so does any other room', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.getByRole('button', { name: 'Tous les lieux', exact: true }).click()
  await page.locator('[data-place="blank"]').click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
  expect((await camera(page)).radius).toBeCloseTo(19.2, 2)
})

test('Aide › Premiers pas with no place open frames the neutral room; with a place already open the camera is left alone', async ({ page }) => {
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.setItem('audio-sim/creation-onboarding.v1', JSON.stringify({ v: 1, profile: 'etudie', offer: 'skipped', request: 0, shown: [] })))
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Premiers pas' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
  expect((await camera(page)).radius).toBeCloseTo(packageById(1).framing.radius, 2)
  // a place that is open is the learner's: Premiers pas does not move the camera
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await settled(page)
  const before = await camera(page)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Premiers pas' }).click()
  await page.waitForTimeout(500)
  expect(await camera(page)).toEqual(before)
})
