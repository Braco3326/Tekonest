/**
 * First-sound framing (onboarding packs, plan T2.5, spec 5, T2 review item 6, ruling R-D): the neutral room opens CLOSE after a start-screen choice (or Aide
 * « Premiers pas »), so that the devices of the first sound, a QL1, an SM58 and a K12.2, are each at least 44 px on their widest axis (the 40 px asked plus 4 px
 * of margin), at 1366 x 768 (canvas about 708 px high) AND at 1366 x 650 (about 590 px, a real laptop window with the browser's own chrome). The plain game (`/`,
 * no `?design`) keeps the 19.2 m overview, and so does every other way into a room.
 *
 * WHAT IS MEASURED: a GEOMETRY test (the plan allows it). A device's size is the screen BOX of the eight corners of its body's bounding box (`bodyBoundsInRoot`, the
 * frame of the placement), projected by the scene's own camera (`worldScreen`). It is NOT a pixel count of the silhouette: for a thin shape (the SM58) the box is never
 * smaller than the silhouette's box, so this can overstate the visible size by a few pixels.
 *
 * THE ZONE (stated, not fitted to the test): the product starts a placement on the floor point under the middle of the canvas (`seedPoint` in placementController.ts). The
 * claim is for the neighbourhood of that point, 0.9 m sideways and 0.5 m in depth (the 0.25 m placement grid), for the SM58 (the smallest of the three); farther floor
 * is smaller, and the visible floor reaches several metres, so no claim is made for it.
 */
import { expect, test, type Page } from '@playwright/test'
import { packageById } from '../../src/design/packages'

const MIN_PX = 40
const MARGIN_PX = 4
const ZONE = { x: 0.9, z: 0.5, step: 0.25 }

type Box = { w: number; h: number; widest: number; x0: number; x1: number; y0: number; y1: number }

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
const canvasBox = async (page: Page) => (await page.locator('#renderCanvas').boundingBox())!

/** The floor point under the middle of the view: the camera's line of sight through its target, down to the floor (y = 0). */
async function seedPoint(page: Page): Promise<[number, number]> {
  const c = await camera(page)
  const eye = [c.target[0] + c.radius * Math.cos(c.alpha) * Math.sin(c.beta), c.target[1] + c.radius * Math.cos(c.beta), c.target[2] + c.radius * Math.sin(c.alpha) * Math.sin(c.beta)]
  const f = [c.target[0] - eye[0], c.target[1] - eye[1], c.target[2] - eye[2]]
  const t = -eye[1] / f[1]
  return [eye[0] + f[0] * t, eye[2] + f[2] * t]
}

/** The screen box of a spawned device's body box placed at (x, z) on the floor: the placed one at its own spot, or a virtual one (same body, another spot). */
async function boxesAt(page: Page, id: string, spots: [number, number][]): Promise<Box[]> {
  return page.evaluate(
    ([instance, pts]) => {
      const c = window.__creation!
      const b = c.bodyBoundsInRoot(instance as string)!
      return (pts as [number, number][]).map(([px, pz]) => {
        const xs: number[] = []
        const ys: number[] = []
        for (const x of [b.lo[0], b.hi[0]])
          for (const y of [b.lo[1], b.hi[1]])
            for (const z of [b.lo[2], b.hi[2]]) {
              const p = c.worldScreen([px + x, y, pz + z])!
              xs.push(p.x)
              ys.push(p.y)
            }
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
        return { w: x1 - x0, h: y1 - y0, widest: Math.max(x1 - x0, y1 - y0), x0, x1, y0, y1 }
      })
    },
    [id, spots] as const,
  )
}
async function spawn(page: Page, id: string, deviceId: string, at: [number, number]): Promise<void> {
  await page.evaluate(([i, d, p]) => window.__creation!.dispatch({ type: 'SPAWN', deviceId: d as string, instanceId: i as string, position: [(p as number[])[0], 0, (p as number[])[1]], rotationY: 0 }), [id, deviceId, at] as const)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
}
const inside = (b: Box, c: { x: number; y: number; width: number; height: number }): boolean => b.x0 >= c.x && b.x1 <= c.x + c.width && b.y0 >= c.y && b.y1 <= c.y + c.height

