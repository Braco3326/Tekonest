/**
 * Task 43b: the audit leftovers of the placement flow.
 *  1. G latches free placement without Alt (status « Aimantation : libre », announced once, reset when the pose ends).
 *  2. A visible « Annuler la pose » button while a device follows the pointer; a tap in the view places (touch).
 *  3. Drawer drag-and-drop with pointer events (mouse AND touch): press + move > 6 px starts a placement, release over the
 *     3D view drops it (one undo entry), release anywhere else or Échap cancels; a press without movement is the click.
 *  4. CA-12: a device dropped inside a stage zone lands at the zone's own floor height (room data `floor_y_m`), mount « Sol ».
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type CDPSession, type Page } from '@playwright/test'
test.use({ viewport: { width: 1366, height: 768 } })

const PLACE = 'room:concert-hall-medium'
type V3 = [number, number, number]

const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' }) // a camera cut, not a flight: stable screen points
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const history = (page: Page) => page.evaluate(() => window.__creation!.historySize())
const placing = (page: Page) => page.evaluate(() => window.__creation!.placing())
const screenOf = async (page: Page, p: V3): Promise<{ x: number; y: number }> => (await page.evaluate((q) => window.__creation!.worldScreen(q), p))!
const poseOf = async (page: Page, id: string): Promise<V3> => (await design(page)).placements.find((p) => p.instanceId === id)!.position_m
const onGrid = (v: number): boolean => Math.abs(v / 0.25 - Math.round(v / 0.25)) < 1e-6
/** Away from a grid-cell border (3 cm off a node) so pixel rounding cannot flip the cell. */
const TARGET: V3 = [1.03, 0, 5.28]
const canvas = (page: Page) => page.locator('#renderCanvas')
const item = (page: Page, deviceId: string) => page.locator(`[data-testid="inventory-item"][data-device-id="${deviceId}"]`)
/** The status bar's polite line (the drawer's filter status is a second role=status once the drawer is mounted). */
const statusLine = (page: Page) => page.locator('.cr-status-msg')
const cancelButton = (page: Page) => page.getByRole('button', { name: 'Annuler la pose' })

/** Open the drawer with Espace and show the tab that holds the device. */
const openDrawer = async (page: Page, tab: string): Promise<void> => {
  await canvas(page).focus()
  await page.keyboard.press('Space')
  await page.getByRole('tab', { name: tab }).click()
  await expect(item(page, 'yamaha-ql1').or(page.getByTestId('inventory-item').first())).toBeVisible()
}
const choose = async (page: Page, deviceId: string, tab: string): Promise<void> => {
  await openDrawer(page, tab)
  await item(page, deviceId).click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await expect(canvas(page)).toBeFocused()
}
const centre = async (page: Page, deviceId: string): Promise<{ x: number; y: number }> => {
  const b = (await item(page, deviceId).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const oneQl1 = async (page: Page): Promise<string> => {
  await expect.poll(async () => (await design(page)).rig.instances.length).toBe(1)
  return (await design(page)).rig.instances[0].instanceId
}

// ── 1. G ─────────────────────────────────────────────────────────────────────────────────────────
test('G latches free placement without Alt: the bar says « libre », the drop is off the grid as ONE entry; the latch ends with the pose', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : 0,25 m · 15°')
  const at = await screenOf(page, TARGET)
  await page.mouse.move(at.x - 20, at.y - 10)
  await page.keyboard.press('g')
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : libre')
  await expect(statusLine(page)).toContainText('Placement libre')
  await page.mouse.move(at.x, at.y, { steps: 3 })
  await page.mouse.click(at.x, at.y) // no Alt anywhere
  const id = await oneQl1(page)
  const [x, , z] = await poseOf(page, id)
  expect(Math.abs(x - TARGET[0])).toBeLessThan(0.1)
  expect(Math.abs(z - TARGET[2])).toBeLessThan(0.1)
  expect(onGrid(x) && onGrid(z)).toBe(false)
  expect(await history(page)).toBe(1)
  await expect(page.getByTestId('status-snapping')).toBeHidden()
  // the next pose starts on the grid again
  await choose(page, 'yamaha-ql1', 'Consoles')
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : 0,25 m · 15°')
  await page.keyboard.press('g')
  await page.keyboard.press('g') // off again: said once per press
  await expect(statusLine(page)).toContainText('Aimantation à la grille')
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : 0,25 m · 15°')
  await page.keyboard.press('Escape')
  // G with nothing placed does nothing (no announcement, no snapping text)
  await page.keyboard.press('g')
  await expect(page.getByTestId('status-snapping')).toBeHidden()
  await expect(statusLine(page)).not.toContainText('Placement libre')
})

test('G frees the move of a dragged device too, and the next drag is on the grid', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 4] }))
  await canvas(page).focus()
  await page.keyboard.press(']')
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  // the .glb arrives after the placeholder and moves the body: press where the body really is, once the loads are done
  await expect.poll(() => page.evaluate(() => window.__creation!.modelsPending()), { timeout: 20_000 }).toBe(0)
  const bodyAt = async (): Promise<{ x: number; y: number }> => (await page.evaluate(() => window.__creation!.deviceScreen('ql1')))!
  const from = await bodyAt()
  const to = await screenOf(page, [1.03, 0.3, 5.28])
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : 0,25 m · 15°') // the drag really started
  await page.keyboard.press('g')
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : libre')
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('status-snapping')).toBeHidden() // the latch ended with the drag
  const [x, , z] = await poseOf(page, 'ql1')
  expect(onGrid(x) && onGrid(z)).toBe(false)
  const again = await bodyAt()
  await page.mouse.move(again.x, again.y)
  await page.mouse.down()
  await page.mouse.move(again.x + 30, again.y + 10, { steps: 3 })
  await expect(page.getByTestId('status-snapping')).toHaveText('Aimantation : 0,25 m · 15°') // the next drag is back on the grid
  await page.mouse.up()
})

