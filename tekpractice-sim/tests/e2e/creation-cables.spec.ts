/**
 * Task 27 (C18): cables coloured by signal type, a legend at the bottom of Propriétés, and cable hover. The legend lists
 * ONLY the signal types on the scene, collapses with a named button and never overlays the 3D view; hovering a cable
 * highlights it and says what it joins; a port or a device under the pointer wins; an idle page renders nothing.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { SIGNAL_STYLE } from '../../src/creation/cableStyle'
import { cableKey } from '../../src/creation/sceneDiff'
test.use({ viewport: { width: 1366, height: 768 } })

type Ref = { instance: string; port: string }
const SM58: Ref = { instance: 'sm58', port: 'out-xlr' }
const MIC1: Ref = { instance: 'ql1', port: 'in-mic-1' }
const QL_OUT: Ref = { instance: 'ql1', port: 'out-main-l' }
const K12_IN: Ref = { instance: 'k12-g', port: 'in-line-a' }
const MIC_KEY = cableKey(SM58, MIC1)
const LINE_KEY = cableKey(QL_OUT, K12_IN)

/** The reference template ("Concert simple", one mic cable) on a settled camera. */
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
const legend = (page: Page) => page.getByTestId('cable-legend')
const items = (page: Page) => page.locator('[data-testid="cable-legend-list"] > li')
const hoverLabel = (page: Page) => page.locator('[data-testid="port-label"]:not([hidden])')
const freePoint = async (page: Page, key: string) => {
  const p = await page.evaluate((k) => window.__creation!.cableFreePoint(k), key)
  expect(p, `a free point on cable ${key}`).not.toBeNull()
  return p!
}
const addLineCable = (page: Page) => page.evaluate(([a, b]) => window.__creation!.dispatch({ type: 'CONNECT', a, b }), [QL_OUT, K12_IN] as const)

test('the template mic cable is drawn in the mic colour and the legend names it (only that signal)', async ({ page }) => {
  await boot(page)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), MIC_KEY)).toBe(SIGNAL_STYLE['mic-level']!.color)
  await expect(legend(page)).toBeVisible()
  await expect(items(page)).toHaveCount(1)
  await expect(items(page).first()).toHaveText('Niveau micro')
  await expect(items(page).first()).toHaveAttribute('data-signal', 'mic-level')
  // the swatch carries the cable colour (a solid stroke: this signal is not dashed)
  const stroke = await items(page).first().locator('line').evaluate((l) => ({ stroke: l.getAttribute('stroke'), dash: l.getAttribute('stroke-dasharray') }))
  expect(stroke).toEqual({ stroke: SIGNAL_STYLE['mic-level']!.color, dash: null })
})

test('the legend lists the signal types present: a second type appears with its own colour, and goes with undo', async ({ page }) => {
  await boot(page)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBeNull() // not drawn yet
  const r = await addLineCable(page)
  expect(r.ok).toBe(true)
  await expect(items(page)).toHaveCount(2)
  await expect(items(page).nth(0)).toHaveText('Niveau micro')
  await expect(items(page).nth(1)).toHaveText('Niveau ligne pro (+4 dBu)')
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBe(SIGNAL_STYLE['line-level-pro']!.color)
  expect(SIGNAL_STYLE['line-level-pro']!.color).not.toBe(SIGNAL_STYLE['mic-level']!.color)
  await page.evaluate(() => window.__creation!.undo())
  await expect(items(page)).toHaveCount(1)
  expect(await page.evaluate((k) => window.__creation!.cableColor(k), LINE_KEY)).toBeNull()
  // no cable at all: the block is gone, not an empty box
  await page.evaluate((r) => window.__creation!.dispatch({ type: 'UNPLUG', a: r[0], b: r[1] }), [SM58, MIC1] as const)
  await expect(legend(page)).toBeHidden()
})

