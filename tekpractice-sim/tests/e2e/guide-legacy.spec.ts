/**
 * The in-page guide (Oscar) on the legacy level page (`?level=a1|b1|c1|d1`), on the production build.
 *
 * What is proven here, and only here (the unit tests have no DOM):
 *  - the icon on a practice level, its accessible name, the keyboard path (Tab, Entrée, Échap), the landmark that holds it, axe with the bubble open;
 *  - the guide costs the page nothing at rest: 0 renders in 3 s, and a pinned set of extra listeners against the same page with `?oscar=0`;
 *  - the guide only reads: every call it makes on `window.__audioSim` is one of four readers, and `dispatch`, `hints` and the rest are never called by it;
 *  - exam surfaces stay silent: `mode=exam`, `level=sandbox`, `teacher.html`, `?legacy=1` alone, an unknown level, a `mode` key in any case: no node, no guide
 *    chunk requested, no call on the hook, the exam's timer and score unchanged against a run with `?oscar=0`;
 *  - the page's own « Conseils d'Oscar » toast and the rule toast are untouched, and the guide does not repeat them (it speaks only when asked, in French, from the
 *    catalog);
 *  - the guide quotes the app: the level's own objective, the first required connection in the checklist's own words, the rule's own text for an error.
 * No console error, no page error and no `guide:` warning during any test of this file.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import catalog from '../../content/catalog.json'
import a1 from '../../content/levels/a1.json'
import { TP_STRINGS } from '../../src/guide/strings'
import { quietWindow } from './waits'

test.use({ viewport: { width: 1280, height: 800 } })
// Software GL on a shared machine: every test boots a 3D page, several boot four or more. The default 60 s is for one page.
test.describe.configure({ timeout: 180_000 })

const RULE = (id: string) => catalog.rules.find((r) => r.id === id)!
const ICON_NAME = 'Oscar, assistant IA'
const IDLE_MS = 3000
const GUIDE_POLL_MS = 500

/** The window / document listeners the guide holds that the same page with `?oscar=0` does not (measured: these six; a seventh, or another kind, fails the test). */
const PAGE_LISTENERS = ['document click (capture)', 'document keydown', 'document visibilitychange', 'window oscar-guide:event', 'window resize', 'window scroll (capture)']
/** The only members of `window.__audioSim` the guide may call: the readers. */
const READERS = ['assets', 'deviceScreen', 'portScreen', 'state']

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
const CHAIN = a1.requiredChain as { from: Ref; to: Ref }[]
const OBJECTIVE = (a1 as unknown as { objective: string }).objective

const boot = async (page: Page, search = '?level=a1'): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/' + search)
  await page.waitForFunction(() => !!window.__audioSim)
}
const icon = (page: Page) => page.getByRole('button', { name: ICON_NAME, exact: true })
const bubble = (page: Page) => page.locator('.oscar-bubble')
const chip = (page: Page, name: string) => page.locator('.oscar-chips').getByRole('button', { name, exact: true })
const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')
const live = (page: Page): Promise<string> => page.locator('.oscar-live').innerText()
const liveLines = (page: Page): Promise<string[]> => page.locator('.oscar-live').evaluate((el) => [...el.children].map((c) => (c.textContent ?? '').trim()))
const guideNodes = (page: Page): Promise<number> => page.locator('.oscar-guide, [data-oscar-root]').count()

/** The guide starts after the page has booted and loads its own chunks: on a loaded machine that takes a few seconds, so the wait is longer than the default. */
const MOUNT_TIMEOUT = 30_000
const waitGuide = async (page: Page): Promise<void> => {
  await expect(icon(page)).toBeVisible({ timeout: MOUNT_TIMEOUT })
}
/**
 * The guide reads the level every 500 ms. A bubble about the level (a missing step, an error, a good chain) is closed by the next change it reads, by design: it
 * would be stale. So after the level is changed, the guide is given three polls to read it before a bubble is opened; a quiet window, not a wait for a state
 * (the guide has no observable « I have read it »).
 */
const guideSees = (page: Page): Promise<void> => quietWindow(page, GUIDE_POLL_MS * 3)
const openBubble = async (page: Page): Promise<void> => {
  await waitGuide(page)
  if (await bubble(page).isHidden()) {
    await guideSees(page)
    await icon(page).click()
  }
  await expect(bubble(page)).toBeVisible()
}
/** « Prochaine étape » until the bubble says `text`: the guide learns of a change at its next poll, so a click right after a change may still read the old level. */
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