// ── 2. cancel button ─────────────────────────────────────────────────────────────────────────────
test('« Annuler la pose »: a real button of at least 44 px, only while a device follows the pointer; it cancels, says so, and gives the view its focus back', async ({ page }) => {
  await boot(page)
  await expect(cancelButton(page)).toHaveCount(0) // nothing placed: no button in the accessibility tree
  await choose(page, 'yamaha-ql1', 'Consoles')
  const b = cancelButton(page)
  await expect(b).toBeVisible()
  expect(await b.evaluate((e) => e.tagName)).toBe('BUTTON')
  const box = (await b.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  await b.click()
  expect(await placing(page)).toBe(false)
  await expect(b).toHaveCount(0)
  await expect(statusLine(page)).toContainText('Pose annulée')
  await expect(canvas(page)).toBeFocused()
  expect((await design(page)).rig.instances).toHaveLength(0)
  expect(await history(page)).toBe(0)
})

test('« Annuler la pose » is reachable by Tab from the 3D view and works with Entrée; Échap while it is focused cancels and focus lands on the view', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  const focused = async (): Promise<boolean> => page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'cancel-placement')
  let reached = false
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await focused()
  }
  expect(reached, 'Tab from the canvas reaches the button').toBe(true)
  await page.keyboard.press('Enter')
  expect(await placing(page)).toBe(false)
  await expect(canvas(page)).toBeFocused()
  // again, cancelled by Échap while the button has focus
  await choose(page, 'yamaha-ql1', 'Consoles')
  await cancelButton(page).focus()
  await page.keyboard.press('Escape')
  expect(await placing(page)).toBe(false)
  await expect(canvas(page)).toBeFocused()
  expect((await design(page)).rig.instances).toHaveLength(0)
})

