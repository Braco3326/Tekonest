/**
 * Night wave 1 (Phase 5.1): the deferred reserves of the Phase 3 and Phase 4 reviews (docs/CREATIVE-MODE-LOG.md L24, L36).
 * Item 1: a Bêta device is named « non vérifié » wherever it is named (the « Connecter à… » list, a port's hover label, a cable's).
 * Item 2: the hover label closes with Échap (WCAG 1.4.13) and cancels nothing else.
 * Item 3: the pinned refusal clears on the next press in the view, when the drawer opens, and on the next successful action.
 * Item 4: the cable legend stays reachable when Propriétés is folded (a rail button, at 400 px and 1366 px).
 * Item 5: the combobox of « Connecter à… » says whether its list is open.
 * Item 6 lives in creation-beta.spec.ts (the drawer opens at once), item 7 in creation-mains-reopen below, item 8 in creation-front.spec.ts.
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { cableKey } from '../../src/creation/sceneDiff'
import { SETTLE_SAMPLE_MS } from './waits'

test.use({ viewport: { width: 1366, height: 768 } })

type Ref = { instance: string; port: string }
const SM58: Ref = { instance: 'sm58', port: 'out-xlr' }
const MIC1: Ref = { instance: 'ql1', port: 'in-mic-1' }
const MIC2: Ref = { instance: 'ql1', port: 'in-mic-2' }
const QL_OUT: Ref = { instance: 'ql1', port: 'out-main-l' }
const K12_POWER: Ref = { instance: 'k12-g', port: 'power-in' }
const MIC_KEY = cableKey(SM58, MIC1)
const MARK = 'non vérifié'

const proposals = (JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; ports: { portId: string; dir: string; connector: string; signal: string }[] }[] }).devices
const AMP = proposals.find((p) => p.id === 'crown-xls-2502')!
const AMP_XLR = AMP.ports.find((p) => p.connector === 'xlr3-f' && p.signal === 'line-level-pro')!

/** Named wait: the .glb models arrive after the placeholders and move the ports; this is the quiet window between two samples of the render counter. */
const QUIET_WINDOW_MS = SETTLE_SAMPLE_MS
const settle = async (page: Page): Promise<void> => {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => window.__creation!.renders())
    if (n === last) return
    last = n
    await page.waitForTimeout(QUIET_WINDOW_MS)
  }
  throw new Error('the page never went idle')
}

/** The reference template ("Concert simple") without its power strip, on a settled camera. */
const boot = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'REMOVE', instanceId: 'mains' }))
  await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 4)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}
const design = (page: Page) => page.evaluate(() => window.__creation!.design())
const screenOf = async (page: Page, ref: Ref) => {
  const p = await page.evaluate((r) => window.__creation!.portScreen(r), ref)
  expect(p, `${ref.instance}.${ref.port} is on screen`).not.toBeNull()
  return p!
}
const clickPort = async (page: Page, ref: Ref): Promise<void> => {
  const p = await screenOf(page, ref)
  await page.mouse.click(p.x, p.y)
}
const hoverPort = async (page: Page, ref: Ref): Promise<void> => {
  await page.mouse.move(0, 0)
  const p = await screenOf(page, ref)
  await page.mouse.move(p.x, p.y, { steps: 3 })
}
const hoverLabel = (page: Page) => page.locator('[data-testid="port-label"]:not([hidden])')
const selectDevice = async (page: Page, id: string): Promise<void> => {
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== id; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe(id)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}

/** Place the Bêta amp through the drawer (as a person does), then stand it beside the console and cable the console's left output to its XLR input. */
const addBetaAmp = async (page: Page): Promise<string> => {
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  await page.getByRole('tab', { name: 'Bêta' }).click()
  await page.locator(`[data-testid="inventory-item"][data-device-id="${AMP.id}"]`).click()
  await expect(page.getByTestId('inventory-drawer')).toBeHidden()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await design(page)).rig.instances.some((i) => i.deviceId === AMP.id)).toBe(true)
  const id = (await design(page)).rig.instances.find((i) => i.deviceId === AMP.id)!.instanceId
  await page.evaluate((i) => window.__creation!.dispatch({ type: 'SET_POSE', instanceId: i, position: [4, 0, 8], yawDeg: 0, tiltDeg: 0, mount: 'floor' }), id)
  expect(await page.evaluate(([i, p]) => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: i, port: p } }).ok, [id, AMP_XLR.portId])).toBe(true)
  await settle(page)
  return id
}

