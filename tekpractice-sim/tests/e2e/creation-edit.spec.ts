/**
 * Task 25: rotate, duplicate, delete and missed-click feedback (CA-11, CA-12, C5). R / Maj+R turn the selected
 * device by 15 deg (Alt: 1 deg), Ctrl+D copies it, Suppr removes it with its cables (Ctrl+Z brings both back);
 * each is ONE undo entry. A click on nothing says so (toast, role="status") and clears the selection.
 */
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const PLACE = 'room:concert-hall-medium'
const MISSED = /Rien ici : clique un appareil ou ouvre l.inventaire \(Espace\)\./

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // a camera cut, not a 450 ms flight: stable screen points
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const history = (page: Page) => page.evaluate(() => window.__creation!.historySize())
const selection = (page: Page) => page.evaluate(() => window.__creation!.selection())
const yawOf = async (page: Page, id: string): Promise<number> => (await design(page)).placements.find((p) => p.instanceId === id)!.yawDeg
const renders = (page: Page) => page.evaluate(() => window.__creation!.renders())

/** The .glb models arrive after the placeholders and move the ports: wait until the page has stopped rendering. */
const settle = async (page: Page): Promise<void> => {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => window.__creation!.renders())
    if (n === last) return
    last = n
    await page.waitForTimeout(700)
  }
  throw new Error('the page never went idle')
}

/** A QL1 at a known place, selected with ] (canvas focused). */
const withQl1 = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  expect(await selection(page)).toBe('ql1')
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
}
/** A synthetic key event on the canvas (the layouts Playwright's keyboard cannot type). */
const keydown = (page: Page, init: { code: string; key: string; ctrlKey?: boolean; repeat?: boolean }) =>
  page.evaluate((i) => {
    document.querySelector('#renderCanvas')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...i }))
  }, init)

test('R turns the selected device +15 deg as ONE undo entry; Maj+R -15; Alt+R +1; Ctrl+Z puts it back', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  const base = await history(page)
  await page.keyboard.press('r')
  expect(await yawOf(page, 'ql1')).toBe(15)
  expect(await history(page)).toBe(base + 1)
  await expect(page.getByTestId('status-bar')).toContainText('Pivoté : Yamaha QL1, 15°')
  await page.keyboard.press('Shift+R')
  expect(await yawOf(page, 'ql1')).toBe(0)
  expect(await history(page)).toBe(base + 2)
  await page.keyboard.press('Shift+R')
  expect(await yawOf(page, 'ql1')).toBe(345)
  await page.keyboard.press('Alt+r')
  expect(await yawOf(page, 'ql1')).toBe(346)
  await page.keyboard.press('Alt+Shift+R')
  expect(await yawOf(page, 'ql1')).toBe(345)
  expect(await history(page)).toBe(base + 5)
  await page.keyboard.press('Control+z')
  expect(await yawOf(page, 'ql1')).toBe(346)
  // a held R is one press
  await page.keyboard.down('r')
  await page.keyboard.down('r')
  await page.keyboard.down('r')
  await page.keyboard.up('r')
  expect(await history(page)).toBe(base + 5) // undo -1, the held R +1
  expect(await yawOf(page, 'ql1')).toBe(1) // 346 + 15 = 361 -> 1
  expect(await selection(page)).toBe('ql1')
})

test('R turns the ghost while placing; the drop uses that yaw', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('r')
  await page.keyboard.press('r')
  await expect(page.getByTestId('status-bar')).toContainText('Orientation : 30°')
  expect(await history(page)).toBe(0) // turning the ghost is not an edit
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  expect(await yawOf(page, (await design(page)).rig.instances[0].instanceId)).toBe(30)
  expect(await history(page)).toBe(1)
})

