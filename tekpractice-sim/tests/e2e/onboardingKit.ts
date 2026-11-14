/**
 * Shared helpers of the three T7.1 specs (onboarding-parity, onboarding-geometry, onboarding-keyboard): the entry routes through the REAL start screen, the bench
 * intents the tutorial's steps wait for, the real « Signal de test » menu route, rectangle arithmetic, and the in-page « every visible control » intersection.
 *
 * Why a module and not a copy per spec: the older onboarding specs each carry their own small `openFresh` / `takeTutorial` / `act`; three more copies of the same
 * thirty lines would be three more places to fix. This file holds no assertion about the product except where a helper says so (`controlsUnder` reports, never asserts).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect as baseExpect, test as baseTest, type Locator, type Page } from '@playwright/test'
import type { DesignId } from '../../src/design/packages'

/**
 * The three T7.1 specs assert on lazy chunks (the start screen, the drawer, Oscar, the models) that arrive late when six workers share one machine: web-first assertions and `expect.poll` wait
 * 15 s here instead of 5 s. A state wait, never a longer sleep: the assertion still returns the moment the state holds.
 */
export const expect = baseExpect.configure({ timeout: 15_000 })

/**
 * `test` with one addition: when a test fails, what the page itself reported is printed as a `PAGE-DIAG` line (page errors, console errors, failed requests, HTTP 4xx and 5xx). A lazy chunk or a
 * model that never arrives shows up here as a failed or refused request, which tells a stalled machine from a product defect.
 */
export const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    const log: string[] = []
    const inFlight = new Map<unknown, string>()
    page.on('request', (r) => inFlight.set(r, `${r.url().slice(-60)} since ${Date.now() % 1_000_000}`))
    page.on('requestfinished', (r) => inFlight.delete(r))
    page.on('requestfailed', (r) => inFlight.delete(r))
    page.on('pageerror', (e) => log.push(`pageerror ${e.message.slice(0, 160)}`))
    page.on('console', (m) => (m.type() === 'error' || (m.type() === 'warning' && /guide|oscar/i.test(m.text())) ? log.push(`console.${m.type()} ${m.text().slice(0, 160)}`) : undefined))
    page.on('requestfailed', (r) => (r.failure()?.errorText === 'net::ERR_ABORTED' ? undefined : log.push(`requestfailed ${r.url().slice(-70)} ${r.failure()?.errorText ?? ''}`))) // an abort is a navigation leaving a page: normal
    page.on('response', (r) => (r.status() >= 400 ? log.push(`http ${r.status()} ${r.url().slice(-70)}`) : undefined))
    await use(page)
    if (testInfo.status !== testInfo.expectedStatus) console.log('PAGE-DIAG', testInfo.title.slice(0, 70), JSON.stringify({ now: Date.now() % 1_000_000, log: log.slice(0, 14), requestsStillOpen: [...inFlight.values()].slice(0, 12) }))
  },
})

export const GUIDE_KEY = 'oscar-guide.onboarding.v1'
export const ONBOARDING_KEY = 'audio-sim/creation-onboarding.v1'

/** The four profiles, by their key on the start screen (spec 3). `focus` is the offer button that holds the focus. */
export const PROFILES = [
  { key: '1', id: 'decouvre', label: 'Je découvre', focus: 'tutorial' },
  { key: '2', id: 'etudie', label: 'J’étudie le son', focus: 'skip' },
  { key: '3', id: 'projet', label: 'Je monte un projet', focus: 'tutorial' },
  { key: '4', id: 'metier', label: 'Je travaille dans le son', focus: 'skip' },
] as const
export type ProfileKey = (typeof PROFILES)[number]['key']

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export const box = async (l: Locator): Promise<Rect> => (await l.boundingBox())!
/** Rectangle intersection (strict: touching edges do not intersect). Spec 11.3: rectangles, never centre points. */
export const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** The empty space between two rectangles in px: 0 when they touch or overlap, else the Euclidean distance between their nearest edges. */
export const gapBetween = (a: Rect, b: Rect): number => {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  return Math.hypot(dx, dy)
}
/** The centred box of `share` (0..1) of a rectangle's width and height: « the centre of the view is free » is measured on this box. */
export const centreBox = (r: Rect, share: number): Rect => ({ x: r.x + (r.width * (1 - share)) / 2, y: r.y + (r.height * (1 - share)) / 2, width: r.width * share, height: r.height * share })