// ── Item 1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('item 1: the « Connecter à… » list names a Bêta device « non vérifié » (heading, options, refused ports) and a verified one plainly', async ({ page }) => {
  await boot(page)
  const amp = await addBetaAmp(page)
  await selectDevice(page, 'ql1')
  const opener = page.locator('[data-key="connect:out-main-r"]')
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByTestId('cr-connect-dialog')
  await expect(dialog).toBeVisible()
  const groups = dialog.locator('.cr-connect-group-title')
  const titles = await groups.allInnerTexts()
  expect(titles.some((t) => t.includes(`(${amp})`) && t.includes(MARK)), titles.join(' | ')).toBe(true)
  expect(titles.filter((t) => t.includes('(k12-g)') || t.includes('(k12-d)')).every((t) => !t.includes(MARK)), titles.join(' | ')).toBe(true)
  // every option of the Bêta device names it in its accessible label; the others do not
  const labels = await dialog.getByRole('option').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  const betaLabels = labels.filter((l) => l.includes(`(${amp})`))
  expect(betaLabels.length).toBeGreaterThan(0)
  expect(betaLabels.every((l) => l.includes(MARK))).toBe(true)
  expect(labels.filter((l) => !l.includes(`(${amp})`)).some((l) => l.includes(MARK))).toBe(false)
  // the refused group too
  await page.getByTestId('connect-rejected-toggle').click()
  const refused = await page.getByTestId('connect-rejected').locator('.cr-connect-rejected-name').allInnerTexts()
  const betaRefused = refused.filter((t) => t.includes(`(${amp})`))
  expect(betaRefused.length).toBeGreaterThan(0)
  expect(betaRefused.every((t) => t.includes(MARK))).toBe(true)
  expect(refused.filter((t) => !t.includes(`(${amp})`)).some((t) => t.includes(MARK))).toBe(false)
  await page.keyboard.press('Escape')
})

test('item 1: a Bêta device\'s port and cable say « non vérifié » on hover; a verified port and cable do not', async ({ page }) => {
  await boot(page)
  const amp = await addBetaAmp(page)
  await hoverPort(page, { instance: amp, port: AMP_XLR.portId })
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText(AMP_XLR.portId)
  await expect(hoverLabel(page)).toContainText(MARK)
  await hoverPort(page, MIC2)
  await expect(hoverLabel(page)).toContainText('in-mic-2')
  await expect(hoverLabel(page)).not.toContainText(MARK)
  // the cable that touches the amp, then the mic cable
  const key = cableKey(QL_OUT, { instance: amp, port: AMP_XLR.portId })
  const onAmp = await page.evaluate((k) => window.__creation!.cableFreePoint(k), key)
  expect(onAmp, 'a free point on the amp cable').not.toBeNull()
  await page.mouse.move(0, 0)
  await page.mouse.move(onAmp!.x, onAmp!.y, { steps: 3 })
  await expect(hoverLabel(page)).toContainText('→')
  await expect(hoverLabel(page)).toContainText(MARK)
  const onMic = await page.evaluate((k) => window.__creation!.cableFreePoint(k), MIC_KEY)
  expect(onMic, 'a free point on the mic cable').not.toBeNull()
  await page.mouse.move(onMic!.x, onMic!.y, { steps: 6 })
  await expect(hoverLabel(page)).toContainText('→')
  await expect(hoverLabel(page)).not.toContainText(MARK)
})

test('item 1 (review): the status bar names a selected Bêta device « non vérifié » (the 3D view has no cue); the Connexions line and the « Débrancher » bubble name it too', async ({ page }) => {
  await boot(page)
  const amp = await addBetaAmp(page)
  await selectDevice(page, amp)
  await expect(page.getByTestId('status-selection')).toContainText(`(${amp}) · ${MARK}`)
  await expect(page.getByTestId('signal-extra')).toContainText('1 appareil non vérifié')
  // the other end of the cable, seen from the console: the amp is named with the mark, visibly
  await selectDevice(page, 'ql1')
  await expect(page.getByTestId('status-selection')).not.toContainText(MARK)
  await expect(page.locator('[data-key="port:out-main-l"] .cr-port-other')).toContainText(`(${amp}) · ${MARK} · ${AMP_XLR.portId}`)
  await expect(page.locator('[data-key="unplug:out-main-l"]')).toHaveAccessibleName(new RegExp(`${MARK}`))
  // the bubble offered on the cabled console output names the amp at the other end
  await clickPort(page, QL_OUT)
  await expect(page.getByTestId('port-offer')).toContainText(MARK)
  await expect(page.getByTestId('port-unplug')).toHaveAccessibleName(new RegExp(MARK))
})

