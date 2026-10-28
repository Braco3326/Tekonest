/**
 * Task 26: enlarged port pick proxies, hover labels and click-to-patch (CA-19, CA-20, C18, C6). Click port A then
 * port B connects (ONE undo entry); a refusal is a pinned message at B and a row in the status list, never an
 * exception; an occupied port offers « Débrancher »; Échap drops the cable after the placement and before the
 * selection; labels exist on hover only; every port is a >= 24 px target at the default camera distance.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

type Ref = { instance: string; port: string }
const SM58: Ref = { instance: 'sm58', port: 'out-xlr' }
const MIC1: Ref = { instance: 'ql1', port: 'in-mic-1' }
const MIC2: Ref = { instance: 'ql1', port: 'in-mic-2' }
const K12_POWER: Ref = { instance: 'k12-g', port: 'power-in' }
const QL_POWER: Ref = { instance: 'ql1', port: 'power-in' }
const QL_OUT: Ref = { instance: 'ql1', port: 'out-main-l' }

/** The reference template ("Concert simple") on a settled camera. */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // a camera cut: stable screen points
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 4)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}
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
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const history = (page: Page) => page.evaluate(() => window.__creation!.historySize())
const pending = (page: Page) => page.evaluate(() => window.__creation!.patchPending())
const cables = async (page: Page) => (await design(page)).rig.connections.length
const screenOf = async (page: Page, ref: Ref) => {
  const p = await page.evaluate((r) => window.__creation!.portScreen(r), ref)
  expect(p, `${ref.instance}.${ref.port} is on screen`).not.toBeNull()
  return p!
}
const clickPort = async (page: Page, ref: Ref): Promise<void> => {
  const p = await screenOf(page, ref)
  await page.mouse.click(p.x, p.y)
}
const visibleLabels = (page: Page) => page.locator('[data-testid="port-label"]:not([hidden])')

test('click sm58 out-xlr then ql1 in-mic-2: connected as ONE undo entry (a cabled port first offers « Débrancher »)', async ({ page }) => {
  await boot(page)
  // The reference template already has sm58 -> in-mic-1: free the mic first, through the offer.
  expect(await cables(page)).toBe(1)
  await clickPort(page, SM58)
  expect(await pending(page)).toBeNull() // an occupied port starts no cable
  const offer = page.getByTestId('port-offer')
  await expect(offer).toBeVisible()
  await expect(offer).toContainText('est branchée à')
  const unplug = page.getByTestId('port-unplug')
  await expect(unplug).toHaveAccessibleName(/^Débrancher .* de /)
  const base = await history(page)
  await unplug.click()
  expect(await cables(page)).toBe(0)
  expect(await history(page)).toBe(base + 1)
  await expect(offer).toBeHidden()
  await expect(page.getByRole('status').first()).toContainText('Débranché')

  await clickPort(page, SM58)
  expect(await pending(page)).toEqual(SM58)
  await clickPort(page, MIC2)
  expect(await pending(page)).toBeNull()
  const d = await design(page)
  expect(d.rig.connections).toHaveLength(1)
  expect(d.rig.connections[0]).toMatchObject({ a: SM58, b: MIC2 })
  expect(await history(page)).toBe(base + 2) // ONE entry for the cable
  await expect(page.getByRole('status').first()).toContainText('Branché')
  await page.evaluate(() => window.__creation!.undo())
  expect(await cables(page)).toBe(0)
})

