/**
 * T7.1b: geometry and axe (onboarding packs, plan T7.1b, spec 11.3 and 11.4; the errata of the spec override older text).
 *
 * 11.3, rectangle intersection and never centre points: at 1366 x 768, 1024 x 768 (tablet) and 820 x 1180, Oscar's ICON, his BUBBLE and the STEP CARD are intersected with every visible control
 * of the shell (buttons, menu items, inputs, tabs, tree rows: `controlsUnder` in onboardingKit.ts), with NO exemption for the current target: the bubble may sit beside the target, never on it.
 * Per step at 1366 x 768; at rest and at two steps on the other viewports. Five CLASSES of claim, each its own test per package, so that a breach of one never hides the others:
 *  - CONTROLS: icon, bubble and card cover no visible control;
 *  - FRAME: icon, bubble and card stay inside the window, the card never meets Oscar, the bubble never sits on the icon;
 *  - TARGET: icon and bubble are clear of the ring (the target's rect) and of the target DEVICE's own screen box (`bodyBoundsInRoot` + `worldScreen`) where the ring is on a device of the bench;
 *  - CENTRE: a box of 20 % x 20 % of the 3D view (`.cr-viewport`) meets neither the icon, the bubble nor the card (the ledger's measure of « the centre is free »);
 *  - MARGIN: at step 4 the bubble keeps about 30 px from the target (the ledger's measure).
 * Reserved rows, measured: the gear row at 390 px wide (it wraps, at most 220 px, the view keeps more than half the window), package 5 with the tutorial card AND the gear row at 1024 x 768 (the view
 * keeps at least 560 px), the tablet card with its key (the tallest card a tablet shows; the first-sound framing reserves less).
 * 11.4: axe on both start stages, the workspace, EVERY tutorial step of each package, the checklist and the connect dialog.
 *
 * The 500 ms bridge poll is waited for with web-first assertions and `expect.poll` (the card says « Étape k sur n », the geometry has stopped moving), never with a sleep standing in for it.
 * KNOWN FINDINGS (see `KNOWN_GEOM`, G14e review C1): where a class is breached today the assertion is NOT loosened. The exact samples that breach it (package, viewport, moment, class) are pinned, and
 * the test asserts the measured list EQUALS the pinned one: green while the known breaches stand, red the day one is fixed or a new one appears. Measured numbers are printed as `GEOM` lines.
 * The one single-sample finding of the reserved rows (F5) keeps its `test.fail`.
 */
import type { Page } from '@playwright/test'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { quietWindow } from './waits'
import { act, axeLines, expect, test, box, centreBox, controlsUnder, enter, gapBetween, intersects, MODEL_LEFT, openFresh, PROFILES, spawn, STEP_INTENTS, start, testSignal, waitStartScreen, waitStep, type Rect, answerFirstQuestion } from './onboardingKit'

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
] as const
type Size = { width: number; height: number }

/** The three-step route (package 5) is read from the package's own start mode, never from its number. */
const onModel = (id: DesignId): boolean => packageById(id).layout.start === 'playable-model'
const stepsOf = (id: DesignId): number => packageById(id).pacing.steps.length

// ── reading the page ──────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Geo {
  icon: Rect | null
  bubble: Rect | null
  ring: Rect | null
  card: Rect | null
  view: Rect
}
const readGeo = (page: Page): Promise<Geo> =>
  page.evaluate(() => {
    const rect = (sel: string): { x: number; y: number; width: number; height: number } | null => {
      const e = document.querySelector<HTMLElement>(sel)
      if (e === null || e.hidden) return null
      const cs = getComputedStyle(e)
      const b = e.getBoundingClientRect()
      return cs.display === 'none' || cs.visibility === 'hidden' || b.width === 0 || b.height === 0 ? null : { x: b.x, y: b.y, width: b.width, height: b.height }
    }
    return { icon: rect('.oscar-icon'), bubble: rect('.oscar-bubble'), ring: rect('.oscar-ring:not(.oscar-ring-drop)'), card: rect('[data-testid="tutorial-card"]'), view: rect('.cr-viewport')! }
  })
const geoKey = (g: Geo): string => JSON.stringify(g, (_k, v: unknown) => (typeof v === 'number' ? Math.round(v) : v))

/** The geometry once the guide has stopped moving (glides, the ring's settle, the 5 s re-read): two reads 350 ms apart are equal. A state wait on the page, not a guessed delay. */
async function settledGeo(page: Page): Promise<Geo> {
  let last = ''
  let g = await readGeo(page)
  await expect
    .poll(
      async () => {
        g = await readGeo(page)
        const same = geoKey(g) === last
        last = geoKey(g)
        await page.waitForTimeout(350)
        return same
      },
      { timeout: 15_000, message: 'the icon, the bubble and the ring never came to rest' },
    )
    .toBe(true)
  return g
}