const connect = (page: Page, i: number): Promise<void> => page.evaluate((c) => window.__audioSim!.dispatch({ type: 'CONNECT', a: c.from, b: c.to }), CHAIN[i])
const state = (page: Page) => page.evaluate(() => window.__audioSim!.state())
const portScreen = (page: Page, r: Ref) => page.evaluate((ref) => window.__audioSim!.portScreen(ref), r)

type Box = { x: number; y: number; width: number; height: number }
const centre = (b: Box): { x: number; y: number } => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y)
const insideViewport = (b: Box, w: number, h: number): boolean => b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5
/** The ring's centre is within `px` of the point the app itself projects for the port. */
const expectRingOnPort = async (page: Page, r: Ref, px = 12): Promise<void> => {
  await expect
    .poll(
      async () => {
        const p = await portScreen(page, r)
        const b = await ring(page).boundingBox()
        return p === null || b === null || (await ring(page).isHidden()) ? Number.POSITIVE_INFINITY : dist(centre(b), p)
      },
      { message: `the ring is within ${px} px of the app's projected point for ${r.instance} ${r.port}`, timeout: 10_000 },
    )
    .toBeLessThanOrEqual(px)
}

/** Every request of a context, as paths. */
const recordRequests = (page: Page): { paths: () => string[] } => {
  const urls: string[] = []
  page.context().on('request', (r) => urls.push(r.url()))
  return { paths: () => [...new Set(urls.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:')).map((u) => new URL(u).pathname))] }
}
/** A page in a context of its own (nothing cached or shared with the test's page): the requests it makes are all its own. */
const session = async (browser: Browser, search: string, o: { hook?: boolean; init?: (page: Page) => Promise<unknown> } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  track(page)
  const req = recordRequests(page)
  if (o.init) await o.init(page)
  if (o.hook === false) await page.goto('/' + search)
  else await boot(page, search)
  return { page, req, close: () => context.close() }
}

/**
 * The calls made on `window.__audioSim`, counted from outside: the object the app assigns is replaced by one whose methods count and then call the real ones
 * (patched in before any script runs). A call is attributed to the guide when the stack that made it passes through one of the guide's lazy chunks
 * (`mount-*.js`, `legacyBridge-*.js`); the others are the app's own and the test's.
 */
const spyOnHook = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __guideCalls: Record<string, number>; __allCalls: Record<string, number> }
    w.__guideCalls = {}
    w.__allCalls = {}
    let real: Record<string, unknown> | undefined
    Object.defineProperty(window, '__audioSim', {
      configurable: true,
      get: () => real,
      set: (v: Record<string, unknown>) => {
        const copy: Record<string, unknown> = {}
        for (const [k, f] of Object.entries(v)) {
          copy[k] =
            typeof f === 'function'
              ? function (this: unknown, ...a: unknown[]) {
                  w.__allCalls[k] = (w.__allCalls[k] ?? 0) + 1
                  if (/\/assets\/(mount|legacyBridge)-[\w-]+\.js/.test(new Error().stack ?? '')) w.__guideCalls[k] = (w.__guideCalls[k] ?? 0) + 1
                  return (f as (...x: unknown[]) => unknown).apply(v, a)
                }
              : f
        }
        real = copy
      },
    })
  })
const guideCalls = (page: Page) => page.evaluate(() => (window as unknown as { __guideCalls: Record<string, number> }).__guideCalls)

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