test('a refused connection (R3) is pinned at the second port as an alert and listed in the status bar; nothing throws or changes', async ({ page }) => {
  await boot(page)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // Free in-mic-1 (the template cables it), then input -> input.
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  const base = await history(page)
  await clickPort(page, K12_POWER)
  expect(await pending(page)).toEqual(K12_POWER)
  await clickPort(page, MIC1)
  const alert = page.getByRole('alert').filter({ hasText: 'Sens de connexion incorrect' })
  await expect(alert).toBeVisible()
  await expect(page.getByTestId('port-error')).toHaveAttribute('role', 'alert')
  // pinned AT port B: the bubble sits just above the port, not far from it
  const port = await screenOf(page, MIC1)
  const box = (await alert.boundingBox())!
  expect(Math.abs(box.x + box.width / 2 - port.x)).toBeLessThan(box.width / 2 + 24)
  expect(port.y - (box.y + box.height)).toBeLessThan(60)
  expect(await cables(page)).toBe(0)
  expect(await history(page)).toBe(base) // a refusal records nothing
  expect(await pending(page)).toEqual(K12_POWER) // the cable stays in hand for a retry
  // the status list: the refusal is its first row
  await expect(page.getByRole('status').first()).toHaveText('Connexion refusée : Sens de connexion incorrect')
  await page.getByTestId('signal-status').click()
  const rows = page.getByRole('dialog', { name: 'Erreurs et avertissements' }).locator('.cr-errlist-row')
  await expect(rows.first()).toHaveAttribute('data-severity', 'rejection')
  await expect(rows.first()).toContainText('Sens de connexion incorrect')
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('hovering a port shows exactly one label, leaving hides it; at rest there is none; the in-scene port labels are gone', async ({ page }) => {
  await boot(page)
  await expect(visibleLabels(page)).toHaveCount(0)
  const p = await screenOf(page, MIC1)
  await page.mouse.move(p.x - 80, p.y - 80)
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await expect(visibleLabels(page)).toHaveCount(1)
  await expect(visibleLabels(page)).toHaveText('in-mic-1 · XLR3 femelle · Niveau micro')
  // moving to another port: still one label
  const q = await screenOf(page, { instance: 'ql1', port: 'out-main-l' })
  await page.mouse.move(q.x, q.y, { steps: 6 })
  await expect(visibleLabels(page)).toHaveCount(1)
  await expect(visibleLabels(page)).toContainText('out-main-l')
  await page.mouse.move(p.x - 200, p.y + 150, { steps: 6 })
  await expect(visibleLabels(page)).toHaveCount(0)
  // no permanent port label in the scene
  const shown = await page.evaluate(() => window.__creation!.visiblePortLabels())
  expect(shown).toBe(0)
})

test('every port is a >= 24 px target at the default camera distance, and a click 10 px off the connector still hits it', async ({ page }) => {
  await boot(page)
  const radii = await page.evaluate(() => {
    const c = window.__creation!
    return c.design().rig.instances.flatMap((i) => {
      const dev = i.deviceId
      return c.devicePorts(i.instanceId).map((port) => ({ ref: `${i.instanceId}.${port}`, r: c.portHitRadiusPx({ instance: i.instanceId, port }), dev }))
    })
  })
  expect(radii.length).toBeGreaterThan(10)
  for (const x of radii) expect(x.r, x.ref).toBeGreaterThanOrEqual(12 - 1e-6)
  // the lone port of the mic: 10 px away on screen still picks it
  const p = await screenOf(page, SM58)
  const r = await page.locator('#renderCanvas').boundingBox()
  const hit = await page.evaluate(
    ({ x, y }) => window.__creation!.portAtPoint(x, y),
    { x: p.x - r!.x + 10, y: p.y - r!.y }
  )
  expect(hit).toEqual(SM58)
  // zoomed way out the target does not shrink
  await page.evaluate(() => {
    const c = window.__creation!
    c.setCameraRadius(c.camera()!.radius * 1.8)
  })
  const far = await page.evaluate((ref) => window.__creation!.portHitRadiusPx(ref), SM58)
  expect(far).toBeGreaterThanOrEqual(12)
})

test('a click on a port is not a miss (no toast) and does not select; a click on nothing while a cable is in hand toasts but keeps it', async ({ page }) => {
  await boot(page)
  await clickPort(page, K12_POWER)
  expect(await pending(page)).toEqual(K12_POWER)
  await expect(page.getByTestId('toast')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  // the camera saw the release: moving the mouse afterwards (no button) does not orbit it
  const cam = await page.evaluate(() => window.__creation!.camera())
  const q = await screenOf(page, QL_POWER)
  await page.mouse.move(q.x, q.y, { steps: 5 })
  await page.mouse.move(q.x - 150, q.y - 90, { steps: 5 })
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam)
  const c = (await page.locator('#renderCanvas').boundingBox())!
  await page.mouse.click(c.x + 6, c.y + c.height - 6) // the corner: nothing there
  await expect(page.getByTestId('toast')).toBeVisible()
  expect(await pending(page)).toEqual(K12_POWER)
})

test('Échap order: a placement first, then the cable in hand, then the selection', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  await page.keyboard.press(']')
  const sel = await page.evaluate(() => window.__creation!.selection())
  expect(sel).not.toBeNull()
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page) // portScreen reads the last RENDERED frame: let the new view render first
  await clickPort(page, QL_POWER)
  expect(await pending(page)).toEqual(QL_POWER)
  // a placement starts over the cable in hand
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false) // 1: the placement
  expect(await pending(page)).toEqual(QL_POWER)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(sel)
  await page.keyboard.press('Escape')
  expect(await pending(page)).toBeNull() // 2: the cable
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(sel)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull() // 3: the selection
})