// ── entry ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const start = (page: Page) => page.getByTestId('start-screen')

/**
 * Oscar mounts lazily (his chunks are fetched after the creation boot). With six browsers on one machine all fetching from ONE `vite preview` process, a request now and then hangs for 30 s and
 * more (the PAGE-DIAG lines of the T7.1 runs list fonts, lazy chunks and the Draco wasm still open after 20 to 38 s, no failed request, no console message), and a load of the page ends with no Oscar
 * (seen about once in 80 loads: `guideNodes: 0`, the hook up) and then no card either. The guide also gives up silently after waiting 10 s for the hook (`WAIT_LIMIT_MS`, src/guide/index.ts).
 * A page on an address where the guide is allowed is therefore loaded again, up to twice, when no icon is there after 20 s.
 * G14e (review C3): every retry is VISIBLE: a `RETRY` console line with the requests still open, and a `RETRY` annotation on the running test (in the report). The rate at which Oscar mounts
 * with NO retry is measured on its own (onboarding-mount-rate.spec.ts), so this retry cannot hide a guide that fails to mount for a learner.
 */
const guideExpected = (query: string): boolean => /^\?design=[1-5]$/.test(query)

/** A retry, made visible: the console line and an annotation of the running test (G14e, review C3). */
export function noteRetry(what: string): void {
  console.log(`RETRY ${what}`)
  try {
    baseTest.info().annotations.push({ type: 'RETRY', description: what.slice(0, 300) })
  } catch {
    // outside a test (a global setup): the console line stands alone
  }
}

/** The requests of a page that are still open, with their age: the evidence a stall leaves. */
export function openRequests(page: Page): { olderThan: (ms: number) => string[]; stop: () => void } {
  const open = new Map<unknown, { url: string; t: number }>()
  const onReq = (r: { url(): string }): void => void open.set(r, { url: r.url().slice(-60), t: Date.now() })
  const onDone = (r: unknown): void => void open.delete(r)
  page.on('request', onReq)
  page.on('requestfinished', onDone)
  page.on('requestfailed', onDone)
  return {
    olderThan: (ms) => {
      const now = Date.now()
      return [...open.values()].filter((o) => now - o.t >= ms).map((o) => `${o.url} open ${Math.round((now - o.t) / 1000)} s`)
    },
    stop: () => {
      page.off('request', onReq)
      page.off('requestfinished', onDone)
      page.off('requestfailed', onDone)
    },
  }
}

/** How long a request must have been open for a failure to count as a stall of the preview server (the PAGE-DIAG lines: 20 to 38 s). */
export const STALL_MS = 10_000
/**
 * The STALL SIGNATURE (G14e, review C3): the failure is a timeout (a wait that never came), AND at least one request of the page has been open for STALL_MS or more. An assertion that fails on a
 * value, or a timeout with nothing pending (the page is idle and simply not in the state asked for), is a FAULT: it is never retried, it fails at once.
 */
export function stallOf(e: unknown, open: { olderThan: (ms: number) => string[] }): string[] | null {
  const msg = String((e as Error)?.message ?? e)
  const timeout = (e as Error)?.name === 'TimeoutError' || /Timeout \d+ms exceeded|Timed out \d+ms waiting|timed out/i.test(msg)
  if (!timeout) return null
  const stalled = open.olderThan(STALL_MS)
  return stalled.length > 0 ? stalled : null
}
const guideMounted = (page: Page): Promise<boolean> =>
  page
    .locator('.oscar-icon')
    .first()
    .waitFor({ state: 'attached', timeout: 20_000 })
    .then(
      () => true,
      () => false,
    )

/**
 * The address with a storage that holds exactly `storage` (empty by default: a first visit), loaded fresh. (A fresh Playwright context is empty already; the reload makes the page see what was written.)
 * On a practice address the guide has to mount (see above), or the page is loaded again.
 */
