import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Task 43a (plan Task 43, CA-18): the runtime budgets of Mode Création, on the production build.
 *  - IDLE: 0 scene renders in a 2 s window after each of: load, a place change, a cube hover, closing the drawer, a coverage computation finishing, stopping
 *    playback. `__creation.renders()` is the render scheduler's frame count (one per `scene.render()` of the main scene).
 *  - LISTENERS: `liveListeners()` (the DisposableBag count) returns to its baseline after 5 place changes with gear; an independent oracle (a page-level count of
 *    the listeners added to `window` / `document`, patched in before the app loads) agrees.
 *  - AXE: 0 serious or critical violations on the whole page (no rule disabled, nothing excluded) with: the place picker, the shell, the inventory drawer, the
 *    connect dialog, the view picker and the listen panel on screen.
 * No fixed sleep is an assertion mechanism. The only waits that are not "until a state": IDLE_WINDOW_MS, the window being measured.
 *
 * SCOPE OF THE IDLE CLAIM. Six of the seven idle scenarios run with `prefers-reduced-motion: reduce` (boot() emulates it by default, which also cuts the camera
 * tweens short); the seventh, "a place change WITHOUT reduced motion", runs with the animations on. So CA-18 is measured with and without tween animation for the
 * place change, and with reduced motion only for the other five.
 *
 * A "0 renders" READING PROVES NOTHING ON ITS OWN (a stalled or throttled page reads 0 too). Every idle window is therefore bracketed by liveness proofs: a
 * page-side requestAnimationFrame counter must advance during the window (the page was not frozen), and a `resize` event (it invalidates the scheduler) must
 * make `renders()` move before AND after the window (the counter observes a real render, the loop is alive).
 */
test.use({ viewport: { width: 1366, height: 768 } })

/** The quiet window that is the thing measured (the brief: "0 renders in a 2 s window"). */
const IDLE_WINDOW_MS = 2000
/** The render count has not moved for this long: the frame that was owed after the action has been drawn, the scene is at rest. */
const QUIET_MS = 500

const PLACE = 'room:concert-hall-medium'

/** The reference template ("Concert simple (référence)": 5 devices) with its two signal cables and playback on: the powered rig, as the listen / coverage specs. */
const boot = async (page: Page, opts: { powered?: boolean; motion?: boolean } = {}): Promise<void> => {
  await page.emulateMedia({ reducedMotion: opts.motion ? 'no-preference' : 'reduce' })
  // An independent clock for the idle windows: counts the page's animation frames, whatever the app does.
  await page.addInitScript(() => {
    const w = window as unknown as { __rafTicks: number }
    w.__rafTicks = 0
    const tick = (): void => {
      w.__rafTicks++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__creation)
  await page.getByTestId('template-grid').getByRole('option', { name: /Concert simple/ }).click()
  await page.waitForFunction(() => window.__creation!.place() === 'room:concert-hall-medium' && window.__creation!.design().rig.instances.length === 5)
  await settled(page)
  if (opts.powered === false) return
  const ok = await page.evaluate(() => {
    const c = window.__creation!
    return [
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } }).ok,
      c.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok,
    ]
  })
  expect(ok).toEqual([true, true, true])
}

const renders = (page: Page): Promise<number> => page.evaluate(() => window.__creation!.renders())

/** Every .glb that will arrive has been applied, and the render count has not moved for QUIET_MS (measured by the page's own clock, polled). */
const settled = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0, null, { timeout: 30_000 })
  // A fresh observation each call: a stale one from an earlier call would read "quiet for a long time" before the frame the action owes has been drawn.
  await page.evaluate(() => delete (window as unknown as { __quiet?: unknown }).__quiet)
  await page.waitForFunction(
    (quietMs) => {
      const w = window as unknown as { __quiet?: { n: number; t: number } }
      const n = window.__creation!.renders()
      const now = performance.now()
      if (!w.__quiet || w.__quiet.n !== n) {
        w.__quiet = { n, t: now }
        return false
      }
      return now - w.__quiet.t >= quietMs
    },
    QUIET_MS,
    { timeout: 30_000, polling: 50 },
  )
}