for (const height of [768, 650]) {
  test.describe(`1366 x ${height}`, () => {
    test.use({ viewport: { width: 1366, height } })

    for (const design of [1, 2, 3, 4, 5] as const) {
      test(`package ${design}: after a start-screen choice the camera is at the package framing for this canvas height`, async ({ page }) => {
        await openNeutralRoomByStart(page, `?design=${design}`, '2')
        const f = packageById(design).framing
        const canvas = await canvasBox(page)
        const cam = await camera(page)
        expect(cam.radius, `radius for a ${Math.round(canvas.height)} px canvas`).toBeCloseTo(Math.max(2, (f.radius * canvas.height) / 600), 1)
        expect(cam.radius, 'never under the camera\'s 2 m lower limit').toBeGreaterThanOrEqual(2)
        expect(cam.alpha, 'alpha').toBeCloseTo(f.alpha, 3)
        expect(cam.beta, 'beta').toBeCloseTo(f.beta, 3)
        expect(cam.target.map((v) => Math.round(v * 1000) / 1000)).toEqual([...f.target].map((v) => Math.round(v * 1000) / 1000))
      })
    }

    test(`the SM58 on every floor point of the zone (${ZONE.x} m sideways, ${ZONE.z} m deep around where a placement starts) is >= ${MIN_PX + MARGIN_PX} px on its widest axis and inside the view; QL1 and K12.2 placed beside it too`, async ({ page }) => {
      await openNeutralRoomByStart(page, '?design=2', '2')
      const canvas = await canvasBox(page)
      const [sx, sz] = await seedPoint(page)
      const spots: [number, number][] = []
      for (let dx = -ZONE.x; dx <= ZONE.x + 1e-9; dx += ZONE.step) for (let dz = -ZONE.z; dz <= ZONE.z + 1e-9; dz += ZONE.step) spots.push([sx + dx, sz + dz])
      await spawn(page, 'sm58', 'shure-sm58', [sx - 0.9, sz - 0.3])
      const zone = await boxesAt(page, 'sm58', spots)
      const smallest = Math.min(...zone.map((b) => b.widest))
      expect(smallest, `SM58 smallest widest axis over ${zone.length} floor points at canvas ${Math.round(canvas.height)} px: ${smallest.toFixed(1)} px`).toBeGreaterThanOrEqual(MIN_PX + MARGIN_PX)
      zone.forEach((b, i) => expect(inside(b, canvas), `SM58 box inside the canvas at zone point ${i}`).toBe(true))
      // the real devices of a first sound, placed in the zone: each is >= 44 px and inside the view
      await spawn(page, 'ql1', 'yamaha-ql1', [sx, sz])
      await spawn(page, 'k12', 'qsc-k12-2', [sx + 0.9, sz - 0.3])
      for (const [id, at] of [['sm58', [sx - 0.9, sz - 0.3]], ['ql1', [sx, sz]], ['k12', [sx + 0.9, sz - 0.3]]] as const) {
        const [b] = await boxesAt(page, id, [[...at]])
        expect(b.widest, `${id} widest axis ${b.widest.toFixed(1)} px (${b.w.toFixed(1)} x ${b.h.toFixed(1)})`).toBeGreaterThanOrEqual(MIN_PX + MARGIN_PX)
        expect(inside(b, canvas), `${id} box inside the canvas`).toBe(true)
      }
    })

    test('with the drawer open on the first room (the profile opens it): the far half of the zone, and the devices placed there, stay above the drawer', async ({ page }) => {
      await openNeutralRoomByStart(page, '?design=2', '2')
      const drawer = (await page.getByTestId('inventory-drawer').boundingBox())!
      expect(await page.getByTestId('inventory-drawer').getAttribute('data-open'), 'the drawer opens on the first room').toBe('true')
      const [sx, sz] = await seedPoint(page)
      await spawn(page, 'sm58', 'shure-sm58', [sx, sz])
      await spawn(page, 'ql1', 'yamaha-ql1', [sx, sz - 0.3])
      const [mic] = await boxesAt(page, 'sm58', [[sx, sz]])
      const [console1] = await boxesAt(page, 'ql1', [[sx, sz - 0.3]])
      expect(mic.y1, `SM58 at the starting point ends at y ${mic.y1.toFixed(0)}, the drawer starts at ${drawer.y.toFixed(0)}`).toBeLessThanOrEqual(drawer.y)
      expect(console1.y1, `QL1 a quarter metre behind it ends at y ${console1.y1.toFixed(0)}`).toBeLessThanOrEqual(drawer.y)
    })
  })
}

test('no ?design: the plain game keeps the 19.2 m overview of the blank room, whichever way the room opens, and the SM58 is small there', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
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
  await spawn(page, 'sm58', 'shure-sm58', [0, 0])
  expect((await boxesAt(page, 'sm58', [[0, 0]]))[0].widest, 'the SM58 at the overview, why the framing exists').toBeLessThan(MIN_PX)
})

test('?design but not through the start screen or the tutorial: « Tous les lieux » then the blank card keeps the overview', async ({ page }) => {
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
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/?design=1')
  await page.evaluate(() => window.localStorage.setItem('audio-sim/creation-onboarding.v1', JSON.stringify({ v: 1, profile: 'etudie', offer: 'skipped', request: 0, shown: [] })))
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.getByRole('menuitem', { name: 'Aide', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Premiers pas' }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
  const canvas = await canvasBox(page)
  expect((await camera(page)).radius).toBeCloseTo(Math.max(2, (packageById(1).framing.radius * canvas.height) / 600), 1)
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

test('on an exam address (?design=1&mode=exam) nothing frames: the plain picker shows and the camera is the overview of whatever room is chosen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/?design=1&mode=exam')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await expect(page.getByTestId('place-picker')).toBeVisible()
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await settled(page)
  expect((await camera(page)).radius).toBeCloseTo(19.2, 2)
})
