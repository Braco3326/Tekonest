/**
 * The in-page guide (Oscar) in Mode Création, on the production build.
 *
 * What is proven here, and only here (the unit tests have no DOM):
 *  - the icon, its accessible name, the keyboard path (Tab, Entrée, Échap, focus back on the icon), the landmark that holds it;
 *  - the guide costs the page nothing at rest: 0 renders in 3 s, and a pinned, measured number of extra listeners against the same page with `?oscar=0`;
 *  - the guide quotes the app: the bubble of an error says the status bar's own explanation, the ring sits on the faulty port;
 *  - a start chip where there is something to start, none on a fix; each stage opens its own flow, ringed on the right anchor;
 *  - « Montre-moi » draws a cable and touches nothing in the design (the guide never performs);
 *  - phone width, a window resize with the ring on a port, a modal dialog (inert), the app's own Échap cascade, axe;
 *  - exam address, `?oscar=0`: no node, no guide chunk requested, nothing stored;
 *  - the cost of following a device (`deviceScreen`) through the widget.
 * No console error, no page error and no `guide:` warning during any test of this file.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'
import { TP_STRINGS } from '../../src/guide/strings'
import { quietWindow, settleRenders } from './waits'

test.use({ viewport: { width: 1280, height: 800 } })

const RULE = (id: string) => catalog.rules.find((r) => r.id === id)!
const PLACE = 'room:concert-hall-medium'
const ICON_NAME = 'Oscar, assistant IA'

/** The window / document listeners the guide holds that the same page with `?oscar=0` does not (measured: these six; a seventh, or another kind, fails the test). */
const PAGE_LISTENERS = ['document click (capture)', 'document keydown', 'document visibilitychange', 'window oscar-guide:event', 'window resize', 'window scroll (capture)']
/** The most extra DisposableBag listeners (the app's own count; the guide registers none there: measured 0). */
const BAG_LISTENERS_BUDGET = 0
const IDLE_MS = 3000

// ── no console error, page error or `guide:` warning in any test ─────────────────────────────────────────────────────

let problems: string[] = []
const track = (page: Page): void => {
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' || (m.type() === 'warning' && /guide:/i.test(t))) problems.push(`${m.type()}: ${t}`)
  })
}
test.beforeEach(({ page }) => {
  problems = []
  track(page)
})
test.afterEach(() => {
  expect(problems, 'console errors, page errors and guide warnings').toEqual([])
})

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

type Ref = { instance: string; port: string }
const SM58_OUT: Ref = { instance: 'sm58', port: 'out-xlr' }
const QL1_MIC1: Ref = { instance: 'ql1', port: 'in-mic-1' }
const U87_OUT: Ref = { instance: 'u87', port: 'out-xlr' }

const boot = async (page: Page, o: { search?: string; place?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/' + (o.search ?? ''))
  await page.waitForFunction(() => !!window.__creation)
  if (o.place === false) return
  await page.evaluate((p) => window.__creation!.choosePlace(p), PLACE)
  await page.waitForFunction((p) => window.__creation!.place() === p, PLACE)
}
/** A mic and a console, no cable: the stage « devices, no cable ». */
const spawnMicAndConsole = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] })
  })
/** A condenser into a preamp with +48 V off: one error, the phantom power rule the app teaches best. */
const spawnPhantomError = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'neumann-u87-ai', instanceId: 'u87', position: [1, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa', position: [2, 0, 8] })
    c.dispatch({ type: 'CONNECT', a: { instance: 'u87', port: 'out-xlr' }, b: { instance: 'isa', port: 'in-mic' } })
  })
  await page.waitForFunction(() => window.__creation!.events().some((e) => e.severity === 'error'))
}

const icon = (page: Page) => page.getByRole('button', { name: ICON_NAME, exact: true })
const bubble = (page: Page) => page.locator('.oscar-bubble')
const chip = (page: Page, name: string) => page.locator('.oscar-chips').getByRole('button', { name, exact: true })
const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')
const ringTo = (page: Page) => page.locator('.oscar-ring-drop')
const live = (page: Page): Promise<string> => page.locator('.oscar-live').innerText()
const liveLines = (page: Page): Promise<string[]> => page.locator('.oscar-live').evaluate((el) => [...el.children].map((c) => (c.textContent ?? '').trim()))

const waitGuide = async (page: Page): Promise<void> => {
  await expect(icon(page)).toBeVisible()
}
/**
 * The guide reads the bench every 500 ms. A bubble about the bench (an error, a missing step, a good chain) is closed by the next change it reads, by design: it
 * would be stale. So after a bench is set up, the guide is given three polls to read it before a bubble is opened; this is a quiet window, not a wait for a state
 * (the guide has no observable "I have read it").
 */
const GUIDE_POLL_MS = 500
const guideSees = (page: Page): Promise<void> => quietWindow(page, GUIDE_POLL_MS * 3)
const openBubble = async (page: Page): Promise<void> => {
  await waitGuide(page)
  if (await bubble(page).isHidden()) {
    await guideSees(page)
    await icon(page).click()
  }
  await expect(bubble(page)).toBeVisible()
}
/** « Prochaine étape » until the bubble says `text`: the guide learns of a change at its next poll, so a click right after a change may still read the old bench. */
const nextStepSays = async (page: Page, text: string): Promise<void> => {
  await openBubble(page)
  await expect
    .poll(
      async () => {
        if (await bubble(page).isHidden()) await icon(page).click()
        await chip(page, 'Prochaine étape').click()
        return live(page)
      },
      { message: `« Prochaine étape » says: ${text}`, timeout: 15_000 },
    )
    .toContain(text)
}