test('?level=a1 shows the icon: a button named « Oscar, assistant IA », inside a landmark, on screen, over nothing of the page', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  await expect(icon(page)).toHaveAccessibleName(ICON_NAME)
  await expect(icon(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(bubble(page)).toBeHidden()
  await expect(page.getByRole('complementary', { name: TP_STRINGS.landmark }).getByRole('button', { name: ICON_NAME, exact: true })).toBeVisible()
  expect(await guideNodes(page), 'one widget').toBe(1)
  const box = (await icon(page).boundingBox())!
  expect(insideViewport(box, 1280, 800)).toBe(true)
  // the icon is what is under the pointer at its centre, and it covers none of the page's own controls (the level card, the toolbar, the exit link)
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.oscar-icon') != null, centre(box))).toBe(true)
  for (const sel of ['#hud-objectives', '#site-link', '#hud-toasts']) {
    const other = await page.locator(sel).first().boundingBox()
    if (other === null) continue
    const apart = box.x >= other.x + other.width || box.x + box.width <= other.x || box.y >= other.y + other.height || box.y + box.height <= other.y
    expect(apart, `the icon does not cover ${sel}`).toBe(true)
  }
  // the exam link and the level links of the page are still the page's own
  await expect(page.locator('#hud-levels a.current')).toHaveText('A1')
})

test('keyboard: Tab reaches the icon from the controls of the page, Entrée opens the bubble, Échap closes it and keeps the focus on the icon', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  // The page keeps Tab for itself while the focus is on the page or its canvas (Focus & Patch cycles the devices): a keyboard user is in the page's own controls
  // first (its level card), and Tab goes on through them to the icon, which comes last in the page.
  await page.locator('#hud-levels a').first().focus()
  let presses = 0
  for (; presses < 60; presses++) {
    await page.keyboard.press('Tab')
    if (await icon(page).evaluate((el) => el === document.activeElement)) break
  }
  expect(presses, 'the icon is reached by Tab').toBeLessThan(60)
  test.info().annotations.push({ type: 'tab-presses', description: `${presses + 1} Tab presses from the page to the icon` })
  await page.keyboard.press('Enter')
  await expect(bubble(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bubble(page)).toBeHidden()
  await expect(icon(page)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(bubble(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bubble(page)).toBeHidden()
})

// ── cost at rest ─────────────────────────────────────────────────────────────────────────────────────────────────────

test(`idle for ${IDLE_MS} ms adds 0 renders against ?oscar=0; the listeners differ by exactly the pinned ones; the guide never calls a method that is not a reader`, async ({ page, browser }) => {
  await trackPageListeners(page)
  await spyOnHook(page)
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
  await waitGuide(page)
  const renders = () => page.evaluate(() => window.__audioSim!.renders!())
  const rafTicks = () => page.evaluate(() => (window as unknown as { __rafTicks: number }).__rafTicks)
  // the page's frames settle first (models and shaders land late)
  let last = -1
  for (let i = 0; i < 40; i++) {
    const n = await renders()
    if (n === last) break
    last = n
    await page.waitForTimeout(700)
  }
  const idle = async (what: string): Promise<number> => {
    const before = await renders()
    const ticks = await rafTicks()
    await quietWindow(page, IDLE_MS)
    expect((await rafTicks()) - ticks, `animation frames the page ran in ${IDLE_MS} ms (the window was not frozen) ${what}`).toBeGreaterThan(20)
    return (await renders()) - before
  }
  expect(await idle('with the bubble closed'), 'renders in 3 s with the guide, bubble closed').toBe(0)
  await icon(page).click()
  await expect(bubble(page)).toBeVisible()
  await quietWindow(page, 800)
  expect(await idle('with the bubble open'), 'renders in 3 s with the guide, bubble open').toBe(0)
  // a resize invalidates the scheduler: the loop is alive and renders() sees it (so a 0 above is not a stalled page)
  const n = await renders()
  await page.evaluate(() => void window.dispatchEvent(new Event('resize')))
  await expect.poll(renders, { message: 'a forced render is counted' }).toBeGreaterThan(n)

  // what the guide called on the hook, over the whole run: the readers, and only them
  const calls = await guideCalls(page)
  test.info().annotations.push({ type: 'guide-calls', description: JSON.stringify(calls) })
  expect(Object.keys(calls).sort(), 'the members of window.__audioSim the guide called').toEqual(expect.arrayContaining(['assets', 'state']))
  for (const name of Object.keys(calls)) expect(READERS, `${name} is not a reader`).toContain(name)
  expect(calls.hints, 'the guide never asks hints()').toBeUndefined()
  expect(calls.dispatch, 'the guide never dispatches').toBeUndefined()

  // the same page with the kill switch
  const withGuide = await pageListeners(page)
  const off = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const p2 = await off.newPage()
  track(p2)
  await trackPageListeners(p2)
  await boot(p2, '?level=a1&oscar=0')
  await quietWindow(p2, 1500)
  let last2 = -1
  for (let i = 0; i < 40; i++) {
    const m = await p2.evaluate(() => window.__audioSim!.renders!())
    if (m === last2) break
    last2 = m
    await p2.waitForTimeout(700)
  }
  const r0 = await p2.evaluate(() => window.__audioSim!.renders!())
  await quietWindow(p2, IDLE_MS)
  expect((await p2.evaluate(() => window.__audioSim!.renders!())) - r0, 'renders in 3 s with ?oscar=0').toBe(0)
  const without = await pageListeners(p2)
  await off.close()
  // the function ids differ between two pages: compare by (target, type, capture), counted
  const tally = (keys: string[]): Map<string, number> => {
    const m = new Map<string, number>()
    for (const k of keys) {
      const [t, type, , cap] = k.split('|')
      const name = `${t} ${type}${cap === 'true' ? ' (capture)' : ''}`
      m.set(name, (m.get(name) ?? 0) + 1)
    }
    return m
  }
  const a = tally(withGuide)
  const b = tally(without)
  const extra = [...a].flatMap(([k, c]) => Array.from({ length: c - (b.get(k) ?? 0) }, () => k)).filter(Boolean)
  const missing = [...b].flatMap(([k, c]) => Array.from({ length: c - (a.get(k) ?? 0) }, () => k)).filter(Boolean)
  test.info().annotations.push({ type: 'listeners', description: `window/document ${withGuide.length} vs ${without.length}; extra: ${extra.join(', ')}` })
  console.log(`[guide listeners, legacy] window/document ${withGuide.length} vs ${without.length} (oscar=0); extra with the guide: ${extra.join(', ')}`)
  expect(missing, 'the guide removes no listener of the app').toEqual([])
  expect(extra.sort(), 'the window / document listeners the guide adds, and only these').toEqual(PAGE_LISTENERS)
})

// ── exam and the surfaces that stay silent ───────────────────────────────────────────────────────────────────────────

/** The guide's lazy chunks and sheets, by name (measured on the build: mount, legacyBridge, theme and guide, a .js or .css each; the legacy page never loads the Mode Création bridge). */
const GUIDE_ASSET = /\/assets\/(mount|legacyBridge|creationBridge|theme|guide)-[\w-]+\.(js|css)$/
interface Facts {
  nodes: number
  landmark: number
  sheet: boolean
  chunks: string[]
  guideCalls: Record<string, number>
}
/** A page in a context of its own, watched for `quietMs` after the page is up. `mounted` waits for the icon first (the control run). */
const probe = async (browser: Browser, search: string, o: { mounted: boolean; quietMs: number }): Promise<{ facts: Facts; mountMs: number | null }> => {
  const s = await session(browser, search, { init: spyOnHook })
  const t0 = Date.now()
  let mountMs: number | null = null
  if (o.mounted) {
    await waitGuide(s.page)
    mountMs = Date.now() - t0
  }
  await quietWindow(s.page, o.quietMs)
  const facts: Facts = {
    nodes: await guideNodes(s.page),
    landmark: await s.page.getByRole('complementary', { name: TP_STRINGS.landmark }).count(),
    sheet: await s.page.evaluate(() => [...document.styleSheets].some((sh) => [...sh.cssRules].some((r) => r.cssText.includes('oscar-guide')))),
    chunks: s.req.paths().filter((p) => GUIDE_ASSET.test(p)).map((p) => p.split('/').pop()!).sort(),
    guideCalls: await guideCalls(s.page),
  }
  await s.close()
  return { facts, mountMs }
}

test('?level=a1&mode=exam shows no guide node, makes no network call for it, calls nothing on the hook, and the exam timer and score are unchanged versus a run with ?oscar=0 (same score)', async ({ browser }) => {
  // The control: the guide mounted on the practice level. Everything the absence checks rely on is asserted PRESENT here first.
  const control = await probe(browser, '?level=a1', { mounted: true, quietMs: 2000 })
  expect(control.facts.nodes, 'control: the widget node is there').toBe(1)
  expect(control.facts.landmark, 'control: the landmark is there').toBe(1)
  expect(control.facts.sheet, 'control: the guide style sheet is loaded').toBe(true)
  expect(control.facts.chunks.filter((c) => c.startsWith('mount-')), 'control: the mount chunk was requested').toHaveLength(1)
  expect(control.facts.chunks.filter((c) => c.startsWith('legacyBridge-')), 'control: the legacy bridge chunk was requested').toHaveLength(1)
  expect(control.facts.chunks.filter((c) => c.endsWith('.css')).length, 'control: the guide sheets were requested').toBeGreaterThanOrEqual(2)
  expect(control.facts.guideCalls.state, 'control: the guide polls the level (state() called by the guide in 2 s)').toBeGreaterThan(0)
  test.info().annotations.push({ type: 'control', description: `mounted after ${control.mountMs} ms; chunks ${control.facts.chunks.join(', ')}; guide calls in 2 s ${JSON.stringify(control.facts.guideCalls)}` })

  // The silent runs: watched for 3 times as long as the control took to mount (at least 2.5 s), so a late mount would show.
  const quietMs = Math.max(2500, 3 * (control.mountMs ?? 0))
  const silent = { nodes: 0, landmark: 0, sheet: false, chunks: [], guideCalls: {} }
  for (const search of ['?level=a1&mode=exam', '?level=a1&oscar=0']) {
    const { facts } = await probe(browser, search, { mounted: false, quietMs })
    expect(facts, search).toEqual(silent)
  }

  // The same scripted play in the exam, with the guide's gates open and with `?oscar=0`: a refused connect, then the whole chain.
  const play = async (search: string) => {
    const s = await session(browser, search, { init: spyOnHook })
    await s.page.evaluate(() => window.localStorage.clear())
    await expect(s.page.locator('#exam-timer')).toBeVisible()
    const first = await s.page.locator('#exam-timer').innerText()
    await s.page.evaluate(() => {
      const sim = window.__audioSim!
      sim.dispatch({ type: 'CONNECT', a: { instance: 'sm57-1', port: 'out-xlr' }, b: { instance: 'k12-1', port: 'in-line-a' } })
      for (const c of sim.level.requiredChain) sim.dispatch({ type: 'CONNECT', a: c.from, b: c.to })
    })
    await expect(s.page.locator('#exam-report')).toBeVisible()
    await quietWindow(s.page, 1200)
    const out = {
      score: ((await s.page.locator('.exam-card h2').textContent()) ?? '').trim(),
      detail: ((await s.page.locator('.exam-card').innerText()) ?? '').replace(/\d+:\d\d/g, 'T'),
      exams: await s.page.evaluate(() => (JSON.parse(window.localStorage.getItem('audio-sim/progress')!).exams as { levelId: string; score20: number; mistakes: number }[]).map((e) => [e.levelId, e.score20, e.mistakes])),
      timerShown: /^\d+:\d\d$/.test(first.trim()),
      toast: ((await s.page.locator('.toast-error strong').first().textContent()) ?? '').trim(),
      nodes: await guideNodes(s.page),
      chunks: s.req.paths().filter((p) => GUIDE_ASSET.test(p)),
      guideCalls: await guideCalls(s.page),
    }
    await s.close()
    return out
  }
  const withGates = await play('?level=a1&mode=exam')
  const withoutGuide = await play('?level=a1&mode=exam&oscar=0')
  test.info().annotations.push({ type: 'exam', description: `score ${withGates.score} (gates open) vs ${withoutGuide.score} (?oscar=0)` })
  expect(withGates.score).toMatch(/^[\d.]+\/20$/)
  expect(withGates.score, 'the exam score is the same with and without the guide').toBe(withoutGuide.score)
  expect(withGates.exams, 'the stored exam score is the same').toEqual(withoutGuide.exams)
  expect(withGates.detail, 'the report is the same').toBe(withoutGuide.detail)
  expect(withGates.toast, 'the refused connect says nothing of the rule in the exam, with and without the guide').toBe('Connexion refusée')
  expect(withoutGuide.toast).toBe('Connexion refusée')
  expect(withGates.timerShown && withoutGuide.timerShown, 'the exam timer shows a clock in both runs').toBe(true)
  for (const r of [withGates, withoutGuide]) {
    expect(r.nodes).toBe(0)
    expect(r.chunks, 'no guide chunk was requested').toEqual([])
    expect(r.guideCalls, 'the guide called nothing on the hook').toEqual({})
  }
  // and the two requests of the whole page are the same set: the guide added none
  const paths = async (search: string): Promise<string[]> => {
    const s = await session(browser, search)
    await quietWindow(s.page, 2000)
    const p = s.req.paths()
    await s.close()
    return p
  }
  expect(await paths('?level=a1&mode=exam')).toEqual(await paths('?level=a1&mode=exam&oscar=0'))
})

test('?level=sandbox shows no guide node', async ({ browser }) => {
  const s = await session(browser, '?level=sandbox', { init: spyOnHook })
  await quietWindow(s.page, 2500)
  expect(await guideNodes(s.page)).toBe(0)
  expect(s.req.paths().filter((p) => GUIDE_ASSET.test(p)), 'no guide chunk requested').toEqual([])
  expect(await guideCalls(s.page), 'the guide called nothing on the hook').toEqual({})
  // the sandbox's own hints switch flips hints(): it never decides the guide's mode, which comes from the address
  await s.page.evaluate(() => window.__audioSim!.hints())
  expect(await guideNodes(s.page)).toBe(0)
  await s.close()
})

test('teacher.html shows no guide node', async ({ browser }) => {
  const s = await session(browser, 'teacher.html', { hook: false })
  await expect(s.page.locator('body')).toBeVisible()
  await quietWindow(s.page, 2000)
  expect(await guideNodes(s.page)).toBe(0)
  expect(s.req.paths().filter((p) => GUIDE_ASSET.test(p)), 'no guide chunk requested').toEqual([])
  await s.close()
})

test('?legacy=1 alone shows no guide node (the dashboard has no level)', async ({ browser }) => {
  const s = await session(browser, '?legacy=1', { hook: false })
  await expect(s.page.locator('body')).toBeVisible()
  await quietWindow(s.page, 2500)
  expect(await guideNodes(s.page)).toBe(0)
  expect(s.req.paths().filter((p) => GUIDE_ASSET.test(p)), 'no guide chunk requested').toEqual([])
  await s.close()
})

test('an unknown level, a mode key in any case, and a second level key show no guide node and request no guide chunk', async ({ browser }) => {
  for (const search of ['?level=zz', '?level=a1&MODE=exam', '?level=a1&Mode=', '?level=a1&%6Dode=exam', '?level=a1&level=b1', '?level=A1']) {
    const s = await session(browser, search, { hook: false, init: spyOnHook })
    await s.page.waitForFunction(() => !!window.__audioSim, undefined, { timeout: 20_000 }).catch(() => undefined)
    await quietWindow(s.page, 2500)
    expect(await guideNodes(s.page), search).toBe(0)
    expect(s.req.paths().filter((p) => GUIDE_ASSET.test(p)), `${search}: no guide chunk requested`).toEqual([])
    expect(await guideCalls(s.page), `${search}: the guide called nothing on the hook`).toEqual({})
    await s.close()
  }
})

// ── the page's own coach and the guide ───────────────────────────────────────────────────────────────────────────────

test('in a1 the existing coach toast and its « Pourquoi ? » button still work and the guide does not duplicate the toast text', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  await guideSees(page)
  const r2 = RULE('R2')
  // a wrong cable: the page's own toast says the rule (its English title and explanation) and « Conseil d'Oscar » comes with it
  await page.evaluate(() =>
    window.__audioSim!.dispatch({ type: 'CONNECT', a: { instance: 'sm57-1', port: 'out-xlr' }, b: { instance: 'k12-1', port: 'in-line-a' } }),
  )
  const toast = page.locator('.toast-error')
  await expect(toast).toBeVisible()
  await expect(toast.locator('strong')).toHaveText(r2.title)
  await expect(toast).toContainText(r2.teach)
  const tip = page.locator('.toast-coach')
  await expect(tip, 'the page\'s own coach toast appears').toBeVisible()
  await expect(tip.locator('strong')).toHaveText('Conseil d’Oscar')
  const tipText = ((await tip.innerText()) ?? '').trim()
  // « Pourquoi ? »: present only when the build holds a coach key (none here), and then it works
  const why = toast.getByRole('button', { name: 'Pourquoi ?' })
  const whyCount = await why.count()
  test.info().annotations.push({ type: 'pourquoi', description: whyCount === 0 ? 'no coach key in this build: the page offers no « Pourquoi ? » button (as without the guide)' : 'button present' })
  if (whyCount > 0) {
    // The coach's request never leaves the machine: a stub answers (a sentence the grounding check rejects, which the page shows as its own calm message).
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    await page.route('https://api.anthropic.com/**', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: cors })
        : route.fulfill({
            status: 200,
            headers: { ...cors, 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'msg_stub', type: 'message', role: 'assistant', model: 'stub', content: [{ type: 'text', text: 'stub' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }),
          }),
    )
    await why.click()
    await expect(toast.locator('.toast-ai-zone')).toBeVisible()
    await expect(toast.getByRole('button', { name: 'Fermer' })).toBeVisible({ timeout: 15_000 })
  }
  // the guide said nothing: no bubble, and none of the page's toast words inside the guide's landmark
  await quietWindow(page, 1500)
  await expect(bubble(page)).toBeHidden()
  const inGuide = await page.getByRole('complementary', { name: TP_STRINGS.landmark }).innerText()
  for (const t of [r2.title, r2.teach, tipText, 'Conseil d’Oscar']) expect(inGuide.includes(t), `the guide does not say: ${t.slice(0, 40)}`).toBe(false)
  // the page's text holds the toast's sentence once: the guide is not a second copy
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.split(r2.teach).length - 1, 'the rule explanation is on the page once (the toast)').toBe(1)
  // the toast and the tip are the page's, in its container, untouched by the guide
  expect(await toast.evaluate((el) => el.closest('#hud-toasts') != null)).toBe(true)
  expect(await tip.evaluate((el) => el.closest('#hud-toasts') != null)).toBe(true)
})