const rafTicks = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __rafTicks: number }).__rafTicks)

/** A `resize` invalidates the scheduler: the loop must answer with a frame, and renders() must count it. Proof that the loop is alive and the counter sees renders. */
const pokeAndExpectFrame = async (page: Page, when: string): Promise<void> => {
  const n = await renders(page)
  await page.evaluate(() => void window.dispatchEvent(new Event('resize')))
  await expect.poll(() => renders(page), { message: `a forced render is observed by renders() (${when})`, timeout: 5000 }).toBeGreaterThan(n)
}

/**
 * The page is at rest, then IDLE_WINDOW_MS later it has drawn nothing. `what` names the action that came before, for the failure message.
 * Liveness: the loop answers a forced frame before the window and after it, and the page's own rAF counter advanced during it.
 */
const expectIdle = async (page: Page, what: string): Promise<void> => {
  await settled(page)
  await pokeAndExpectFrame(page, `before the window after ${what}`)
  await settled(page)
  const before = await renders(page)
  const ticks = await rafTicks(page)
  await page.waitForTimeout(IDLE_WINDOW_MS)
  const after = await renders(page)
  expect(await rafTicks(page) - ticks, `animation frames the page ran in ${IDLE_WINDOW_MS} ms (the window was not frozen)`).toBeGreaterThan(10)
  expect(after, `renders in ${IDLE_WINDOW_MS} ms after ${what}`).toBe(before)
  await pokeAndExpectFrame(page, `after the window after ${what}`)
}

const ecoute = (page: Page) => page.getByRole('menuitem', { name: 'Écoute', exact: true })
const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true })
const choose = async (page: Page, name: string): Promise<void> => {
  await ecoute(page).click()
  await expect(page.locator('#cr-menu-ecoute-panel')).toBeVisible()
  await item(page, name).click()
}
const waitState = (page: Page, s: 'playing' | 'stopped') =>
  page.waitForFunction((want) => window.__creation!.audioState().state === want, s, { timeout: 15_000 })
const drawer = (page: Page) => page.getByTestId('inventory-drawer')

test.describe('idle = 0 renders in 2 s (CA-18)', () => {
  test('after load (a reload that reopens the autosaved rig)', async ({ page }) => {
    await boot(page, { powered: false })
    await page.waitForFunction(() => localStorage.getItem('audio-sim/creation.v1')?.includes('"k12-g"'), null, { timeout: 10_000 })
    await page.reload()
    await page.waitForFunction(() => !!window.__creation)
    await page.waitForFunction((p) => window.__creation!.place() === p && window.__creation!.design().rig.instances.length === 5, PLACE)
    await expect(page.getByTestId('place-picker')).toBeHidden()
    await expectIdle(page, 'load')
  })

  test('after a place change (with gear kept)', async ({ page }) => {
    await boot(page, { powered: false })
    const n = await renders(page)
    await page.evaluate(() => void window.__creation!.requestPlace('room:bar-club-stage-small'))
    await page.getByRole('button', { name: 'Garder le matériel' }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'room:bar-club-stage-small')
    expect(await renders(page), 'the place change drew frames').toBeGreaterThan(n)
    await expectIdle(page, 'a place change')
  })

  test('after a place change, WITHOUT reduced motion (the tweens run, then rest)', async ({ page }) => {
    await boot(page, { powered: false, motion: true })
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'animations are on').toBe(false)
    const n = await renders(page)
    await page.evaluate(() => void window.__creation!.requestPlace('room:bar-club-stage-small'))
    await page.getByRole('button', { name: 'Garder le matériel' }).click()
    await page.waitForFunction(() => window.__creation!.place() === 'room:bar-club-stage-small')
    expect(await renders(page), 'the place change drew frames').toBeGreaterThan(n)
    await expectIdle(page, 'a place change with animations on')
  })

  test('after a cube hover (and after leaving it)', async ({ page }) => {
    await boot(page, { powered: false })
    await page.evaluate(() => window.__creation!.cubeZoneScreenPoint('face'))
    await settled(page)
    const r = await page.evaluate(() => window.__creation!.cubeRect())
    const n = await renders(page)
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBe('face')
    await expect.poll(() => renders(page), { message: 'the hover drew a frame' }).toBeGreaterThan(n)
    await expectIdle(page, 'a cube hover')
    await page.mouse.move(r.x + r.width + 200, r.y + r.height + 200)
    await expect.poll(() => page.evaluate(() => window.__creation!.cubeHover())).toBeNull()
    await expectIdle(page, 'leaving the cube')
  })

  test('after closing the drawer', async ({ page }) => {
    await boot(page, { powered: false })
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Space')
    await expect(drawer(page)).toBeVisible()
    await settled(page)
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toBeHidden()
    await expectIdle(page, 'closing the drawer')
  })

  test('after a coverage computation finishes', async ({ page }) => {
    await boot(page)
    expect(await page.evaluate(() => window.__creation!.coverageJobs())).toBe(0)
    await ecoute(page).click()
    await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
    await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
    expect(await page.evaluate(() => window.__creation!.coverageJobs()), 'a job really ran').toBeGreaterThanOrEqual(1)
    expect(await page.evaluate(() => window.__creation!.coverage().points)).toBeGreaterThan(0)
    const jobs = await page.evaluate(() => window.__creation!.coverageJobs())
    await expectIdle(page, 'a coverage computation')
    expect(await page.evaluate(() => window.__creation!.coverageJobs()), 'no further job at rest').toBe(jobs)
  })

  test('after stopping playback', async ({ page }) => {
    await boot(page)
    await choose(page, 'Lecture')
    await waitState(page, 'playing')
    await page.waitForFunction(() => window.__creation!.leases().includes('meters'))
    await choose(page, 'Stop')
    await waitState(page, 'stopped')
    await page.waitForFunction(() => {
      const s = window.__creation!.audioStats()
      return !window.__creation!.leases().includes('meters') && s.contexts.opened === s.contexts.closed && window.__creation!.audioState().retiring === 0
    }, null, { timeout: 10_000 })
    await expectIdle(page, 'stopping playback')
  })
})