test('Ctrl+D (QWERTY and AZERTY events) copies the device: a new id, the same controls, +0.5 m on x, the copy selected, ONE entry per press', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  // give the original a changed control, so "the same controls" means something
  const ctl = Object.entries((await design(page)).rig.controls.ql1 ?? {}).find(([, v]) => typeof v === 'boolean')
  if (ctl) await page.evaluate(([c, v]) => window.__creation!.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: c as string, value: !v }), ctl)
  const before = await design(page)
  const base = await history(page)
  const orig = before.placements.find((p) => p.instanceId === 'ql1')!

  await page.keyboard.press('Control+d') // QWERTY
  let d = await design(page)
  expect(d.rig.instances).toHaveLength(2)
  const copy = d.rig.instances.find((i) => i.instanceId !== 'ql1')!
  expect(copy.deviceId).toBe('yamaha-ql1')
  expect(d.rig.controls[copy.instanceId] ?? {}).toEqual(d.rig.controls.ql1 ?? {})
  const cp = d.placements.find((p) => p.instanceId === copy.instanceId)!
  expect(cp.position_m).toEqual([orig.position_m[0] + 0.5, orig.position_m[1], orig.position_m[2]])
  expect(cp.yawDeg).toBe(orig.yawDeg)
  expect(await history(page)).toBe(base + 1)
  expect(await selection(page)).toBe(copy.instanceId)
  await expect(page.getByTestId('status-bar')).toContainText('Dupliqué : Yamaha QL1')

  // AZERTY: the key printed D is the physical D; and a layout where it sits on another code (the labelled key wins)
  await keydown(page, { code: 'KeyD', key: 'd', ctrlKey: true })
  expect((await design(page)).rig.instances).toHaveLength(3)
  await keydown(page, { code: 'KeyE', key: 'd', ctrlKey: true })
  expect((await design(page)).rig.instances).toHaveLength(4)
  expect(await history(page)).toBe(base + 3)
  // the physical D of that layout types an E: not a duplicate
  await keydown(page, { code: 'KeyD', key: 'e', ctrlKey: true })
  expect((await design(page)).rig.instances).toHaveLength(4)
  // a held Ctrl+D (auto-repeat) copies once
  await keydown(page, { code: 'KeyD', key: 'd', ctrlKey: true, repeat: true })
  await keydown(page, { code: 'KeyD', key: 'd', ctrlKey: true, repeat: true })
  expect((await design(page)).rig.instances).toHaveLength(4)
  expect(new Set((await design(page)).rig.instances.map((i) => i.instanceId)).size).toBe(4)

  await page.keyboard.press('Control+z')
  expect((await design(page)).rig.instances).toHaveLength(3)
  d = await design(page)
  expect(d.rig.instances.some((i) => i.instanceId === 'ql1')).toBe(true)
})

const WIRED = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
  })
}

test('Suppr removes the device and its cables as ONE entry; Ctrl+Z brings back the device AND its cables; Ctrl+Shift+Z removes again', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  await WIRED(page)
  const before = await design(page)
  expect(before.rig.connections).toHaveLength(1)
  const base = await history(page)
  await page.keyboard.press('Delete')
  let d = await design(page)
  expect(d.rig.instances.map((i) => i.instanceId)).toEqual(['k12-g'])
  expect(d.rig.connections).toHaveLength(0)
  expect(await history(page)).toBe(base + 1)
  expect(await selection(page)).toBeNull()
  await expect(page.getByTestId('status-bar')).toContainText('Supprimé : Yamaha QL1, avec ses câbles')
  await page.keyboard.press('Control+z')
  d = await design(page)
  expect(d.rig.instances.map((i) => i.instanceId).sort()).toEqual(['k12-g', 'ql1'])
  expect(d.rig.connections).toEqual(before.rig.connections)
  expect(d.placements.find((p) => p.instanceId === 'ql1')).toEqual(before.placements.find((p) => p.instanceId === 'ql1'))
  expect(await history(page)).toBe(base)
  await page.keyboard.press('Control+Shift+z')
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['k12-g'])
})

test('a held Suppr deletes once (and the next device stays)', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] }))
  const base = await history(page)
  await page.keyboard.down('Delete')
  await page.keyboard.down('Delete')
  await page.keyboard.down('Delete')
  await page.keyboard.up('Delete')
  expect(await history(page)).toBe(base + 1)
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['k12-g'])
})

test('with nothing selected the edit keys say so and change nothing', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.locator('#renderCanvas').focus()
  const base = await history(page)
  for (const k of ['r', 'Delete', 'Control+d']) await page.keyboard.press(k)
  expect(await history(page)).toBe(base)
  expect((await design(page)).rig.instances).toHaveLength(1)
  await expect(page.getByTestId('status-bar')).toContainText('Aucun appareil sélectionné')
})