test('asked, the guide answers in French from the catalog: an error is the rule\'s own French title-and-explanation, the ring on the faulty port, the page\'s English toast not repeated', async ({ page }) => {
  await boot(page, '?level=d1')
  await waitGuide(page)
  await guideSees(page)
  await page.evaluate(() => {
    const c = window.__audioSim!.level.requiredChain[0]
    window.__audioSim!.dispatch({ type: 'CONNECT', a: c.from, b: c.to })
  })
  const st = await state(page)
  expect(st.violations.map((v) => v.ruleId)).toEqual(['R4'])
  const r4 = RULE('R4')
  const toast = page.locator('.toast-warning, .toast-error').first()
  await expect(toast).toContainText(r4.teach) // the page's own toast, English
  await nextStepSays(page, r4.teach_fr)
  expect(await liveLines(page), 'the bubble says the rule\'s own French explanation under the generic head line').toEqual(['Correction à apporter', r4.teach_fr])
  expect(await live(page)).not.toContain(r4.teach)
  expect(await live(page)).not.toContain(r4.title)
  expect(await chip(page, 'Lancer le parcours proposé').count(), 'no start chip on a fix').toBe(0)
  await expectRingOnPort(page, st.violations[0].subjects[0])
  // asking changed nothing in the level
  expect(await state(page)).toEqual(st)
})

