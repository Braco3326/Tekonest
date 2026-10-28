/**
 * Task 24: place and move devices (CA-10, P20, C5). Choosing a device in the drawer makes a ghost follow
 * the pointer (0.25 m grid, Alt = free); a click drops it (one SPAWN). A left-drag that starts ON the selected
 * device moves it (ONE undo entry, Échap rolls it back); any other left-drag orbits.
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const PLACE = 'room:concert-hall-medium'
type V3 = [number, number, number]

const boot = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
/** Open the drawer, pick a device by its catalogue id (the tab that holds it is opened first). */
const choose = async (page: Page, deviceId: string, tab: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: tab }).click()
  await page.locator(`[data-testid="inventory-item"][data-device-id="${deviceId}"]`).click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
}
const screenOf = async (page: Page, p: V3): Promise<{ x: number; y: number }> =>
  (await page.evaluate((q) => window.__creation!.worldScreen(q), p))!
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const history = (page: Page) => page.evaluate(() => window.__creation!.historySize())
const camera = (page: Page) => page.evaluate(() => window.__creation!.camera()!)
const poseOf = async (page: Page, id: string): Promise<V3> =>
  (await design(page)).placements.find((p) => p.instanceId === id)!.position_m
/** The cable's centre once the .glb models have re-anchored the ports (it moves while they load): two equal reads 300 ms apart. */
const settledCable = async (page: Page): Promise<V3> => {
  const read = async (): Promise<V3> => (await page.evaluate(() => window.__creation!.cableCenters()))[0]!
  let prev = await read()
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(300)
    const now = await read()
    if (now.every((v, k) => Math.abs(v - prev[k]) < 1e-6)) return now
    prev = now
  }
  throw new Error('the cable never settled')
}
const onGrid = (v: number): boolean => Math.abs(v / 0.25 - Math.round(v / 0.25)) < 1e-6

/** Where on the floor the tests click: away from a grid-cell border (3 cm off a node) so pixel rounding cannot flip the cell. */
const TARGET: V3 = [1.03, 0, 5.28]

/** Choose the QL1 and click the floor at TARGET: returns the new instance id. */
const placeQl1 = async (page: Page, hold?: 'Alt'): Promise<string> => {
  await choose(page, 'yamaha-ql1', 'Consoles')
  const at = await screenOf(page, TARGET)
  await page.mouse.move(at.x, at.y)
  if (hold) await page.keyboard.down(hold)
  await page.mouse.click(at.x, at.y)
  if (hold) await page.keyboard.up(hold)
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  return (await design(page)).rig.instances[0].instanceId
}

test('a chosen device follows the pointer; a click drops it on the 0.25 m grid as ONE undoable entry, and selects it', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  await expect(page.getByRole('status')).toContainText('Cliquez pour poser')
  await expect(page.getByTestId('status-snapping')).toBeVisible()
  expect((await design(page)).rig.instances).toHaveLength(0) // choosing places nothing yet
  const at = await screenOf(page, TARGET)
  await page.mouse.move(at.x - 30, at.y - 20)
  await page.mouse.move(at.x, at.y, { steps: 4 })
  await page.mouse.click(at.x, at.y)
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  const d = await design(page)
  const [x, y, z] = await poseOf(page, d.rig.instances[0].instanceId)
  expect(onGrid(x) && onGrid(z)).toBe(true)
  expect(Math.abs(x - 1.0)).toBeLessThan(0.3)
  expect(Math.abs(z - 5.25)).toBeLessThan(0.3)
  expect(Number.isFinite(y)).toBe(true)
  expect(await history(page)).toBe(1)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(d.rig.instances[0].instanceId)
  await expect(page.getByRole('status')).toContainText('Posé : Yamaha QL1')
  await expect(page.getByTestId('status-snapping')).toBeHidden() // back to nothing placed
  // Ctrl+Z takes it away again
  await page.keyboard.press('Control+z')
  expect((await design(page)).rig.instances).toHaveLength(0)
})

test('Alt drops without the grid', async ({ page }) => {
  await boot(page)
  const id = await placeQl1(page, 'Alt')
  const [x, , z] = await poseOf(page, id)
  expect(Math.abs(x - TARGET[0])).toBeLessThan(0.1)
  expect(Math.abs(z - TARGET[2])).toBeLessThan(0.1)
  expect(onGrid(x) && onGrid(z)).toBe(false)
})