for (const vp of [{ width: 1366, height: 768 }, { width: 400, height: 800 }]) {
  test(`« Annuler la pose » is inside the view, clear of the notes and the view cube, and on top of the reopened drawer, at ${vp.width} px`, async ({ page }) => {
    await page.setViewportSize(vp)
    await boot(page)
    await choose(page, 'yamaha-ql1', 'Consoles')
    // a dismissible note is on screen (as « Appareils non rechargés »): the stack is bottom left of the view
    await page.evaluate(() => {
      const stack = document.querySelector('[data-testid="notes"]')!
      const n = document.createElement('div')
      n.className = 'cr-note'
      n.style.minHeight = '120px'
      n.textContent = 'Une note'
      stack.append(n)
    })
    const rect = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!
    const b = await rect(cancelButton(page))
    const view = await rect(page.locator('.cr-viewport'))
    expect(b.x, 'inside the view (left)').toBeGreaterThanOrEqual(view.x)
    expect(b.y, 'inside the view (top)').toBeGreaterThanOrEqual(view.y)
    expect(b.x + b.width, 'inside the view (right)').toBeLessThanOrEqual(view.x + view.width)
    expect(b.y + b.height, 'inside the view (bottom)').toBeLessThanOrEqual(view.y + view.height)
    const meets = (a: { x: number; y: number; width: number; height: number }, c: { x: number; y: number; width: number; height: number }): boolean =>
      a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height
    const note = await rect(page.locator('[data-testid="notes"] .cr-note'))
    expect(meets(b, note), 'clear of the notes').toBe(false)
    const cube = await page.evaluate(() => window.__creation!.cubeRect())
    expect(meets(b, cube), 'clear of the view cube').toBe(false)
    const top = (r: { x: number; y: number; width: number; height: number }) =>
      page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), { x: r.x + r.width / 2, y: r.y + r.height / 2 })
    expect(await top(b), 'the button is what a tap at its centre reaches').toBe('cancel-placement')
    // the drawer reopened during the pose does not hide it
    await canvas(page).focus()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('inventory-drawer')).toBeVisible()
    expect(await top(await rect(cancelButton(page)))).toBe('cancel-placement')
  })
}

test('axe: no serious or critical violation while a pose is in progress (the cancel button is on screen); the button has a visible focus ring', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  await expect(cancelButton(page)).toBeVisible()
  for (let i = 0; i < 12 && !(await cancelButton(page).evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press('Tab') // keyboard focus: the ring shows
  await expect(cancelButton(page)).toBeFocused()
  const ring = await cancelButton(page).evaluate((e) => {
    const c = getComputedStyle(e)
    return { outline: c.outlineStyle, width: parseFloat(c.outlineWidth), shadow: c.boxShadow }
  })
  expect(ring.outline !== 'none' && ring.width > 0 || ring.shadow !== 'none', 'a focus indicator').toBe(true)
  // The shell is position: fixed under body { overflow: hidden }, which blinds axe's visibility rules: lifted while it runs (as creation-budgets).
  await page.evaluate(() => document.body.style.setProperty('overflow', 'visible'))
  try {
    const r = await new AxeBuilder({ page }).analyze()
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(' | '))
    expect(bad).toEqual([])
    const looked = [...r.passes, ...r.incomplete, ...r.violations].filter((x) => x.id === 'color-contrast').reduce((n, x) => n + x.nodes.length, 0)
    expect(looked, 'axe evaluated text (not blind)').toBeGreaterThan(10)
  } finally {
    await page.evaluate(() => document.body.style.removeProperty('overflow'))
  }
})

test.describe('touch', () => {
  test.use({ hasTouch: true })

  test('a tap on a drawer item, then a tap in the view, places the device (one undo entry, on the grid)', async ({ page }) => {
    await boot(page)
    await openDrawer(page, 'Consoles')
    await item(page, 'yamaha-ql1').tap()
    await expect(page.getByTestId('inventory-drawer')).toBeHidden()
    expect(await placing(page)).toBe(true)
    const at = await screenOf(page, TARGET)
    await page.touchscreen.tap(at.x, at.y)
    const id = await oneQl1(page)
    const [x, , z] = await poseOf(page, id)
    expect(onGrid(x) && onGrid(z)).toBe(true)
    expect(Math.abs(x - 1.0)).toBeLessThan(0.3)
    expect(Math.abs(z - 5.25)).toBeLessThan(0.3)
    expect(await history(page)).toBe(1)
    expect(await placing(page)).toBe(false)
  })

  test('a touch user cancels a pose with the button (tap), nothing is placed', async ({ page }) => {
    await boot(page)
    await openDrawer(page, 'Consoles')
    await item(page, 'yamaha-ql1').tap()
    await expect(cancelButton(page)).toBeVisible()
    await cancelButton(page).tap()
    expect(await placing(page)).toBe(false)
    await expect(statusLine(page)).toContainText('Pose annulée')
    expect((await design(page)).rig.instances).toHaveLength(0)
  })

  test('a finger that drags in the view (an orbit) does not drop the device', async ({ page }) => {
    await boot(page)
    await openDrawer(page, 'Consoles')
    await item(page, 'yamaha-ql1').tap()
    const cdp = await page.context().newCDPSession(page)
    await touchDrag(cdp, { x: 500, y: 300 }, { x: 640, y: 340 })
    expect(await placing(page)).toBe(true)
    expect((await design(page)).rig.instances).toHaveLength(0)
  })
})