// ── Item 2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('item 2: Échap closes the hover label of a port with the pointer where it is, and leaves the cable in hand alone; the next Échap drops the cable', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await clickPort(page, SM58) // a cable in hand
  expect(await page.evaluate(() => window.__creation!.patchPending())).toEqual(SM58)
  await hoverPort(page, MIC2)
  await expect(hoverLabel(page)).toContainText('in-mic-2')
  await page.keyboard.press('Escape')
  await expect(hoverLabel(page)).toHaveCount(0) // closed, the pointer has not moved
  expect(await page.evaluate(() => window.__creation!.patchPending())).toEqual(SM58)
  await page.keyboard.press('Escape') // nothing to dismiss: the usual cascade (the cable first)
  expect(await page.evaluate(() => window.__creation!.patchPending())).toBeNull()
})

test('item 2: Échap with a label on screen leaves the selection alone; the next Échap clears it', async ({ page }) => {
  await boot(page)
  await selectDevice(page, 'ql1')
  await hoverPort(page, MIC2)
  await expect(hoverLabel(page)).toContainText('in-mic-2')
  await page.keyboard.press('Escape')
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection())).toBeNull()
})

test('item 2: Échap closes a cable\'s hover label too, and a new hover brings a label back', async ({ page }) => {
  await boot(page)
  const onMic = await page.evaluate((k) => window.__creation!.cableFreePoint(k), MIC_KEY)
  expect(onMic).not.toBeNull()
  await page.mouse.move(0, 0)
  await page.mouse.move(onMic!.x, onMic!.y, { steps: 3 })
  await expect(hoverLabel(page)).toContainText('→')
  await page.keyboard.press('Escape')
  await expect(hoverLabel(page)).toHaveCount(0)
  await hoverPort(page, MIC2) // another target: its label shows
  await expect(hoverLabel(page)).toContainText('in-mic-2')
})

test('item 2: a pose in progress keeps its own Échap (no hover label survives a pose, so the two never compete): Échap ends the pose, a later label still closes', async ({ page }) => {
  await boot(page)
  await hoverPort(page, MIC2)
  await expect(hoverLabel(page)).toHaveCount(1)
  // The keyboard starts the pose, so the pointer stays on the port.
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  await page.keyboard.type('SM58')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__creation!.placing())).toBe(true)
  await expect(hoverLabel(page)).toHaveCount(0) // patching is inert during a pose: its labels go
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.placing())).toBe(false)
  expect((await design(page)).rig.instances).toHaveLength(4) // nothing was placed
  await hoverPort(page, MIC2)
  await expect(hoverLabel(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(hoverLabel(page)).toHaveCount(0)
})

// ── Item 3 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A refused connection pinned at the second port: mains inlet to mic input. */
const pinRefusal = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await clickPort(page, K12_POWER)
  await clickPort(page, MIC1)
  await expect(page.getByTestId('port-error')).toBeVisible()
}

test('item 3: the pinned refusal clears on the next press in the empty 3D view', async ({ page }) => {
  await boot(page)
  await pinRefusal(page)
  const view = (await page.getByTestId('viewport').boundingBox())!
  await page.mouse.click(view.x + 8, view.y + view.height - 8) // empty floor corner
  await expect(page.getByTestId('port-error')).toBeHidden()
})

test('item 3: the pinned refusal clears when the drawer opens', async ({ page }) => {
  await boot(page)
  await pinRefusal(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('inventory-drawer')).toBeVisible()
  await expect(page.getByTestId('port-error')).toBeHidden()
})

test('item 3: the pinned refusal clears on the next successful action, and stays for a keyboard user until they act', async ({ page }) => {
  await boot(page)
  await pinRefusal(page)
  // keys that act on nothing leave it (a keyboard user reads it at their pace)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Shift')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('port-error')).toBeVisible()
  // a successful action: a device placed
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58b', position: [5, 0, 5] }))
  await expect(page.getByTestId('port-error')).toBeHidden()
})