/** « Prochaine étape » until a start chip is offered (a bench with something to start). */
const startChipOffered = async (page: Page): Promise<void> => {
  await openBubble(page)
  await expect
    .poll(
      async () => {
        if (await bubble(page).isHidden()) await icon(page).click()
        await chip(page, 'Prochaine étape').click()
        return chip(page, 'Lancer le parcours proposé').count()
      },
      { message: 'the guide has read the bench and offers a start chip', timeout: 15_000 },
    )
    .toBe(1)
}

type Box = { x: number; y: number; width: number; height: number }
const centre = (b: Box): { x: number; y: number } => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y)
const portScreen = (page: Page, r: Ref) => page.evaluate((ref) => window.__creation!.portScreen(ref), r)
/** The ring's centre is within `px` of the point the app itself projects for the port. */
const expectRingOnPort = async (page: Page, which: Locator, r: Ref, px = 12): Promise<void> => {
  await expect
    .poll(
      async () => {
        const p = await portScreen(page, r)
        const b = await which.boundingBox()
        return p === null || b === null || (await which.isHidden()) ? Number.POSITIVE_INFINITY : dist(centre(b), p)
      },
      { message: `the ring is within ${px} px of the app's projected point for ${r.instance} ${r.port}`, timeout: 10_000 },
    )
    .toBeLessThanOrEqual(px)
}
const insideViewport = (b: Box, w: number, h: number): boolean => b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5

