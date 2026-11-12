/**
 * Oscar never rests on top of the page's own controls (T1.1 and T1.2b of the onboarding plan).
 *
 * « Resting » = the guide's icon (and its bubble when it is open) where the guide puts it by itself: nothing dragged. The check is geometric and on the
 * production build: the rect of the icon (or of the bubble) is intersected with the rect of every VISIBLE control of the page (buttons, inputs, links, menu
 * items, tabs, summaries; clipped by the scroll areas that hold them, nothing under `visibility: hidden`, `display: none` or `inert`; the 3D canvas is where the
 * guide may rest). The guide's own nodes are not controls of the page. While a step points at something, the controls inside the ring are the target itself and
 * do not count (the icon is beside them by design); every other control counts.
 *
 * - 1366 x 768 (T1.1): Propriétés open with a device selected, then folded to its rail.
 * - 1366 x 768, 1024 x 768, 820 x 1180 (T1.2b): the resting icon and the open bubble, Propriétés open; the inventory drawer open; and every stage of the
 *   first mounting (no place, empty bench, one device, a pair, a cabled pair) with its step pointing at the menu, the ports or the status bar.
 */
import { expect, test, type Page } from '@playwright/test'
import { settleRenders } from './waits'

const PLACE = 'room:concert-hall-medium'
const ICON_NAME = 'Oscar, assistant IA'

type Size = { width: number; height: number }
type Box = { x: number; y: number; w: number; h: number }
interface Hit {
  name: string
  box: Box
  overlap: Box
}

const SIZES: Size[] = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
]

/** The bench: 0 = no device, 1 = ql1, 2 = ql1 + sm58, 3 = those two with a cable, 4 = four devices without a cable. */
type Bench = 0 | 1 | 2 | 3 | 4

/** Seed: a place (unless `place` is false), the devices of `bench`, `ql1` selected when there is one so that Propriétés lists its ports. */
async function boot(page: Page, size: Size, opts: { bench?: Bench; place?: boolean; select?: boolean } = {}): Promise<void> {
  const bench = opts.bench ?? 4
  await page.setViewportSize(size)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  if (opts.place !== false) {
    await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
    await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
  }
  await page.evaluate((n) => {
    const c = window.__creation!
    if (n >= 1) c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    if (n >= 2) c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] })
    if (n === 3) c.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } })
    if (n >= 4) {
      c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
      c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-d', position: [-3, 0, -3] })
    }
  }, bench)
  // (selecting a device flies the camera to it: a step that points at a port needs the ports on screen, so that case does not select)
  if (bench >= 1 && opts.place !== false && opts.select !== false) {
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
    expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  }
  // below about 1100 px the shell folds Propriétés to its rail by itself: the cases of this file are about the panel OPEN, so open it
  // (while the place picker is up the shell is behind it: that stage keeps the panel as the shell has it)
  if (opts.place !== false) {
    if ((await page.locator('.cr[data-props="collapsed"]').count()) > 0) await page.getByTestId('props-collapse').click()
    await expect(page.locator('.cr[data-props="collapsed"]')).toHaveCount(0)
  }
  await expect(icon(page)).toBeVisible()
  await settle(page)
}

const icon = (page: Page) => page.getByRole('button', { name: ICON_NAME, exact: true })

/** The guide settles with a frame or two (rect resync); two animation frames and a short wait are enough with reduced motion. */
async function settle(page: Page): Promise<void> {
  await settleRenders(page)
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  await page.waitForTimeout(400)
}

/** The visible controls of the page that the box of `what` overlaps by more than a pixel in both directions (controls inside a ring are the target: skipped). */
async function controlsUnder(page: Page, what: '.oscar-icon' | '.oscar-bubble'): Promise<Hit[]> {
  return page.evaluate((selector) => {
    const guideRoot = document.querySelector('[data-oscar-root]')
    const target = document.querySelector(selector)
    if (target === null) return [{ name: `no ${selector}`, box: { x: 0, y: 0, w: 0, h: 0 }, overlap: { x: 0, y: 0, w: 1, h: 1 } }]
    const t = target.getBoundingClientRect()
    const rings = [...document.querySelectorAll('.oscar-ring')].filter((r) => !(r as HTMLElement).hidden && r.getBoundingClientRect().width > 0).map((r) => r.getBoundingClientRect())
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
      const cx = c.left + c.width / 2
      const cy = c.top + c.height / 2
      if (rings.some((g) => cx >= g.left && cx <= g.right && cy >= g.top && cy <= g.bottom)) continue
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
  const b = await icon(page).boundingBox()
  expect(b).not.toBeNull()
  return { x: b!.x, y: b!.y, w: b!.width, h: b!.height }
}
/** The side panels the box lies on (by more than a pixel each way): text and rows the guide would hide even where no control sits under it. */
async function panelsUnder(page: Page, what: '.oscar-icon' | '.oscar-bubble'): Promise<string[]> {
  return page.evaluate((selector) => {
    const t = document.querySelector(selector)!.getBoundingClientRect()
    const out: string[] = []
    for (const id of ['properties', 'project-tree']) {
      const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect()
      if (r === undefined || r.width <= 0) continue
      if (Math.min(r.right, t.right) - Math.max(r.left, t.left) > 1 && Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top) > 1) out.push(id)
    }
    return out
  }, what)
}
/** Inside the viewport, give or take a pixel (the layout reads whole-pixel sizes, the box can be a fraction taller). */
const inside = (b: Box, size: Size): boolean => b.x >= -1 && b.y >= -1 && b.x + b.w <= size.width + 1 && b.y + b.h <= size.height + 1

/** Open the bubble with the icon and wait for its text. */
async function openBubble(page: Page): Promise<void> {
  await icon(page).click()
  await expect(page.locator('.oscar-bubble')).toBeVisible()
  await expect(page.locator('.oscar-live')).not.toBeEmpty()
  await settle(page)
}

// ── T1.1: 1366 x 768 ──────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('1366 x 768', () => {
  test('the resting icon overlaps no visible control of the page (Propriétés open, a device selected)', async ({ page }) => {
    await boot(page, SIZES[0])
    // the premise: Propriétés lists « Connecter à… » buttons, so there is something to land on
    await expect(page.locator('[data-key^="connect:"]').first()).toBeVisible()
    expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
  })

  test('the icon rests left of Propriétés and above the status bar', async ({ page }) => {
    await boot(page, SIZES[0])
    const icn = await iconBox(page)
    const props = (await page.getByTestId('properties').boundingBox())!
    const status = (await page.getByTestId('status-bar').boundingBox())!
    expect(icn.x + icn.w).toBeLessThanOrEqual(props.x)
    expect(icn.y + icn.h).toBeLessThanOrEqual(status.y)
  })

  test('Propriétés folded to its rail: the icon moves to the rail (it follows the panel)', async ({ page }) => {
    await boot(page, SIZES[0])
    await page.getByTestId('props-collapse').click()
    await expect(page.locator('.cr[data-props="collapsed"]')).toHaveCount(1)
    await settle(page)
    expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
    const icn = await iconBox(page)
    const props = (await page.getByTestId('properties').boundingBox())!
    expect(icn.x + icn.w).toBeLessThanOrEqual(props.x)
    expect(icn.x + icn.w).toBeGreaterThan(1366 - 100)
  })
})