test('item 3: an Échap still drops the pinned refusal (the keyboard way out)', async ({ page }) => {
  await boot(page)
  await pinRefusal(page)
  await page.mouse.move(0, 0) // off the port: no hover label to dismiss first
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('port-error')).toBeHidden()
})

// ── Item 4 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const rail = (page: Page) => page.getByTestId('cable-legend-rail')
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)

test('item 4 (1366 px): with Propriétés folded the legend is reachable from the rail, and unfolds Propriétés with the legend open', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('cable-legend-toggle')).toBeVisible()
  await expect(rail(page)).toBeHidden() // unfolded: the legend itself is on screen, the rail button is not needed
  await page.getByTestId('props-collapse').click()
  await expect(page.getByTestId('cable-legend-toggle')).toBeHidden()
  await expect(rail(page)).toBeVisible()
  await expect(rail(page)).toHaveAccessibleName('Légende des câbles : déplier Propriétés')
  // the column has finished folding (a state), then measure
  await expect.poll(async () => (await page.getByTestId('properties').boundingBox())!.width).toBeLessThan(50)
  const box = (await rail(page).boundingBox())!
  const props = (await page.getByTestId('properties').boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(props.x - 0.5)
  expect(box.x + box.width).toBeLessThanOrEqual(props.x + props.width + 0.5)
  expect(box.width).toBeGreaterThanOrEqual(24)
  expect(box.height).toBeGreaterThanOrEqual(24)
  expect(await noHorizontalOverflow(page)).toBe(true)
  await rail(page).click()
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('cable-legend-list')).toBeVisible()
  await expect(page.getByTestId('cable-legend-toggle')).toBeFocused()
  await expect(rail(page)).toBeHidden()
})

test('item 4 (1366 px): no cable, no rail button', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }))
  await page.getByTestId('props-collapse').click()
  await expect(rail(page)).toBeHidden()
})

test('item 4 (400 px): Propriétés starts folded; the legend is reachable from the rail and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await boot(page)
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'false')
  await expect(rail(page)).toBeVisible()
  const box = (await rail(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(400)
  expect(box.width).toBeGreaterThanOrEqual(24)
  expect(await noHorizontalOverflow(page)).toBe(true)
  // the rail button overlaps no other control of the rail (the unfold button, the vertical title)
  const collapse = (await page.getByTestId('props-collapse').boundingBox())!
  expect(box.y >= collapse.y + collapse.height - 0.5 || box.y + box.height <= collapse.y + 0.5).toBe(true)
  await rail(page).click()
  await expect(page.getByTestId('props-collapse')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('cable-legend-toggle')).toBeFocused()
  await expect(page.getByTestId('cable-legend-list')).toBeVisible()
  expect(await noHorizontalOverflow(page)).toBe(true)
})