test('a held Échap is ONE press: it drops the cable and does not fall through to the selection', async ({ page }) => {
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press(']')
  const sel = await page.evaluate(() => window.__creation!.selection())
  expect(sel).not.toBeNull()
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  await clickPort(page, QL_POWER)
  expect(await pending(page)).toEqual(QL_POWER)
  await page.keyboard.down('Escape')
  await page.keyboard.down('Escape') // auto-repeat
  await page.keyboard.down('Escape')
  await page.keyboard.up('Escape')
  expect(await pending(page)).toBeNull()
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(sel)
})

test('the « Débrancher » offer is reachable by keyboard: Échap on its button closes it and gives the 3D view back; Entrée unplugs', async ({ page }) => {
  await boot(page)
  await clickPort(page, SM58)
  const unplug = page.getByTestId('port-unplug')
  await expect(unplug).toBeVisible()
  await unplug.focus()
  await expect(unplug).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('port-offer')).toBeHidden()
  await expect(page.locator('#renderCanvas')).toBeFocused()
  expect(await cables(page)).toBe(1) // closing the offer unplugged nothing
  await clickPort(page, SM58)
  await unplug.focus()
  await page.keyboard.press('Enter')
  expect(await cables(page)).toBe(0)
  await expect(page.locator('#renderCanvas')).toBeFocused()
})

test('the label, the pinned refusal and the offer have no accessibility violations and a visible focus ring on the button', async ({ page }) => {
  await boot(page)
  await clickPort(page, SM58) // the offer
  await page.keyboard.press('Shift') // keyboard modality: a scripted focus then matches :focus-visible
  await page.getByTestId('port-unplug').focus()
  const ring = await page.getByTestId('port-unplug').evaluate((b) => {
    const cs = getComputedStyle(b)
    return { outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth), transition: cs.transitionProperty, radius: cs.borderTopLeftRadius }
  })
  expect(ring.outline).not.toBe('none')
  expect(ring.width).toBeGreaterThanOrEqual(2)
  expect(ring.transition).toBe('none')
  expect(ring.radius).toBe('0px')
  await clickPort(page, K12_POWER) // a press elsewhere closes the offer; a cable in hand
  await clickPort(page, QL_POWER) // power-in -> power-in: refused, the alert is pinned
  await expect(page.getByTestId('port-error')).toBeVisible()
  await page.mouse.move(0, 0)
  const q = await screenOf(page, MIC1)
  await page.mouse.move(q.x, q.y, { steps: 3 }) // and a hover label
  await expect(visibleLabels(page)).toHaveCount(1)
  const results = await new AxeBuilder({ page }).include('[data-testid="viewport"]').exclude('#renderCanvas').disableRules(['region']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

test('while a device follows the pointer, patching is inert: the click that drops it connects nothing', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: 'Consoles' }).click()
  await page.locator('[data-testid="inventory-item"][data-device-id="yamaha-ql1"]').click()
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(true)
  const p = await screenOf(page, SM58)
  await page.mouse.move(p.x, p.y, { steps: 3 })
  await expect(visibleLabels(page)).toHaveCount(0) // no hover label under a ghost
  await page.mouse.click(p.x, p.y)
  expect(await pending(page)).toBeNull()
  await page.keyboard.press('Escape')
})