test('dragging the selected device moves it: ONE undo entry; Ctrl+Z restores the drop point; the cable follows', async ({ page }) => {
  await boot(page)
  const id = await placeQl1(page)
  await page.evaluate((qlId) => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: qlId, port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  }, id)
  const before = await history(page)
  const drop = await poseOf(page, id)
  const cable0 = await settledCable(page)
  const cam0 = await camera(page)

  const start = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
  const a = await screenOf(page, drop)
  const b = await screenOf(page, [drop[0] + 2, drop[1], drop[2]])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + (b.x - a.x) / 2, start.y + (b.y - a.y) / 2, { steps: 6 })
  expect(await page.evaluate(() => window.__creation!.leases())).toContain('drag')
  await page.mouse.move(start.x + (b.x - a.x), start.y + (b.y - a.y), { steps: 6 })
  await page.mouse.up()
  const moved = await poseOf(page, id)
  expect(moved[0] - drop[0]).toBeGreaterThan(1.5)
  expect(moved[0] - drop[0]).toBeLessThan(2.5)
  expect(Math.abs(moved[2] - drop[2])).toBeLessThan(0.6)
  expect(onGrid(moved[0]) && onGrid(moved[2])).toBe(true)
  expect(await history(page)).toBe(before + 1) // the whole drag is ONE entry
  expect(await page.evaluate(() => window.__creation!.leases())).toEqual([])
  expect(await page.evaluate((i) => window.__creation!.selection() === i, id)).toBe(true)
  const cam1 = await camera(page)
  expect(cam1.alpha).toBeCloseTo(cam0.alpha, 6) // the drag moved the device, not the camera
  expect(cam1.beta).toBeCloseTo(cam0.beta, 6)
  // the cable follows the device
  const cable1 = (await page.evaluate(() => window.__creation!.cableCenters()))[0]!
  expect(Math.abs(cable1[0] - cable0[0])).toBeGreaterThan(0.5)
  await expect(page.getByRole('status')).toContainText('Déplacé')

  await page.keyboard.press('Control+z')
  expect(await poseOf(page, id)).toEqual(drop)
  expect(await history(page)).toBe(before)
  const cable2 = await settledCable(page)
  expect(cable2[0]).toBeCloseTo(cable0[0], 3)
  await page.keyboard.press('Control+Shift+z')
  expect(await poseOf(page, id)).toEqual(moved)
})

test('Échap during a drag restores the pose, records nothing and keeps the selection', async ({ page }) => {
  await boot(page)
  const id = await placeQl1(page)
  const drop = await poseOf(page, id)
  const before = await history(page)
  const start = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 160, start.y, { steps: 8 })
  expect((await poseOf(page, id))[0]).not.toBe(drop[0])
  await page.keyboard.press('Escape')
  expect(await poseOf(page, id)).toEqual(drop)
  expect(await page.evaluate(() => window.__creation!.leases())).toEqual([])
  await page.mouse.move(start.x + 260, start.y, { steps: 4 }) // the rest of the gesture does nothing
  await page.mouse.up()
  expect(await poseOf(page, id)).toEqual(drop)
  expect(await history(page)).toBe(before)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
  await expect(page.getByRole('status')).toContainText('Déplacement annulé')
  // and the next Échap (nothing to cancel) clears the selection as before
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
})

test('a drag that starts off the device orbits: the camera turns, the pose does not change', async ({ page }) => {
  await boot(page)
  const id = await placeQl1(page)
  const drop = await poseOf(page, id)
  const before = await history(page)
  const cam0 = await camera(page)
  const dev = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
  // far from the device, on the floor in the audience
  const off = await screenOf(page, [drop[0] - 4, 0, drop[2] + 1])
  expect(Math.hypot(off.x - dev.x, off.y - dev.y)).toBeGreaterThan(120)
  await page.mouse.move(off.x, off.y)
  await page.mouse.down()
  await page.mouse.move(off.x + 140, off.y, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => Math.abs((await camera(page)).alpha - cam0.alpha)).toBeGreaterThan(0.05)
  expect(await poseOf(page, id)).toEqual(drop)
  expect(await history(page)).toBe(before)
})