/** The listeners added to `window` and `document` and not yet removed, counted from outside the app: patched in before any script runs. `once` listeners are not tracked. */
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
    ;(window as unknown as { __pageListeners: () => number }).__pageListeners = () => live.size
  })
const pageListeners = (page: Page) => page.evaluate(() => (window as unknown as { __pageListeners: () => number }).__pageListeners())

test('5 place changes with the template gear: liveListeners() and the page-level listener count return to their baseline, one scene', async ({ page }) => {
  await trackPageListeners(page)
  await boot(page, { powered: false })
  const baseline = { bag: await page.evaluate(() => window.__creation!.liveListeners()), page: await pageListeners(page), meshes: await page.evaluate(() => window.__creation!.meshCount()) }
  expect(baseline.bag, 'the bag registers listeners at all (not a vacuous 0)').toBeGreaterThan(0)
  expect(baseline.page).toBeGreaterThan(0)
  // the user path: the keep / empty dialog with gear on the scene, « Garder le matériel »; the last stop is the starting place
  const stops = ['room:bar-club-stage-small', 'set:theatre', 'blank', 'room:classroom-lab-small', PLACE]
  for (const key of stops) {
    await page.evaluate((k) => void window.__creation!.requestPlace(k), key)
    await page.getByRole('button', { name: 'Garder le matériel' }).click()
    await page.waitForFunction((k) => window.__creation!.place() === k, key)
    expect(await page.evaluate(() => window.__creation!.design().rig.instances.length), `gear kept at ${key}`).toBe(5)
    await settled(page)
  }
  const after = { bag: await page.evaluate(() => window.__creation!.liveListeners()), page: await pageListeners(page), meshes: await page.evaluate(() => window.__creation!.meshCount()) }
  test.info().annotations.push({ type: 'listeners', description: `baseline ${JSON.stringify(baseline)} after 5 changes ${JSON.stringify(after)}` })
  console.log(`[listeners] baseline ${JSON.stringify(baseline)} after 5 place changes ${JSON.stringify(after)}`)
  expect(after.bag, 'DisposableBag.liveListeners').toBe(baseline.bag)
  expect(after.page, 'window / document listeners').toBe(baseline.page)
  expect(await page.evaluate(() => window.__creation!.scenes())).toBe(1)
  expect(after.meshes, 'meshes').toBe(baseline.meshes)
})