test('a press-and-drag that starts on a port of the SELECTED device moves it; a plain click there is the cabling\'s', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  const canvas = page.locator('#renderCanvas')
  await canvas.focus()
  // select ql1 with the keyboard cycle
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  // out-main-l is drawn over the console's body from this view: a press there is a press on the selected device
  const sp = await screenOf(page, QL_OUT)
  const box = (await page.locator('#renderCanvas').boundingBox())!
  expect(await page.evaluate(([x, y]) => window.__creation!.pickAt(x, y), [sp.x - box.x, sp.y - box.y])).toBe('ql1')
  // Zoom out a little so a re-frame of the selection (the select-and-fly of a plain click on the device) WOULD move the camera.
  await page.evaluate(() => window.__creation!.setCameraRadius(window.__creation!.camera()!.radius * 1.3))
  await settle(page)
  const sp2 = await screenOf(page, QL_OUT)
  expect(await page.evaluate(([x, y]) => window.__creation!.pickAt(x, y), [sp2.x - box.x, sp2.y - box.y])).toBe('ql1')
  const posOf = async () => (await design(page)).placements.find((q) => q.instanceId === 'ql1')!.position_m
  const before = await posOf()
  const base = await history(page)
  const cam0 = await page.evaluate(() => window.__creation!.camera())
  // a plain click on one of its ports: a cable in hand; the device neither moved nor re-framed (camera and flight checked)
  await clickPort(page, QL_OUT)
  expect(await pending(page)).toEqual(QL_OUT)
  expect(await page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam0)
  await settle(page)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam0)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await posOf()).toEqual(before)
  expect(await history(page)).toBe(base)
  await page.keyboard.press('Escape')
  expect(await pending(page)).toBeNull()
  // a drag from the same spot moves the device
  const p = await screenOf(page, QL_OUT)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.move(p.x + 180, p.y + 12, { steps: 12 }) // far enough to leave the 0.25 m grid cell
  await page.mouse.up()
  expect(await posOf()).not.toEqual(before)
  expect(await history(page)).toBe(base + 1)
  expect(await pending(page)).toBeNull()
})

test("a first click 8 px off a connector that sits on a device body is the PORT's (no selection, camera still); 16+ px off on the body selects it", async ({ page }) => {
  await boot(page)
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  const box = (await page.locator('#renderCanvas').boundingBox())!
  // Where, in canvas px: a ql1 connector drawn over the body with an 8 px neighbour point also over the body and nearest to that connector;
  // and a body point 16+ px from EVERY port of the rig.
  const plan = await page.evaluate(() => {
    const c = window.__creation!
    const rect = document.querySelector('#renderCanvas')!.getBoundingClientRect()
    const all = c.design().rig.instances.flatMap((i) => c.devicePorts(i.instanceId).map((port) => ({ instance: i.instanceId, port })))
    const at = all.map((r) => ({ r, p: c.portScreen(r)! })).map(({ r, p }) => ({ r, x: p.x - rect.left, y: p.y - rect.top }))
    const nearest = (x: number, y: number) => at.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b))
    let eight: { ref: { instance: string; port: string }; x: number; y: number } | null = null
    for (const q of at.filter((a) => a.r.instance === 'ql1')) {
      if (c.pickAt(q.x, q.y) !== 'ql1') continue
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const x = q.x + dx
        const y = q.y + dy
        const n = nearest(x, y)
        if (c.pickAt(x, y) === 'ql1' && n.r.port === q.r.port && n.r.instance === q.r.instance) eight ??= { ref: q.r, x, y }
      }
    }
    const centre = c.deviceScreen('ql1')!
    let far: { x: number; y: number } | null = null
    for (let dx = -60; dx <= 60; dx += 2)
      for (let dy = -40; dy <= 40; dy += 2) {
        const x = centre.x - rect.left + dx
        const y = centre.y - rect.top + dy
        if (c.pickAt(x, y) === 'ql1' && Math.hypot(nearest(x, y).x - x, nearest(x, y).y - y) >= 16 && (!far || Math.hypot(dx, dy) < Math.hypot(far.x - (centre.x - rect.left), far.y - (centre.y - rect.top)))) far = { x, y }
      }
    return { eight, far }
  })
  expect(plan.eight, 'a ql1 connector on its body with an 8 px point on the body').not.toBeNull()
  expect(plan.far, 'a ql1 body point 16+ px from every port').not.toBeNull()
  const cam0 = await page.evaluate(() => window.__creation!.camera())
  await page.mouse.click(box.x + plan.eight!.x, box.y + plan.eight!.y)
  expect(await pending(page)).toEqual(plan.eight!.ref) // the port took it
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull() // and nothing was selected
  expect(await page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam0)
  await page.keyboard.press('Escape')
  expect(await pending(page)).toBeNull()
  await page.mouse.click(box.x + plan.far!.x, box.y + plan.far!.y)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1') // far from every port: the body
  expect(await pending(page)).toBeNull()
})