/** A one-finger drag through the real touch pipeline (Playwright's touchscreen only taps). `to` may be null: the finger stays down. */
async function touchDrag(cdp: CDPSession, from: { x: number; y: number }, to: { x: number; y: number } | null, end = true): Promise<void> {
  const pt = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) })
  if (to) {
    const n = 8
    for (let i = 1; i <= n; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n }) })
    }
  }
  if (end) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// ── 3. drawer drag-and-drop ──────────────────────────────────────────────────────────────────────
test('drag from a drawer item and release over the view drops it: ONE undo entry, on the grid, selected; the ghost followed', async ({ page }) => {
  await boot(page)
  await openDrawer(page, 'Consoles')
  const from = await centre(page, 'yamaha-ql1')
  const at = await screenOf(page, TARGET)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 3, from.y - 3) // 4 px: under the threshold, still a press
  expect(await placing(page)).toBe(false)
  await page.mouse.move(from.x + 10, from.y - 30, { steps: 3 })
  expect(await placing(page), 'past 6 px a placement starts').toBe(true)
  await expect(page.getByTestId('inventory-drawer')).toBeHidden() // the view is clear for the drop
  await expect(statusLine(page)).toContainText('relâchez')
  await page.mouse.move(at.x, at.y, { steps: 6 })
  expect((await design(page)).rig.instances).toHaveLength(0) // nothing is placed before the release
  await page.mouse.up()
  const id = await oneQl1(page)
  const [x, , z] = await poseOf(page, id)
  expect(onGrid(x) && onGrid(z)).toBe(true)
  expect(Math.abs(x - 1.0)).toBeLessThan(0.3)
  expect(Math.abs(z - 5.25)).toBeLessThan(0.3)
  expect(await history(page)).toBe(1)
  expect(await placing(page)).toBe(false)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
  await expect(statusLine(page)).toContainText('Posé : Yamaha QL1')
  await page.keyboard.press('Control+z')
  expect((await design(page)).rig.instances).toHaveLength(0)
})

test('a release anywhere but the 3D view (a panel, the menu bar) cancels: nothing placed, said, no entry', async ({ page }) => {
  await boot(page)
  for (const where of [page.getByTestId('properties'), page.getByTestId('status-bar')]) {
    await openDrawer(page, 'Consoles')
    const from = await centre(page, 'yamaha-ql1')
    const b = (await where.boundingBox())!
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 12, from.y - 40, { steps: 3 })
    expect(await placing(page)).toBe(true)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 })
    await page.mouse.up()
    expect(await placing(page)).toBe(false)
    await expect(statusLine(page)).toContainText('Pose annulée')
    expect((await design(page)).rig.instances).toHaveLength(0)
    expect(await history(page)).toBe(0)
  }
})

test('Échap during the drag cancels it; the release afterwards drops nothing', async ({ page }) => {
  await boot(page)
  await openDrawer(page, 'Consoles')
  const from = await centre(page, 'yamaha-ql1')
  const at = await screenOf(page, TARGET)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 12, from.y - 40, { steps: 3 })
  expect(await placing(page)).toBe(true)
  await page.keyboard.press('Escape')
  expect(await placing(page)).toBe(false)
  await page.mouse.move(at.x, at.y, { steps: 5 })
  await page.mouse.up()
  expect((await design(page)).rig.instances).toHaveLength(0)
  expect(await history(page)).toBe(0)
  expect(await placing(page)).toBe(false)
  await expect(statusLine(page)).toContainText('Pose annulée')
})