/** Every request of a context, as paths. */
const recordRequests = (page: Page): { paths: () => string[]; urls: () => string[] } => {
  const urls: string[] = []
  page.context().on('request', (r) => urls.push(r.url()))
  return { urls: () => urls, paths: () => [...new Set(urls.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:')).map((u) => new URL(u).pathname))] }
}
/** A page in a context of its own (nothing cached or shared with the test's page): the requests it makes are all its own. */
const session = async (browser: Browser, search: string, o: { place?: boolean } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  track(page)
  const req = recordRequests(page)
  await boot(page, { search, ...o })
  return { page, req, close: () => context.close() }
}

/** The listeners added to `window` and `document` and not removed, counted from outside the app (patched in before any script runs). `once` listeners are not tracked. */
const trackPageListeners = (page: Page) =>
  page.addInitScript(() => {
    const ids = new WeakMap<object, number>()
    let next = 0
    const live = new Set<string>()
    const key = (t: EventTarget, type: string, fn: unknown, opts: unknown): string | null => {
      if (typeof fn !== 'function' && (typeof fn !== 'object' || fn === null)) return null
      const o = opts as boolean | { capture?: boolean; once?: boolean } | undefined
      if (typeof o === 'object' && o !== null && o.once) return null
      const capture = typeof o === 'boolean' ? o : !!o?.capture
      let id = ids.get(fn as object)
      if (id === undefined) ids.set(fn as object, (id = ++next))
      return `${t === window ? 'window' : 'document'}|${type}|${id}|${capture}`
    }
    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, fn: never, opts?: never) {
      if (this === window || this === document) {
        const k = key(this, type, fn, opts)
        if (k) live.add(k)
      }
      return add.call(this, type, fn, opts)
    }
    EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, fn: never, opts?: never) {
      if (this === window || this === document) {
        const k = key(this, type, fn, opts)
        if (k) live.delete(k)
      }
      return remove.call(this, type, fn, opts)
    }
    ;(window as unknown as { __pageListeners: () => string[] }).__pageListeners = () => [...live].sort()
  })
const pageListeners = (page: Page) => page.evaluate(() => (window as unknown as { __pageListeners: () => string[] }).__pageListeners())

/** axe on the whole page. `overflow` of body is lifted while it runs (index.html sets `overflow: hidden`, which makes axe-core treat every element as not visible and skip color-contrast). */
const seriousViolations = async (page: Page): Promise<{ bad: string[]; guideContrastNodes: number }> => {
  const saved = await page.evaluate(() => {
    const st = document.body.style
    const prev = { value: st.getPropertyValue('overflow'), priority: st.getPropertyPriority('overflow') }
    st.setProperty('overflow', 'visible')
    return prev
  })
  try {
    const r = await new AxeBuilder({ page }).analyze()
    const guideContrastNodes = [...r.passes, ...r.incomplete, ...r.violations]
      .filter((x) => x.id === 'color-contrast')
      .reduce((n, x) => n + x.nodes.filter((nd) => nd.target.join(' ').includes('oscar')).length, 0)
    return {
      bad: r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
      guideContrastNodes,
    }
  } finally {
    await page.evaluate((prev) => {
      const st = document.body.style
      if (prev.value) st.setProperty('overflow', prev.value, prev.priority)
      else st.removeProperty('overflow')
    }, saved)
  }
}

// ── the icon and the keyboard ────────────────────────────────────────────────────────────────────────────────────────

test('the icon is on the page once a place is chosen, a button named « Oscar, assistant IA », inside a landmark, on screen and clear of the status bar', async ({ page }) => {
  await boot(page)
  await expect(icon(page)).toBeVisible()
  await expect(icon(page)).toHaveAccessibleName(ICON_NAME)
  await expect(icon(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(bubble(page)).toBeHidden()
  // inside a landmark of its own: nothing of the guide sits outside one (axe `region`)
  await expect(page.getByRole('complementary', { name: TP_STRINGS.landmark }).getByRole('button', { name: ICON_NAME, exact: true })).toBeVisible()
  const box = (await icon(page).boundingBox())!
  expect(insideViewport(box, 1280, 800)).toBe(true)
  // it does not sit on the app's own controls: the status bar is the bottom strip, the icon is above it
  const status = (await page.getByTestId('status-bar').boundingBox())!
  test.info().annotations.push({ type: 'geometry', description: `icon ${JSON.stringify(box)}; status bar ${JSON.stringify(status)}` })
  expect(box.y + box.height, 'the icon ends above the status bar').toBeLessThanOrEqual(status.y + 0.5)
  // the app's controls are still the ones under the pointer where the icon is not
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.oscar-icon') != null, centre(box))).toBe(true)
})

test('the icon rests clear of the menu bar and the status bar in each of the four corners (arrow keys move it)', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  const clear = async (corner: string, w: number): Promise<void> => {
    const menu = (await page.getByTestId('menubar').boundingBox())!
    const status = (await page.getByTestId('status-bar').boundingBox())!
    await expect
      .poll(
        async () => {
          const b = (await icon(page).boundingBox())!
          return { top: b.y >= menu.y + menu.height - 0.5, bottom: b.y + b.height <= status.y + 0.5, inside: insideViewport(b, w, 800) }
        },
        { message: `corner ${corner}: the icon is clear of both bars` },
      )
      .toEqual({ top: true, bottom: true, inside: true })
  }
  await clear('bottom right', 1280)
  await icon(page).focus()
  for (const [key, corner] of [['ArrowUp', 'top right'], ['ArrowLeft', 'top left'], ['ArrowDown', 'bottom left'], ['ArrowRight', 'bottom right']] as const) {
    await page.keyboard.press(key)
    await clear(corner, 1280)
  }
  // the bubble, docked at the bottom, ends above the status bar too
  await openBubble(page)
  const status = (await page.getByTestId('status-bar').boundingBox())!
  const b = (await bubble(page).boundingBox())!
  expect(b.y + b.height, 'the open bubble ends above the status bar').toBeLessThanOrEqual(status.y + 0.5)
})

test('Tab reaches the icon, Entrée opens the bubble, Échap closes it and puts focus back on the icon; Espace opens it too', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  await page.locator('#renderCanvas').focus()
  const onIcon = () => page.evaluate(() => document.activeElement?.classList.contains('oscar-icon') === true)
  let tabs = 0
  while (!(await onIcon()) && tabs < 150) {
    await page.keyboard.press('Tab')
    tabs++
  }
  expect(await onIcon(), `the icon is reached by Tab (after ${tabs} presses from the canvas)`).toBe(true)
  test.info().annotations.push({ type: 'tab-stops', description: `${tabs} Tab presses from the canvas to the icon` })
  await expect(icon(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(bubble(page)).toBeVisible()
  await expect(icon(page)).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(bubble(page)).toBeHidden()
  await expect(icon(page)).toBeFocused()
  await expect(icon(page)).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Space')
  await expect(bubble(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bubble(page)).toBeHidden()
  await expect(icon(page)).toBeFocused()
})

// ── cost at rest ─────────────────────────────────────────────────────────────────────────────────────────────────────

test(`idle for ${IDLE_MS} ms adds 0 renders (bubble closed, then open) and no heavy projection; the listeners differ from the same page with ?oscar=0 by at most a pinned number`, async ({ page, browser }) => {
  await trackPageListeners(page)
  await page.addInitScript(() => {
    const w = window as unknown as { __rafTicks: number }
    w.__rafTicks = 0
    const tick = (): void => {
      w.__rafTicks++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await boot(page)
  await spawnPhantomError(page)
  await waitGuide(page)
  await settleRenders(page)
  const renders = () => page.evaluate(() => window.__creation!.renders())
  const rafTicks = () => page.evaluate(() => (window as unknown as { __rafTicks: number }).__rafTicks)
  // count the heavy projection the guide may ask for (a grid pick): it must stay at 0 while nothing asks for a device
  await page.evaluate(() => {
    const w = window as unknown as { __calls: Record<string, number> }
    w.__calls = { deviceScreen: 0, portScreen: 0, controlScreen: 0 }
    const c = window.__creation as unknown as Record<string, (...a: unknown[]) => unknown>
    for (const k of Object.keys(w.__calls)) {
      const f = c[k].bind(c)
      c[k] = (...a: unknown[]) => {
        w.__calls[k]++
        return f(...a)
      }
    }
  })
  const idle = async (what: string): Promise<void> => {
    const before = await renders()
    const ticks = await rafTicks()
    await quietWindow(page, IDLE_MS)
    expect((await rafTicks()) - ticks, `animation frames the page ran in ${IDLE_MS} ms (the window was not frozen) ${what}`).toBeGreaterThan(20)
    expect(await renders(), `renders in ${IDLE_MS} ms ${what}`).toBe(before)
  }
  await idle('with the bubble closed')
  await nextStepSays(page, RULE('R4').teach_fr) // a ring is on the faulty port now
  await expect(ring(page)).toBeVisible()
  await settleRenders(page)
  await idle('with the bubble open and a ring on a port')
  const calls = await page.evaluate(() => (window as unknown as { __calls: Record<string, number> }).__calls)
  test.info().annotations.push({ type: 'seam-calls', description: `over the idle windows: ${JSON.stringify(calls)}` })
  expect(calls.deviceScreen, 'no device projection (the heavy seam) while idle with a port ring').toBe(0)
  // a resize invalidates the scheduler: the loop is alive and renders() sees it (so a 0 above is not a stalled page)
  const n = await renders()
  await page.evaluate(() => void window.dispatchEvent(new Event('resize')))
  await expect.poll(renders, { message: 'a forced render is counted' }).toBeGreaterThan(n)

  // the same page with the kill switch
  const withGuide = { bag: await page.evaluate(() => window.__creation!.liveListeners()), page: await pageListeners(page) }
  const off = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const p2 = await off.newPage()
  track(p2)
  await trackPageListeners(p2)
  await boot(p2, { search: '?oscar=0' })
  await spawnPhantomError(p2)
  await quietWindow(p2, 1500)
  await settleRenders(p2)
  const without = { bag: await p2.evaluate(() => window.__creation!.liveListeners()), page: await pageListeners(p2) }
  await off.close()
  // the function ids differ between two pages: compare by (target, type, capture), counted
  const tally = (keys: string[]): Map<string, number> => {
    const m = new Map<string, number>()
    for (const k of keys) {
      const [t, type, , cap] = k.split('|')
      m.set(`${t} ${type}${cap === 'true' ? ' (capture)' : ''}`, (m.get(`${t} ${type}${cap === 'true' ? ' (capture)' : ''}`) ?? 0) + 1)
    }
    return m
  }
  const a = tally(withGuide.page)
  const b = tally(without.page)
  const extra = [...a].flatMap(([k, n]) => Array.from({ length: n - (b.get(k) ?? 0) }, () => k)).filter(Boolean)
  const missing = [...b].flatMap(([k, n]) => Array.from({ length: n - (a.get(k) ?? 0) }, () => k)).filter(Boolean)
  test.info().annotations.push({ type: 'listeners', description: `bag ${withGuide.bag} vs ${without.bag}; window/document ${withGuide.page.length} vs ${without.page.length}; extra: ${extra.join(', ')}` })
  console.log(`[guide listeners] bag ${withGuide.bag} vs ${without.bag} (oscar=0); window/document ${withGuide.page.length} vs ${without.page.length}; extra with the guide: ${extra.join(', ')}`)
  expect(missing, 'the guide removes no listener of the app').toEqual([])
  expect(withGuide.bag - without.bag, 'DisposableBag.liveListeners: guide minus no-guide').toBeLessThanOrEqual(BAG_LISTENERS_BUDGET)
  expect(extra.sort(), 'the window / document listeners the guide adds, and only these').toEqual(PAGE_LISTENERS)
})

// ── the guide quotes the app ─────────────────────────────────────────────────────────────────────────────────────────

test('an error on the bench: « Prochaine étape » says the status bar\'s own explanation, no start chip, the ring on the faulty port', async ({ page }) => {
  await boot(page)
  await spawnPhantomError(page)
  await waitGuide(page)
  // the status bar's row, read from the DOM
  await page.getByTestId('signal-status').click()
  const row = page.getByRole('dialog', { name: 'Erreurs et avertissements' }).locator('.cr-errlist-row').first()
  await expect(row).toBeVisible()
  const barTitle = (await row.locator('.cr-errlist-rtitle').textContent())!.trim()
  const barDetail = (await row.locator('.cr-errlist-detail').textContent())!.trim()
  expect(barTitle, 'the bar says the catalog title').toBe(RULE('R4').title_fr)
  expect(barDetail, 'the bar says the catalog explanation').toBe(RULE('R4').teach_fr)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Erreurs et avertissements' })).toBeHidden()

  await nextStepSays(page, barDetail)
  // What the bubble says is pinned exactly: the generic head line, then the rule's explanation word for word. The rule's title stays on the status bar row
  // (asserted above), beside it; the bubble does not repeat it.
  const lines = await liveLines(page)
  expect(lines, 'the bubble: the generic head, then the explanation').toEqual(['Correction à apporter', RULE('R4').teach_fr])
  expect(lines[1]).toBe(barDetail)
  expect(lines.join(' '), 'the rule title is not in the bubble').not.toContain(barTitle)
  await expect(page.locator('.oscar-bubble')).toHaveAttribute('data-kind', 'fix')
  await expect(chip(page, 'Lancer le parcours proposé'), 'a fix bubble has no start chip').toHaveCount(0)
  // the ring is on the first subject of the app's own error event
  const first = await page.evaluate(() => window.__creation!.events().find((e) => e.severity === 'error')!.subjects[0])
  expect(first).toEqual(U87_OUT)
  await expectRingOnPort(page, ring(page), first)
  // the guide changed nothing in the design
  expect(await page.evaluate(() => window.__creation!.design().rig.connections.length)).toBe(1)
})

test('an open bubble with a ring on a port does not cover the menu bar or the status bar, at 1280 x 800 and at 375 x 812', async ({ page }) => {
  await boot(page)
  await spawnPhantomError(page)
  await nextStepSays(page, RULE('R4').teach_fr)
  await expect(ring(page)).toBeVisible()
  const clearOfBars = async (w: number, h: number): Promise<void> => {
    await expect
      .poll(
        async () => {
          const menu = (await page.getByTestId('menubar').boundingBox())!
          const status = (await page.getByTestId('status-bar').boundingBox())!
          const b = (await bubble(page).boundingBox())!
          return { top: b.y >= menu.y + menu.height - 0.5, bottom: b.y + b.height <= status.y + 0.5, inside: insideViewport(b, w, h) }
        },
        { message: `${w} x ${h}: the bubble beside a ring is clear of both bars` },
      )
      .toEqual({ top: true, bottom: true, inside: true })
  }
  await clearOfBars(1280, 800)
  await page.setViewportSize({ width: 375, height: 812 })
  await clearOfBars(375, 812)
})

test('no place yet: « Prochaine étape » says to choose a place first and offers the start chip, which opens « Premier montage » at the place step', async ({ page }) => {
  await boot(page, { place: false })
  await nextStepSays(page, TP_STRINGS.verdict.placeFirst)
  await expect(chip(page, 'Lancer le parcours proposé')).toBeVisible()
  await chip(page, 'Lancer le parcours proposé').click()
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Premier montage » : étape 1 sur 5.')
  await expect(page.locator('.oscar-live')).toContainText(TP_STRINGS.flows['premier-montage'].steps.place)
  await expect(ring(page)).toBeVisible()
})

test('an empty bench with a place: need-info text and a start chip; the chip opens « Ajouter des appareils », its ring on the Matériel menu (nav:inventory)', async ({ page }) => {
  await boot(page)
  await nextStepSays(page, TP_STRINGS.verdict.benchEmpty)
  await expect(page.locator('.oscar-bubble')).toHaveAttribute('data-kind', 'need-info')
  await expect(chip(page, 'Lancer le parcours proposé')).toBeVisible()
  await chip(page, 'Lancer le parcours proposé').click()
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Ajouter des appareils » : étape 1 sur 2.')
  await expect(page.locator('.oscar-live')).toContainText(TP_STRINGS.flows['ajouter-des-appareils'].steps.addFirst)
  await expect(ring(page)).toBeVisible()
  const target = (await page.locator('#cr-menu-materiel').boundingBox())!
  await expect
    .poll(async () => dist(centre((await ring(page).boundingBox())!), centre(target)), { message: 'the ring is on the Matériel menu' })
    .toBeLessThanOrEqual(12)
})

test('devices and no cable: the start chip opens « Premier câble », the ring on the suggested output; « Montre-moi » draws the cable and changes nothing in the design', async ({ page }) => {
  await boot(page)
  await spawnMicAndConsole(page)
  await startChipOffered(page)
  await chip(page, 'Lancer le parcours proposé').click()
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Premier câble » : étape 1 sur 2.')
  await expectRingOnPort(page, ring(page), SM58_OUT)

  const history = await page.evaluate(() => window.__creation!.historySize())
  const cables = () => page.evaluate(() => window.__creation!.design().rig.connections.length)
  expect(await cables()).toBe(0)
  await chip(page, 'Montre-moi').click()
  // the ghost: the guide's own svg, shown, with a path from the output to the input; and the drop ring on the input
  const cable = page.locator('.oscar-cable')
  await expect(cable).not.toHaveAttribute('hidden', /.*/)
  const d = (await page.locator('.oscar-cable-path').getAttribute('d'))!
  const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
  expect(nums.length, 'a drawn path').toBeGreaterThan(2)
  const from = (await portScreen(page, SM58_OUT))!
  const to = (await portScreen(page, QL1_MIC1))!
  expect(dist(nums[0], from), 'the ghost starts on the mic output').toBeLessThanOrEqual(12)
  expect(dist(nums[nums.length - 1], to), 'the ghost ends on the console input').toBeLessThanOrEqual(12)
  await expect(ringTo(page)).toBeVisible()
  // the guide never performs: no cable made, no undo entry, still so after the demonstration has played out
  expect(await cables()).toBe(0)
  await quietWindow(page, 1500)
  expect(await cables()).toBe(0)
  expect(await page.evaluate(() => window.__creation!.historySize()), 'no undo entry was made').toBe(history)
  expect(await page.evaluate(() => window.__creation!.events().length)).toBe(0)
})

// ── phone width and resize ───────────────────────────────────────────────────────────────────────────────────────────

test('after a resize to 375 x 812 the bubble stays inside the viewport, the icon is on screen and reachable, the ring follows the port', async ({ page }) => {
  await boot(page)
  await spawnPhantomError(page)
  await nextStepSays(page, RULE('R4').teach_fr)
  await expectRingOnPort(page, ring(page), U87_OUT)
  await page.setViewportSize({ width: 375, height: 812 })
  await expect.poll(async () => insideViewport((await bubble(page).boundingBox())!, 375, 812), { message: 'the bubble is inside 375 x 812' }).toBe(true)
  const b = (await bubble(page).boundingBox())!
  expect(b.width).toBeLessThanOrEqual(375)
  await expect.poll(async () => insideViewport((await icon(page).boundingBox())!, 375, 812), { message: 'the icon is inside 375 x 812' }).toBe(true)
  // reachable: the icon is what is under its own centre, and the keyboard lands on it
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.oscar-icon') != null, centre((await icon(page).boundingBox())!))).toBe(true)
  await icon(page).focus()
  await expect(icon(page)).toBeFocused()
  // the ring follows the point the app projects at this size (or is hidden when the port is off screen)
  await expect
    .poll(
      async () => {
        const p = await portScreen(page, U87_OUT)
        const hidden = await ring(page).isHidden()
        if (p === null) return hidden ? 0 : Number.POSITIVE_INFINITY
        if (hidden) return Number.POSITIVE_INFINITY
        return dist(centre((await ring(page).boundingBox())!), p)
      },
      { message: 'at 375 px the ring is on the port (or hidden with it)', timeout: 10_000 },
    )
    .toBeLessThanOrEqual(12)
  // and the bubble closes and opens again at this size, still inside
  await icon(page).click()
  await expect(bubble(page)).toBeHidden()
  await icon(page).click()
  await expect(bubble(page)).toBeVisible()
  expect(insideViewport((await bubble(page).boundingBox())!, 375, 812)).toBe(true)
})

test.describe('phone width from the start', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test('loaded at 375 x 812: the icon is on screen and reachable, the opened bubble is inside the viewport', async ({ page }) => {
    await boot(page)
    await spawnMicAndConsole(page)
    await openBubble(page)
    await expect.poll(async () => insideViewport((await icon(page).boundingBox())!, 375, 812)).toBe(true)
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.oscar-icon') != null, centre((await icon(page).boundingBox())!))).toBe(true)
    expect(insideViewport((await bubble(page).boundingBox())!, 375, 812)).toBe(true)
  })
})

// ── dialogs and the app's own keys ───────────────────────────────────────────────────────────────────────────────────

test('with the connect dialog open (the page behind is inert) the guide cannot take focus; after Échap it can again', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const c = window.__creation!
    c.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 8] })
    c.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [3, 0, -3] })
  })
  await waitGuide(page)
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
  expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
  const opener = page.locator('[data-key="connect:out-main-l"]')
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByTestId('cr-connect-dialog')
  await expect(dialog).toBeVisible()
  const inert = () => page.evaluate(() => document.querySelector('.oscar-guide')?.closest('[inert]') != null)
  const iconHasFocus = () => page.evaluate(() => document.activeElement?.classList.contains('oscar-icon') === true)
  expect(await inert(), 'the guide is inert behind the dialog').toBe(true)
  await page.evaluate(() => (document.querySelector('.oscar-icon') as HTMLElement).focus())
  expect(await iconHasFocus(), 'focus() on an inert icon does nothing').toBe(false)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    expect(await iconHasFocus(), `Tab ${i + 1} never lands on the guide`).toBe(false)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await inert(), 'the guide is live again').toBe(false)
  await page.evaluate(() => (document.querySelector('.oscar-icon') as HTMLElement).focus())
  await expect(icon(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(bubble(page)).toBeVisible()
})

