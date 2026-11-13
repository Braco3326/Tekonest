/**
 * The new Oscar in the browser (onboarding spec 10.2 and 11 items 5 and 6, plan T5.2): the real module (src/guide/character.ts) and the real
 * sheets (vendored guide.css, then src/guide/character.css) in a blank page, see tests/guide/characterHarness.ts for how. Not wired into the app
 * yet (plan T5.3), so this spec does not open the app.
 *  - 24 px silhouette: idle, point, celebrate and sleep at 24 px; every pair differs in >= 6 % of pixels; idle differs from a plain filled circle of
 *    the same size by >= 6 % (the silhouettes compared, and also against the closest circle: same area, same centroid). On Nuit and on Papier.
 *  - Motion: 6 s after any state, document.getAnimations() is empty, with the vendored mascot and ring present (their loops are infinite in the
 *    vendored sheet; the host class stops them). A control shows the same page WITHOUT the host class keeps vendored loops running.
 *  - Reduced motion: no animation or transition at all, and each of the nine static poses is distinct.
 *  - Direction: the arm points east, west (mirrored), north and south.
 * Run: `npm.cmd run build` first (the config's web server serves dist/), then `$env:E2E_PORT='4391'; npx.cmd playwright test character.spec`.
 */
import { expect, test, type Page } from '@playwright/test'
import { CHARACTER_STATES, DIRS, type CharacterState } from '../../src/guide/character'
import { NUIT, PAPIER, PRUNE, bestCircle, mask, openCharacterPage, pixelDiff, shot, xorShare } from '../guide/characterHarness'

test.use({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })

const cell = (page: Page, o: { id: string; size: number; state: CharacterState; ground: string; dir?: (typeof DIRS)[number] }) =>
  page.evaluate((x) => window.__tpo.cell(x), o)

test.describe('24 px silhouette (spec 11.6)', () => {
  const STATES: CharacterState[] = ['idle', 'point', 'celebrate', 'sleep']
  for (const ground of [NUIT, PAPIER]) {
    test(`idle, point, celebrate, sleep differ pairwise by >= 6 % and idle is not a plain circle (ground ${ground})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }) // the still of each state, not a frame of its motion
      await openCharacterPage(page, { ground })
      for (const s of STATES) await cell(page, { id: `c-${s}`, size: 24, state: s, ground })
      await page.evaluate((g) => window.__tpo.circle('disc', 24, g, '#612D45'), ground)
      const r = Object.fromEntries(await Promise.all(STATES.map(async (s) => [s, await shot(page, `#c-${s}`)] as const)))
      for (const s of STATES) expect([r[s].w, r[s].h], `${s} is rendered at 24 x 24`).toEqual([24, 24])
      const report: string[] = []
      for (let i = 0; i < STATES.length; i++)
        for (let j = i + 1; j < STATES.length; j++) {
          const d = pixelDiff(r[STATES[i]], r[STATES[j]])
          report.push(`${STATES[i]}/${STATES[j]} ${(d * 100).toFixed(1)} %`)
          expect(d, `${STATES[i]} vs ${STATES[j]} at 24 px`).toBeGreaterThanOrEqual(0.06)
        }
      const idle = mask(r.idle, ground)
      const disc = mask(await shot(page, '#disc'), ground)
      const vsDisc = xorShare(idle, disc)
      const vsBest = xorShare(idle, bestCircle(idle, 24))
      report.push(`idle/24 px circle ${(vsDisc * 100).toFixed(1)} %`, `idle/closest circle ${(vsBest * 100).toFixed(1)} %`)
      test.info().annotations.push({ type: 'silhouette', description: report.join('; ') })
      expect(vsDisc, 'idle vs a plain filled circle of 24 px').toBeGreaterThanOrEqual(0.06)
      expect(vsBest, 'idle vs the closest circle (same area, same centroid)').toBeGreaterThanOrEqual(0.06)
    })
  }
})

/** One widget per drawn state: seven controller states, plus nod and wave played over it with real timers. */
const WIDGETS: { vendor: string; host?: 'nod' | 'wave'; draws: CharacterState }[] = [
  { vendor: 'idle', draws: 'idle' },
  { vendor: 'walk', draws: 'walk' },
  { vendor: 'point', draws: 'point' },
  { vendor: 'think', draws: 'think' },
  { vendor: 'celebrate', draws: 'celebrate' },
  { vendor: 'no', draws: 'shrug' },
  { vendor: 'sleep', draws: 'sleep' },
  { vendor: 'idle', host: 'nod', draws: 'nod' },
  { vendor: 'point', host: 'wave', draws: 'wave' },
]