test.describe('axe: 0 serious or critical violations, whole page, no rule disabled', () => {
  /**
   * `rule: selector | selector` for each serious / critical violation. Every test expects `[]`: the Projet tree rows that used to be a pinned exception here
   * (label-content-name-mismatch, tracking id 43d-tree) were fixed in Task 43d (projectTree.ts), so any violation, that one included, fails.
   *
   * WHY `overflow` IS LIFTED WHILE AXE RUNS. index.html has `body { overflow: hidden }` (the shell is position: fixed and never scrolls). With that, axe-core 4.14
   * treats every element as not visible: `color-contrast` and the other visibility-based rules do not evaluate (measured: a probe paragraph in #777 on #888 is
   * not reported, and the picker lists 2 nodes under color-contrast instead of 63 in Task 43a and 67 in Task 43d). Every earlier axe check of this app ran with that blind spot. The shell is
   * fixed, so lifting the overflow changes no layout; it is restored at once. No rule is disabled and nothing is excluded.
   * The inline value (and priority) that was on `body` is saved and put back, whatever it was; the document height is measured before and after to show the
   * lift moved nothing (the place picker overlay included).
   * `minLooked` is a per-state floor for the nodes color-contrast evaluated, 69 to 76 % of what Task 43d measured (picker 50 of 67, shell 30 of 41, drawer 45 of 59, connect dialog
   * 8 of 11 (a modal makes the rest of the page inert, so few nodes), view picker 20 of 29, listen panel 35 of 47); the all-groups-open test uses 30, which was not measured
   * separately. (The 43a note "63 to 89" was not true of the dialog states.)
   * Each run also records its count as a test annotation.
   */
  const bad = async (page: Page, minLooked: number): Promise<string[]> => {
    const saved = await page.evaluate(() => {
      const st = document.body.style
      const prev = { value: st.getPropertyValue('overflow'), priority: st.getPropertyPriority('overflow'), height: document.body.scrollHeight }
      st.setProperty('overflow', 'visible')
      return prev
    })
    try {
      const r = await new AxeBuilder({ page }).analyze()
      // Proof the run was not blind: color-contrast really looked at text (passes + the ones axe could not decide).
      const looked = [...r.passes, ...r.incomplete, ...r.violations].filter((x) => x.id === 'color-contrast').reduce((n, x) => n + x.nodes.length, 0)
      test.info().annotations.push({ type: 'axe', description: `color-contrast looked at ${looked} node(s)` })
      expect(looked, 'color-contrast evaluated text nodes (axe is not blind)').toBeGreaterThanOrEqual(minLooked)
      expect(await page.evaluate(() => document.body.scrollHeight), 'lifting overflow did not change the document height').toBe(saved.height)
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
    } finally {
      const restored = await page.evaluate((prev) => {
        const st = document.body.style
        if (prev.value) st.setProperty('overflow', prev.value, prev.priority)
        else st.removeProperty('overflow')
        return st.getPropertyValue('overflow')
      }, saved)
      expect(restored, 'the inline overflow of body is back to what it was').toBe(saved.value)
    }
  }

  test('the place picker (first visit)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForFunction(() => !!window.__creation)
    await expect(page.getByTestId('place-picker')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    // Wave 1b finding 7: at 1366 x 768 (no taller window, no excluded card) axe's label-content-name-mismatch flagged 4 cards that straddle the bottom edge
    // of the picker's scroll area: the clipped size left "name type", not contained in the name "name size type". Fixed in placePicker.ts (the name order is
    // now name, type, size, badge: what can be clipped is last, so what stays visible is a prefix of the name). The rule runs on the real viewport.
    expect(await bad(page, 50)).toEqual([])
    // The Label-in-Name fix put the type after the name in the DOM; it is still DRAWN above the name, the size below it (the look did not change).
    // Checked on the first, a middle and the last place card, and on the first and last (wide, row layout) template card.
    const drawnTypeNameSize = async (card: Locator, label: string): Promise<void> => {
      await card.scrollIntoViewIfNeeded()
      const y = async (cls: string): Promise<number> => (await card.locator(cls).boundingBox())!.y
      expect(await y('.cr-card-type'), `${label}: type above name`).toBeLessThan(await y('.cr-card-name'))
      expect(await y('.cr-card-name'), `${label}: name above size`).toBeLessThan(await y('.cr-card-size'))
    }
    const places = page.locator('[data-testid="place-grid"] .cr-card')
    const nPlaces = await places.count()
    expect(nPlaces, 'the picker lists several places').toBeGreaterThan(3)
    for (const i of [0, Math.floor(nPlaces / 2), nPlaces - 1]) await drawnTypeNameSize(places.nth(i), `place card ${i} of ${nPlaces}`)
    const templates = page.locator('[data-testid="template-grid"] .cr-card')
    const nTemplates = await templates.count()
    expect(nTemplates, 'the picker lists templates').toBeGreaterThan(0)
    for (const i of new Set([0, nTemplates - 1])) await drawnTypeNameSize(templates.nth(i), `template card ${i} of ${nTemplates}`)
  })

  test('the shell with a place and the template on screen', async ({ page }) => {
    await boot(page, { powered: false })
    await expect(page.getByTestId('place-picker')).toBeHidden()
    expect(await bad(page, 30)).toEqual([])
  })

  test('the shell with every Projet tree group open (rows that contain their children)', async ({ page }) => {
    await boot(page, { powered: false })
    const tree = page.getByTestId('tree')
    for (const name of [/^Zones/, /^Matériel/, /^Câbles/, /^Points d’écoute/]) await tree.getByRole('treeitem', { name }).click() // a click on a group opens it
    await expect(tree.locator('[role="treeitem"][aria-expanded="true"]')).toHaveCount(4)
    expect(await tree.getByRole('treeitem').count(), 'the groups show their children').toBeGreaterThan(9)
    expect(await bad(page, 30)).toEqual([])
  })

  test('the inventory drawer, open', async ({ page }) => {
    await boot(page, { powered: false })
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('Space')
    await expect(drawer(page)).toBeVisible()
    expect(await bad(page, 45)).toEqual([])
  })

  test('the connect dialog, open', async ({ page }) => {
    await boot(page, { powered: false })
    await page.locator('#renderCanvas').focus()
    for (let i = 0; i < 8 && (await page.evaluate(() => window.__creation!.selection())) !== 'ql1'; i++) await page.keyboard.press(']')
    expect(await page.evaluate(() => window.__creation!.selection())).toBe('ql1')
    const opener = page.locator('[data-key="connect:out-main-l"]')
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('cr-connect-dialog')).toBeVisible()
    expect(await bad(page, 8)).toEqual([])
  })

  test('the view picker, open', async ({ page }) => {
    await boot(page, { powered: false })
    await page.locator('#renderCanvas').focus()
    await page.keyboard.press('v')
    await expect(page.getByRole('dialog', { name: 'Choisir une vue' })).toBeVisible()
    expect(await bad(page, 20)).toEqual([])
  })

  test('the listen panel (the Écoute block on screen; playback is not running)', async ({ page }) => {
    await boot(page)
    await choose(page, 'Lecture') // the block is part of the lazy listen chunk: the first Lecture brings it
    await waitState(page, 'playing')
    await choose(page, 'Stop')
    await waitState(page, 'stopped')
    await expect(page.getByTestId('listen-panel')).toBeVisible()
    await expect(page.getByTestId('listen-transport')).toBeVisible()
    await settled(page)
    expect(await bad(page, 35)).toEqual([])
  })
})