// ── the flows ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('« Prochaine étape » at the start says the first required connection in the checklist\'s own words; « Lire l\'objectif » quotes the level\'s own objective and ends when the card is read', async ({ page }) => {
  await boot(page)
  await openBubble(page)
  const firstRow = (await page.locator('#hud-checklist li').first().innerText()).trim()
  await nextStepSays(page, firstRow)
  expect(await liveLines(page)).toContain(`${TP_STRINGS.verdict.nextLink} ${firstRow}`)
  await expect(chip(page, 'Lancer le parcours proposé')).toBeVisible()
  await chip(page, 'Lancer le parcours proposé').click()
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Lire l’objectif » : étape 1 sur 1.')
  expect(await live(page)).toContain(`« ${OBJECTIVE} »`)
  // the ring is on the level card
  await expect(ring(page)).toBeVisible()
  const card = (await page.locator('#hud-objectives').boundingBox())!
  const r = (await ring(page).boundingBox())!
  expect(Math.abs(r.x - card.x), 'ring left edge on the card').toBeLessThan(16)
  expect(Math.abs(r.y - card.y), 'ring top edge on the card').toBeLessThan(16)
  // reading it (a click inside the card) ends the step
  await page.locator('#hud-objectives h1').click()
  await expect(page.locator('.oscar-live')).toContainText('terminé')
  expect(await state(page), 'nothing changed in the level').toMatchObject({ connectedRequired: 0 })
})