// ── T1.2b: the three viewports, the icon and the bubble ───────────────────────────────────────────────────────────────────

for (const size of SIZES) {
  test.describe(`${size.width} x ${size.height}: obstacles from the host`, () => {
    test('the resting icon overlaps no visible control, Propriétés open with a device selected', async ({ page }) => {
      await boot(page, size)
      await expect(page.locator('[data-key^="connect:"]').first()).toBeVisible()
      expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
      expect(await panelsUnder(page, '.oscar-icon'), 'the icon is not on a side panel').toEqual([])
      expect(inside(await iconBox(page), size)).toBe(true)
    })

    test('the open bubble overlaps no visible control either, and the icon still overlaps none', async ({ page }) => {
      await boot(page, size)
      await openBubble(page)
      expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
      expect(await controlsUnder(page, '.oscar-bubble')).toEqual([])
      expect(await panelsUnder(page, '.oscar-icon'), 'the icon is not on a side panel').toEqual([])
      expect(await panelsUnder(page, '.oscar-bubble'), 'the bubble is not on a side panel').toEqual([])
      const b = (await page.locator('.oscar-bubble').boundingBox())!
      expect(inside({ x: b.x, y: b.y, w: b.width, h: b.height }, size)).toBe(true)
    })

    test('the inventory drawer open: the icon and the bubble stay off its tabs, its search field and its items', async ({ page }) => {
      await boot(page, size, { bench: 0 })
      await page.locator('#renderCanvas').focus()
      await page.keyboard.press('Space')
      await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true')
      await settle(page)
      expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
      await openBubble(page)
      expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
      expect(await controlsUnder(page, '.oscar-bubble')).toEqual([])
    })

    // The first mounting, stage by stage: the stage decides the flow the start chip opens (no place: « Premier montage » at the place; an empty bench: the
    // Matériel menu; one device: the Matériel menu; a pair: the cable from the mic output to the console input; a cabled pair: the status bar).
    const STAGES: { name: string; bench: Bench; place: boolean; select?: boolean }[] = [
      { name: 'no place yet (step: the place)', bench: 0, place: false },
      { name: 'an empty bench (step: the Matériel menu)', bench: 0, place: true },
      { name: 'one device (step: the Matériel menu)', bench: 1, place: true },
      { name: 'a pair without a cable (step: the cable, from the output to the input)', bench: 2, place: true, select: false },
      { name: 'a cabled pair (step: the status bar)', bench: 3, place: true },
    ]
    for (const stage of STAGES) {
      test(`${stage.name}: the icon and the bubble overlap no control but the one pointed at`, async ({ page }) => {
        await boot(page, size, { bench: stage.bench, place: stage.place, ...(stage.select === false ? { select: false } : {}) })
        await openBubble(page)
        // the guide reads the bench with « Prochaine étape » and then offers the flow of the stage (it may need a poll or two to have read the bench)
        const start = page.locator('.oscar-chips').getByRole('button', { name: 'Lancer le parcours proposé', exact: true })
        await expect
          .poll(
            async () => {
              if (await page.locator('.oscar-bubble').isHidden()) await icon(page).click()
              await page.locator('.oscar-chips').getByRole('button', { name: 'Prochaine étape', exact: true }).click()
              return start.count()
            },
            { message: 'the guide offers a start chip', timeout: 15_000 },
          )
          .toBe(1)
        await start.click()
        await expect(page.locator('.oscar-ring:not(.oscar-ring-drop)')).toBeVisible()
        await settle(page)
        expect(await controlsUnder(page, '.oscar-icon')).toEqual([])
        expect(await controlsUnder(page, '.oscar-bubble')).toEqual([])
        expect(inside(await iconBox(page), size)).toBe(true)
        const b = (await page.locator('.oscar-bubble').boundingBox())!
        expect(inside({ x: b.x, y: b.y, w: b.width, h: b.height }, size)).toBe(true)
      })
    }
  })
}