test('Échap with the canvas focused is the app\'s: it drops the cable in hand first, the guide (bubble open) does not swallow it nor close', async ({ page }) => {
  await boot(page)
  await spawnMicAndConsole(page)
  await openBubble(page)
  // a device selected, a cable in hand
  await page.locator('#renderCanvas').focus()
  for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
  const sel = await page.evaluate(() => window.__creation!.selection())
  expect(sel).not.toBeNull()
  await expect.poll(() => page.evaluate(() => window.__creation!.cameraMoving())).toBe(false)
  expect(await page.evaluate((r) => window.__creation!.patchClick(r), SM58_OUT)).toBe(true)
  expect(await page.evaluate(() => window.__creation!.patchPending())).toEqual(SM58_OUT)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.patchPending()), 'the cable in hand is dropped: the app\'s cascade ran').toBeNull()
  expect(await page.evaluate(() => window.__creation!.selection()), 'the selection is next in the cascade, not this press').toBe(sel)
  await expect(bubble(page), 'the canvas has focus: this Échap is not the guide\'s').toBeVisible()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__creation!.selection()), 'the second Échap deselects, as without the guide').toBeNull()
})

// ── exam and kill switch ─────────────────────────────────────────────────────────────────────────────────────────────

/** The guide's lazy chunks and sheets, by name (measured on the build: creationBridge, mount, theme and guide, a .js or .css each). Only a mounting guide requests them. */
const GUIDE_ASSET = /\/assets\/(mount|creationBridge|theme|guide)-[\w-]+\.(js|css)$/
/** The readers the bridge polls on `window.__creation`, counted from outside: a wrapper installed before the app sets the hook. `__readerCalls` is read and reset by the test. */
const countReaders = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __readerCalls: number }
    w.__readerCalls = 0
    let real: Record<string, unknown> | undefined
    Object.defineProperty(window, '__creation', {
      configurable: true,
      get: () => real,
      set: (v: Record<string, unknown>) => {
        real = v
        for (const k of ['design', 'events', 'place', 'devicePorts']) {
          const f = v?.[k]
          if (typeof f === 'function')
            v[k] = function (this: unknown, ...a: unknown[]) {
              w.__readerCalls++
              return (f as (...x: unknown[]) => unknown).apply(this, a)
            }
        }
      },
    })
  })