test('« Premier câble »: the ring is on the first missing connection\'s output port, « Montre-moi » draws a ghost cable, the guide performs nothing, and the next one follows the level', async ({ page }) => {
  await boot(page)
  await openBubble(page)
  await page.getByRole('textbox', { name: /Poser une question/ }).fill('comment faire le premier câble')
  await page.getByRole('textbox', { name: /Poser une question/ }).press('Enter')
  await expect(page.locator('.oscar-live')).toContainText('Parcours « Premier câble » : étape 1 sur 2.')
  await expect(ring(page)).toBeVisible()
  await expectRingOnPort(page, CHAIN[0].from)
  await chip(page, 'Montre-moi').click()
  await expect(page.locator('.oscar-cable')).not.toHaveAttribute('hidden', /.*/)
  expect(await state(page), 'the guide draws nothing in the level').toMatchObject({ connectedRequired: 0 })
  await quietWindow(page, 1500)
  expect(await state(page)).toMatchObject({ connectedRequired: 0 })
  // the learner draws the cable (through the page's own intent): the step is done by the derived connect, the ring goes to the checklist
  await connect(page, 0)
  await expect(page.locator('.oscar-live')).toContainText('étape 2 sur 2', { timeout: 10_000 })
  await expect(page.locator('#hud-checklist li.done')).toHaveCount(1)
  await page.locator('#hud-objectives h1').click()
  await expect(page.locator('.oscar-live')).toContainText('terminé')
  // the next required connection is now the one asked for
  await guideSees(page)
  await nextStepSays(page, (await page.locator('#hud-checklist li').nth(1).innerText()).trim())
})