test('a drag whose pointerup never came (SYNTHETIC: a window pointermove with no button, the real button still down): the next move with no button down is the release, over the view it drops', async ({ page }) => {
  await boot(page)
  await openDrawer(page, 'Consoles')
  const from = await centre(page, 'yamaha-ql1')
  const at = await screenOf(page, TARGET)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 12, from.y - 40, { steps: 3 })
  expect(await placing(page)).toBe(true)
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0, clientX: x, clientY: y, bubbles: true }))
  }, at)
  await oneQl1(page)
  expect(await placing(page)).toBe(false)
  await page.mouse.up() // the real release, late: nothing more happens
  expect(await history(page)).toBe(1)
})

test('a press without movement is the click it always was: the device is chosen, then a click in the view places it', async ({ page }) => {
  await boot(page)
  await openDrawer(page, 'Consoles')
  const from = await centre(page, 'yamaha-ql1')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 2, from.y + 2) // a tremor
  await page.mouse.up()
  expect(await placing(page)).toBe(true)
  await expect(statusLine(page)).toContainText('Cliquez pour poser')
  const at = await screenOf(page, TARGET)
  await page.mouse.click(at.x, at.y)
  await oneQl1(page)
  expect(await history(page)).toBe(1)
})

test('the keyboard flow is unchanged: Entrée on an item chooses it, Entrée drops it where the ghost is', async ({ page }) => {
  await boot(page)
  await canvas(page).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('tab', { selected: true })).toBeFocused() // the drawer took the focus
  await page.keyboard.type('ql1') // typed on the tab: it lands in the field
  await expect(page.getByRole('textbox', { name: 'Filtrer' })).toHaveValue('ql1')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  expect(await placing(page)).toBe(true)
  await page.keyboard.press('Enter')
  await oneQl1(page)
})

test.describe('touch drag', () => {
  test.use({ hasTouch: true })

  test('a finger that presses a drawer item and slides over the view places it on release (same code path, one undo entry)', async ({ page }) => {
    await boot(page)
    await openDrawer(page, 'Consoles')
    const from = await centre(page, 'yamaha-ql1')
    const at = await screenOf(page, TARGET)
    const cdp = await page.context().newCDPSession(page)
    await touchDrag(cdp, from, at, false)
    expect(await placing(page), 'the finger is down over the view: the ghost is out').toBe(true)
    expect((await design(page)).rig.instances).toHaveLength(0)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const id = await oneQl1(page)
    const [x, , z] = await poseOf(page, id)
    expect(onGrid(x) && onGrid(z)).toBe(true)
    expect(Math.abs(x - 1.0)).toBeLessThan(0.3)
    expect(Math.abs(z - 5.25)).toBeLessThan(0.3)
    expect(await history(page)).toBe(1)
  })

  test('a finger lifted off the 3D view cancels', async ({ page }) => {
    await boot(page)
    await openDrawer(page, 'Consoles')
    const from = await centre(page, 'yamaha-ql1')
    const b = (await page.getByTestId('properties').boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    await touchDrag(cdp, from, { x: b.x + b.width / 2, y: b.y + b.height / 2 })
    expect(await placing(page)).toBe(false)
    expect((await design(page)).rig.instances).toHaveLength(0)
    await expect(statusLine(page)).toContainText('Pose annulée')
  })
})

// ── 4. CA-12: the stage deck ─────────────────────────────────────────────────────────────────────
test('CA-12: a device dropped inside the stage zone lands at the deck height (room data floor_y_m 1.3), stays « Sol », and Propriétés shows the height; dragged off the stage it is back at 0', async ({ page }) => {
  await boot(page)
  await choose(page, 'yamaha-ql1', 'Consoles')
  const onDeck = await screenOf(page, [1.03, 1.3, -10.22]) // inside « scene » (x −7…7, z −16…−7)
  await page.mouse.move(onDeck.x - 10, onDeck.y - 5)
  await page.mouse.move(onDeck.x, onDeck.y, { steps: 3 })
  await page.mouse.click(onDeck.x, onDeck.y)
  const id = await oneQl1(page)
  const pl = (await design(page)).placements.find((p) => p.instanceId === id)!
  expect(pl.position_m[1]).toBeCloseTo(1.3, 6)
  expect(pl.mount ?? 'floor').toBe('floor')
  const props = page.getByTestId('properties')
  const height = props.getByRole('textbox', { name: 'Hauteur', exact: true })
  await expect(height).toHaveValue('1,30')
  await expect(height).toHaveAttribute('readonly', '')
  // moved onto the audience floor (z = 5, outside every raised zone): back to 0
  await expect.poll(() => page.evaluate(() => window.__creation!.modelsPending()), { timeout: 20_000 }).toBe(0) // the .glb moves the body: press where it really is
  const from = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
  const off = await screenOf(page, [1.03, 0, 5.28])
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(off.x, off.y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await poseOf(page, id))[1]).toBe(0)
  await expect(height).toHaveValue('0,00')
})