interface Facts {
  nodes: number
  landmark: number
  sheet: boolean
  chunks: string[]
  readerCalls: number
}
/** A page in a context of its own. `quietMs` is how long it is watched after the creation page is up; `mounted` waits for the icon first (the control run). */
const probe = async (browser: Browser, search: string, o: { mounted: boolean; quietMs: number }): Promise<{ facts: Facts; mountMs: number | null }> => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  track(page)
  const req = recordRequests(page)
  await countReaders(page)
  const t0 = Date.now()
  await boot(page, { search })
  let mountMs: number | null = null
  if (o.mounted) {
    await waitGuide(page)
    mountMs = Date.now() - t0
  }
  // the app's own readers are not ours to count: reset, then watch the window with no call from the test
  await page.evaluate(() => void ((window as unknown as { __readerCalls: number }).__readerCalls = 0))
  await quietWindow(page, o.quietMs)
  const facts: Facts = {
    nodes: await page.locator('.oscar-guide, [data-oscar-root]').count(),
    landmark: await page.getByRole('complementary', { name: TP_STRINGS.landmark }).count(),
    sheet: await page.evaluate(() => [...document.styleSheets].some((sh) => [...sh.cssRules].some((r) => r.cssText.includes('oscar-guide')))),
    chunks: req.paths().filter((p) => GUIDE_ASSET.test(p)).map((p) => p.split('/').pop()!).sort(),
    readerCalls: await page.evaluate(() => (window as unknown as { __readerCalls: number }).__readerCalls),
  }
  await context.close()
  return { facts, mountMs }
}