test('the legend is at the bottom of Propriétés, never over the 3D view; it collapses with a named button that has a visible focus ring and no transition', async ({ page }) => {
  await boot(page)
  const box = (await legend(page).boundingBox())!
  const props = (await page.getByTestId('properties').boundingBox())!
  const view = (await page.getByTestId('viewport').boundingBox())!
  // inside Propriétés, flush with its bottom edge, and clear of the viewport
  expect(box.x).toBeGreaterThanOrEqual(props.x - 0.5)
  expect(box.x + box.width).toBeLessThanOrEqual(props.x + props.width + 0.5)
  expect(Math.abs(box.y + box.height - (props.y + props.height))).toBeLessThanOrEqual(1)
  expect(box.x).toBeGreaterThanOrEqual(view.x + view.width - 0.5)
  expect(await legend(page).evaluate((el) => el.closest('[data-testid="properties"]') !== null)).toBe(true)

  const toggle = page.getByRole('button', { name: 'Replier la légende des câbles' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(items(page).first()).toBeVisible()
  await toggle.click()
  const expand = page.getByRole('button', { name: 'Déplier la légende des câbles' })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expect(items(page).first()).toBeHidden()
  await expect(legend(page)).toBeVisible() // the title stays: only the list folds
  await expand.click()
  await expect(items(page).first()).toBeVisible()

  // keyboard: the button is reachable, Entrée folds, and its focus ring is 2 px Ambre with a Nuit inner ring
  await page.getByTestId('cable-legend-toggle').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('cable-legend-toggle')).toBeFocused()
  const ring = await page.getByTestId('cable-legend-toggle').evaluate((el) => {
    const c = getComputedStyle(el)
    return { width: c.outlineWidth, style: c.outlineStyle, color: c.outlineColor, shadow: c.boxShadow, transition: c.transitionDuration }
  })
  expect(ring.width).toBe('2px')
  expect(ring.style).toBe('solid')
  expect(ring.color).toBe('rgb(221, 147, 73)') // Ambre #DD9349
  expect(ring.shadow).toContain('rgb(19, 17, 20)') // Nuit #131114
  expect(parseFloat(ring.transition)).toBeLessThanOrEqual(0.001) // none (reduced motion rounds a 0 duration up to 1e-5 s)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cable-legend-toggle')).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cable-legend-toggle')).toHaveAttribute('aria-expanded', 'true')

  // folding Propriétés itself takes the legend with it
  await page.getByRole('button', { name: 'Replier le panneau Propriétés' }).click()
  await expect(legend(page)).toBeHidden()
  await page.getByRole('button', { name: 'Déplier le panneau Propriétés' }).click()
  await expect(legend(page)).toBeVisible()
})

test('the legend and the hover label pass axe (no serious or critical violation)', async ({ page }) => {
  await boot(page)
  await addLineCable(page)
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toBeVisible()
  const results = await new AxeBuilder({ page }).include('[data-testid="properties"]').include('[data-testid="viewport"]').exclude('#renderCanvas').disableRules(['region']).analyze()
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('hovering a cable highlights it and says what it joins; leaving clears both; an idle page renders nothing', async ({ page }) => {
  await boot(page)
  const p = await freePoint(page, MIC_KEY)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toHaveText('sm58 out-xlr → ql1 in-mic-1 · Niveau micro')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(MIC_KEY)
  // the label sits at the pointer (a bubble above it, kept inside the 3D view)
  const label = (await hoverLabel(page).boundingBox())!
  expect(Math.abs(label.x + label.width / 2 - p.x)).toBeLessThanOrEqual(label.width / 2 + 8)
  expect(Math.abs(label.y + label.height - p.y)).toBeLessThanOrEqual(40)

  // away from every cable: the highlight and the label go
  const view = (await page.getByTestId('viewport').boundingBox())!
  await page.mouse.move(view.x + 6, view.y + view.height - 6)
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  // idle: no frame at all for 2 s once the hover has ended
  await settle(page)
  const before = await page.evaluate(() => window.__creation!.renders())
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => window.__creation!.renders())).toBe(before)
})

test('a port under the pointer wins over the cable at its end: the port label shows, the cable is not hovered, never two labels', async ({ page }) => {
  await boot(page)
  const at = await page.evaluate((r) => window.__creation!.portScreen(r), SM58)
  expect(at).not.toBeNull()
  await page.mouse.move(at!.x, at!.y)
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('out-xlr')
  await expect(hoverLabel(page)).not.toContainText('→')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  // sliding from the cable onto the port keeps ONE label, and it is the port's
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toContainText('→')
  await page.mouse.move(at!.x, at!.y, { steps: 6 })
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('out-xlr')
  await expect(hoverLabel(page)).not.toContainText('→')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('an orbit drag (button held) shows no cable hover and ends it', async ({ page }) => {
  await boot(page)
  const p = await freePoint(page, MIC_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toBeVisible()
  await page.mouse.down()
  await page.mouse.move(p.x + 30, p.y + 10, { steps: 4 })
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  await page.mouse.up()
})

/** The camera is cut under a resting pointer (no mouse event): the hover must follow what is under the pointer NOW. */
const hoverAt = async (page: Page, key: string) => {
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  const q = await freePoint(page, key)
  await page.mouse.move(q.x, q.y)
  await expect(hoverLabel(page)).toBeVisible()
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(key)
  return q
}
const cut = async (page: Page, move: { radius?: (current: number) => number; turn?: number }) => {
  const current = (await page.evaluate(() => window.__creation!.camera()))!.radius
  if (move.radius) await page.evaluate((r) => window.__creation!.setCameraRadius(r), move.radius(current))
  if (move.turn) await page.evaluate((d) => window.__creation!.turnCamera(d), move.turn)
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  await settle(page)
}

test('a camera cut that moves the cable away from the resting pointer removes the highlight and the label', async ({ page }) => {
  await boot(page)
  const q = await hoverAt(page, MIC_KEY)
  await cut(page, { turn: 0.5 })
  // the independent oracle: after the cut, the cable is NOT under the pointer any more
  expect(await page.evaluate(([x, y]) => window.__creation!.cableAtPage(x, y), [q.x, q.y] as const)).toBeNull()
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('a camera cut that leaves the cable under the resting pointer keeps the highlight and the label', async ({ page }) => {
  await boot(page)
  const q = await hoverAt(page, MIC_KEY)
  await cut(page, { radius: (r) => r * 1.002 }) // a hair: the cable moves well under the 7 px tolerance
  expect(await page.evaluate(([x, y]) => window.__creation!.cableAtPage(x, y), [q.x, q.y] as const)).toBe(MIC_KEY)
  await expect(hoverLabel(page)).toHaveCount(1)
  await expect(hoverLabel(page)).toContainText('sm58 out-xlr → ql1 in-mic-1')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(MIC_KEY)
})

test('undo of the hovered cable under a still pointer drops the highlight and the label', async ({ page }) => {
  await boot(page)
  await addLineCable(page)
  await expect(items(page)).toHaveCount(2)
  await settle(page)
  const p = await freePoint(page, LINE_KEY)
  await page.mouse.move(p.x, p.y)
  await expect(hoverLabel(page)).toContainText('ql1 out-main-l → k12-g in-line-a · Niveau ligne pro (+4 dBu)')
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBe(LINE_KEY)
  await page.evaluate(() => window.__creation!.undo())
  await expect(hoverLabel(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__creation!.cableHovered())).toBeNull()
})

test('a mains-power entry is drawn dashed with its « pointillés » note, a solid one is not; an empty legend hides the block', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__creation!.legendPreview(['mains-power', 'mic-level']))
  await expect(items(page)).toHaveCount(2)
  const mains = items(page).nth(0)
  await expect(mains).toHaveAttribute('data-signal', 'mains-power')
  await expect(mains).toContainText('Secteur 230 V')
  await expect(mains).toContainText('pointillés')
  const line = mains.locator('line')
  expect(await line.getAttribute('stroke-dasharray')).toMatch(/^\d+ \d+$/)
  expect(await line.getAttribute('stroke')).toBe(SIGNAL_STYLE['mains-power']!.color)
  const mic = items(page).nth(1)
  expect(await mic.locator('line').getAttribute('stroke-dasharray')).toBeNull()
  await expect(mic.locator('.cr-legend-note')).toHaveCount(0)
  // the toggle still folds and unfolds it, with the state and the name in step
  const toggle = page.getByTestId('cable-legend-toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-label', 'Déplier la légende des câbles')
  await expect(page.getByTestId('cable-legend-list')).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('cable-legend-list')).toBeVisible()
  // no entry: the block is hidden, not an empty box
  await page.evaluate(() => window.__creation!.legendPreview([]))
  await expect(legend(page)).toBeHidden()
})
