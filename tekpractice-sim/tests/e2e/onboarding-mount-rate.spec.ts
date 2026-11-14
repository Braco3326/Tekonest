/**
 * G14e (review C3): the rate at which Oscar mounts on a first visit, measured WITHOUT any retry. The kit's `loadFresh` loads a page again when the guide did not
 * mount (a `vite preview` stall under six browsers); that retry must not hide a guide that fails to mount for a learner: a first-timer on a package address who
 * gets no Oscar gets no tutorial offer from him and no ring.
 *
 * One serial test: N fresh first visits of a package address (a new browser context each: an empty storage, no cache), each must mount the guide (the Oscar icon in
 * the page) within MOUNT_MS. The rate is a test annotation; the test fails below MIN_RATE. Each failed load prints a `MOUNT-FAIL` line with what the page held
 * (the hook, the guide's nodes, the requests still open, the console errors), the evidence for the cause.
 */
import type { Page } from '@playwright/test'
import { expect, STALL_MS, stallOf, test } from './onboardingKit'

const N = 30
const MIN_RATE = 0.95
/** The kit's own patience for the guide (onboardingKit.ts `guideMounted`): the guide waits 10 s for the hook, then its chunks. */
const MOUNT_MS = 20_000

test.describe.configure({ mode: 'serial', retries: 0 })
test.use({ viewport: { width: 1366, height: 768 } })

/** What the page holds when Oscar did not come: the evidence a failed load leaves. */
const evidence = (page: Page) =>
  page.evaluate(() => ({
    hook: !!window.__creation,
    place: window.__creation?.place() ?? null,
    guideNodes: document.querySelectorAll('.oscar-guide, [data-oscar-root]').length,
    icons: document.querySelectorAll('.oscar-icon').length,
    startScreen: document.querySelector('[data-testid="start-screen"]') !== null,
    htmlClass: document.documentElement.className,
    booted: (window as unknown as { __tekBooted?: unknown }).__tekBooted ?? null,
  }))

test(`Oscar mounts on a first visit of ?design=1 in at least ${MIN_RATE * 100} % of ${N} fresh loads, with no retry`, async ({ browser }) => {
  test.setTimeout(N * 45_000)
  const results: { mounted: boolean; ms: number }[] = []
  for (let i = 1; i <= N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const page = await ctx.newPage()
    const open = new Map<unknown, { url: string; t: number }>()
    const errors: string[] = []
    page.on('request', (r) => open.set(r, { url: r.url().slice(-70), t: Date.now() }))
    page.on('requestfinished', (r) => open.delete(r))
    page.on('requestfailed', (r) => {
      open.delete(r)
      if (r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`requestfailed ${r.url().slice(-70)} ${r.failure()?.errorText ?? ''}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message.slice(0, 160)}`))
    page.on('console', (m) => (m.type() === 'error' || (m.type() === 'warning' && /guide|oscar/i.test(m.text())) ? errors.push(`console.${m.type()} ${m.text().slice(0, 160)}`) : undefined))
    try {
      const t0 = Date.now()
      await page.goto('/?design=1')
      const mounted = await page
        .locator('.oscar-icon')
        .first()
        .waitFor({ state: 'attached', timeout: MOUNT_MS })
        .then(
          () => true,
          () => false,
        )
      const ms = Date.now() - t0
      results.push({ mounted, ms })
      if (!mounted) {
        const now = Date.now()
        console.log('MOUNT-FAIL', JSON.stringify({ load: i, ms, page: await evidence(page), stillOpen: [...open.values()].map((o) => `${o.url} ${Math.round((now - o.t) / 1000)} s`).slice(0, 15), errors: errors.slice(0, 10) }))
      }
    } finally {
      await ctx.close()
    }
  }
  const ok = results.filter((r) => r.mounted).length
  const rate = ok / N
  const times = results.filter((r) => r.mounted).map((r) => r.ms).sort((a, b) => a - b)
  const summary = { loads: N, mounted: ok, rate: Math.round(rate * 1000) / 10, medianMs: times[Math.floor(times.length / 2)] ?? null, slowestMs: times[times.length - 1] ?? null }
  console.log('MOUNT-RATE', JSON.stringify(summary))
  test.info().annotations.push({ type: 'Oscar mount rate (no retry)', description: JSON.stringify(summary) })
  expect(rate, `Oscar mounted on ${ok} of ${N} first visits (see the MOUNT-FAIL lines)`).toBeGreaterThanOrEqual(MIN_RATE)
})

test('the stall signature of the kit (C3): only a timeout with a request open for STALL_MS is retried; a value assertion, or a timeout with nothing pending, is a fault', () => {
  const open = (ages: number[]) => ({ olderThan: (ms: number) => ages.filter((a) => a >= ms).map((a) => `chunk.js open ${a / 1000} s`) })
  const timeout = Object.assign(new Error('locator.waitFor: Timeout 20000ms exceeded.'), { name: 'TimeoutError' })
  const expectTimeout = new Error('Timed out 20000ms waiting for expect(locator).toBeVisible()')
  const value = new Error('expect(received).toBe(expected) // Object.is equality')
  expect(stallOf(timeout, open([STALL_MS + 5_000])), 'a timeout with a request open for long').toEqual(['chunk.js open 15 s'])
  expect(stallOf(expectTimeout, open([30_000])), 'an expect timeout with a request open for long').not.toBeNull()
  expect(stallOf(timeout, open([])), 'a timeout with nothing pending').toBeNull()
  expect(stallOf(timeout, open([STALL_MS - 1_000])), 'a timeout with only a young request').toBeNull()
  expect(stallOf(value, open([30_000])), 'a value assertion, even with a request open').toBeNull()
})