// ── 5. Écoute › Écouter depuis ici ───────────────────────────────────────────────────────────────
test.describe('Écouter depuis ici', () => {
  /** The reference rig, both speakers cabled, console playback on (as creation-listen). */
  const bootRig = async (page: Page): Promise<void> => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForFunction(() => !!window.__creation)
    await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
    await page.waitForFunction((p) => window.__creation!.place() === p && window.__creation!.design().rig.instances.length === 5, PLACE)
    await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
    const ok = await page.evaluate(() => {
      const c = window.__creation!
      return [
        c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
        c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
        c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
      ]
    })
    expect(ok).toEqual([true, true, true])
  }
  const menu = async (page: Page, top: string, name: string): Promise<void> => {
    await page.getByRole('menuitem', { name: top, exact: true }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  const points = (page: Page) => page.evaluate(() => window.__creation!.listeningPoints())
  const voices = (page: Page) => page.evaluate(() => window.__creation!.audioState().voices)

  test('the listener moves to where the view stands (the orbit pivot, on the floor at ear height); the camera stays; playback and the tree follow', async ({ page }) => {
    await bootRig(page)
    // re-pivot the view onto a bare patch of the hall floor next to the left speaker's side of the room
    const floor: V3 = [5, 0, 0]
    const at = (await page.evaluate((p) => window.__creation!.worldScreen(p), floor))!
    await page.mouse.dblclick(at.x, at.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
    const cam = (await page.evaluate(() => window.__creation!.camera()))!
    expect((await points(page)).map((p) => p.id)).not.toContain('ici')
    // play from the Régie (centred between the two speakers): the two voices are alike
    await menu(page, 'Écoute', 'Lecture')
    await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
    const regie = await voices(page)
    expect(regie).toHaveLength(2)
    expect(Math.abs(regie[0].gain - regie[1].gain)).toBeLessThan(1e-6)
    // Écoute › Écouter depuis ici
    await menu(page, 'Écoute', 'Écouter depuis ici')
    const ici = (await points(page)).find((p) => p.id === 'ici')!
    expect(ici.label).toBe('Ici')
    expect(ici.position[0]).toBeCloseTo(cam.target[0], 6)
    expect(ici.position[2]).toBeCloseTo(cam.target[2], 6)
    expect(ici.position[1]).toBeCloseTo(1.2, 6) // the audience floor is at 0: ear height
    expect(await page.evaluate(() => window.__creation!.listenerPoint())).toBe('ici')
    await expect(statusLine(page)).toContainText('Point d’écoute : Ici')
    expect(await page.evaluate(() => window.__creation!.camera()!.target)).toEqual(cam.target) // the camera did not move
    // the sound follows: the speaker on this side (k12-g, x +6) is now the louder one
    await expect.poll(async () => {
      const v = await voices(page)
      const g = v.find((x) => x.instanceId === 'k12-g')!.gain
      const d = v.find((x) => x.instanceId === 'k12-d')!.gain
      return g > d + 0.01
    }).toBe(true)
    // « Ici » is a listening point like the others: listed and checked in Vue › Aller au point d’écoute, with no key
    await page.getByRole('menuitem', { name: 'Vue', exact: true }).click()
    await page.getByRole('menuitem', { name: /Aller au point d’écoute/ }).hover()
    const radio = page.getByRole('menuitemradio', { name: /^Ici/ })
    await expect(radio).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('menuitemradio', { name: /Régie/ })).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Escape')
    await menu(page, 'Écoute', 'Stop')
    await page.waitForFunction(() => window.__creation!.audioState().state === 'stopped', null, { timeout: 10_000 })
  })

  test('the heading is the camera\'s: after Écouter depuis ici the pan of each speaker matches the side it is DRAWN on (screen oracle), at three azimuths', async ({ page }) => {
    await bootRig(page)
    await menu(page, 'Écoute', 'Lecture')
    await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
    for (const turn of [0, 0.5, -0.5]) {
      if (turn !== 0) await page.evaluate((t) => window.__creation!.turnCamera(t), turn)
      await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
      await menu(page, 'Écoute', 'Écouter depuis ici')
      const box = (await canvas(page).boundingBox())!
      const centre = box.x + box.width / 2
      for (const id of ['k12-g', 'k12-d']) {
        const at = (await page.evaluate((i) => window.__creation!.deviceScreen(i), id))!
        expect(at, id + ' is drawn').not.toBeNull()
        const v = (await voices(page)).find((x) => x.instanceId === id)!
        expect(Math.abs(at.x - centre), id + ' is off-centre enough to have a side').toBeGreaterThan(20)
        // drawn to the left of the view's centre (where the listener stands, looking along the view) = panned left
        expect(Math.sign(v.pan), `${id} at turn ${turn}: drawn ${at.x < centre ? 'left' : 'right'}, pan ${v.pan}`).toBe(at.x < centre ? -1 : 1)
      }
    }
  })

  test('« Ici » is a coverage probe: its level is read in the panel, and follows the point when it is placed again', async ({ page }) => {
    await bootRig(page)
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
    await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
    expect((await page.evaluate(() => window.__creation!.coverage().probes)).map((p) => p.id)).not.toContain('ici')
    await menu(page, 'Écoute', 'Écouter depuis ici')
    await page.waitForFunction(() => window.__creation!.coverage().probes.some((p) => p.id === 'ici') && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
    const ici = (await page.evaluate(() => window.__creation!.coverage().probes)).find((p) => p.id === 'ici')!
    expect(ici.db).not.toBeNull()
    expect(Number.isFinite(ici.db!)).toBe(true)
    await expect(page.getByTestId('coverage-points')).toContainText('Ici : ') // the level as text, like the Régie row
    await expect(page.getByRole('button', { name: 'Épingler Ici' })).toBeVisible() // and a button, like the named points
    // the camera moves to another spot, « Ici » is placed again: the probe is recomputed there
    const before = ici.db
    await page.evaluate(() => window.__creation!.turnCamera(0.5))
    const floor: V3 = [-5, 0, 2]
    const at = (await page.evaluate((p) => window.__creation!.worldScreen(p), floor))!
    await page.mouse.dblclick(at.x, at.y)
    await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
    await menu(page, 'Écoute', 'Écouter depuis ici')
    await expect
      .poll(async () => {
        const db = (await page.evaluate(() => window.__creation!.coverage().probes)).find((p) => p.id === 'ici')?.db
        return db !== undefined && db !== null && Number.isFinite(db) && db !== before // a real, new level (not a missing probe or null)
      })
      .toBe(true)
  })

  test('another place forgets it; « Ici » is back on the Régie', async ({ page }) => {
    await bootRig(page)
    await menu(page, 'Écoute', 'Écouter depuis ici')
    expect((await points(page)).map((p) => p.id)).toContain('ici')
    await page.evaluate(() => window.__creation!.choosePlace('room:bar-club-stage-small'))
    await page.waitForFunction(() => window.__creation!.place() === 'room:bar-club-stage-small')
    expect((await points(page)).map((p) => p.id)).not.toContain('ici')
    expect(await page.evaluate(() => window.__creation!.listenerPoint())).toBe('regie')
  })

  test('in the walk view it is the walker who is heard from: the point lands under the walker', async ({ page }) => {
    await bootRig(page)
    await canvas(page).focus()
    await page.keyboard.press('Shift+V') // walk
    await page.waitForFunction(() => window.__creation!.view() === 'explore')
    const w = (await page.evaluate(() => window.__creation!.walkCamera()))!
    await menu(page, 'Écoute', 'Écouter depuis ici')
    const ici = (await points(page)).find((p) => p.id === 'ici')!
    expect(ici.position[0]).toBeCloseTo(w.x, 3)
    expect(ici.position[2]).toBeCloseTo(w.z, 3)
  })
})