test('a won level: « Prochaine étape » says the chain is complete and the check covers only the app\'s own controls', async ({ page }) => {
  await boot(page)
  await waitGuide(page)
  for (let i = 0; i < CHAIN.length; i++) await connect(page, i)
  await expect.poll(async () => (await state(page)).won).toBe(true)
  await expect(page.locator('#hud-win .win-card')).toBeVisible()
  await nextStepSays(page, TP_STRINGS.verdict.legacyWon)
  // the win card is still the page's, and still readable
  await expect(page.locator('#hud-win .win-card')).toBeVisible()
})

// ── layout and accessibility ─────────────────────────────────────────────────────────────────────────────────────────

test('phone width: the icon and the open bubble are inside the viewport and the icon is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await boot(page)
  await waitGuide(page)
  const box = (await icon(page).boundingBox())!
  expect(insideViewport(box, 375, 812)).toBe(true)
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.oscar-icon') != null, centre(box))).toBe(true)
  await icon(page).click()
  await expect(bubble(page)).toBeVisible()
  expect(insideViewport((await bubble(page).boundingBox())!, 375, 812)).toBe(true)
})

test('axe: the guide adds no serious or critical violation with the bubble open (a fresh level, an error with a ring, a flow step); the page has its own, the same without it', async ({ page, browser }) => {
  // What the page has by itself, without the guide (the kill switch): on a fresh level and with an error on screen. These are not the guide's.
  const base = await page.context().newPage()
  track(base)
  await boot(base, '?level=a1&oscar=0')
  await quietWindow(base, 1500)
  const own = new Set((await seriousViolations(base)).bad.map((v) => v.split(' ')[0]))
  await boot(base, '?level=d1&oscar=0')
  await connect2(base)
  await quietWindow(base, 1500)
  for (const v of (await seriousViolations(base)).bad) own.add(v.split(' ')[0])
  await base.close()
  test.info().annotations.push({ type: 'page-own-axe', description: `serious or critical rules the page has without the guide: ${[...own].join(', ') || 'none'}` })
  const theGuides = (bad: string[]): string[] => bad.filter((v) => /oscar/.test(v) || !own.has(v.split(' ')[0]))

  await boot(page)
  await openBubble(page)
  let r = await seriousViolations(page)
  expect(theGuides(r.bad), 'bubble open on a fresh level').toEqual([])
  expect(r.guideContrastNodes, 'axe looked at the text contrast of the guide (it is not blind)').toBeGreaterThan(0)
  await chip(page, 'Prochaine étape').click()
  await chip(page, 'Lancer le parcours proposé').click()
  await expect(ring(page)).toBeVisible()
  r = await seriousViolations(page)
  expect(theGuides(r.bad), 'bubble open on the objective step with the ring').toEqual([])

  // a context of its own: the guide keeps a running flow in the browser's storage, and a flow started on the first level must not be resumed here
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  const p2 = await ctx2.newPage()
  track(p2)
  await boot(p2, '?level=d1')
  await openBubble(p2)
  await guideSees(p2)
  await connect2(p2)
  await nextStepSays(p2, RULE('R4').teach_fr)
  await expect(ring(p2)).toBeVisible()
  r = await seriousViolations(p2)
  expect(theGuides(r.bad), 'bubble open on an error with the ring on the port').toEqual([])
  test.info().annotations.push({ type: 'axe', description: `color-contrast nodes of the guide looked at: ${r.guideContrastNodes}` })
  await ctx2.close()
})
const connect2 = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const c = window.__audioSim!.level.requiredChain[0]
    window.__audioSim!.dispatch({ type: 'CONNECT', a: c.from, b: c.to })
  })