/**
 * CA-24 (audit; fixed in Task 43d): Babylon's glTF loader used to fetch its Draco decoder from https://cdn.babylonjs.com/ at runtime (26 of the 53 shipped
 * models are Draco-compressed; a third party is blocked by school filters, absent offline, and learns every visitor's IP). The decoder (draco3dgltf 1.5.7,
 * Apache-2.0) is now vendored under public/draco/ and `DracoCompression.Configuration` points to it (src/render/draco.ts, set by Mode Création's boot and by the
 * legacy entry). These tests are the guard: NO request leaves the origin IN THE SESSIONS THEY EXERCISE (Chromium; one creation session and one legacy level, not every path of the app), and the decoder really is fetched from /draco/ (so "no foreign request" is not
 * a pass because nothing was decoded). Requests are read on the browser context, so a dedicated worker's fetch (where the wrapper loads) is seen too.
 * Not seen by this listener: WebSocket and EventSource traffic.
 */
const DRACO_FILES = ['/draco/draco_decoder_gltf.wasm', '/draco/draco_decoder_gltf_nodejs.js']

/** Every request of the page and its workers, and the status of each response. */
const watch = (page: Page) => {
  const urls: string[] = []
  const status = new Map<string, number>()
  const problems: string[] = []
  page.context().on('request', (r) => urls.push(r.url()))
  page.context().on('response', (r) => status.set(new URL(r.url()).pathname, r.status()))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
  })
  return {
    real: () => urls.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:')),
    status,
    problems,
  }
}

