/**
 * Oscar never rests on top of the page's own controls (T1.1, T1.2b of the onboarding plan).
 *
 * « Resting » = the guide's icon (and its bubble when it is open) where the guide puts it by itself: no flow running, nothing dragged. The check is geometric
 * and on the production build: the rect of the icon is intersected with the rect of every VISIBLE control of the page (buttons, inputs, links, menu items,
 * tabs, summaries; clipped by the scroll areas that hold them, nothing under `visibility: hidden`, `display: none` or `inert`). The guide's own nodes are not
 * controls of the page.
 *
 * T1.1: 1366 x 768 (Propriétés open with a device selected: its « Connecter à… » buttons run down to the status bar).
 * The 1024 x 768 and 820 x 1180 cases, the bubble and the inventory drawer are in the second half of this file (T1.2b): they need the obstacles.
 */
import { expect, test, type Page } from '@playwright/test'
import { settleRenders } from './waits'

const PLACE = 'room:concert-hall-medium'
const ICON_NAME = 'Oscar, assistant IA'

type Box = { x: number; y: number; w: number; h: number }
interface Hit {
  name: string
  box: Box
  overlap: Box
}

/** Seed: a place and four devices (as creation-connect-dialog does), with `ql1` selected so that Propriétés lists its ports. */
async function boot(page: Page, size: { width: number; height: number }, opts: { select?: boolean } = {}): Promise<void> {
  await page.setViewportSize(size)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-d', position: [-3, 0, -3] })
  })
  if (opts.select !== false) {
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
    expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  }
  await expect(page.getByRole('button', { name: ICON_NAME, exact: true })).toBeVisible()
  await settle(page)
}

/** The guide settles with a frame or two (rect resync); two animation frames and a short wait are enough with reduced motion. */
async function settle(page: Page): Promise<void> {
  await settleRenders(page)
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  await page.waitForTimeout(400)
}

/** The visible controls of the page that the box of `what` overlaps by more than a pixel in both directions. */
async function controlsUnder(page: Page, what: '.oscar-icon' | '.oscar-bubble'): Promise<Hit[]> {
  return page.evaluate((selector) => {
    const guideRoot = document.querySelector('[data-oscar-root]')
    const target = document.querySelector(selector)
    if (target === null) return [{ name: `no ${selector}`, box: { x: 0, y: 0, w: 0, h: 0 }, overlap: { x: 0, y: 0, w: 1, h: 1 } }]
    const t = target.getBoundingClientRect()
    const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="combobox"], [tabindex]:not([tabindex="-1"])'
    const clipOf = (el: Element, r: DOMRect): DOMRect | null => {
      let x0 = r.left
      let y0 = r.top
      let x1 = r.right
      let y1 = r.bottom
      // the body and the root are not scroll areas of the page (the body is 0 high with overflow hidden)
      for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const pr = p.getBoundingClientRect()
          x0 = Math.max(x0, pr.left)
          y0 = Math.max(y0, pr.top)
          x1 = Math.min(x1, pr.right)
          y1 = Math.min(y1, pr.bottom)
        }
      }
      return x1 - x0 > 0 && y1 - y0 > 0 ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : null
    }
    const hits: { name: string; box: { x: number; y: number; w: number; h: number }; overlap: { x: number; y: number; w: number; h: number } }[] = []
    for (const el of document.querySelectorAll(CONTROLS)) {
      if (guideRoot !== null && guideRoot.contains(el)) continue
      if (el.tagName === 'CANVAS') continue // the 3D view is where the guide is allowed to rest
      if (el.closest('[inert]') !== null) continue
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible' || cs.display === 'none') continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      const c = clipOf(el, r)
      if (c === null) continue
      const x0 = Math.max(c.left, t.left)
      const y0 = Math.max(c.top, t.top)
      const x1 = Math.min(c.right, t.right)
      const y1 = Math.min(c.bottom, t.bottom)
      if (x1 - x0 > 1 && y1 - y0 > 1) {
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        hits.push({ name: `${el.tagName.toLowerCase()} ${label}`, box: { x: c.left, y: c.top, w: c.width, h: c.height }, overlap: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } })
      }
    }
    return hits
  }, what)
}

const iconBox = async (page: Page): Promise<Box> => {
  const b = await page.getByRole('button', { name: ICON_NAME, exact: true }).boundingBox()
  expect(b).not.toBeNull()
  return { x: b!.x, y: b!.y, w: b!.width, h: b!.height }
}

test.describe('1366 x 768', () => {
  test('the resting icon overlaps no visible control of the page (Propriétés open, a device selected)', async ({ page }) => {
    await boot(page, { width: 1366, height: 768 })
    // the premise: Propriétés lists « Connecter à… » buttons, so there is something to land on
    await expect(page.locator('[data-key^="connect:"]').first()).toBeVisible()
    expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
  })

  test('the icon rests left of Propriétés and above the status bar', async ({ page }) => {
    await boot(page, { width: 1366, height: 768 })
    const icon = await iconBox(page)
    const props = (await page.getByTestId('properties').boundingBox())!
    const status = (await page.getByTestId('status-bar').boundingBox())!
    expect(icon.x + icon.w).toBeLessThanOrEqual(props.x)
    expect(icon.y + icon.h).toBeLessThanOrEqual(status.y)
  })

  test('Propriétés folded to its rail: the icon moves to the rail (it follows the panel)', async ({ page }) => {
    await boot(page, { width: 1366, height: 768 })
    await page.getByTestId('props-collapse').click()
    await expect(page.locator('.cr[data-props="collapsed"]')).toHaveCount(1)
    await settle(page)
    expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
    const icon = await iconBox(page)
    const props = (await page.getByTestId('properties').boundingBox())!
    expect(icon.x + icon.w).toBeLessThanOrEqual(props.x)
    expect(icon.x + icon.w).toBeGreaterThan(1366 - 100)
  })
})
