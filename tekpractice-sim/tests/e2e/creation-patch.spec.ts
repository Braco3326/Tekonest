/**
 * Task 26: enlarged port pick proxies, hover labels and click-to-patch (CA-19, CA-20, C18, C6). Click port A then
 * port B connects (ONE undo entry); a refusal is a pinned message at B and a row in the status list, never an
 * exception; an occupied port offers « Débrancher »; Échap drops the cable after the placement and before the
 * selection; labels exist on hover only; every port is a >= 24 px target at the default camera distance.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'

/** Task 29 (CA-15): the rule texts are the catalog's French fields, pinned exactly. */
const RULE = (id: string) => catalog.rules.find((r) => r.id === id)!
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
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  // Task 32: the template also holds its power strip `mains` and three mains cables. This spec is about the signal cables and
  // needs the power-in ports free, so it takes the strip away (the powered rig is held by creation-keyboard-patch, the SceneHost
  // test and the powered-rig test of creation-cables.spec.ts).
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'mains' }))
  await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 4)
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
/** Select this device from the keyboard (`]`), and wait for the camera to settle on it. */
const selectDevice = async (page: Page, id: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}
/** Every port of the rig: its pick proxy radius (the >= 12 px floor) and the radius a first click gets over its body now. */
const proxyRadii = (page: Page) =>
  page.evaluate(() => {
    const c = window.__creation!
    return c.design().rig.instances.flatMap((i) =>
      c.devicePorts(i.instanceId).map((port) => ({
        ref: `${i.instanceId}.${port}`,
        dev: i.instanceId,
        r: c.portProxyRadiusPx({ instance: i.instanceId, port }),
        first: c.portHitRadiusPx({ instance: i.instanceId, port }),
      }))
    )
  })
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
  await expect(page.getByTestId('port-error')).toHaveText(`Branchement refusé : ${RULE('R3').title_fr}`)
  await expect(page.getByTestId('port-error')).not.toContainText(RULE('R3').title) // never the English title
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
  await expect(rows.first()).toContainText(RULE('R3').title_fr)
  await expect(rows.first()).toContainText(RULE('R3').teach_fr)
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