const expectSameOriginDraco = (w: ReturnType<typeof watch>, origin: string, base = '/'): void => {
  const urls = w.real().map((u) => new URL(u))
  const foreign = urls.filter((u) => u.origin !== origin)
  expect(foreign.map((u) => u.href), 'cross-origin requests (CA-24)').toEqual([])
  const draco = [...new Set(urls.map((u) => u.pathname))].filter((p) => p.startsWith(base + 'draco/'))
  expect(draco.sort(), 'the Draco decoder is fetched from the same origin').toEqual(DRACO_FILES.map((f) => base + f.slice(1)).sort())
  for (const p of draco) expect(w.status.get(p), `${p} answered 200`).toBe(200)
  const dracoProblems = w.problems.filter((m) => /draco|decoder|wasm|importScripts/i.test(m))
  expect(dracoProblems, 'no decoder error in the console').toEqual([])
}

test('CA-24: a whole Mode Création session (boot, Draco template models, drawer, playback, coverage) makes no cross-origin request; the decoder comes from /draco/', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.locator('#renderCanvas').focus()
  await page.keyboard.press('Space')
  await expect(drawer(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await choose(page, 'Lecture')
  await waitState(page, 'playing')
  await ecoute(page).click()
  await page.getByRole('menuitemcheckbox', { name: 'Couverture' }).click()
  await page.waitForFunction(() => window.__creation!.coverage().status === 'ready' && !window.__creation!.coverage().pending, null, { timeout: 20_000 })
  await choose(page, 'Stop')
  await waitState(page, 'stopped')
  await settled(page)
  expect(w.real().length, 'the session made requests at all').toBeGreaterThan(20)
  expectSameOriginDraco(w, new URL(page.url()).origin)
  // The models really were DECODED, not left as placeholder boxes (measured: decoder blocked = 109 meshes and QL1 at the box centre [0, 0.125, 8]; decoded = 124 meshes).
  expect(await page.evaluate(() => window.__creation!.meshCount()), 'decoded meshes in the scene').toBeGreaterThan(120)
  expect(await page.evaluate(() => window.__creation!.deviceBodyCenter('ql1')), 'QL1 is its real model, not the placeholder box').not.toEqual([0, 0.125, 8])
  test.info().annotations.push({ type: 'CA-24', description: `${w.real().length} requests, 0 cross-origin; Draco: ${DRACO_FILES.join(', ')}` })
})

test('CA-24 (legacy entry): a level with devices makes no cross-origin request; the decoder comes from /draco/', async ({ page }) => {
  const w = watch(page)
  await page.goto('/?level=a1')
  // the shelf devices are .glb files, most of them Draco-compressed: wait until the decoder has been asked for, and the network is quiet
  await expect.poll(() => w.real().filter((u) => new URL(u).pathname === DRACO_FILES[0]).length, { message: 'the legacy path asked for the decoder', timeout: 30_000 }).toBeGreaterThan(0)
  await page.waitForLoadState('networkidle')
  expect(w.real().filter((u) => u.endsWith('.glb')).length, 'devices were fetched').toBeGreaterThan(0)
  expectSameOriginDraco(w, new URL(page.url()).origin)
})