test('?oscar=0 and ?mode=exam: no widget node, no landmark, no guide style sheet, no guide chunk requested, and the bench is never read by the guide; the control run has all of them', async ({ browser }) => {
  // The control: the guide mounted. Everything the absence checks rely on is asserted PRESENT here first.
  const control = await probe(browser, '', { mounted: true, quietMs: 2000 })
  expect(control.facts.nodes, 'control: the widget node is there').toBe(1)
  expect(control.facts.landmark, 'control: the landmark is there').toBe(1)
  expect(control.facts.sheet, 'control: the guide style sheet is loaded').toBe(true)
  expect(control.facts.chunks.filter((c) => c.startsWith('mount-')), 'control: the mount chunk was requested').toHaveLength(1)
  expect(control.facts.chunks.filter((c) => c.startsWith('creationBridge-')), 'control: the bridge chunk was requested').toHaveLength(1)
  expect(control.facts.chunks.filter((c) => c.endsWith('.css')).length, 'control: the guide sheets were requested').toBeGreaterThanOrEqual(2)
  expect(control.facts.readerCalls, 'control: the guide polls the bench (readers of the debug hook called in 2 s)').toBeGreaterThan(0)
  test.info().annotations.push({ type: 'control', description: `mounted after ${control.mountMs} ms; chunks ${control.facts.chunks.join(', ')}; ${control.facts.readerCalls} reader calls in 2 s` })

  // The silent runs: watched for 3 times as long as the control took to mount (at least 2.5 s), so a late mount would show.
  const quietMs = Math.max(2500, 3 * (control.mountMs ?? 0))
  for (const search of ['?oscar=0', '?mode=exam']) {
    const { facts } = await probe(browser, search, { mounted: false, quietMs })
    expect(facts, search).toEqual({ nodes: 0, landmark: 0, sheet: false, chunks: [], readerCalls: 0 })
  }
})