test('every port is a >= 24 px target on the selected device (and while a cable is in hand); over an unselected body the first click is tight; the proxies are >= 12 px at any distance', async ({ page }) => {
  await boot(page)
  // The proxies themselves: >= 12 px radius for every port of every device, selected or not (the floor).
  const radii = await proxyRadii(page)
  expect(radii.length).toBeGreaterThan(10)
  for (const x of radii) expect(x.r, x.ref).toBeGreaterThanOrEqual(12 - 1e-6)
  // Unselected devices (nothing is selected yet): a first click over the body is TIGHT, never under 6 px and under 12.
  for (const x of radii) {
    expect(x.first, `${x.ref} unselected`).toBeGreaterThanOrEqual(6 - 1e-6)
    expect(x.first, `${x.ref} unselected`).toBeLessThan(12)
  }
  // Selected (the focus distance): the mic's ports are full 24 px targets; the others stay tight.
  await selectDevice(page, 'sm58')
  const sel = await proxyRadii(page)
  for (const x of sel.filter((q) => q.dev === 'sm58')) expect(x.first, x.ref).toBeGreaterThanOrEqual(12 - 1e-6)
  for (const x of sel.filter((q) => q.dev !== 'sm58')) expect(x.first, `${x.ref} still unselected`).toBeLessThan(12)
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
  expect(await page.evaluate((ref) => window.__creation!.portProxyRadiusPx(ref), SM58)).toBeGreaterThanOrEqual(12)
  expect(await page.evaluate((ref) => window.__creation!.portHitRadiusPx(ref), SM58)).toBeGreaterThanOrEqual(12)
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

/**
 * Where, in canvas px: a ql1 connector drawn over the body, an 8 px neighbour point also over the body whose nearest port is that connector,
 * and a body point 16+ px from EVERY port of the rig (the camera must be settled).
 */
const ql1Plan = (page: Page) =>
  page.evaluate(() => {
    const c = window.__creation!
    const rect = document.querySelector('#renderCanvas')!.getBoundingClientRect()
    const all = c.design().rig.instances.flatMap((i) => c.devicePorts(i.instanceId).map((port) => ({ instance: i.instanceId, port })))
    const at = all.map((r) => ({ r, p: c.portScreen(r)! })).map(({ r, p }) => ({ r, x: p.x - rect.left, y: p.y - rect.top }))
    const nearest = (x: number, y: number) => at.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b))
    let eight: { ref: { instance: string; port: string }; x: number; y: number; cx: number; cy: number } | null = null
    for (const q of at.filter((a) => a.r.instance === 'ql1')) {
      if (c.pickAt(q.x, q.y) !== 'ql1') continue
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const x = q.x + dx
        const y = q.y + dy
        const n = nearest(x, y)
        if (c.pickAt(x, y) === 'ql1' && n.r.port === q.r.port && n.r.instance === q.r.instance) eight ??= { ref: q.r, x, y, cx: q.x, cy: q.y }
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

test('over an UNSELECTED device body a first click 8 px off a connector selects the body; ON the connector it starts the patch (final review 3)', async ({ page }) => {
  await boot(page)
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  const box = (await page.locator('#renderCanvas').boundingBox())!
  const plan = await ql1Plan(page)
  expect(plan.eight, 'a ql1 connector on its body with an 8 px point on the body').not.toBeNull()
  expect(plan.far, 'a ql1 body point 16+ px from every port').not.toBeNull()
  // the radius a first click gets here is under the 8 px of the neighbour point (tight, >= 6), and the proxy is still >= 12
  const ref = plan.eight!.ref
  const first = await page.evaluate((r) => window.__creation!.portHitRadiusPx(r), ref)
  expect(first).toBeGreaterThanOrEqual(6 - 1e-6)
  expect(first).toBeLessThan(8)
  expect(await page.evaluate((r) => window.__creation!.portProxyRadiusPx(r), ref)).toBeGreaterThanOrEqual(12 - 1e-6)
  expect(await page.evaluate(({ x, y }) => window.__creation!.portAtPoint(x, y), { x: plan.eight!.x, y: plan.eight!.y })).toBeNull()
  // ON the connector: the port takes it, nothing is selected
  expect(await page.evaluate(({ x, y }) => window.__creation!.portAtPoint(x, y), { x: plan.eight!.cx, y: plan.eight!.cy })).toEqual(ref)
  await page.mouse.click(box.x + plan.eight!.cx, box.y + plan.eight!.cy)
  expect(await pending(page)).toEqual(ref)
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
  await page.keyboard.press('Escape')
  expect(await pending(page)).toBeNull()
  // 8 px off: the BODY selects (no cable in hand)
  await page.mouse.click(box.x + plan.eight!.x, box.y + plan.eight!.y)
  expect(await pending(page)).toBeNull()
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
})

test("on the SELECTED device a first click 8 px off a connector is still the PORT's (camera still)", async ({ page }) => {
  await boot(page)
  await selectDevice(page, 'ql1')
  const box = (await page.locator('#renderCanvas').boundingBox())!
  const plan = await ql1Plan(page)
  expect(plan.eight, 'a ql1 connector on its body with an 8 px point on the body').not.toBeNull()
  expect(await page.evaluate((r) => window.__creation!.portHitRadiusPx(r), plan.eight!.ref)).toBeGreaterThanOrEqual(12 - 1e-6)
  const cam0 = await page.evaluate(() => window.__creation!.camera())
  await page.mouse.click(box.x + plan.eight!.x, box.y + plan.eight!.y)
  expect(await pending(page)).toEqual(plan.eight!.ref) // the port took it
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  expect(await page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
  expect(await page.evaluate(() => window.__creation!.camera())).toEqual(cam0)
  await page.keyboard.press('Escape')
  expect(await pending(page)).toBeNull()
})

test('with a cable in hand every port is a full 12 px target, on a device that is not selected too', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await clickPort(page, SM58) // a cable in hand (the connector itself always patches)
  expect(await pending(page)).toEqual(SM58)
  expect(await page.evaluate((r) => window.__creation!.portHitRadiusPx(r), MIC1)).toBeGreaterThanOrEqual(12 - 1e-6) // ql1 is not selected, but a cable is in hand
  const plan = await ql1Plan(page) // a point 8 px from a ql1 connector, that connector the nearest port
  expect(plan.eight, 'a ql1 connector with an 8 px point on its body').not.toBeNull()
  expect(await page.evaluate(({ x, y }) => window.__creation!.portAtPoint(x, y), { x: plan.eight!.x, y: plan.eight!.y })).toEqual(plan.eight!.ref)
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
  // a quarter turn of the view (keypad 6): a single cut too
  const before = await screenOf(page, MIC1)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Numpad6')
  await settle(page)
  const turned = await screenOf(page, MIC1)
  const vp = (await page.getByTestId('viewport').boundingBox())!
  // Preconditions, loud: the turn really moved the port, and it is still well inside the view (a bubble at an edge is
  // clamped, which is not the lag under test).
  expect(Math.hypot(turned.x - before.x, turned.y - before.y), 'the quarter turn moved the port').toBeGreaterThan(20)
  expect(turned.x, 'turned port inside the view (left)').toBeGreaterThan(vp.x + 150)
  expect(turned.x, 'turned port inside the view (right)').toBeLessThan(vp.x + vp.width - 150)
  expect(turned.y, 'turned port inside the view (top)').toBeGreaterThan(vp.y + 80)
  expect(turned.y, 'turned port inside the view (bottom)').toBeLessThan(vp.y + vp.height - 40)
  await near('after a quarter turn')
  // a camera cut (reduced motion: one event, no flight)
  await page.evaluate(() => window.__creation!.setCameraRadius(window.__creation!.camera()!.radius * 1.25))
  await near('after a zoom cut')
  // a window resize
  await page.setViewportSize({ width: 1300, height: 640 }) // the port stays well inside the view (a bubble at an edge is clamped, not lagging)
  await near('after a resize')
})

test('after a window resize (shrink AND grow) every proxy is still >= 12 px, the selected device keeps 12 px first clicks and unselected ones stay tight', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await selectDevice(page, 'sm58')
  for (const size of [{ width: 1300, height: 560 }, { width: 1500, height: 900 }, { width: 1366, height: 768 }]) {
    const at = `${size.width}x${size.height}`
    await page.setViewportSize(size)
    await settle(page)
    const all = await proxyRadii(page)
    expect(all.length).toBeGreaterThan(10)
    for (const x of all) expect(x.r, `${x.ref} proxy at ${at}`).toBeGreaterThanOrEqual(12 - 1e-6)
    for (const x of all.filter((q) => q.dev === 'sm58')) expect(x.first, `${x.ref} selected at ${at}`).toBeGreaterThanOrEqual(12 - 1e-6)
    for (const x of all.filter((q) => q.dev !== 'sm58')) {
      expect(x.first, `${x.ref} unselected at ${at}`).toBeGreaterThanOrEqual(6 - 1e-6)
      expect(x.first, `${x.ref} unselected at ${at}`).toBeLessThan(12)
    }
    // a real click 11 px off the selected mic's connector is still the port's (starts a cable)
    const p = await screenOf(page, SM58)
    await page.mouse.click(p.x + 11, p.y)
    expect(await pending(page), `11 px off at ${at}`).toEqual(SM58)
    await page.keyboard.press('Escape')
    expect(await pending(page)).toBeNull()
  }
})

test('the FIRST scene after a reload (placeholders only, no .glb re-anchor) has >= 12 px port targets with no camera move', async ({ page }) => {
  await page.route('**/*.glb', (route) => route.abort()) // no model arrives to re-anchor and re-size the proxies: only the host can
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1, 0, 6] })
  })
  await page.waitForFunction(() => (localStorage.getItem('audio-sim/creation.v1') ?? '').includes('sm58')) // the autosave landed
  await page.reload()
  await page.waitForFunction(() => !!window.__creation)
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 2)
  await expect.poll(() => page.evaluate(() => window.__creation!.modelsPending())).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  const radii = await page.evaluate(() => {
    const c = window.__creation!
    return c.design().rig.instances.flatMap((i) => c.devicePorts(i.instanceId).map((port) => ({ ref: `${i.instanceId}.${port}`, r: c.portProxyRadiusPx({ instance: i.instanceId, port }) })))
  })
  expect(radii.length).toBeGreaterThan(5)
  for (const { ref, r } of radii) expect(r, ref).toBeGreaterThanOrEqual(12 - 1e-6)
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
  expect(await page.evaluate(() => window.__creation!.portProxyRadiusPx({ instance: 'm', port: 'out-xlr' }))).toBeGreaterThanOrEqual(12)
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