/**
 * The screen box of each device of the bench: « the target device's rect ». `bodyBoundsInRoot` is in the frame of the INSTANCE ROOT (centred on (0, 0) in x / z, src/scene/debugBody.ts), so each of
 * its eight corners is first put where the design places the device (G14e, review C2): the root's pose as src/creation/sceneHost.ts `pose()` sets it, rotation (-tiltDeg, yawDeg, 0) in Babylon's
 * order (pitch about x, then yaw about y; left-handed, row vectors) and translation `position_m`, read from the design's own placement, then through the scene's camera (`worldScreen`).
 * `frame: 'root'` is the old reading (the root-frame corners fed to `worldScreen` as world points, every device drawn at the origin), kept only for the proof that the two differ.
 */
const deviceBoxes = (page: Page, frame: 'placed' | 'root' = 'placed'): Promise<Record<string, Rect>> =>
  page.evaluate((frame) => {
    const c = window.__creation!
    const design = c.design()
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {}
    for (const i of design.rig.instances) {
      const b = c.bodyBoundsInRoot(i.instanceId)
      const p = design.placements.find((q) => q.instanceId === i.instanceId)
      if (!b || !p) continue
      const yaw = (p.yawDeg * Math.PI) / 180
      const pitch = (-(p.tiltDeg ?? 0) * Math.PI) / 180
      const place = (x: number, y: number, z: number): [number, number, number] => {
        if (frame === 'root') return [x, y, z]
        const y1 = y * Math.cos(pitch) - z * Math.sin(pitch)
        const z1 = y * Math.sin(pitch) + z * Math.cos(pitch)
        const x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw)
        const z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw)
        return [x2 + p.position_m[0], y1 + p.position_m[1], z2 + p.position_m[2]]
      }
      const xs: number[] = []
      const ys: number[] = []
      for (const x of [b.lo[0], b.hi[0]])
        for (const y of [b.lo[1], b.hi[1]])
          for (const z of [b.lo[2], b.hi[2]]) {
            const s = c.worldScreen(place(x, y, z))
            if (s) {
              xs.push(s.x)
              ys.push(s.y)
            }
          }
      if (xs.length === 0) continue
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      out[i.instanceId] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
    }
    return out
  }, frame)

