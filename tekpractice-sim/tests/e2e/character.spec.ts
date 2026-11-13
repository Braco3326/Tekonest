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
 * In the app (plan T5.3 to T5.5, the production build on the config's web server; these tests DO open the app):
 *  - scope (controller ruling 4): the new Oscar only on ?design=1..5; the plain address and the level page keep the vendored mascot; exam and ?oscar=0: no Oscar;
 *  - the seam: host class on .oscar-guide, svg.tpo in .oscar-icon at the icon's 56 px box, the vendored mascot hidden, no second coin, the name kept;
 *  - the 10 steps of « Premiers pas » on ?design=1: at each, the arm points at the ring (dot product > 0) and the « Oscar · Assistant » badge shows (>= 12 px);
 *    wave on the first open, celebrate on the first accepted connection and the first sound, nod after; a refused connection shrugs;
 *  - 6 s after the last change no animation runs on the icon or the ring (the in-app sheet order);
 *  - T5.5: package 4 and the sound engineer start muted with nothing stored; an unmute is stored and wins after a reload.
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

// ── In the app (plan T5.3 to T5.5) ────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('in the app: the skin on the vendored widget (T5.3 to T5.5)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  const ICON_NAME = 'Oscar, assistant IA'
  const BADGE = 'Oscar · Assistant'
  const MUTE_KEY = 'oscar-guide.state.v1.muted'
  const live = (page: Page) => page.locator('.oscar-live')
  const ring = (page: Page) => page.locator('.oscar-ring:not(.oscar-ring-drop)')
  const stepLine = (k: number, n = 10): string => `Parcours « Premiers pas » : étape ${k} sur ${n}.`
  const start = (page: Page) => page.getByTestId('start-screen')

  /** Records every drawn state of the character (data-state of svg.tpo), from the moment it is in the page. */
  const recordStates = (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as { __tpoLog: string[] }
      w.__tpoLog = []
      let svg: Element | null = null
      const watch = new MutationObserver(() => {
        const s = document.querySelector('.oscar-icon svg.tpo')
        if (s === null || s === svg) return
        svg = s
        w.__tpoLog.push(s.getAttribute('data-state') ?? '')
        new MutationObserver(() => w.__tpoLog.push(s.getAttribute('data-state') ?? '')).observe(s, { attributes: true, attributeFilter: ['data-state'] })
      })
      const go = (): void => watch.observe(document.documentElement, { childList: true, subtree: true })
      if (document.documentElement) go()
      else document.addEventListener('DOMContentLoaded', go, { once: true }) // an init script can run before the root element exists
    })
  const states = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __tpoLog: string[] }).__tpoLog.slice())

  async function openFresh(page: Page, query: string): Promise<void> {
    await page.goto('/' + query)
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
  }
  async function profile(page: Page, name: string, offer: RegExp | null): Promise<void> {
    await start(page).getByRole('button', { name, exact: true }).click()
    if (offer !== null) await start(page).getByRole('button', { name: offer }).click()
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
  }
  const act = (page: Page, intents: unknown[]) =>
    page.evaluate((list) => {
      for (const i of list) {
        const r = window.__creation!.dispatch(i as never)
        if (!r.ok) throw new Error('refused: ' + JSON.stringify(i))
      }
    }, intents)
  const spawn = (deviceId: string, instanceId: string, x: number) => ({ type: 'SPAWN', deviceId, instanceId, position: [x, 0, 0] })
  const connect = (a: string, ap: string, b: string, bp: string) => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })

  /** The arm (hand centre minus the start of the arm line, in screen px) and the vector from that shoulder to the ring's centre. */
  const pointing = (page: Page) =>
    page.evaluate(() => {
      const svg = document.querySelector('.oscar-icon svg.tpo') as SVGSVGElement
      const r = document.querySelector('.oscar-ring:not(.oscar-ring-drop)') as HTMLElement
      const hand = svg.querySelector('[data-part="hand"]')!.getBoundingClientRect()
      const line = svg.querySelector('.tpo-arm-line') as SVGPathElement
      const p = line.getPointAtLength(0)
      const m = line.getScreenCTM()!
      const sx = m.a * p.x + m.c * p.y + m.e
      const sy = m.b * p.x + m.d * p.y + m.f
      const rb = r.getBoundingClientRect()
      const arm = { x: hand.x + hand.width / 2 - sx, y: hand.y + hand.height / 2 - sy }
      const to = { x: rb.x + rb.width / 2 - sx, y: rb.y + rb.height / 2 - sy }
      return { arm, to, dot: arm.x * to.x + arm.y * to.y, dir: svg.getAttribute('data-dir'), state: svg.getAttribute('data-state'), vendor: document.querySelector('svg.oscar-mascot')!.getAttribute('data-state') }
    })

  const badgeOk = async (page: Page, where: string): Promise<void> => {
    const b = page.locator('.oscar-bubble .oscar-header .tp-oscar-badge')
    await expect(b, `${where}: the badge is visible with the open bubble`).toBeVisible()
    await expect(b).toHaveText(BADGE)
    const px = await b.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    expect(px, `${where}: badge font size`).toBeGreaterThanOrEqual(12)
  }

  test('?design=1: the character is the icon (host class on the root, the 56 px box, the vendored mascot hidden, no second coin, the name kept)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFresh(page, '?design=1')
    await profile(page, 'Je découvre', /^Faire le tutoriel/)
    const icon = page.getByRole('button', { name: ICON_NAME, exact: true })
    await expect(icon).toBeVisible()
    const g = await page.evaluate(() => {
      const root = document.querySelector('.oscar-guide')!
      const icon = root.querySelector('.oscar-icon') as HTMLElement
      const svg = icon.querySelector('svg.tpo')!
      const m = icon.querySelector('svg.oscar-mascot')!
      const ib = icon.getBoundingClientRect()
      const sb = svg.getBoundingClientRect()
      const cs = getComputedStyle(icon)
      return {
        rootHost: root.classList.contains('tp-oscar-host'),
        iconHost: icon.classList.contains('tp-oscar-host'),
        icon: [ib.width, ib.height],
        svg: [sb.x - ib.x, sb.y - ib.y, sb.width, sb.height],
        mascotDisplay: getComputedStyle(m).display,
        mascotState: m.hasAttribute('data-state'),
        bg: cs.backgroundColor,
        border: cs.borderTopWidth,
        shadow: cs.boxShadow,
        hidden: svg.getAttribute('aria-hidden'),
        svgs: icon.querySelectorAll('svg').length,
      }
    })
    expect(g).toEqual({
      rootHost: true,
      iconHost: false,
      icon: [56, 56],
      svg: [0, 0, 56, 56],
      mascotDisplay: 'none',
      mascotState: true,
      bg: 'rgba(0, 0, 0, 0)',
      border: '0px',
      shadow: 'none',
      hidden: 'true',
      svgs: 2,
    })
  })

  test('?design=1, the 10 steps of « Premiers pas »: the arm points at the ring and the badge shows at each; wave, celebrate, nod as in spec 10.2', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' }) // the static poses: no transition between a state change and the measure
    await recordStates(page)
    await openFresh(page, '?design=1')
    await profile(page, 'Je découvre', /^Faire le tutoriel/)
    const SETUP: unknown[][] = [
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
    const report: string[] = []
    for (let k = 1; k <= 10; k++) {
      await expect(live(page)).toContainText(stepLine(k), { timeout: 10_000 })
      await expect(ring(page)).toBeVisible()
      await badgeOk(page, `step ${k}`)
      // the controller points, and any host state (nod 600 ms, celebrate 1 000 ms) is over
      await expect.poll(async () => (await pointing(page)).state, { message: `step ${k}: the character points`, timeout: 6_000 }).toBe('point')
      const p = await pointing(page)
      report.push(`${k}: ${p.dir} dot ${p.dot.toFixed(0)}`)
      expect(p.dot, `step ${k}: arm ${JSON.stringify(p.arm)} vs ring ${JSON.stringify(p.to)} (${p.dir})`).toBeGreaterThan(0)
      if (k < 10) await act(page, SETUP[k - 1])
      if (k === 4) await expect.poll(() => states(page), { message: 'the first accepted connection celebrates', timeout: 4_000 }).toContain('celebrate')
    }
    test.info().annotations.push({ type: 'pointing', description: report.join('; ') })
    const before = (await states(page)).filter((s) => s === 'celebrate').length
    await page.getByRole('menuitem', { name: 'Écoute', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Signal de test', exact: true }).click()
    await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 15_000 })
    await expect.poll(async () => (await states(page)).filter((s) => s === 'celebrate').length, { message: 'the first sound celebrates', timeout: 4_000 }).toBeGreaterThan(before)
    const log = await states(page)
    test.info().annotations.push({ type: 'states', description: log.join(' ') })
    expect(log, 'the first open of the bubble waved').toContain('wave')
    expect(log, 'later connections and steps done nod').toContain('nod')
    // celebrate sparingly (spec 10.2, round 1 S4): exactly the first accepted connection and the first sound. The tutorial's end (the vendored flow-end
    // celebrate, the same moment as the sound) is drawn as a nod once both are spent, and that nod does not cut the running celebration.
    expect(log.filter((s) => s === 'celebrate').length, log.join(' ')).toBe(2)
    await page.waitForTimeout(1_500) // past the celebration and the vendored hold: nothing celebrates later
    expect((await states(page)).filter((s) => s === 'celebrate').length).toBe(2)
  })

  test('a refused connection shrugs (the app refused the cable; the vendored controller has no state for it)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordStates(page)
    await openFresh(page, '?design=1')
    await profile(page, 'Je découvre', /^Faire le tutoriel/)
    await expect(live(page)).toContainText(stepLine(1), { timeout: 10_000 })
    await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('shure-sm58', 'sm58', 0.8)])
    const refused = await page.evaluate(() => window.__creation!.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'out-main-l' } } as never).ok)
    expect(refused, 'an output into an output is refused by the app').toBe(false)
    expect(await page.evaluate(() => window.__creation!.connectRefusals())).toBe(1)
    await expect.poll(() => states(page), { message: 'shrug', timeout: 4_000 }).toContain('shrug')
  })

  test('6 s after the last change, no animation runs on the icon or the ring (the motion sheet is loaded in the app, after the vendored one)', async ({ page }) => {
    test.setTimeout(60_000)
    await openFresh(page, '?design=1')
    await profile(page, 'Je découvre', /^Faire le tutoriel/)
    await expect(live(page)).toContainText(stepLine(1), { timeout: 10_000 })
    await expect(ring(page)).toBeVisible()
    await expect.poll(async () => (await pointing(page)).state, { timeout: 6_000 }).toBe('point')
    // The moment of the last change of the character, the ring or the icon's place (round 1: the test waits on it, not on a fixed instant).
    await page.evaluate(() => {
      const w = window as unknown as { __lastChange: number }
      w.__lastChange = performance.now()
      const mark = new MutationObserver(() => void (w.__lastChange = performance.now()))
      mark.observe(document.querySelector('.oscar-icon svg.tpo')!, { attributes: true, attributeFilter: ['data-state', 'data-dir'] })
      for (const sel of ['.oscar-ring', '.oscar-icon-wrap']) for (const el of document.querySelectorAll(sel)) mark.observe(el, { attributes: true, attributeFilter: ['style', 'hidden'] })
    })
    const running = () =>
      page.evaluate(() =>
        ['.oscar-icon-wrap', '.oscar-ring'].flatMap((sel) =>
          [...document.querySelectorAll(sel)].flatMap((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').map((a) => `${sel} ${(a as CSSAnimation).animationName ?? 'waapi'}`)),
        ),
      )
    // A state with a known finite animation: the first accepted connection celebrates (tpo-cheer, 1 000 ms once). Polled every 50 ms: the bridge reads the
    // bench every 500 ms, so the start is not at a known instant, but a 1 000 ms window cannot be missed.
    await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1), connect('ql1', 'out-main-l', 'k12', 'in-line-a')])
    await expect.poll(running, { message: 'the celebration runs', timeout: 5_000, intervals: [50] }).toContain('.oscar-icon-wrap tpo-cheer')
    // Then nothing changes for 6 s (longer than every finite animation of the sheet; think, 4 x 1 200 ms, is the longest), and nothing runs.
    await expect
      .poll(() => page.evaluate(() => performance.now() - (window as unknown as { __lastChange: number }).__lastChange), { message: '6 s without a change', timeout: 40_000, intervals: [250] })
      .toBeGreaterThanOrEqual(6_000)
    expect(await running()).toEqual([])
  })

  test('scope (ruling 4): the plain address and the level page keep the vendored mascot; exam and ?oscar=0 with ?design have no Oscar', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const vendored = async (where: string): Promise<void> => {
      await expect(page.getByRole('button', { name: ICON_NAME, exact: true }), where).toBeVisible({ timeout: 15_000 })
      const v = await page.evaluate(() => ({
        tpo: document.querySelectorAll('svg.tpo').length,
        host: document.querySelectorAll('.tp-oscar-host').length,
        badge: document.querySelectorAll('.tp-oscar-badge').length,
        mascot: getComputedStyle(document.querySelector('.oscar-icon svg.oscar-mascot')!).display,
      }))
      expect(v, where).toEqual({ tpo: 0, host: 0, badge: 0, mascot: 'block' })
    }
    await page.goto('/')
    await page.waitForFunction(() => !!window.__creation)
    await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    await vendored('plain address')
    await page.goto('/?level=a1&oscar=legacy&design=1')
    await page.waitForFunction(() => !!(window as unknown as { __audioSim?: unknown }).__audioSim)
    await vendored('level page')
    for (const q of ['?design=1&mode=exam', '?design=1&oscar=0']) {
      await page.goto('/' + q)
      await page.waitForFunction(() => !!window.__creation)
      await page.waitForTimeout(1_500)
      expect(await page.locator('.oscar-guide, svg.tpo').count(), q).toBe(0)
    }
  })

  test('T5.5: package 4 starts muted (asleep) with nothing stored; an unmute is stored (« 0 ») and still wins after a reload', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFresh(page, '?design=4')
    await profile(page, 'Je découvre', /^Passer/)
    const icon = page.getByRole('button', { name: ICON_NAME, exact: true })
    await expect(icon).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.querySelector('svg.oscar-mascot')!.getAttribute('data-state')), { timeout: 5_000 }).toBe('sleep')
    expect(await page.evaluate((k) => window.localStorage.getItem(k), MUTE_KEY)).toBeNull()
    await icon.click()
    const mute = page.locator('.oscar-bubble .oscar-mute')
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await mute.click()
    await expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate((k) => window.localStorage.getItem(k), MUTE_KEY)).toBe('0')
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await expect(icon).toBeVisible({ timeout: 15_000 })
    await icon.click()
    await expect(page.locator('.oscar-bubble .oscar-mute')).toHaveAttribute('aria-pressed', 'false')
  })

  test('T5.5: the sound engineer on package 1 is muted once the profile is chosen, no bubble left open, NOTHING stored; a reload stays muted by the default; the plain address is not muted; « Je découvre » through the chip then a reload is not muted', async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFresh(page, '?design=1')
    await profile(page, 'Je travaille dans le son', /^Passer/)
    const icon = page.getByRole('button', { name: ICON_NAME, exact: true })
    const vendorState = () => page.evaluate(() => document.querySelector('svg.oscar-mascot')!.getAttribute('data-state'))
    const stored = () => page.evaluate((k) => window.localStorage.getItem(k), MUTE_KEY)
    const pressed = async (): Promise<string | null> => {
      await icon.click()
      const mute = page.locator('.oscar-bubble .oscar-mute')
      await expect(mute).toBeVisible()
      const v = await mute.getAttribute('aria-pressed')
      await page.keyboard.press('Escape')
      return v
    }
    const reload = async (url?: string): Promise<void> => {
      if (url === undefined) await page.reload()
      else await page.goto(url)
      await page.waitForFunction(() => !!window.__creation)
    }
    await expect(icon).toBeVisible()
    await expect.poll(vendorState, { timeout: 5_000 }).toBe('sleep')
    await expect(page.locator('.oscar-bubble')).toBeHidden()
    await expect(icon).toHaveAttribute('aria-expanded', 'false')
    expect(await stored(), 'the late mute is not stored (round 1, S1)').toBeNull()
    await reload()
    await expect(icon).toBeVisible({ timeout: 15_000 })
    await expect.poll(vendorState, { message: 'muted again by the default (profile metier)', timeout: 5_000 }).toBe('sleep')
    expect(await pressed()).toBe('true')
    expect(await stored()).toBeNull()
    // the plain address: today's Oscar, not muted
    await reload('/')
    await page.evaluate(() => window.__creation!.choosePlace('room:concert-hall-medium'))
    await expect(icon).toBeVisible({ timeout: 15_000 })
    expect(await pressed(), 'plain address').toBe('false')
    // back on ?design=1, the profile changed through the status-bar chip to « Je découvre »: the next mount is not muted
    await reload('/?design=1')
    await page.getByTestId('profile-chip').click()
    await page.getByTestId('start-screen').getByRole('button', { name: 'Je découvre', exact: true }).click()
    await page.getByTestId('start-screen').getByRole('button', { name: /^Passer/ }).click()
    await expect(page.getByTestId('profile-chip')).toHaveText('Profil : Je découvre · changer')
    await reload()
    await expect(icon).toBeVisible({ timeout: 15_000 })
    expect(await pressed(), 'after « Je découvre »').toBe('false')
    expect(await stored()).toBeNull()
  })

  for (const c of [
    { q: '?design=4', who: 'Je découvre', why: 'package 4' },
    { q: '?design=1', who: 'Je travaille dans le son', why: 'the sound engineer' },
  ]) {
    test(`round 1, S3: muted (${c.why}), « Faire le tutoriel » still shows step 1, and step 2 once step 1 is done`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openFresh(page, c.q)
      await profile(page, c.who, /^Faire le tutoriel/)
      await expect(live(page)).toContainText(stepLine(1), { timeout: 10_000 })
      await act(page, [spawn('yamaha-ql1', 'ql1', 0)])
      await expect(live(page)).toContainText(stepLine(2), { timeout: 10_000 })
      await expect(page.locator('.oscar-bubble .oscar-mute')).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate((k) => window.localStorage.getItem(k), MUTE_KEY)).toBeNull()
    })
  }

  test('round 1, N5: forced colours: the borderless icon keeps an edge (an outline)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
    await openFresh(page, '?design=1')
    await profile(page, 'Je découvre', /^Passer/)
    await expect(page.getByRole('button', { name: ICON_NAME, exact: true })).toBeVisible()
    const o = await page.locator('.oscar-icon').evaluate((el) => ({ style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth }))
    expect(o).toEqual({ style: 'solid', width: '2px' })
  })
})