export async function loadFresh(page: Page, query: string, storage: Record<string, string> = {}): Promise<void> {
  await page.goto('/' + query)
  await page.evaluate((entries) => {
    window.localStorage.clear()
    for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v)
  }, storage)
  for (let attempt = 1; ; attempt++) {
    const open = openRequests(page)
    try {
      await page.reload()
      await page.waitForFunction(() => !!window.__creation)
      if (!guideExpected(query) || (await guideMounted(page))) return
      const held = await page.evaluate(() => ({ hook: !!window.__creation, guideNodes: document.querySelectorAll('.oscar-guide, [data-oscar-root]').length }))
      noteRetry(`the guide did not mount within 20 s on ${query} (load ${attempt}): ${JSON.stringify(held)}; requests open: ${JSON.stringify(open.olderThan(0).slice(0, 8))}`)
      if (attempt >= 3) throw new Error(`the guide never mounted in three loads of ${query}`)
    } finally {
      open.stop()
    }
  }
}
/** An empty storage, then the address: a first visit. */
export const openFresh = (page: Page, query: string): Promise<void> => loadFresh(page, query)
/** The start screen is a lazy chunk: a key counts once the first profile button holds the focus (the same wait as onboarding-start.spec.ts). */
export async function waitStartScreen(page: Page): Promise<void> {
  await expect(start(page).getByRole('button', { name: PROFILES[0].label, exact: true })).toBeFocused({ timeout: 30_000 })
}
/** Real clicks: a profile button, then « Faire le tutoriel » (or « Passer, je connais »). Resolves once the first room is open. */
export async function enter(page: Page, id: DesignId, o: { profile?: ProfileKey; tutorial: boolean }): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const open = openRequests(page)
    try {
      await openFresh(page, `?design=${id}`)
      await waitStartScreen(page)
      const p = PROFILES.find((x) => x.key === (o.profile ?? '1'))!
      await start(page).getByRole('button', { name: p.label, exact: true }).click()
      await start(page).getByRole('button', { name: o.tutorial ? /^Faire le tutoriel/ : 'Passer, je connais' }).click()
      await page.waitForFunction(() => window.__creation?.place() === 'blank')
      // the profile opens the inventory drawer on its first tab (a lazy chunk): a state the callers can rely on, not a race
      await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true', { timeout: 20_000 })
      if (o.tutorial) await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 20_000 })
      return
    } catch (e) {
      // the entry is a first visit from an empty storage: doing it again is the same test, but ONLY when the failure is a stall (G14e, C3: `stallOf`). A fault fails at once.
      const stall = stallOf(e, open)
      if (stall === null || attempt >= 3) throw e
      noteRetry(`the entry on package ${id} (attempt ${attempt}): ${(e as Error).message.slice(0, 90).split('\n')[0]}; stalled: ${JSON.stringify(stall.slice(0, 6))}`)
    } finally {
      open.stop()
    }
  }
}

// ── the bench, through the app's own intents (the same path as the UI, `history.do`) ────────────────────────────────────────────

export const act = (page: Page, intents: unknown[]) =>
  page.evaluate((list) => {
    for (const i of list) {
      const r = window.__creation!.dispatch(i as never)
      if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
    }
  }, intents)
export const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
export const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
/** The intents of the ten steps of the standard tutorial, in step order (step k completes with `STEP_INTENTS[k - 1]`). */
export const STEP_INTENTS: readonly (readonly unknown[])[] = [
  [spawn('yamaha-ql1', 'ql1', 0)],
  [spawn('shure-sm58', 'sm58', 0.8)],
  [spawn('qsc-k12-2', 'k12', -1)],
  [connect('ql1', 'out-main-l', 'k12', 'in-line-a')],
  [connect('sm58', 'out-xlr', 'ql1', 'in-mic-1')],
  [{ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }],
  [spawn('multiprise-secteur', 'strip', 0.4)],
  [connect('strip', 'out-1', 'ql1', 'power-in')],
  [connect('strip', 'out-2', 'k12', 'power-in')],
]
/** The two cables of the playable model that the three-step route (package 5) unplugs. */
export const MODEL_LEFT = { a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }

/** The real route: Écoute, then Signal de test (mouse). Resolves when the test signal plays. */
export async function testSignal(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
  await waitTestSignalPlaying(page)
}
export const waitTestSignalPlaying = (page: Page) =>
  page.waitForFunction(() => window.__creation!.audioState().state === 'playing' && window.__creation!.audioState().source === 'test', null, { timeout: 30_000 })

/**
 * « Étape {k} sur {n} » on the card AND in Oscar's own announcement (a state wait: the guide's 500 ms poll has seen the bench, and the controller has moved to the step). Acting the moment the
 * card changes can outrun the controller (one profile-4 journey stayed on step 5 for 10 s after its cable under load); the announcement comes after the controller's step change.
 */
export async function waitStep(page: Page, k: number, n: number): Promise<void> {
  await expect(page.getByTestId('tutorial-step-count')).toHaveText(`Étape ${k} sur ${n}`, { timeout: 30_000 })
  await expect(page.locator('.oscar-live')).toContainText(`étape ${k} sur ${n}`, { timeout: 30_000 })
}

// ── axe ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** axe violations as readable lines (`rule: selector :: message`); `include` narrows the scan to one region. */
export async function axeLines(page: Page, include?: string): Promise<string[]> {
  const b = new AxeBuilder({ page })
  const r = await (include ? b.include(include) : b).analyze()
  return r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`))
}

// ── geometry ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Hit {
  name: string
  overlap: Rect
}
/**
 * The VISIBLE controls of the page (buttons, inputs, links, menu items, tabs, summaries, focus stops; clipped by the scroll areas that hold them; nothing under
 * `display: none`, `visibility: hidden`, `[hidden]` or `inert`; the 3D canvas is not a control) that `what` overlaps by more than one pixel in both directions.
 * Nothing is exempted for being « the target »: the bubble may sit beside the target, never on it (spec 11.3). `skip` names one subtree whose controls do not
 * count (the step card's own button when the card is the thing measured). The guide's own nodes are never page controls.
 */
export async function controlsUnder(page: Page, what: Rect, skip?: string): Promise<Hit[]> {
  return page.evaluate(
    ({ t, skipSel }) => {
      const guideRoot = document.querySelector('[data-oscar-root]')
      const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="combobox"], [role="treeitem"], [tabindex]:not([tabindex="-1"])'
      const clipOf = (el: Element, r: DOMRect): DOMRect | null => {
        let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom]
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
      const skipRoot = skipSel ? document.querySelector(skipSel) : null
      const hits: { name: string; overlap: { x: number; y: number; width: number; height: number } }[] = []
      for (const el of document.querySelectorAll(CONTROLS)) {
        if (guideRoot?.contains(el) || skipRoot?.contains(el)) continue
        if (el.tagName === 'CANVAS' || el.closest('[inert], [hidden]') !== null) continue
        const cs = getComputedStyle(el)
        if (cs.visibility !== 'visible' || cs.display === 'none') continue
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) continue
        const c = clipOf(el, r)
        if (c === null) continue
        const x0 = Math.max(c.left, t.x)
        const y0 = Math.max(c.top, t.y)
        const x1 = Math.min(c.right, t.x + t.width)
        const y1 = Math.min(c.bottom, t.y + t.height)
        if (x1 - x0 > 1 && y1 - y0 > 1) {
          const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
          hits.push({ name: `${el.tagName.toLowerCase()} ${label}`, overlap: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })
        }
      }
      return hits
    },
    { t: what, skipSel: skip ?? null },
  )
}

/** The icon's box once it has stopped moving (the guide glides and re-reads the page: a state wait, not a sleep). */
export async function settledIcon(page: Page): Promise<Rect> {
  const read = async (): Promise<string> => {
    const b = await page.locator('.oscar-icon').boundingBox()
    return b === null ? '' : `${Math.round(b.x)},${Math.round(b.y)}`
  }
  let last = ''
  await expect
    .poll(async () => {
      const now = await read()
      const stable = now !== '' && now === last
      last = now
      await page.waitForTimeout(350)
      return stable
    })
    .toBe(true)
  return (await page.locator('.oscar-icon').boundingBox())!
}