test('while a drag is in progress Suppr, Ctrl+D, R, Ctrl+Z and Ctrl+Y are ignored: the drag stays ONE entry and the device stays', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  const base = await history(page)
  const start = (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 90, start.y, { steps: 6 })
  expect(await page.evaluate(() => window.__creation!.leases())).toContain('drag')
  const during = await design(page)
  for (const k of ['Delete', 'Control+d', 'r', 'Shift+R', 'Control+z', 'Control+y', 'Control+Shift+z']) await page.keyboard.press(k)
  const after = await design(page)
  expect(after.rig.instances.map((i) => i.instanceId)).toEqual(['ql1'])
  expect(after.placements).toEqual(during.placements) // not turned, not moved back
  await page.mouse.up()
  expect(await history(page)).toBe(base + 1) // the whole drag, and nothing else
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['ql1'])
  expect(await selection(page)).toBe('ql1')
  // the drag is that one entry: one Ctrl+Z puts the pose back
  await page.keyboard.press('Control+z')
  expect(await history(page)).toBe(base)
  expect((await design(page)).placements[0].position_m).toEqual([0, 0, 4])
})

test('Matériel › Pivoter / Dupliquer / Supprimer: off without a selection, on with one, with their shortcuts', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  for (const name of [/^Pivoter/, /^Dupliquer/, /^Supprimer/]) await expect(page.getByRole('menuitem', { name })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  await expect(page.getByRole('menuitem', { name: /^Pivoter/ })).toContainText('R')
  await expect(page.getByRole('menuitem', { name: /^Dupliquer/ })).toContainText('Ctrl+D')
  await expect(page.getByRole('menuitem', { name: /^Supprimer/ })).toContainText('Suppr')
  const base = await history(page)
  await page.getByRole('menuitem', { name: /^Pivoter/ }).click()
  expect(await yawOf(page, 'ql1')).toBe(15)
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  await page.getByRole('menuitem', { name: /^Dupliquer/ }).click()
  expect((await design(page)).rig.instances).toHaveLength(2)
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  await page.getByRole('menuitem', { name: /^Supprimer/ }).click()
  expect((await design(page)).rig.instances).toHaveLength(1)
  expect(await history(page)).toBe(base + 3)
})

test('a click on the empty floor shows the message (role=status, polite), clears the selection, takes no focus and goes away after 2.5 s without waking the renderer', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  const toast = page.getByTestId('toast')
  await expect(toast).toBeHidden()
  const box = (await page.locator('#renderCanvas').boundingBox())!
  const base = await history(page)
  await page.mouse.click(box.x + 40, box.y + box.height - 40) // bottom-left: the floor, far from the console
  expect(await selection(page)).toBeNull()
  await expect(toast).toBeVisible()
  await expect(toast).toHaveText(MISSED)
  await expect(toast).toHaveAttribute('role', 'status')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('renderCanvas') // it took no focus
  expect(await history(page)).toBe(base) // clearing the selection is not an edit
  const shownAt = Date.now()
  await expect(toast).toBeHidden({ timeout: 4000 })
  expect(Date.now() - shownAt).toBeGreaterThan(1500)
  expect(Date.now() - shownAt).toBeLessThan(3800)
  await page.waitForTimeout(500) // let the last frame settle
  const a = await renders(page)
  await page.waitForTimeout(2000)
  expect(await renders(page)).toBe(a) // 0 renders in 2 s once the toast has ended
  expect(await page.evaluate(() => window.__creation!.leases())).toEqual([])
})

test('a click on the sky shows the same message', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 6) // the top edge of the view: above the room
  await expect(page.getByTestId('toast')).toHaveText(MISSED)
  expect(await selection(page)).toBeNull()
})

test('a click where a hidden device stands does nothing visible but shows the same message and clears the selection', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  const at = (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  await page.getByRole('button', { name: 'Masquer Yamaha QL1 (ql1)' }).click()
  await expect.poll(() => page.evaluate(() => window.__creation!.visible('ql1'))).toBe(false)
  expect(await selection(page)).toBe('ql1') // hiding does not unselect
  const base = await history(page)
  await page.mouse.click(at.x, at.y)
  await expect(page.getByTestId('toast')).toHaveText(MISSED)
  expect(await selection(page)).toBeNull()
  expect(await history(page)).toBe(base)
  expect((await design(page)).rig.instances).toHaveLength(1)
})