test('?mode=exam: the creation page itself is up (a device placed through it) and the guide is absent', async ({ browser }) => {
  const s = await session(browser, '?mode=exam')
  await s.page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [2, 0, 8] }))
  await quietWindow(s.page, 2000)
  expect(await s.page.evaluate(() => window.__creation!.design().rig.instances.length), 'the creation page works').toBe(1)
  await expect(s.page.getByTestId('status-bar')).toBeVisible()
  expect(await s.page.evaluate(() => document.querySelectorAll('.oscar-guide, [data-oscar-root], .oscar-bubble, .oscar-icon').length)).toBe(0)
  expect(s.req.paths().filter((p) => GUIDE_ASSET.test(p)), 'no guide chunk requested').toEqual([])
  await s.close()
})

// ── axe ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('axe: no serious or critical violation with the bubble open (empty bench, an error with a ring, the demonstration)', async ({ page }) => {
  await boot(page)
  await openBubble(page)
  let r = await seriousViolations(page)
  expect(r.bad, 'bubble open on an empty bench').toEqual([])
  expect(r.guideContrastNodes, 'axe looked at the guide\'s text contrast (it is not blind)').toBeGreaterThan(0)

  await spawnPhantomError(page)
  await nextStepSays(page, RULE('R4').teach_fr)
  await expect(ring(page)).toBeVisible()
  r = await seriousViolations(page)
  expect(r.bad, 'bubble open on an error with the ring on the port').toEqual([])

  // a bench with a start chip and the demonstration cable drawn (the bubble about the old bench is closed first: a change closes it, by design)
  await icon(page).click()
  await expect(bubble(page)).toBeHidden()
  await page.evaluate(() => {
    const c = window.__creation!
    for (const id of ['u87', 'isa']) c.dispatch({ type: 'REMOVE', instanceId: id })
  })
  await spawnMicAndConsole(page)
  await startChipOffered(page)
  await chip(page, 'Lancer le parcours proposé').click()
  await chip(page, 'Montre-moi').click()
  await expect(page.locator('.oscar-cable')).not.toHaveAttribute('hidden', /.*/)
  r = await seriousViolations(page)
  expect(r.bad, 'bubble open on a step with the demonstration cable').toEqual([])
  test.info().annotations.push({ type: 'axe', description: `color-contrast nodes of the guide looked at: ${r.guideContrastNodes}` })
})