test('a click on the selected device without dragging moves nothing and records nothing', async ({ page }) => {
  await boot(page)
  const id = await placeQl1(page)
  const drop = await poseOf(page, id)
  const before = await history(page)
  const dev = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
  await page.mouse.click(dev.x, dev.y)
  expect(await poseOf(page, id)).toEqual(drop)
  expect(await history(page)).toBe(before)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
})

test('Échap while placing cancels the placement and does not clear the selection; the next Échap does', async ({ page }) => {
  await boot(page)
  await page.evaluate(() =>
    window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
  )
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('k12-g')
  const before = await history(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('k12-g')
  expect((await design(page)).rig.instances).toHaveLength(1)
  expect(await history(page)).toBe(before)
  await expect(page.getByRole('status')).toContainText('Pose annulée')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
})

test('Entrée drops the ghost where it is (keyboard path)', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  expect(await history(page)).toBe(1)
})

test('placing in orbit never switches to the walk view; an orbit drag during placement still drops nothing', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  const cam0 = await camera(page)
  const p = await screenOf(page, [0, 0, 8])
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.move(p.x + 140, p.y, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => Math.abs((await camera(page)).alpha - cam0.alpha)).toBeGreaterThan(0.05)
  expect((await design(page)).rig.instances).toHaveLength(0)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect(await page.evaluate(() => window.__creation!.view())).toBe('orbit')
})

test('a drop at 30 % and at 70 % of the canvas width lands within 0.3 m of the floor point under the cursor (no wall clamp)', async ({ page }) => {
  await boot(page)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  for (const frac of [0.3, 0.7]) {
    const px = box.x + box.width * frac
    const py = box.y + box.height * 0.75
    const under = await page.evaluate(([x, y]) => window.__creation!.floorPoint(x, y), [px, py])
    expect(under, `a floor point at ${frac}`).not.toBeNull()
    const before = (await design(page)).rig.instances.length
    await choose(page, 'yamaha-ql1', 'Consoles')
    await page.mouse.move(px - 20, py)
    await page.mouse.move(px, py, { steps: 3 })
    await page.mouse.click(px, py)
    await expect.poll(async () => (await design(page)).rig.instances.length).toBe(before + 1)
    const d = await design(page)
    const [x, , z] = await poseOf(page, d.rig.instances[before].instanceId)
    expect(Math.hypot(x - under![0], z - under![2]), `drop at ${frac}`).toBeLessThan(0.3)
    expect(onGrid(x) && onGrid(z)).toBe(true)
  }
})

test('choosing a device and cancelling leaves no transform node behind (the glb empties of the ghost go with it)', async ({ page }) => {
  await boot(page)
  const count = () => page.evaluate(() => window.__creation!.transformNodeCount())
  const baseline = await count()
  for (let i = 0; i < 3; i++) {
    await choose(page, 'yamaha-ql1', 'Consoles')
    // wait for the .glb to arrive (the ghost then owns more than its root node)
    await expect.poll(count, { timeout: 15_000 }).toBeGreaterThan(baseline + 1)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
    expect(await count()).toBe(baseline)
  }
})

test('a held Entrée that chose the device does not also drop it: repeats never confirm; a fresh Entrée does', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  const first = page.getByRole('tabpanel').getByTestId('inventory-item').first()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.down('Enter') // chooses; the drawer closes and the canvas takes focus
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  await page.keyboard.down('Enter') // auto-repeat: down again while still held
  await page.keyboard.down('Enter')
  await page.keyboard.down('Enter') // an even number of keydowns in all
  await page.keyboard.up('Enter')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect((await design(page)).rig.instances).toHaveLength(0)
  await page.keyboard.press('Enter') // a deliberate press drops
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
})

test('a place change during placement ends it and says so (the placement line does not linger)', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  await expect(page.getByRole('status')).toContainText('Cliquez pour poser')
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  await expect(page.getByRole('status')).toContainText('Pose annulée')
  await expect(page.getByRole('status')).not.toContainText('Cliquez pour poser')
  await expect(page.getByTestId('status-snapping')).toBeHidden()
  expect((await design(page)).rig.instances).toHaveLength(0)
})

test('idle while placing and after a drop: no render in 2 s, no lease left', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  await page.waitForTimeout(800)
  const a = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(a) // a ghost standing still costs nothing
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  await page.waitForTimeout(800)
  const b = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(b)
  expect(await page.evaluate(() => window.__creation!.leases())).toEqual([])
})