test('a click on a device selects it and shows no message; the click that drops a device is no miss; an orbit drag is no miss', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4], rotationY: 180 })) // facing the audience as in the reference template: its connectors are on the far side
  await settle(page)
  // Over an unselected body a port's first-click area is tight (final review 3): a plain click on the body's centre selects it,
  // even with the QL1 facing the camera and its connectors on the far side.
  const at = (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  expect(at, 'the QL1 centre is on screen').not.toBeNull()
  await page.mouse.click(at.x, at.y)
  expect(await selection(page)).toBe('ql1')
  await expect(page.getByTestId('toast')).toBeHidden()
  // an orbit drag over empty floor
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.move(box.x + 60, box.y + box.height - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + box.height - 60, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByTestId('toast')).toBeHidden()
  expect(await selection(page)).toBe('ql1')
  // placing: the dropping click is not a miss
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await page.mouse.move(box.x + 300, box.y + box.height - 80)
  await page.mouse.click(box.x + 300, box.y + box.height - 80)
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(2)
  await expect(page.getByTestId('toast')).toBeHidden()
})

test('a place change takes the message down', async ({ page }) => {
  await boot(page)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.click(box.x + 40, box.y + box.height - 40)
  await expect(page.getByTestId('toast')).toBeVisible()
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  await expect(page.getByTestId('toast')).toBeHidden()
})

const pairsOf = async (page: Page): Promise<string[]> =>
  (await design(page)).rig.connections.map((c) => [c.a, c.b].map((r) => `${r.instance}.${r.port}`).sort().join(' | ')).sort()

test('Suppr on a device wired on both sides: Ctrl+Z restores EVERY cable of it (as a set of port pairs), the unrelated cable wired after stays, Ctrl+Shift+Z removes exactly its cables', async ({ page }) => {
  await boot(page)
  await withQl1(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm1', position: [-2, 0, 4] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'm1', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    // wired AFTER the console's cables: on undo the console's cables come back after it
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm2', position: [-3, 0, 5] })
    c.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'x', position: [4, 0, 5] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'm2', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } })
  })
  const all = await pairsOf(page)
  expect(all).toHaveLength(3)
  expect(all.filter((p) => p.includes('ql1.'))).toHaveLength(2)
  const base = await history(page)
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await selection(page)) !== 'ql1'; i++) await page.keyboard.press(']')
  expect(await selection(page)).toBe('ql1')
  await page.keyboard.press('Delete')
  expect(await pairsOf(page)).toEqual(all.filter((p) => !p.includes('ql1.')))
  expect(await history(page)).toBe(base + 1)
  await page.keyboard.press('Control+z')
  expect(await pairsOf(page)).toEqual(all) // same pairs; connection ids and list order are not stable across undo
  await page.keyboard.press('Control+Shift+z')
  expect(await pairsOf(page)).toEqual(all.filter((p) => !p.includes('ql1.')))
})

test('while a device follows the pointer, Suppr and Ctrl+D leave the (hidden) selection alone and the placement goes on; after Échap Suppr removes the selected device', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  expect(await selection(page)).toBe('k12-g')
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  const base = await history(page)
  await page.keyboard.press('Delete')
  await page.keyboard.press('Control+d')
  expect((await design(page)).rig.instances.map((i) => i.instanceId)).toEqual(['k12-g'])
  expect(await history(page)).toBe(base)
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  expect(await selection(page)).toBe('k12-g')
  await expect(page.getByTestId('status-bar')).toContainText('Terminez ou annulez la pose')
  // the menu cannot reach the hidden selection either
  await page.getByRole('menuitem', { name: 'Matériel' }).click()
  for (const name of [/^Pivoter/, /^Dupliquer/, /^Supprimer/]) await expect(page.getByRole('menuitem', { name })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.locator('#renderCanvas').focus()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true) // the menu closed; the placement goes on
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  expect(await selection(page)).toBe('k12-g')
  await page.keyboard.press('Delete')
  expect((await design(page)).rig.instances).toHaveLength(0)
  expect(await history(page)).toBe(base + 1)
})