const CLASSES = ['controls', 'frame', 'target', 'centre', 'margin'] as const
type Cls = (typeof CLASSES)[number]
interface Sample {
  /** `rest`, `rest + bubble` or `step k`, with the viewport. */
  where: string
  step: number | null
  breaches: { cls: Cls; text: string }[]
  /** Printed for the report. */
  numbers: Record<string, number | string | null>
  bubble: boolean
}
const rectText = (r: Rect): string => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`

/**
 * The guide re-reads the page on a 5 s tick (and 250 ms behind a change: G2-fix), so a position taken a moment after the drawer opened or the window changed can be the one BEFORE the re-read: package 5 at
 * 820 x 1180 was once measured with the icon on a drawer card and never again in 6 runs. A REST position is where the icon is after one whole tick, so a sample (at rest or at a step, G14b) waits a quiet window of 5.5 s first.
 */
const TICK_QUIET_MS = 5500

/** Everything 11.3 asks of one moment, sorted into its classes. `margin`: the gap the bubble must keep from the target (asked at step 4). */
async function sample(page: Page, id: DesignId, where: string, step: number | null, size: Size, margin?: number): Promise<Sample> {
  // G14b: a step sample too. The guide's soft obstacles (src/guide/clearance.ts) can re-place it once the bench's models and the bubble have settled; a place held
  // for about 1.5 s before that passed the 350 ms stability read, and the class verdict then depended on timing (measured: package 2 and 4 margin, 11 px or 30).
  await quietWindow(page, TICK_QUIET_MS)
  const g = await settledGeo(page)
  const breaches: Sample['breaches'] = []
  const add = (cls: Cls, text: string): void => void breaches.push({ cls, text })
  const names = (hits: { name: string }[]): string => hits.map((h) => h.name).join(' | ')
  const numbers: Sample['numbers'] = { icon: g.icon ? rectText(g.icon) : null, bubble: g.bubble ? rectText(g.bubble) : null, card: g.card ? rectText(g.card) : null, ring: g.ring ? rectText(g.ring) : null, view: `${Math.round(g.view.width)}x${Math.round(g.view.height)}` }
  const inside = (r: Rect): boolean => r.x >= -1 && r.y >= -1 && r.x + r.width <= size.width + 1 && r.y + r.height <= size.height + 1
  const free = centreBox(g.view, 0.2)
  if (g.icon === null) add('frame', 'no icon')
  else {
    const icon = g.icon
    if (!inside(icon)) add('frame', `icon outside the window: ${rectText(icon)}`)
    const onIcon = await controlsUnder(page, icon)
    if (onIcon.length) add('controls', `icon covers ${names(onIcon)}`)
    if (intersects(icon, free)) add('centre', 'icon in the centre box')
    if (g.bubble && intersects(g.bubble, icon)) add('frame', 'bubble on the icon')
    if (g.card && intersects(g.card, icon)) add('frame', 'card meets the icon')
    if (g.ring) {
      if (intersects(icon, g.ring)) add('target', `icon on the ring ${rectText(g.ring)}`)
      numbers.iconToRing = Math.round(gapBetween(icon, g.ring))
    }
  }
  if (g.bubble) {
    const b = g.bubble
    if (!inside(b)) add('frame', `bubble outside the window: ${rectText(b)}`)
    const onBubble = await controlsUnder(page, b)
    if (onBubble.length) add('controls', `bubble covers ${names(onBubble)}`)
    if (intersects(b, free)) add('centre', 'bubble in the centre box')
    if (g.card && intersects(g.card, b)) add('frame', 'card meets the bubble')
    if (g.ring) {
      if (intersects(b, g.ring)) add('target', `bubble on the ring ${rectText(g.ring)}`)
      numbers.bubbleToRing = Math.round(gapBetween(b, g.ring))
    }
  }
  if (g.card) {
    if (!inside(g.card)) add('frame', `card outside the window: ${rectText(g.card)}`)
    const onCard = await controlsUnder(page, g.card, '[data-testid="tutorial-slot"]')
    if (onCard.length) add('controls', `card covers ${names(onCard)}`)
    if (intersects(g.card, free)) add('centre', 'card in the centre box')
  }
  if (g.ring) {
    // the device the ring is on, if any: the bench device whose screen box centre lies inside the ring
    const devices = await deviceBoxes(page)
    const ring = g.ring
    const hit = Object.entries(devices).find(([, d]) => d.x + d.width / 2 >= ring.x && d.x + d.width / 2 <= ring.x + ring.width && d.y + d.height / 2 >= ring.y && d.y + d.height / 2 <= ring.y + ring.height)
    if (hit) {
      const [id, d] = hit
      numbers.targetDevice = `${id} ${rectText(d)}`
      if (g.icon && intersects(g.icon, d)) add('target', `icon covers the target device ${id} (${rectText(d)})`)
      if (g.bubble && intersects(g.bubble, d)) add('target', `bubble covers the target device ${id} (${rectText(d)})`)
      if (g.bubble) numbers.bubbleToDevice = Math.round(gapBetween(g.bubble, d))
    }
    if (margin !== undefined) {
      if (!g.bubble) add('margin', 'no bubble to measure the margin of')
      else if (gapBetween(g.bubble, ring) < margin) add('margin', `bubble keeps ${Math.round(gapBetween(g.bubble, ring))} px from the target, wants ${margin} px`)
    }
  }
  const s: Sample = { where: `${where} @${size.width}x${size.height}`, step, breaches, numbers, bubble: g.bubble !== null }
  console.log('GEOM', JSON.stringify({ package: id, at: s.where, ...numbers, breaches: breaches.map((b) => `${b.cls}: ${b.text}`) }))
  return s
}

// ── walking a tutorial ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Brings the run from step k-1 to step k with the real bench change that step k-1 waits for (the model route: the sound, then the unplug). */
async function advance(page: Page, id: DesignId, k: number): Promise<void> {
  if (onModel(id)) {
    if (k === 2) await testSignal(page)
    else await act(page, [{ type: 'UNPLUG', a: MODEL_LEFT.a, b: MODEL_LEFT.b }])
  } else await act(page, [...STEP_INTENTS[k - 2]])
  await waitStep(page, k, stepsOf(id))
}
/** Both the card and Oscar's bubble have to say step k: the bubble is refreshed by the guide's poll, after the card. */
const bubbleSays = (page: Page, k: number, n: number) => expect(page.locator('.oscar-live')).toContainText(`étape ${k} sur ${n}`, { timeout: 15_000 })
/** Takes the tutorial on package `id`, then calls `at(k)` on each step in `stops`, advancing through the steps in between. */
async function walk(page: Page, id: DesignId, stops: readonly number[], at: (k: number) => Promise<void>): Promise<void> {
  const n = stepsOf(id)
  await enter(page, id, { tutorial: true })
  await waitStep(page, 1, n)
  for (let k = 1; k <= Math.max(...stops); k++) {
    if (k > 1) await advance(page, id, k)
    if (stops.includes(k)) {
      await bubbleSays(page, k, n)
      await at(k)
    }
  }
}
/** The step whose bubble must keep its margin from the target (the ledger: step 4, the connect step) on the ten-step route. */
const MARGIN_STEP = 4
const MARGIN_PX = 30

// ── known findings ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * G14e (review C1): the known breaches are pinned EXACTLY, per package, per class, per sample (`<moment> @<viewport>`: `rest`, `rest + bubble` or `step k`), the way the proxy pins KNOWN_UNLED. Each class
 * test asserts that the list of samples that breach it EQUALS its list here: a breach that goes away (fixed) or a new one (a regression, or a 1366 breach that used to hide behind a 1024 one) turns the
 * test red, and the entry is updated with the report's numbers. No `test.fail`: a class with no entry is a plain « nothing breaches ». The numbers of each sample are the `GEOM` lines and report G14e.
 * Measured on the build of HEAD 9e81af1 with the device boxes projected through each placement (C2), 2026-11-14.
 */
const FINDING: Record<Cls, string> = {
  controls: 'F4 / F5 (no room: the bubble on a control of the view cube or a panel)',
  frame: 'none',
  target: 'F1 (no room: the icon or the bubble on the ring or on the target device)',
  centre: 'F2 (the centre is the first thing given up where no place clear of the controls holds the 352 px bubble)',
  margin: 'F3 (no room: the bubble closer than 30 px to the target at step 4)',
}
/** Packages 2 and 4 (two panels open at 1366, the drawer too at 1024): the same samples breach, in the same classes. */
const TWO_PANELS = {
  controls: ['step 4 @1024x768'],
  target: ['step 4 @1024x768', 'step 4 @1366x768', 'step 6 @1366x768', 'step 8 @1366x768', 'step 9 @1366x768'],
  centre: ['rest + bubble @1024x768', 'rest + bubble @1366x768', 'rest + bubble @820x1180', 'step 1 @1024x768', 'step 4 @1024x768', 'step 4 @1366x768', 'step 6 @1366x768', 'step 7 @1366x768', 'step 8 @1366x768', 'step 9 @1366x768'],
  margin: ['step 4 @1024x768'],
} as const
const KNOWN_GEOM: Record<DesignId, Partial<Record<Cls, readonly string[]>>> = {
  // step 4 @1024: the icon on the console (ql1 423,297 178x159; iconToRing 0) and in the centre box; the opened bubble at rest @820 in the centre box
  // Equipment merge (2026-11-14, deploy/onboarding-equipment-20261114): step 7 @1366 joins, as package 3's step 7. The 113-device catalogue adds « Amplis », « Réseau », « Câbles et DI » and
  // « Pieds et accroches » before « Secteur » in the drawer's tab row, so the ringed Secteur tab moves to 1034,500 78x44; Oscar's icon sits 33 px above it (1045,411) and the bubble goes to the
  // left (201,117 352x379): its right edge (553) is 0.2 px inside the centre box (552.8 = 32 + 0.4 x 1302). Measured the same with and without the merge fix of src/guide/reveal.ts.
  1: { target: ['step 4 @1024x768'], centre: ['rest + bubble @820x1180', 'step 4 @1024x768', 'step 7 @1366x768'] },
  2: TWO_PANELS,
  // step 4 @1024 as package 1; step 9 @1366 the icon on the speaker (k12 818,202 213x236; iconToRing 4); step 7 @1366 the bubble in the centre box
  3: { target: ['step 4 @1024x768', 'step 9 @1366x768'], centre: ['step 4 @1024x768', 'step 7 @1366x768'] },
  4: TWO_PANELS,
  // the opened bubble at rest @1024 and @820, the bubble at step 1 and the icon and bubble at step 3 @1024 in the centre box; nothing at 1366
  5: { centre: ['rest + bubble @1024x768', 'rest + bubble @820x1180', 'step 1 @1024x768', 'step 3 @1024x768'] },
}
/** Spec 11.3 (line 497): « bubble plus icon leave the canvas centre free at 1366 x 768 », the 1366 samples where the ICON or the BUBBLE meets the centre box (the card is the CENTRE class's business). */
const KNOWN_CENTRE_1366: Record<DesignId, readonly string[]> = {
  1: ['step 7 @1366x768'], // equipment merge 2026-11-14: see KNOWN_GEOM[1] (bubble 0.2 px into the centre box, the Secteur tab moved right)
  2: ['rest + bubble @1366x768', 'step 4 @1366x768', 'step 6 @1366x768', 'step 7 @1366x768', 'step 8 @1366x768', 'step 9 @1366x768'],
  3: ['step 7 @1366x768'],
  4: ['rest + bubble @1366x768', 'step 4 @1366x768', 'step 6 @1366x768', 'step 7 @1366x768', 'step 8 @1366x768', 'step 9 @1366x768'],
  5: [],
}
/** Review S10: the tutorial steps where no bubble was there to measure (the bubble is the thing 11.3 is mostly about): pinned exactly, so a step that loses its bubble is seen. */
const KNOWN_NO_BUBBLE: Record<DesignId, readonly string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
const sorted = (xs: readonly string[]): string[] => [...xs].sort()

test.describe.configure({ mode: 'parallel' })

// ── 11.3, per package ─────────────────────────────────────────────────────────────────────────────────────────────────────────

for (const id of DESIGN_IDS) {
  const n = stepsOf(id)
  const all = Array.from({ length: n }, (_v, i) => i + 1)
  const probes = onModel(id) ? [1, n] : [1, MARGIN_STEP]
  // one measuring pass per package (a serial group on its own worker): the page is walked once, then each class is its own test
  test.describe(`package ${id}: 11.3`, () => {
    test.describe.configure({ mode: 'default' })
    const samples: Sample[] = []

    test.beforeAll(async ({ browser }, testInfo) => {
      testInfo.setTimeout(600_000)
      samples.length = 0
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: vp })
        const page = await ctx.newPage()
        try {
          // at rest: the room open, no tutorial, the icon alone, then the bubble the learner opens with a click
          await enter(page, id, { tutorial: false })
          samples.push(await sample(page, id, 'rest', null, vp))
          await page.locator('.oscar-icon').click()
          await expect(page.locator('.oscar-bubble')).toBeVisible()
          samples.push(await sample(page, id, 'rest + bubble', null, vp))
          // on a tutorial run: every step at 1366 x 768, two steps on the other viewports
          await walk(page, id, vp.width === 1366 ? all : probes, async (k) => {
            samples.push(await sample(page, id, `step ${k}`, k, vp, !onModel(id) && k === MARGIN_STEP ? MARGIN_PX : undefined))
          })
        } finally {
          await ctx.close()
        }
      }
    })

    test('the scan is not vacuous: every viewport, every step, the bubble and the card were measured', () => {
      for (const vp of VIEWPORTS) {
        const here = samples.filter((s) => s.where.endsWith(`@${vp.width}x${vp.height}`)).map((s) => s.where.split(' @')[0])
        expect(here, `${vp.width}: what was measured`).toEqual(['rest', 'rest + bubble', ...(vp.width === 1366 ? all : probes).map((k) => `step ${k}`)])
      }
      const steps = samples.filter((s) => s.step !== null)
      // S10: a bubble at every tutorial step, except the steps pinned in KNOWN_NO_BUBBLE
      expect(sorted(steps.filter((s) => !s.bubble).map((s) => s.where)), 'tutorial steps measured without a bubble').toEqual(sorted(KNOWN_NO_BUBBLE[id]))
      expect(steps.filter((s) => s.numbers.card !== null).length, 'the card was there at every step').toBe(steps.length)
      // S11: the icon was there in every sample (a missing icon is a FRAME breach too, but the scan must not be vacuous)
      expect(samples.filter((s) => s.numbers.icon === null).map((s) => s.where), 'samples without the icon').toEqual([])
    })

    /** The samples that breach `cls`, with the breaches' own text and numbers for the failure message. */
    const breaching = (cls: Cls, only: (s: Sample, text: string) => boolean = () => true): { keys: string[]; detail: string } => {
      const hits = samples.map((s) => ({ s, texts: s.breaches.filter((b) => b.cls === cls && only(s, b.text)).map((b) => b.text) })).filter((h) => h.texts.length > 0)
      return { keys: sorted(hits.map((h) => h.s.where)), detail: hits.map((h) => `${h.s.where}: ${h.texts.join('; ')} ${JSON.stringify(h.s.numbers)}`).join('\n') }
    }

    for (const cls of CLASSES) {
      if (cls === 'margin' && onModel(id)) continue
      const known = KNOWN_GEOM[id][cls] ?? []
      const claim: Record<Cls, string> = {
        controls: 'icon, bubble and card cover no visible control, at rest and at every step',
        frame: 'icon, bubble and card stay inside the window; the card never meets Oscar; the bubble never sits on the icon',
        target: 'the icon and the bubble are clear of the target (the ring, and the target device’s own box)',
        centre: 'the centre 20 % x 20 % of the view is free of the icon, the bubble and the card',
        margin: `the bubble keeps ${MARGIN_PX} px from the target at step ${MARGIN_STEP}`,
      }
      test(`${cls.toUpperCase()}: ${claim[cls]}${known.length ? ` [known ${FINDING[cls].split(' ')[0]}: exactly ${known.length} sample(s) pinned]` : ''}`, () => {
        const { keys, detail } = breaching(cls)
        expect(keys, `${cls}: the samples that breach it (pinned list in KNOWN_GEOM)\n${detail}`).toEqual(sorted(known))
      })
    }

    const centre1366 = KNOWN_CENTRE_1366[id]
    test(`CENTRE AT 1366 x 768 (spec 11.3: bubble plus icon leave the canvas centre free)${centre1366.length ? ` [known F2: exactly ${centre1366.length} sample(s) pinned]` : ''}`, () => {
      const { keys, detail } = breaching('centre', (s, text) => s.where.endsWith('@1366x768') && /^(icon|bubble) in the centre box$/.test(text))
      expect(samples.filter((s) => s.where.endsWith('@1366x768')).length, 'the 1366 samples were taken').toBe(2 + n)
      expect(keys, `the 1366 samples where the icon or the bubble meets the centre box\n${detail}`).toEqual(sorted(centre1366))
    })
  })
}

// ── reserved rows, measured ───────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('reserved rows', () => {
  const ENTREPRENEUR = PROFILES[2]
  const BENCH = [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1), spawn('multiprise-secteur', 'strip', 0.4), ...STEP_INTENTS[3], ...STEP_INTENTS[5], ...STEP_INTENTS[7], ...STEP_INTENTS[8]]

  test('390 x 844: the gear row wraps, stays within 220 px, leaves the view more than half the window, and Oscar is off it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await enter(page, 1, { profile: ENTREPRENEUR.key, tutorial: false })
    await act(page, BENCH)
    await testSignal(page)
    const row = page.getByTestId('gear-slot')
    await expect(row).toBeVisible()
    const r = await box(row)
    const view = await box(page.locator('.cr-viewport'))
    const tops = await page.getByTestId('own-gear-venue').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))])
    console.log('GEOM', JSON.stringify({ at: 'gear row @390x844', row: rectText(r), view: rectText(view), venueRows: tops.length }))
    expect(tops.length, 'the three venue cards wrap onto more than one row').toBeGreaterThan(1)
    expect(r.height, 'a strip, not a panel (measured 197 px)').toBeLessThanOrEqual(220)
    expect(view.height, 'the 3D view keeps more than half of the window').toBeGreaterThan(844 / 2)
    expect(r.x + r.width).toBeLessThanOrEqual(390 + 1)
    const g = await settledGeo(page)
    // S11: the icon must be there, or « Oscar is off the gear row » holds of nothing; the bubble is closed at rest (asserted only when open)
    expect(g.icon, 'Oscar’s icon is on the page').not.toBeNull()
    expect(intersects(g.icon!, r), 'Oscar’s icon is off the gear row').toBe(false)
    if (g.bubble) expect(intersects(g.bubble, r), 'Oscar’s bubble is off the gear row').toBe(false)
  })

  /** Package 5 with the tutorial running on step 2 and the entrepreneur's gear row up, at 1024 x 768: the two reserved rows and Oscar. */
  async function packageFiveWithBothRows(page: Page): Promise<{ gear: Rect; card: Rect; view: Rect; status: Rect; g: Geo }> {
    await page.setViewportSize({ width: 1024, height: 768 })
    const id = DESIGN_IDS.find(onModel)!
    await openFresh(page, `?design=${id}`)
    await waitStartScreen(page)
    await page.keyboard.press(ENTREPRENEUR.key)
    await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
    await page.waitForFunction(() => window.__creation?.place() === 'blank')
    await waitStep(page, 1, stepsOf(id))
    await testSignal(page)
    await expect(page.getByTestId('gear-slot')).toBeVisible()
    await waitStep(page, 2, stepsOf(id))
    const gear = await box(page.getByTestId('gear-slot'))
    const card = await box(page.getByTestId('tutorial-slot'))
    const view = await box(page.locator('.cr-viewport'))
    const status = await box(page.getByTestId('status-bar'))
    // G14b: the guide re-places itself once the bench's models and the gear row have settled (its obstacles change with them); a place held for 1.5 s before that
    // passed the 350 ms stability read. The rows are measured as they rest: one whole tick, as for the rest samples.
    await quietWindow(page, TICK_QUIET_MS)
    const g = await settledGeo(page)
    console.log('GEOM', JSON.stringify({ at: 'P5 card + gear row @1024x768', card: rectText(card), gear: rectText(gear), view: rectText(view), icon: g.icon ? rectText(g.icon) : null, bubble: g.bubble ? rectText(g.bubble) : null }))
    return { gear, card, view, status, g }
  }

  test('package 5, tutorial card AND gear row at 1024 x 768: two reserved rows, the view keeps at least 560 px, nothing overlaps, Oscar is clear of both', async ({ page }) => {
    const { gear, card, view, status, g } = await packageFiveWithBothRows(page)
    expect(view.height, 'the 3D view keeps at least 560 px').toBeGreaterThanOrEqual(560)
    expect(intersects(gear, card), 'the two rows are apart').toBe(false)
    expect(card.y + card.height).toBeLessThanOrEqual(view.y + 1)
    expect(view.y + view.height).toBeLessThanOrEqual(gear.y + 1)
    expect(gear.y + gear.height).toBeLessThanOrEqual(status.y + 1)
    expect(g.icon, 'S11: Oscar’s icon is on the page').not.toBeNull()
    for (const [what, r] of [['icon', g.icon], ['bubble', g.bubble]] as const) {
      if (r === null) continue // the bubble only (the icon is asserted above)
      expect(intersects(r, gear), `${what} is clear of the gear row`).toBe(false)
      expect(intersects(r, card), `${what} is clear of the step card`).toBe(false)
    }
  })

  test('package 5, tutorial card AND gear row at 1024 x 768: the icon and the bubble cover no control [known finding F5: the bubble covers the view cube’s three buttons]', async ({ page }) => {
    test.fail(true, 'F5 (package 5, 1024 x 768, tutorial step 2 and the gear row: the bubble covers the view cube’s « Tourner de 90° à gauche », « Tourner de 90° à droite » and « Vue d’ensemble » buttons)')
    const { g } = await packageFiveWithBothRows(page)
    expect(g.icon, 'S11: Oscar’s icon is on the page').not.toBeNull()
    for (const [what, r] of [['icon', g.icon], ['bubble', g.bubble]] as const) {
      if (r === null) continue // the bubble, when closed (the icon is asserted above)
      expect((await controlsUnder(page, r)).map((h) => h.name), `${what} covers no control`).toEqual([])
    }
  })

  // The tablet card with its key: the tallest card a tablet shows. The first-sound framing reserves TUTORIAL_ROW_PX (49) of it; the rest comes out of the view after the framing was made.
  for (const vp of [{ width: 1024, height: 768 }, { width: 820, height: 1180 }, { width: 768, height: 1024 }] as const)
    test(`${vp.width} x ${vp.height}: the card with its key (a « passée » mark) keeps the view above half the window, clear of Oscar and the centre, and an SM58 at the start point is still 40 px wide`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(vp)
      await enter(page, 1, { tutorial: true })
      await waitStep(page, 1, 10)
      await act(page, [...STEP_INTENTS[0]])
      await waitStep(page, 2, 10)
      await page.locator('.oscar-chips').getByRole('button', { name: 'Passer cette étape', exact: true }).click()
      await waitStep(page, 3, 10)
      await expect(page.getByTestId('tutorial-legend')).toBeVisible() // the key row: the card at its tallest
      const g = await settledGeo(page)
      const card = await box(page.getByTestId('tutorial-slot'))
      const view = await box(page.locator('.cr-viewport'))
      expect(g.icon).not.toBeNull()
      // the mic where the product starts a placement: the floor point under the middle of the view (the framing's own claim: 40 px)
      const seed = await page.evaluate(() => {
        const cam = window.__creation!.camera()!
        const eye = [cam.target[0] + cam.radius * Math.cos(cam.alpha) * Math.sin(cam.beta), cam.target[1] + cam.radius * Math.cos(cam.beta), cam.target[2] + cam.radius * Math.sin(cam.alpha) * Math.sin(cam.beta)]
        const f = [cam.target[0] - eye[0], cam.target[1] - eye[1], cam.target[2] - eye[2]]
        const t = -eye[1] / f[1]
        return { x: eye[0] + f[0] * t, z: eye[2] + f[2] * t }
      })
      await page.evaluate((p) => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'probe', position: [p.x, 0, p.z], rotationY: 0 } as never), seed)
      await page.waitForFunction(() => window.__creation!.modelsPending() === 0)
      const mic = (await deviceBoxes(page)).probe
      const widest = Math.max(mic.width, mic.height)
      console.log('GEOM', JSON.stringify({ at: `tablet card with key @${vp.width}x${vp.height}`, card: rectText(card), view: rectText(view), sm58Widest: Math.round(widest) }))
      expect(view.height, 'the view keeps more than half the window').toBeGreaterThan(vp.height / 2)
      expect(intersects(g.icon!, card), 'the icon is clear of the card').toBe(false)
      expect(intersects(card, centreBox(view, 0.2)), 'the centre of the view is clear of the card').toBe(false)
      expect(widest, 'the SM58 at the start point keeps 40 px on its widest axis').toBeGreaterThanOrEqual(40)
    })
})

// ── the device box reader, proven (review C2) ─────────────────────────────────────────────────────────────────────────────────────

test('the target-device box is projected where the device stands: a K12 placed away from the origin and turned 90° holds its own placement point, the old root-frame reading does not', async ({ page }) => {
  await enter(page, 1, { tutorial: false })
  await page.evaluate(() => window.__creation!.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'far', position: [-1.2, 0, 0.3], rotationY: 90 } as never))
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0 && !window.__creation!.cameraMoving())
  const placed = (await deviceBoxes(page)).far
  const root = (await deviceBoxes(page, 'root')).far
  // independent of the box: the placement's own floor point and the point above it at the body's top, each through the camera
  const marks = await page.evaluate(() => {
    const c = window.__creation!
    const p = c.design().placements.find((q) => q.instanceId === 'far')!
    const top = c.bodyBoundsInRoot('far')!.hi[1]
    return { foot: c.worldScreen(p.position_m), head: c.worldScreen([p.position_m[0], p.position_m[1] + top, p.position_m[2]]), product: c.deviceScreenBox('far') }
  })
  const holds = (r: Rect, q: { x: number; y: number } | null): boolean => q !== null && q.x >= r.x - 1 && q.x <= r.x + r.width + 1 && q.y >= r.y - 1 && q.y <= r.y + r.height + 1
  console.log('GEOM', JSON.stringify({ at: 'C2 proof, K12 at (-1.2, 0, 0.3) yaw 90', placed: rectText(placed), root: rectText(root), foot: marks.foot, head: marks.head, product: marks.product }))
  expect(holds(placed, marks.foot), 'the placed box holds the device’s floor point').toBe(true)
  expect(holds(placed, marks.head), 'the placed box holds the point above it at the body’s top').toBe(true)
  expect(holds(root, marks.foot), 'the root-frame box (the old reading) does not: it is drawn at the origin').toBe(false)
  expect(intersects(placed, root), 'the two readings are apart: the device is away from the origin').toBe(false)
  expect(placed.x >= 0 && placed.x + placed.width <= 1280, 'the device is on screen (the proof is not off the view)').toBe(true)
  // the product's own reader (src/scene/screenBox.ts, a box of the body meshes' boxes: never smaller) agrees within a few px
  const pb = marks.product!
  expect(pb.x, 'left edge').toBeLessThanOrEqual(placed.x + 3)
  expect(pb.y, 'top edge').toBeLessThanOrEqual(placed.y + 3)
  expect(pb.x + pb.w, 'right edge').toBeGreaterThanOrEqual(placed.x + placed.width - 3)
  expect(pb.y + pb.h, 'bottom edge').toBeGreaterThanOrEqual(placed.y + placed.height - 3)
})

// ── 11.4: axe ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function expectAxeClean(page: Page, what: string): Promise<void> {
  expect(await axeLines(page), `axe, ${what}`).toEqual([])
}

test('axe can fail: a button with no accessible name added to the workspace is reported (so the clean runs below mean something)', async ({ page }) => {
  await enter(page, 1, { tutorial: false })
  expect(await axeLines(page), 'the workspace is clean before the probe').toEqual([])
  await page.evaluate(() => {
    const b = document.createElement('button')
    b.style.cssText = 'position:fixed;left:10px;top:200px;width:30px;height:30px'
    document.body.appendChild(b)
  })
  expect((await axeLines(page)).some((l) => l.startsWith('button-name')), 'axe reports the nameless button').toBe(true)
})

for (const id of DESIGN_IDS) {
  test.describe(`package ${id}: 11.4 axe`, () => {
    test('both start stages and the workspace', async ({ page }) => {
      await openFresh(page, `?design=${id}`)
      await waitStartScreen(page)
      await expect(page.locator('.oscar-icon')).toBeVisible({ timeout: 15_000 })
      await expectAxeClean(page, `package ${id}, start screen, profile stage`)
      await answerFirstQuestion(page, '1') // package 2 asks the goal screens (mission 1): the goal of that profile there
      await expect(start(page).getByRole('button', { name: /^Faire le tutoriel/ })).toBeVisible()
      await expectAxeClean(page, `package ${id}, start screen, offer stage`)
      await start(page).getByRole('button', { name: 'Passer, je connais', exact: true }).click()
      await page.waitForFunction(() => window.__creation?.place() === 'blank')
      await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true', { timeout: 15_000 })
      await settledGeo(page)
      await expectAxeClean(page, `package ${id}, workspace`)
    })

    test(`every tutorial step (${stepsOf(id)})`, async ({ page }) => {
      test.setTimeout(240_000)
      const n = stepsOf(id)
      await walk(page, id, Array.from({ length: n }, (_v, i) => i + 1), async (k) => {
        await settledGeo(page)
        await expectAxeClean(page, `package ${id}, step ${k} of ${n}`)
      })
    })

    test('the checklist (open, or docked) and the connect dialog', async ({ page }) => {
      test.setTimeout(120_000)
      await enter(page, id, { tutorial: false })
      if (onModel(id))
        // the model plays; pull its two line cables so the checklist has something to say
        await page.evaluate(() => {
          for (const [k, p] of [['k12-g', 'out-main-l'], ['k12-d', 'out-main-r']] as const) window.__creation!.dispatch({ type: 'UNPLUG', a: { instance: 'ql1', port: p }, b: { instance: k, port: 'in-line-a' } })
        })
      else await act(page, [spawn('yamaha-ql1', 'ql1', 0), spawn('qsc-k12-2', 'k12', -1)])
      const docked = packageById(id).layout.checklist === 'panel'
      if (!docked) {
        await page.getByTestId('checklist-chip').click()
        await expect(page.getByTestId('checklist')).toBeVisible()
      } else await expect(page.getByTestId('project-tree').getByTestId('checklist')).toBeVisible()
      await settledGeo(page)
      await expectAxeClean(page, `package ${id}, checklist ${docked ? 'docked' : 'open'}`)
      if (!docked) await page.keyboard.press('Escape')
      // the connect dialog, on the console's first output
      await page.evaluate(() => window.__creation!.frameDevice('ql1'))
      await page.waitForFunction(() => !window.__creation!.cameraMoving())
      if ((await page.getByTestId('props-collapse').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('props-collapse').click()
      const row = page.locator('[data-testid="properties-content"] [data-key="connect:out-main-l"]')
      await row.scrollIntoViewIfNeeded()
      await row.click()
      await expect(page.getByRole('dialog', { name: 'Connecter à…' })).toBeVisible()
      await expectAxeClean(page, `package ${id}, connect dialog`)
    })
  })
}