// ── the cost of following a device ───────────────────────────────────────────────────────────────────────────────────

test('the ring follows a control through 20 window resizes: the heavy device projection is not used, the guide asks rarely, and the cost is measured', async ({ page, browser }) => {
  await boot(page)
  await spawnPhantomError(page)
  await openBubble(page)
  const input = page.getByRole('textbox', { name: /Poser une question/ })
  await input.fill('comment activer l’alimentation fantôme')
  await input.press('Enter')
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Alimentation fantôme » : étape 1 sur 1.')
  await expect(ring(page)).toBeVisible()
  await settleRenders(page)

  // cost of one resolution of each seam, on this machine (software GL in headless Chromium)
  const timing = await page.evaluate(() => {
    const c = window.__creation!
    const time = (f: () => unknown): { max: number; avg: number } => {
      f()
      const t: number[] = []
      for (let i = 0; i < 20; i++) {
        const a = performance.now()
        f()
        t.push(performance.now() - a)
      }
      return { max: Math.max(...t), avg: t.reduce((p, q) => p + q, 0) / t.length }
    }
    return {
      deviceScreen: time(() => c.deviceScreen('isa')),
      portScreen: time(() => c.portScreen({ instance: 'u87', port: 'out-xlr' })),
      controlScreen: time(() => c.controlScreen('isa', 'phantom-48v')),
    }
  })
  const fmt = (t: { max: number; avg: number }): string => `avg ${t.avg.toFixed(2)} ms, max ${t.max.toFixed(2)} ms`
  const line = `per call, 20 calls: deviceScreen ${fmt(timing.deviceScreen)}; portScreen ${fmt(timing.portScreen)}; controlScreen ${fmt(timing.controlScreen)}`
  test.info().annotations.push({ type: 'seam-cost', description: line })
  console.log(`[guide cost] ${line}`)

  const watchPage = async (p: Page): Promise<void> => {
    await p.evaluate(() => {
      const w = window as unknown as { __lt: number[]; __calls: Record<string, number> }
      w.__lt = []
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__lt.push(e.duration)
      }).observe({ entryTypes: ['longtask'] })
      w.__calls = { deviceScreen: 0, portScreen: 0, controlScreen: 0 }
      const c = window.__creation as unknown as Record<string, (...a: unknown[]) => unknown>
      for (const k of Object.keys(w.__calls)) {
        const f = c[k].bind(c)
        c[k] = (...a: unknown[]) => {
          w.__calls[k]++
          return f(...a)
        }
      }
    })
  }
  const resizeLoop = async (p: Page): Promise<{ ms: number; long: number[]; calls: Record<string, number> }> => {
    await watchPage(p)
    const t0 = Date.now()
    for (let i = 0; i < 20; i++) await p.setViewportSize(i % 2 ? { width: 1280, height: 800 } : { width: 1200, height: 760 })
    const ms = Date.now() - t0
    await quietWindow(p, 700) // the widget's own refreshes after the last resize
    const r = await p.evaluate(() => {
      const w = window as unknown as { __lt: number[]; __calls: Record<string, number> }
      return { long: w.__lt, calls: w.__calls }
    })
    return { ms, long: r.long, calls: r.calls }
  }
  const withGuide = await resizeLoop(page)
  // the ring is on the control (or the device holding it) at the final size
  await expect
    .poll(
      async () => {
        const p = await page.evaluate(() => window.__creation!.controlScreen('isa', 'phantom-48v'))
        const b = await ring(page).boundingBox()
        return p === null || b === null ? Number.POSITIVE_INFINITY : dist(centre(b), p)
      },
      { message: 'after 20 resizes the ring is on the phantom switch' },
    )
    .toBeLessThanOrEqual(12)

  // the same loop on the same rig with the guide off
  const off = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const p2 = await off.newPage()
  track(p2)
  await boot(p2, { search: '?oscar=0' })
  await spawnPhantomError(p2)
  await settleRenders(p2)
  const without = await resizeLoop(p2)
  await off.close()

  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0)
  const report = `20 resizes in ${withGuide.ms} ms with the guide (long tasks: ${withGuide.long.length}, ${sum(withGuide.long).toFixed(0)} ms in total; seam calls ${JSON.stringify(withGuide.calls)}) against ${without.ms} ms without it (long tasks: ${without.long.length}, ${sum(without.long).toFixed(0)} ms)`
  test.info().annotations.push({ type: 'resize-cost', description: report })
  console.log(`[guide cost] ${report}`)
  // The shipped flows never ask for the heavy seam; the widget asks for the cheap ones at most once per cache window (250 ms) per anchor.
  expect(withGuide.calls.deviceScreen, 'no device projection while a control is followed').toBe(0)
  const windows = Math.ceil((withGuide.ms + 700) / 250) + 2
  expect(withGuide.calls.controlScreen + withGuide.calls.portScreen, 'cheap projections are bounded by the cache window').toBeLessThanOrEqual(windows * 2)
})