test('item 4: the rail button has no accessibility violation', async ({ page }) => {
  await boot(page)
  await page.getByTestId('props-collapse').click()
  await expect(rail(page)).toBeVisible()
  const results = await new AxeBuilder({ page }).include('[data-testid="properties"]').disableRules(['region']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

// ── Item 5 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('item 5: the combobox aria-expanded follows the list (open with options, closed when the filter matches none), axe clean in both states', async ({ page }) => {
  await boot(page)
  await selectDevice(page, 'ql1')
  const opener = page.locator('[data-key="connect:out-main-l"]')
  await opener.focus()
  await page.keyboard.press('Enter')
  const combo = page.getByRole('combobox', { name: 'Filtrer' })
  await expect(combo).toBeFocused()
  await expect(page.getByTestId('connect-list')).toBeVisible()
  await expect(combo).toHaveAttribute('aria-expanded', 'true')
  let results = await new AxeBuilder({ page }).include('[data-testid="cr-connect-dialog"]').disableRules(['region']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  await page.keyboard.type('zzzz-aucune-prise')
  await expect(page.getByTestId('connect-list')).toBeHidden()
  await expect(combo).toHaveAttribute('aria-expanded', 'false')
  results = await new AxeBuilder({ page }).include('[data-testid="cr-connect-dialog"]').disableRules(['region']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  await combo.fill('')
  await expect(page.getByTestId('connect-list')).toBeVisible()
  await expect(combo).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
})

test('item 5: a dialog with no compatible port opens with aria-expanded false', async ({ page }) => {
  await boot(page)
  await selectDevice(page, 'k12-g')
  // power-in of a speaker: the only compatible ports would be mains outlets, and the template\'s strip was taken away
  const opener = page.locator('[data-key="connect:power-in"]')
  await opener.focus()
  await page.keyboard.press('Enter')
  const combo = page.getByRole('combobox', { name: 'Filtrer' })
  await expect(combo).toBeFocused()
  await expect(page.getByTestId('connect-count')).toHaveText(/Aucune prise compatible/)
  await expect(combo).toHaveAttribute('aria-expanded', 'false')
})

// ── Item 7 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const NO_MAINS = 'Aucune multiprise dans ce projet : les appareils actifs ne sont pas alimentés. Ajoutez-en une (onglet « Secteur » du tiroir) et branchez-y les appareils.'
const statusMsg = (page: Page) => page.locator('.cr-status-msg')
const AUTOSAVE_KEY = 'audio-sim/creation.v1'

/** A project of before the mains model: a console and a speaker in the hall, no power strip, one signal cable. Waits for the autosave to hold it. */
const oldProject = async (page: Page, o: { strip?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium')
  await page.evaluate((strip) => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    if (strip) c.dispatch({ type: 'SPAWN', deviceId: 'multiprise-secteur', instanceId: 'mains', position: [0, 0, -10] })
  }, !!o.strip)
  const want = o.strip ? 3 : 2
  await expect
    .poll(() => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? 'null') as { design?: { rig?: { instances?: unknown[] } } } | null)?.design?.rig?.instances?.length ?? 0, AUTOSAVE_KEY))
    .toBe(want)
}
const reload = async (page: Page): Promise<void> => {
  await page.reload()
  await page.waitForFunction(() => window.__creation?.place() === 'room:concert-hall-medium')
}

test('item 7: reopening a project with active gear and no power strip says so once, and edits nothing', async ({ page }) => {
  await oldProject(page)
  const before = await design(page)
  await reload(page)
  await expect(statusMsg(page)).toContainText(NO_MAINS)
  await expect(statusMsg(page)).toContainText('Travail de la dernière séance rouvert.') // both lines, merged by the one announcer
  const after = await design(page)
  expect(after.rig.instances).toEqual(before.rig.instances)
  expect(after.rig.connections).toEqual(before.rig.connections) // nothing was added or cabled for the learner
  expect(await page.evaluate(() => window.__creation!.historySize())).toBe(0)
})

test('item 7: the line is for a reopen only: not after a first action, and not for a project that has a power strip', async ({ page }) => {
  await oldProject(page)
  await reload(page)
  await expect(statusMsg(page)).toContainText(NO_MAINS)
  // the next thing the learner does replaces it; it does not come back by itself
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] }))
  await expect(statusMsg(page)).not.toContainText(NO_MAINS)
  await page.getByRole('menuitem', { name: 'Projet' }).click() // no further announcement from merely using the menus
  await page.keyboard.press('Escape')
  await expect(statusMsg(page)).not.toContainText(NO_MAINS)
})

test('item 7: a reopened project that has its power strip gets no such line; neither does a fresh starter template', async ({ page }) => {
  await oldProject(page, { strip: true })
  await reload(page)
  await expect(statusMsg(page)).toContainText('Travail de la dernière séance rouvert.')
  await expect(statusMsg(page)).not.toContainText(NO_MAINS)
  // the starter template (it has its strip) is a new project, not a reopen
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.design().rig.instances.length === 5)
  await expect(statusMsg(page)).not.toContainText(NO_MAINS)
})

test('item 7: « Ouvrir… » on a saved project without a power strip says it too', async ({ page }) => {
  await oldProject(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Control+s')
  await page.getByRole('textbox', { name: 'Nom du projet' }).fill('Ancien')
  await page.keyboard.press('Enter')
  await expect(page).toHaveTitle(/^Ancien/)
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Nouveau/ }).click()
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('menuitem', { name: 'Projet' }).click()
  await page.getByRole('menuitem', { name: /^Ouvrir/ }).click()
  await page.getByRole('button', { name: /^Ancien, enregistré le / }).click()
  await expect(page).toHaveTitle(/^Ancien/)
  await expect(statusMsg(page)).toContainText('Projet « Ancien » ouvert.')
  await expect(statusMsg(page)).toContainText(NO_MAINS)
})