test.describe('motion (spec 11.5)', () => {
  test('6 s after any state, document.getAnimations() is empty (vendored mascot and ring present, host class on)', async ({ page }) => {
    test.setTimeout(30_000)
    await openCharacterPage(page)
    const drawn = await page.evaluate((ws) => ws.map((w, i) => window.__tpo.widget({ ...w, hostClass: true, x: 10 + i * 64 })), WIDGETS)
    expect(drawn).toEqual(WIDGETS.map((w) => w.draws))
    expect(new Set(drawn)).toEqual(new Set(CHARACTER_STATES))
    // The test can see motion: right after the states are set, things run.
    const early = await page.evaluate(() => window.__tpo.running())
    expect(early.length, 'animations right after the state change').toBeGreaterThan(5)
    await page.waitForTimeout(6000)
    expect(await page.evaluate(() => window.__tpo.running()), 'running 6 s later').toEqual([])
  })

  test('later state changes (point, then think), each after the last settled, also stop within 6 s', async ({ page }) => {
    test.setTimeout(30_000)
    await openCharacterPage(page)
    await page.evaluate(() => {
      window.__tpo.widget({ vendor: 'idle', hostClass: true, x: 10 })
    })
    await page.waitForTimeout(6000)
    expect(await page.evaluate(() => window.__tpo.running())).toEqual([])
    // The controller now points (the ring is already shown): the arm reaches through its transition.
    expect(await page.evaluate(() => window.__tpo.set(0, 'point'))).toBe('point')
    expect((await page.evaluate(() => window.__tpo.running())).some((a) => a.includes('tpo-arm-pose')), 'the arm moves').toBe(true)
    await page.waitForTimeout(6000)
    expect(await page.evaluate(() => window.__tpo.running())).toEqual([])
    // Then thinks: the dots run 4 cycles at most, then everything is still.
    expect(await page.evaluate(() => window.__tpo.set(0, 'think'))).toBe('think')
    expect((await page.evaluate(() => window.__tpo.running())).some((a) => a.startsWith('tpo-dot'))).toBe(true)
    await page.waitForTimeout(6000)
    expect(await page.evaluate(() => window.__tpo.running())).toEqual([])
  })

  test('control: without the host class the vendored loops are still running after 6 s', async ({ page }) => {
    test.setTimeout(30_000)
    await openCharacterPage(page)
    await page.evaluate((ws) => ws.forEach((w, i) => window.__tpo.widget({ ...w, hostClass: false, x: 10 + i * 64 })), WIDGETS)
    await page.waitForTimeout(6000)
    const left = await page.evaluate(() => window.__tpo.running())
    expect(left.some((a) => a.startsWith('oscar-pulse')), left.join(', ')).toBe(true)
    expect(left.some((a) => a.startsWith('oscar-breathe')), left.join(', ')).toBe(true)
    // ... and none of them is the character's own (every one of those is finite).
    expect(left.filter((a) => a.startsWith('tpo-'))).toEqual([])
  })
})

test.describe('reduced motion (spec 11.5)', () => {
  test('no animation or transition runs, in the widget or in a bare cell', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCharacterPage(page)
    await page.evaluate((ws) => ws.forEach((w, i) => window.__tpo.widget({ ...w, hostClass: true, x: 10 + i * 64 })), WIDGETS)
    await page.evaluate((states) => states.forEach((s, i) => window.__tpo.cell({ id: `r-${i}`, size: 64, state: s, ground: '#131114' })), [...CHARACTER_STATES])
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    expect(await page.evaluate(() => window.__tpo.running())).toEqual([])
    // A state change under reduced motion starts nothing either.
    await page.evaluate(() => document.querySelectorAll('.tpo').forEach((s) => s.setAttribute('data-state', 'celebrate')))
    expect(await page.evaluate(() => window.__tpo.running())).toEqual([])
  })

  test('each of the nine static poses is distinct (128 px, >= 1 % of pixels between any two)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCharacterPage(page)
    const states = [...CHARACTER_STATES]
    for (const s of states) await cell(page, { id: `p-${s}`, size: 128, state: s, ground: NUIT })
    const r = Object.fromEntries(await Promise.all(states.map(async (s) => [s, await shot(page, `#p-${s}`)] as const)))
    const report: string[] = []
    for (let i = 0; i < states.length; i++)
      for (let j = i + 1; j < states.length; j++) {
        const d = pixelDiff(r[states[i]], r[states[j]])
        report.push(`${states[i]}/${states[j]} ${(d * 100).toFixed(1)}`)
        expect(d, `${states[i]} vs ${states[j]} static`).toBeGreaterThanOrEqual(0.01)
      }
    test.info().annotations.push({ type: 'poses %', description: report.join('; ') })
  })
})

test.describe('direction (spec 10.2 pointer)', () => {
  const WANT = { east: { x: 1, y: 0 }, west: { x: -1, y: 0 }, north: { x: 0, y: -1 }, south: { x: 0, y: 1 } } as const
  for (const dir of DIRS) {
    test(`point ${dir}: the hand goes ${dir} of the shoulder`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openCharacterPage(page)
      await cell(page, { id: 'd', size: 128, state: 'point', ground: PRUNE, dir })
      const v = await page.evaluate(() => window.__tpo.armVector('d'))
      expect(v.x * WANT[dir].x + v.y * WANT[dir].y, JSON.stringify(v)).toBeGreaterThan(0)
      // The main direction wins: the arm points more toward it than across it.
      const along = Math.abs(v.x * WANT[dir].x + v.y * WANT[dir].y)
      const across = Math.abs(v.x * WANT[dir].y - v.y * WANT[dir].x)
      expect(along, `${dir}: along ${along.toFixed(1)}, across ${across.toFixed(1)}`).toBeGreaterThan(across)
    })
  }
})