test('a pinned refusal follows its port through a camera cut and a window resize (within a few px of the independently projected port)', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await clickPort(page, K12_POWER)
  await clickPort(page, MIC1)
  const alert = page.getByTestId('port-error')
  await expect(alert).toBeVisible()
  const near = async (what: string): Promise<void> => {
    await settle(page) // a quiet page: whatever moves a label must have moved it by now
    const port = await screenOf(page, MIC1)
    const box = (await alert.boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - port.x), `${what}: horizontal`).toBeLessThanOrEqual(6)
    expect(Math.abs(port.y - 14 - (box.y + box.height)), `${what}: vertical`).toBeLessThanOrEqual(6)
  }
  await near('at pin')
  // a camera cut (reduced motion: one event, no flight)
  await page.evaluate(() => window.__creation!.setCameraRadius(window.__creation!.camera()!.radius * 0.75))
  await near('after a zoom cut')
  // a quarter turn of the view (keypad 6): a single cut too
  const before = await screenOf(page, MIC1)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Numpad6')
  await settle(page)
  const turned = await screenOf(page, MIC1)
  if (Math.hypot(turned.x - before.x, turned.y - before.y) > 20) {
    const vp = (await page.getByTestId('viewport').boundingBox())!
    // only when the port is still well inside the view (a bubble at an edge is clamped, which is not the lag under test)
    if (turned.x > vp.x + 150 && turned.x < vp.x + vp.width - 150 && turned.y > vp.y + 80 && turned.y < vp.y + vp.height - 40) await near('after a quarter turn')
  }
  // a window resize
  await page.setViewportSize({ width: 1300, height: 640 }) // the port stays well inside the view (a bubble at an edge is clamped, not lagging)
  await near('after a resize')
})

test('a place change drops the cable in hand and the labels; the new scene has its own >= 24 px targets', async ({ page }) => {
  await boot(page)
  await clickPort(page, K12_POWER)
  expect(await pending(page)).toEqual(K12_POWER)
  const p = await screenOf(page, MIC1)
  await page.mouse.move(p.x, p.y, { steps: 3 })
  await expect(visibleLabels(page)).toHaveCount(1)
  await page.evaluate(() => window.__creation!.choosePlace('blank'))
  await page.waitForFunction(() => window.__creation!.place() === 'blank')
  expect(await pending(page)).toBeNull()
  await expect(visibleLabels(page)).toHaveCount(0)
  await expect(page.getByTestId('port-error')).toBeHidden()
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  // spawn in the new scene: its proxies are sized
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [0, 0, 0] }))
  expect(await page.evaluate(() => window.__creation!.portHitRadiusPx({ instance: 'm', port: 'out-xlr' }))).toBeGreaterThanOrEqual(12)
})

test('idle after patching renders nothing, and nothing leaks across place changes', async ({ page }) => {
  await boot(page)
  const listeners = await page.evaluate(() => window.__creation!.liveListeners())
  await clickPort(page, K12_POWER)
  await page.keyboard.press('Escape')
  const p = await screenOf(page, MIC1)
  await page.mouse.move(p.x, p.y, { steps: 3 })
  await page.mouse.move(p.x - 300, p.y + 200, { steps: 3 })
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(before)
  for (let i = 0; i < 3; i++) {
    await page.evaluate((k) => window.__creation!.choosePlace(k), i % 2 === 0 ? 'blank' : 'room:concert-hall-medium')
    await page.waitForFunction((k) => window.__creation!.place() === k, i % 2 === 0 ? 'blank' : 'room:concert-hall-medium')
  }
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  expect(await page.evaluate(() => window.__creation!.liveListeners())).toBe(listeners)
})
