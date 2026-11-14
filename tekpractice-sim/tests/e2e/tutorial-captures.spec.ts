/**
 * T8.1: annotated STILL captures of the tutorial « Premiers pas » on the real game, one per step (onboarding packs, plan T8.1, spec 12). STILLS ONLY: no video, no animation export (founder
 * grant, ledger 2026-11-12). It runs ONLY when CAPTURE=1: without the flag every test here is skipped, so the normal suite is unaffected.
 *
 *   PowerShell:  $env:E2E_PORT='4392'; npm run build; $env:CAPTURE='1'; npx playwright test tests/e2e/tutorial-captures.spec.ts --workers=1
 *   (the build first: the run serves dist/ on the private port 4392; the config starts and stops its own `vite preview`.)
 *
 * What it does. Package 1 (the ten steps) and package 5 (the three steps of the model), 1366 x 768, a first visit through the real start screen, driven by the guide's RING with the mouse
 * (the route a learner who follows Oscar takes: the click on the centre of the ring, after checking that the thing under it is what it rings; the two clicks the ring cannot show are the
 * drop of a device on the floor and the choice in « Connecter à… »). At the start of each step, once the card AND Oscar's bubble say that step and the ring is at rest, one PNG is taken,
 * with a numbered annotation drawn on it, and a line of `captures/manifest.json` records what the page said (the bubble's lines are READ FROM THE DOM, never typed here) and what the route did next.
 *
 * THE 3D VIEW IS IN THE STILLS (default). Hidden, the ring of 6 of the 13 steps (a device in the view) circles an empty dark area and an arrow would point at nothing. The scene is the real
 * one and at rest it is stable (two shots of the same state are compared: `jitterPixels`, asserted 0; while a sound plays the scene redraws every frame and the 3D view is left out of the check).
 * The models wear pictures derived from product photos (spec 12): the stills are never committed until the founder has looked. CAPTURE_HIDE_3D=1 hides the canvas instead
 * (`visibility: hidden` through the screenshot's own `style`, as onboarding-visual.spec.ts does; never during the walk, a hidden canvas takes no click) and a step whose ring is on the 3D view then fails.
 *
 * The annotation (spec 12). An SVG layer drawn in the page (`data-capture-overlay`, `aria-hidden`, `pointer-events: none`, put up empty before the clean shot and taken down after the annotated one):
 * TWO numbers per capture, each an Ambre numeral (Tektur 17 px) in a 30 px Nuit disc with a thin Ambre rim, and a 3 px Ambre arrow with a Nuit halo. The number is the step's number, the card's
 * « Étape k »: the first disc points at what the ring rings (the action), the second at Oscar's bubble (his sentence for the step). Every position of a disc on a 6 x 3 px grid is a candidate;
 * the first that covers no text and no control (read from the page: every visible text run, control and picture, Oscar's bubble and icon), whose arrow crosses none, and that sits on no Papier (read from
 * the clean picture) wins, the shortest arrow first, inside the 3D view's area first. Where a dense panel leaves no room the margins are relaxed in steps (LEVELS); the level used is in the manifest.
 *
 * Pixel checks, on the clean capture (taken the instant before the overlay, the same state):
 *  - no label box (the disc and 4 px around it) holds a Papier pixel, and no sampled point along an arrow holds one (Ambre on Papier is never drawn: spec 12 « never Ambre on Papier »);
 *  - the overlay touched nothing but its own boxes: the clean and the annotated shot differ only inside the annotation's boxes (and, while a sound plays, the 3D view).
 * The Papier check is proven to bite (a synthetic Papier patch under a label, or along an arrow, is counted).
 *
 * Output: `docs/tutorial/captures/` (git-ignored by docs/tutorial/.gitignore: the captures are NOT committed until the founder has looked). The storyboard `docs/tutorial/storyboard.md` is
 * committed; the last test checks that it names every capture file and quotes every bubble line exactly as the page showed it, and that each bubble says what COPY says for its step.
 * A run clears the stills it made before and writes all thirteen again (a partial run with -g leaves the other package's stills deleted).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import sharp from 'sharp'
import { COPY } from '../../src/creation/copy'
import { CREATION_TOKENS } from '../../src/design/creationTokens'
import { packageById, type DesignId, type StepId } from '../../src/design/packages'
import { waitRendersIdle } from './waits'
import { enter, expect, test, waitStep } from './onboardingKit'

const CAPTURE = process.env.CAPTURE === '1'
const OUT = resolve(process.cwd(), 'docs/tutorial/captures')
const STORYBOARD = resolve(process.cwd(), 'docs/tutorial/storyboard.md')
const VIEWPORT = { width: 1366, height: 768 }

test.use({ viewport: VIEWPORT })
test.describe.configure({ retries: 0 })
test.skip(!CAPTURE, 'tutorial captures run only with CAPTURE=1 (see the header of this file)')

// ── colours (the product's tokens, read, never retyped) ──────────────────────────────────────────────────────────────────────────

const C = CREATION_TOKENS.color
type Rgb = readonly [number, number, number]
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
/** The Papier of the brand and the Papier sheet's inset (the same two the visual spec reads as Papier). */
const PAPIER: readonly Rgb[] = [hex(C.papier), hex('#E6E0D7')]
/** ΔE 1976 within which a pixel counts as Papier (the visual spec's CLASS_DELTA_E is 12; 8 here: a pixel is Papier, not merely light). */
const PAPIER_DELTA_E = 8
function lab(c: Rgb): Rgb {
  const lin = c.map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const xyz = [
    (0.4124564 * lin[0] + 0.3575761 * lin[1] + 0.1804375 * lin[2]) / 0.95047,
    0.2126729 * lin[0] + 0.7151522 * lin[1] + 0.072175 * lin[2],
    (0.0193339 * lin[0] + 0.119192 * lin[1] + 0.9503041 * lin[2]) / 1.08883,
  ]
  const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116))
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}
const PAPIER_LAB = PAPIER.map(lab)
const isPapier = (c: Rgb): boolean => {
  const p = lab(c)
  return PAPIER_LAB.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= PAPIER_DELTA_E)
}

// ── the picture: Papier counts ───────────────────────────────────────────────────────────────────────────────────────────────────

interface Raw {
  data: Buffer
  width: number
  height: number
  channels: number
}
const readRaw = async (png: Buffer): Promise<Raw> => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}
const pixelAt = (r: Raw, x: number, y: number): Rgb => {
  const i = (Math.min(r.height - 1, Math.max(0, Math.round(y))) * r.width + Math.min(r.width - 1, Math.max(0, Math.round(x)))) * r.channels
  return [r.data[i], r.data[i + 1], r.data[i + 2]]
}
type Box = { x: number; y: number; width: number; height: number }
/** The Papier pixels inside a box (every pixel of it). */
function papierIn(r: Raw, b: Box): number {
  let n = 0
  for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(r.height, Math.ceil(b.y + b.height)); y++)
    for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(r.width, Math.ceil(b.x + b.width)); x++) if (isPapier(pixelAt(r, x, y))) n++
  return n
}
/** The Papier pixels met along a polyline's path (a sample every 2 px, and the pixels 2 px to each side of it). */
function papierAlong(r: Raw, pts: readonly { x: number; y: number }[]): number {
  let n = 0
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const nx = len === 0 ? 0 : -(b.y - a.y) / len
    const ny = len === 0 ? 0 : (b.x - a.x) / len
    for (let s = 0; s <= len; s += 2)
      for (const o of [-2, 0, 2]) if (isPapier(pixelAt(r, a.x + ((b.x - a.x) * s) / (len || 1) + nx * o, a.y + ((b.y - a.y) * s) / (len || 1) + ny * o))) n++
  }
  return n
}

// ── an annotation: where its pieces are ──────────────────────────────────────────────────────────────────────────────────────────

const DISC_R = 15
/** The label box: the disc and a 4 px margin (what must be clear of text, controls and Papier). */
const LABEL_PAD = 4
interface Placed {
  n: number
  /** Disc centre. */
  cx: number
  cy: number
  /** The arrow, from the disc's rim to the target's edge: a polyline (a line and its head). */
  shaft: { x: number; y: number }[]
  head: { x: number; y: number }[]
  /** The margin around the disc that holds no text and no control (see LEVELS), and the level used. */
  pad: number
  level: number
  box: Box
}
const labelBox = (cx: number, cy: number, pad = LABEL_PAD): Box => ({ x: cx - DISC_R - pad, y: cy - DISC_R - pad, width: 2 * (DISC_R + pad), height: 2 * (DISC_R + pad) })

/** The arrow from a disc to a target box: from the disc's rim straight to the NEAREST point of the target's box, stopping 4 px short of it, with a two-stroke head. */
function arrowTo(cx: number, cy: number, t: Box, headLen = 12, headWide = 7): { shaft: { x: number; y: number }[]; head: { x: number; y: number }[] } {
  const tip = { x: Math.min(t.x + t.width, Math.max(t.x, cx)), y: Math.min(t.y + t.height, Math.max(t.y, cy)) }
  const dx = tip.x - cx
  const dy = tip.y - cy
  const d = Math.hypot(dx, dy) || 1
  const ux = dx / d
  const uy = dy / d
  const start = { x: cx + ux * (DISC_R + 3), y: cy + uy * (DISC_R + 3) }
  const end = { x: tip.x - ux * 4, y: tip.y - uy * 4 }
  const head = (sign: number) => ({ x: end.x - ux * headLen + sign * -uy * headWide, y: end.y - uy * headLen + sign * ux * headWide })
  return { shaft: [start, end], head: [head(1), end, head(-1)] }
}

/** Everything in the page a label or an arrow must stay clear of: visible text runs, controls, Oscar's bubble and icon, the card (read from the live page, clipping and occlusion taken into account). */
const readObstacles = (page: Page): Promise<Box[]> =>
  page.evaluate(() => {
    const out: { x: number; y: number; width: number; height: number }[] = []
    const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="combobox"], [role="treeitem"], [role="switch"], [role="checkbox"]'
    const shown = (el: Element): boolean => {
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.closest('[hidden], [inert], [data-capture-overlay]') === null
    }
    const clipOf = (el: Element, r: DOMRect): DOMRect | null => {
      let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom]
      for (let p: Element | null = el; p !== null && p !== document.body; p = p.parentElement) {
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
    const push = (r: DOMRect): void => void out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
    // text runs
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const el = n.parentElement
      if (el === null || (n.textContent ?? '').trim() === '' || !shown(el) || el.closest('script, style, canvas') !== null) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue
        const c = clipOf(el, r)
        if (c === null) continue
        const hit = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2)
        if (hit !== null && (el.contains(hit) || hit.contains(el))) push(c)
      }
    }
    // controls
    for (const el of document.querySelectorAll(CONTROLS)) {
      if (!shown(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      const c = clipOf(el, r)
      if (c !== null) push(c)
    }
    // graphics: the card's marks (a tick or a number in a square), icons and pictures
    for (const el of document.querySelectorAll('svg, img, [role="img"], .tp-sc-dot')) {
      if (!shown(el) || el.closest('canvas') !== null) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      const c = clipOf(el, r)
      if (c !== null) push(c)
    }
    // Oscar's bubble and icon (the step card's own text and controls are read above)
    for (const el of document.querySelectorAll('.oscar-bubble, .oscar-icon')) {
      if (!shown(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) push(r)
    }
    return out
  })

const overlaps = (a: Box, b: Box, margin = 0): boolean => a.x < b.x + b.width + margin && b.x - margin < a.x + a.width && a.y < b.y + b.height + margin && b.y - margin < a.y + a.height
const grow = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m })
const segmentClear = (pts: readonly { x: number; y: number }[], obstacles: readonly Box[], clear: number): boolean => {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    for (let s = 0; s <= len; s += 3) {
      const p = { x: a.x + ((b.x - a.x) * s) / (len || 1), y: a.y + ((b.y - a.y) * s) / (len || 1) }
      if (obstacles.some((o) => p.x >= o.x - clear && p.x <= o.x + o.width + clear && p.y >= o.y - clear && p.y <= o.y + o.height + clear)) return false
    }
  }
  return true
}

const inside = (o: Box, t: Box, m: number): boolean => o.x >= t.x - m && o.y >= t.y - m && o.x + o.width <= t.x + t.width + m && o.y + o.height <= t.y + t.height + m

/**
 * How tightly an annotation may be fitted. Level 0 is the rule; the later levels are used only when the page leaves no room for the one before (a dense panel beside Oscar's icon), and the level
 * used is written in the manifest. `pad`: the margin around the 30 px disc that must hold no text and no control. `clear`: how far the shaft keeps from text and controls (its Nuit halo is 3.5 px a
 * side). `minLen`: the shortest arrow that still reads as an arrow. The Papier check never relaxes (a 4 px margin around the disc, 2 px each side of the arrow's path).
 */
interface Level {
  pad: number
  clear: number
  minLen: number
}
const LEVELS: readonly Level[] = [
  { pad: 4, clear: 3, minLen: 36 },
  { pad: 2, clear: 2, minLen: 24 },
  { pad: 1, clear: 1, minLen: 16 },
]

/**
 * Places the annotation `n` that points at `target`. Every disc centre on a 6 x 3 px grid over the view is a candidate; a candidate must have its label box clear of every obstacle (visible text and
 * controls, Oscar's bubble and icon, the numbers already placed), its arrow (a straight line to the target's edge, a Nuit halo 7 px wide) clear of every obstacle and of the placed numbers, and,
 * read on the CLEAN picture, no Papier pixel in its label box or along its arrow. The target's own text and controls (everything inside its box) are what the arrow points at, not obstacles.
 * Among the candidates the SHORTEST arrow wins. Null when nothing qualifies at this level.
 */
function placeAt(n: number, target: Box, obstacles: readonly Box[], clean: Raw, taken: readonly Placed[], lv: Level, levelIndex: number, view: Box): Placed | null {
  const others = obstacles.filter((o) => !inside(o, target, 3))
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  const quick: { cx: number; cy: number; d: number }[] = []
  for (let cy = DISC_R + 2; cy <= VIEWPORT.height - DISC_R - 2; cy += 3)
    for (let cx = DISC_R + 2; cx <= VIEWPORT.width - DISC_R - 2; cx += 6) {
      const lb = labelBox(cx, cy, lv.pad)
      if (overlaps(lb, grow(target, 6))) continue
      if (others.some((o) => overlaps(lb, o, 0))) continue
      if (taken.some((p) => overlaps(lb, grow(p.box, 10)))) continue
      // a disc inside the 3D view's own area is preferred (by 120 px of arrow length) to one that straddles the menu bar, the card's row or the panels
      const inView = cx - DISC_R >= view.x && cx + DISC_R <= view.x + view.width && cy - DISC_R >= view.y && cy + DISC_R <= view.y + view.height
      quick.push({ cx, cy, d: Math.hypot(cx - tc.x, cy - tc.y) + (inView ? 0 : 120) })
    }
  quick.sort((a, b) => a.d - b.d)
  for (const { cx, cy } of quick) {
    // the head is 12 x 7 px with the shaft's clearance; where the corridor is tight (the menu bar over the card's row) a head of 7 x 3.5 px with a 1 px clearance is tried
    let arrow = arrowTo(cx, cy, target)
    let headOk = segmentClear(arrow.head, others, lv.clear)
    if (!headOk) {
      arrow = arrowTo(cx, cy, target, 7, 3.5)
      headOk = segmentClear(arrow.head, others, 1)
    }
    const { shaft, head } = arrow
    const len = Math.hypot(shaft[1].x - shaft[0].x, shaft[1].y - shaft[0].y)
    if (len < lv.minLen || len > 420) continue
    if (!headOk || !segmentClear(shaft, others, lv.clear)) continue
    if (taken.some((p) => !segmentClear(shaft, [grow(p.box, 6)], 0) || !segmentClear(head, [grow(p.box, 6)], 0))) continue
    const lb = labelBox(cx, cy, lv.pad)
    if (papierIn(clean, labelBox(cx, cy, LABEL_PAD)) > 0 || papierAlong(clean, shaft) > 0 || papierAlong(clean, head) > 0) continue
    const xs = [...shaft, ...head, { x: lb.x, y: lb.y }, { x: lb.x + lb.width, y: lb.y + lb.height }]
    const [x0, x1] = [Math.min(...xs.map((q) => q.x)), Math.max(...xs.map((q) => q.x))]
    const [y0, y1] = [Math.min(...xs.map((q) => q.y)), Math.max(...xs.map((q) => q.y))]
    return { n, cx, cy, shaft, head, pad: lv.pad, level: levelIndex, box: { x: x0 - 5, y: y0 - 5, width: x1 - x0 + 10, height: y1 - y0 + 10 } }
  }
  return null
}
/** The first level at which the annotation fits (see LEVELS). */
function place(n: number, target: Box, obstacles: readonly Box[], clean: Raw, taken: readonly Placed[], view: Box): Placed | null {
  for (let i = 0; i < LEVELS.length; i++) {
    const p = placeAt(n, target, obstacles, clean, taken, LEVELS[i], i, view)
    if (p !== null) return p
  }
  return null
}

/**
 * The overlay layer, empty, put up BEFORE the clean shot: adding a fixed, top-most layer changes how Chromium composites the page (the edges of a control at a fractional position, such as the
 * bubble's buttons, come out one pixel column apart), so both shots are taken with the layer present and the only difference between them is what is drawn in it.
 */
const layerUp = (page: Page): Promise<void> =>
  page.evaluate(
    ({ w, h }) => {
      if (document.querySelector('[data-capture-overlay]') !== null) return
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('data-capture-overlay', '')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('width', String(w))
      svg.setAttribute('height', String(h))
      svg.setAttribute('style', 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647')
      document.body.append(svg)
    },
    { w: VIEWPORT.width, h: VIEWPORT.height },
  )

/** Draws into the layer: for each annotation a Nuit halo under a 3 px Ambre arrow, and a Nuit disc with an Ambre rim and the numeral in Tektur. Appended to <body>, nothing else of the page is touched. */
const drawOverlay = (page: Page, marks: readonly Placed[]): Promise<void> =>
  page.evaluate(
    ({ marks, nuit, ambre, r }) => {
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.querySelector('[data-capture-overlay]')!
      const path = (pts: { x: number; y: number }[], stroke: string, w: number): void => {
        const p = document.createElementNS(NS, 'path')
        p.setAttribute('d', pts.map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' '))
        p.setAttribute('fill', 'none')
        p.setAttribute('stroke', stroke)
        p.setAttribute('stroke-width', String(w))
        p.setAttribute('stroke-linecap', 'round')
        p.setAttribute('stroke-linejoin', 'round')
        svg.append(p)
      }
      for (const m of marks) {
        path(m.shaft, nuit, 7)
        path(m.head, nuit, 7)
        path(m.shaft, ambre, 3)
        path(m.head, ambre, 3)
      }
      for (const m of marks) {
        const c = document.createElementNS(NS, 'circle')
        c.setAttribute('cx', String(m.cx))
        c.setAttribute('cy', String(m.cy))
        c.setAttribute('r', String(r))
        c.setAttribute('fill', nuit)
        c.setAttribute('stroke', ambre)
        c.setAttribute('stroke-width', '2')
        svg.append(c)
        const t = document.createElementNS(NS, 'text')
        t.setAttribute('x', String(m.cx))
        t.setAttribute('y', String(m.cy))
        t.setAttribute('text-anchor', 'middle')
        t.setAttribute('dominant-baseline', 'central')
        t.setAttribute('fill', ambre)
        t.setAttribute('font-family', 'Tektur, sans-serif')
        t.setAttribute('font-weight', '600')
        t.setAttribute('font-size', '17')
        t.textContent = String(m.n)
        svg.append(t)
      }
    },
    { marks: marks.map((m) => ({ n: m.n, cx: m.cx, cy: m.cy, shaft: m.shaft, head: m.head })), nuit: C.nuit, ambre: C.ambre, r: DISC_R },
  )
const removeOverlay = (page: Page): Promise<void> => page.evaluate(() => document.querySelectorAll('[data-capture-overlay]').forEach((e) => e.remove()))

// ── at rest ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The faces the shell draws with, loaded and verified (as the visual spec): the numeral is Tektur, the page's text Plex. */
async function fontsLoaded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(['600 16px Tektur', '400 16px "IBM Plex Sans"', '500 16px "IBM Plex Sans"', '600 16px "IBM Plex Sans"'].map((f) => document.fonts.load(f, 'Étape 1 sur 10 « é » ’ Ab')))
    await document.fonts.ready
  })
  expect(await page.evaluate(() => document.fonts.check('600 17px Tektur'))).toBe(true)
}

const ringLoc = (page: Page): Locator => page.locator('.oscar-ring:not(.oscar-ring-drop)')
const boxKey = (b: Box | null): string => (b === null ? '' : [b.x, b.y, b.width, b.height].map(Math.round).join(','))
const centreOf = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const ringShown = (page: Page, ms: number): Promise<boolean> =>
  ringLoc(page)
    .waitFor({ state: 'visible', timeout: ms })
    .then(
      () => true,
      () => false,
    )

/** The ring is visible and has stopped moving (two equal reads 300 ms apart). Returns its box. */
async function settledRing(page: Page, label: string): Promise<Box> {
  await expect(ringLoc(page), `${label}: the guide rings what to do next`).toBeVisible({ timeout: 20_000 })
  let last = ''
  await expect
    .poll(
      async () => {
        const now = boxKey(await ringLoc(page).boundingBox())
        const stable = now !== '' && now === last
        last = now
        if (!stable) await page.waitForTimeout(300)
        return stable
      },
      { timeout: 20_000, message: `${label}: the ring never stopped moving` },
    )
    .toBe(true)
  return (await ringLoc(page).boundingBox())!
}

interface Hit {
  kind: 'view' | 'control' | 'guide' | 'card' | 'other' | 'none'
  name: string
  disabled: boolean
}
const hitAt = (page: Page, x: number, y: number): Promise<Hit> =>
  page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      const name = (e: Element): string => (e.getAttribute('aria-label') ?? (e as HTMLElement).innerText ?? e.tagName).replace(/\s+/g, ' ').trim().slice(0, 50)
      if (el === null) return { kind: 'none' as const, name: '', disabled: false }
      if (el.closest('[data-oscar-root], .oscar-guide') !== null) return { kind: 'guide' as const, name: name(el), disabled: false }
      if (el.closest('[data-testid="tutorial-slot"], [data-testid="gear-slot"]') !== null) return { kind: 'card' as const, name: name(el), disabled: false }
      if (el.id === 'renderCanvas') return { kind: 'view' as const, name: 'the 3D view', disabled: false }
      const c = el.closest('button, a[href], input, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [data-testid="inventory-item"]')
      if (c === null) return { kind: 'other' as const, name: `${el.tagName.toLowerCase()} ${name(el)}`, disabled: false }
      return { kind: 'control' as const, name: name(c), disabled: c.matches(':disabled') || c.getAttribute('aria-disabled') === 'true' }
    },
    { x, y },
  )

/**
 * What the guide's parts are doing: the box of the icon, the bubble, the ring and the card to a hundredth of a pixel (the guide glides and re-reads the page: a bubble 0.3 px off shows as a
 * different edge on its buttons), and the character's pose (a nod, a wave, a celebration or a walk is a moment, not a rest: the poses held while nothing happens are listed).
 */
const RESTING_POSES: readonly (string | null)[] = [null, 'idle', 'point', 'sleep']
const readGeo = (page: Page): Promise<{ key: string; pose: string | null }> =>
  page.evaluate(() => {
    const rect = (sel: string): string => {
      const e = document.querySelector<HTMLElement>(sel)
      if (e === null || e.hidden) return '-'
      const cs = getComputedStyle(e)
      const b = e.getBoundingClientRect()
      return cs.display === 'none' || cs.visibility === 'hidden' || b.width === 0 || b.height === 0 ? '-' : [b.x, b.y, b.width, b.height].map((v) => v.toFixed(2)).join(',')
    }
    return {
      key: ['.oscar-icon', '.oscar-bubble', '.oscar-ring:not(.oscar-ring-drop)', '[data-testid="tutorial-card"]'].map(rect).join(' | '),
      pose: document.querySelector('svg.tpo')?.getAttribute('data-state') ?? null,
    }
  })

/**
 * The page at rest before a still: fonts, no model pending, the camera still, no render over a sample window, the guide's parts at the same place over two reads 350 ms apart with the
 * character in a resting pose, the pointer parked where no control is. `sound`: while a sound plays the scene redraws every frame (the console's live meters) and never goes idle, so the wait is on
 * the playing state instead.
 */
async function atRest(page: Page, sound = false): Promise<void> {
  await fontsLoaded(page)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0 && !window.__creation!.cameraMoving(), null, { timeout: 30_000 })
  if (sound) await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 30_000 })
  else await waitRendersIdle(page, 30_000)
  await page.mouse.move(0, 0)
  let last = ''
  await expect
    .poll(
      async () => {
        const g = await readGeo(page)
        const same = g.key === last && RESTING_POSES.includes(g.pose)
        last = g.key
        await page.waitForTimeout(350)
        return same
      },
      { timeout: 20_000, message: 'the icon, the bubble, the ring, the card and the character never came to rest' },
    )
    .toBe(true)
}

// ── what a step shows, as the page says it ──────────────────────────────────────────────────────────────────────────────────────

const visibleLines = (page: Page, selector: string): Promise<string[]> =>
  page.evaluate((sel) => {
    const shown = (el: Element): boolean => el instanceof HTMLElement && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') === null
    return [...document.querySelectorAll(sel)].filter(shown).map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter((t) => t !== '')
  }, selector)
const bubbleLines = (page: Page): Promise<string[]> => visibleLines(page, '.oscar-bubble .oscar-live .oscar-sub, .oscar-bubble .oscar-live .oscar-line')

interface Entry {
  file: string
  package: DesignId
  k: number
  n: number
  step: StepId
  card: string
  /** What Oscar's bubble says, line by line, read from the page. */
  bubble: string[]
  /** The character's own pose when the still was taken (`data-state` of `svg.tpo`, src/guide/character.ts). */
  pose: string | null
  /** What the route did after the still, in order: the clicks on the ring (what was under its centre), the drop on the floor, the option chosen in « Connecter à… ». */
  actions: string[]
  /** What the ring rings at that moment: « the 3D view » or the control's name. */
  ringOn: string
  ring: Box
  /** Where each annotation is and what it points at. */
  marks: { n: number; at: string; target: Box; disc: { cx: number; cy: number }; level: number }[]
  /** The 3D view is in the still (false: hidden with CAPTURE_HIDE_3D=1). */
  canvasShown: boolean
  /** A sound was playing (the scene redraws every frame: the 3D view is left out of the stray check). */
  sound: boolean
  /** Pixels that differ between two clean shots of the same state (0 = the scene is still). */
  jitterPixels: number
  /** The check of the overlay: pixels that differ between the clean and the annotated shot outside the annotation's boxes (and, while a sound plays, outside the 3D view). */
  strayPixels: number
}
const manifest: Entry[] = []

/**
 * The 3D view is IN the stills by default: with it hidden, the ring of steps 4 to 6, 8 and 9 (which first rings a device in the view) would circle an empty dark area and an arrow would point at nothing. With
 * CAPTURE_HIDE_3D=1 the canvas is hidden (visibility: hidden, through the screenshot's own style, as onboarding-visual.spec.ts does) and a step whose ring is on the 3D view fails with that message:
 * the founder may decide that no model wearing a product-photo picture is shown (spec 12). Never hidden during the walk (a hidden canvas takes no click).
 */
const HIDE_3D = process.env.CAPTURE_HIDE_3D === '1'
const SHOT_STYLE = HIDE_3D ? 'canvas { visibility: hidden !important }' : undefined

/** Pixels that differ between two shots of the same size outside the given boxes (a per-channel difference above 8: anti-aliasing noise is not a change). */
async function strayPixels(a: Buffer, b: Buffer, inside: readonly Box[]): Promise<{ n: number; where: string }> {
  const [ra, rb] = await Promise.all([readRaw(a), readRaw(b)])
  expect([ra.width, ra.height]).toEqual([rb.width, rb.height])
  let n = 0
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1]
  for (let y = 0; y < ra.height; y++)
    for (let x = 0; x < ra.width; x++) {
      const i = (y * ra.width + x) * ra.channels
      if (Math.abs(ra.data[i] - rb.data[i]) + Math.abs(ra.data[i + 1] - rb.data[i + 1]) + Math.abs(ra.data[i + 2] - rb.data[i + 2]) <= 24) continue
      if (inside.some((o) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height)) continue
      n++
      ;[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]
    }
  return { n, where: n === 0 ? '' : `x ${x0}..${x1}, y ${y0}..${y1}` }
}

/** One still of the step now showing: the clean shot, the places, the annotated shot (saved), the checks. */
async function capture(page: Page, id: DesignId, k: number, step: StepId, file: string, sound: boolean): Promise<void> {
  const n = packageById(id).pacing.steps.length
  const label = `package ${id} step ${k} (${step})`
  await waitStep(page, k, n)
  const ring = (await ringShown(page, 8_000)) ? await settledRing(page, label) : null
  expect(ring, `${label}: the guide rings what to do (an arrow at nothing is not drawn)`).not.toBeNull()
  await layerUp(page)
  await atRest(page, sound)
  const ringBox = (await ringLoc(page).boundingBox())!
  const hit = await hitAt(page, centreOf(ringBox).x, centreOf(ringBox).y)
  const bubbleBox = await page.locator('.oscar-bubble').boundingBox()
  expect(bubbleBox, `${label}: Oscar's bubble is open (the second number points at his sentence)`).not.toBeNull()
  const card = ((await page.getByTestId('tutorial-step-count').textContent()) ?? '').trim()
  const bubble = await bubbleLines(page)

  expect(!HIDE_3D || hit.kind !== 'view', `${label}: the ring is on the 3D view, which is hidden (CAPTURE_HIDE_3D=1): an arrow would point at nothing`).toBe(true)
  const viewBox = (await page.locator('.cr-viewport').boundingBox())!
  const clean = await page.screenshot({ style: SHOT_STYLE, animations: 'disabled', caret: 'hide' })
  // the scene at rest draws the same picture twice (a 3D view that moved between two shots would be a flaky still); while a sound plays it redraws every frame and is left out
  const jitter = sound ? 0 : (await strayPixels(clean, await page.screenshot({ style: SHOT_STYLE, animations: 'disabled', caret: 'hide' }), [])).n
  expect(jitter, `${label}: two shots of the same resting state differ (${jitter} pixels)`).toBe(0)
  const cleanRaw = await readRaw(clean)
  const obstacles = await readObstacles(page)
  const first = place(k, ringBox, obstacles, cleanRaw, [], viewBox)
  expect(first, `${label}: no place for the number beside the ring that is clear of text, controls and Papier`).not.toBeNull()
  const second = place(k, bubbleBox!, obstacles, cleanRaw, [first!], viewBox)
  expect(second, `${label}: no place for the number beside Oscar's bubble that is clear of text, controls and Papier`).not.toBeNull()
  const marks = [first!, second!]
  // the pixel check, once more on the final boxes (the placement already required it)
  for (const m of marks) {
    expect(papierIn(cleanRaw, labelBox(m.cx, m.cy)), `${label}: the label box ${m.n} sits on Papier`).toBe(0)
    expect(papierAlong(cleanRaw, m.shaft) + papierAlong(cleanRaw, m.head), `${label}: the arrow of ${m.n} runs over Papier`).toBe(0)
    expect(obstacles.filter((o) => overlaps(labelBox(m.cx, m.cy, m.pad), o, 0)), `${label}: the label box ${m.n} sits on text or a control`).toEqual([])
  }

  await drawOverlay(page, marks)
  const shot = await page.screenshot({ style: SHOT_STYLE, animations: 'disabled', caret: 'hide', path: resolve(OUT, file) })
  await removeOverlay(page)
  const { n: stray, where } = await strayPixels(clean, shot, [...marks.map((m) => m.box), ...(sound ? [viewBox] : [])])
  expect(stray, `${label}: the annotated shot differs from the clean one outside the annotation (${stray} pixels, ${where})`).toBe(0)

  manifest.push({
    file,
    package: id,
    k,
    n,
    step,
    card,
    bubble,
    pose: (await readGeo(page)).pose,
    actions: [],
    ringOn: hit.kind === 'view' ? 'the 3D view' : hit.name,
    ring: ringBox,
    marks: [
      { n: k, at: hit.kind === 'view' ? 'the ring over a device of the 3D view' : `« ${hit.name} »`, target: ringBox, disc: { cx: first!.cx, cy: first!.cy }, level: first!.level },
      { n: k, at: "Oscar's bubble (his sentence for the step)", target: bubbleBox!, disc: { cx: second!.cx, cy: second!.cy }, level: second!.level },
    ],
    canvasShown: !HIDE_3D,
    sound,
    jitterPixels: jitter,
    strayPixels: stray,
  })
  console.log('CAPTURE', file, JSON.stringify({ ringOn: hit.kind === 'view' ? 'the 3D view' : hit.name, bubble, card }))
}

// ── driving by the ring ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A click on the centre of the ring, checked first: what is under it is the 3D view or an enabled control, never Oscar, the card or a dead area. */
async function clickRing(page: Page, label: string): Promise<string> {
  const b = await settledRing(page, label)
  const { x, y } = centreOf(b)
  const hit = await hitAt(page, x, y)
  expect(['view', 'control'], `${label}: under the ring's centre (${Math.round(x)}, ${Math.round(y)}) is ${hit.kind} « ${hit.name} », not the thing it rings`).toContain(hit.kind)
  if (hit.kind === 'control') await expect.poll(async () => (await hitAt(page, x, y)).disabled, { message: `${label}: « ${hit.name} » stays disabled`, timeout: 30_000 }).toBe(false)
  await page.mouse.click(x, y)
  journal.push(hit.kind === 'view' ? 'ring: click on the 3D view' : `ring: click on « ${hit.name} »`)
  return boxKey(b)
}
/** The actions of the step now running (see Entry.actions). */
let journal: string[] = []
const menuOpen = async (page: Page): Promise<boolean> => (await page.locator('.cr-menu-top[aria-expanded="true"]').count()) > 0

/** Clicks what the ring shows until `done` holds (at most `max` clicks: more is a dead end). After each click the page must answer: done, the ring moved, or a menu opened. */
async function followRing(page: Page, label: string, done: () => Promise<boolean>, max = 4): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await done()) return
    const before = await clickRing(page, `${label} (click ${i + 1})`)
    await expect
      .poll(async () => (await done()) || boxKey(await ringLoc(page).boundingBox()) !== before || (await menuOpen(page)), { message: `${label}: the click on the ring changed nothing`, timeout: 20_000 })
      .toBe(true)
    if (!(await done()) && !(await ringLoc(page).isVisible())) await expect.poll(async () => (await done()) || (await ringLoc(page).isVisible()), { timeout: 15_000 }).toBe(true).catch(() => undefined)
  }
  expect(await done(), `${label}: ${max} clicks on what the ring showed and still not there (a dead end)`).toBe(true)
}

/** The step has moved on: the card's counter or Oscar's bubble no longer says step k, or the closing card is up. */
const movedOn = (page: Page, k: number, n: number) => async (): Promise<boolean> => {
  if (await page.getByTestId('tutorial-closing').isVisible()) return true
  const card = (await page.getByTestId('tutorial-step-count').textContent()) ?? ''
  const live = (await page.locator('.oscar-live').textContent()) ?? ''
  return card !== `Étape ${k} sur ${n}` || !live.includes(`étape ${k} sur ${n}`)
}
const placing = (page: Page) => page.getByTestId('status-snapping').isVisible()

/** Free floor points of the 3D view (shares of `.cr-viewport`), apart from each other; the first whose point is the 3D view itself is used (the click the ring cannot show). */
const FLOOR = [
  [0.5, 0.62],
  [0.3, 0.72],
  [0.7, 0.72],
  [0.5, 0.84],
  [0.2, 0.86],
  [0.8, 0.86],
] as const
async function drop(page: Page, label: string, used: Set<number>): Promise<void> {
  const view = (await page.locator('.cr-viewport').boundingBox())!
  for (let i = 0; i < FLOOR.length; i++) {
    if (used.has(i)) continue
    const x = view.x + view.width * FLOOR[i][0]
    const y = view.y + view.height * FLOOR[i][1]
    if ((await hitAt(page, x, y)).kind !== 'view') continue
    used.add(i)
    await page.mouse.move(x, y, { steps: 4 })
    await page.mouse.click(x, y)
    journal.push('floor: click on a free point of the 3D view (drops the device)')
    return
  }
  throw new Error(`${label}: no free floor point left in the view`)
}

/** In « Connecter à… »: the first option under the device the bubble names (the choice the ring cannot show). */
async function chooseIn(page: Page, label: string, device: RegExp): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
  await expect(dialog, `${label}: « Connecter à… » is open`).toBeVisible()
  const group = dialog.getByRole('group').filter({ has: page.locator('.cr-connect-group-title', { hasText: device }) }).first()
  const option = group.getByRole('option').first()
  await expect(option, `${label}: the dialog offers a port of ${device}`).toBeVisible()
  const chosen = (await option.getAttribute('aria-label')) ?? (await option.innerText())
  await option.click()
  journal.push(`dialog: option « ${chosen.replace(/\s+/g, ' ').trim()} »`)
  await expect(dialog).toBeHidden()
}
/** The device each cable step's dialog offers (the group to choose in). */
const GROUP: Partial<Record<StepId, RegExp>> = {
  'console-enceinte': /K12/,
  'micro-console': /QL1/,
  'courant-console': /[Mm]ultiprise/,
  'courant-enceinte': /[Mm]ultiprise/,
  rebrancher: /K12/,
}
const PLACE: readonly StepId[] = ['console', 'micro', 'enceinte', 'multiprise']

/** One step led by the ring: the still at its start, then the learner's action by the ring, then the wait for the step to complete. */
async function doStep(page: Page, id: DesignId, k: number, step: StepId, used: Set<number>, nameOf: (k: number, step: StepId) => string, sound = false): Promise<void> {
  const n = packageById(id).pacing.steps.length
  const label = `package ${id} step ${k} (${step})`
  journal = []
  await capture(page, id, k, step, nameOf(k, step), sound)
  const advanced = movedOn(page, k, n)
  if (PLACE.includes(step)) {
    await followRing(page, label, () => placing(page)) // the tab, then the card: the device follows the pointer
    await drop(page, label, used)
  } else if (GROUP[step] !== undefined) {
    const dialog = page.getByRole('dialog', { name: 'Connecter à…' })
    await followRing(page, label, () => dialog.isVisible())
    await chooseIn(page, label, GROUP[step]!)
  } else {
    await followRing(page, label, advanced)
  }
  await expect.poll(advanced, { message: `${label}: the step never completed`, timeout: 30_000 }).toBe(true)
  manifest[manifest.length - 1].actions = journal
}

const fileName = (id: DesignId) => (k: number, step: StepId): string => `pkg${id}-step${String(k).padStart(2, '0')}-${step}.png`

// ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true })
  // only this spec's own files are cleared (a run is a whole new set)
  for (const f of readdirSync(OUT)) if (/^pkg\d-step\d+-.*\.png$/.test(f) || f === 'manifest.json') rmSync(resolve(OUT, f))
})

test('the Papier pixel check bites: a Papier patch under a label, or along an arrow, is counted', async () => {
  const w = 200
  const h = 120
  const nuit = hex(C.nuit)
  const buf = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) buf.set(i % w >= 100 ? PAPIER[0] : nuit, i * 3)
  const raw: Raw = { data: buf, width: w, height: h, channels: 3 }
  expect(papierIn(raw, labelBox(50, 60)), 'a label on Nuit holds no Papier').toBe(0)
  expect(papierIn(raw, labelBox(130, 60)), 'a label on Papier holds Papier').toBeGreaterThan(1000)
  expect(papierIn(raw, labelBox(100, 60)), 'a label straddling the edge holds some').toBeGreaterThan(0)
  expect(papierAlong(raw, [{ x: 10, y: 20 }, { x: 90, y: 20 }]), 'an arrow on Nuit').toBe(0)
  expect(papierAlong(raw, [{ x: 90, y: 20 }, { x: 150, y: 20 }]), 'an arrow that reaches Papier').toBeGreaterThan(0)
  // the inset of the sheet counts as Papier too, and the dark shell tints do not
  expect(isPapier(hex('#E6E0D7'))).toBe(true)
  expect(isPapier(hex(C.panel))).toBe(false)
  expect(isPapier(hex(C.ambre))).toBe(false)
})

test('package 1: the ten steps of « Premiers pas », one annotated still each', async ({ page }) => {
  const id: DesignId = 1
  await enter(page, id, { tutorial: true })
  await waitStep(page, 1, 10)
  const used = new Set<number>()
  const steps = packageById(id).pacing.steps
  expect(steps.length).toBe(10)
  for (let k = 1; k <= steps.length; k++) await doStep(page, id, k, steps[k - 1], used, fileName(id))
})

test('package 5: the three steps of the playable model, one annotated still each', async ({ page }) => {
  const id: DesignId = 5
  await enter(page, id, { tutorial: true })
  await waitStep(page, 1, 3)
  const steps = packageById(id).pacing.steps
  expect(steps.length).toBe(3)
  for (let k = 1; k <= steps.length; k++) await doStep(page, id, k, steps[k - 1], new Set(), fileName(id), k >= 2)
})

test('the manifest is written, and the storyboard names every still and quotes every Oscar line as the page showed it', async () => {
  expect(manifest.length, 'ten stills of package 1 and three of package 5').toBe(13)
  writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1))
  // the product's own sentence of each step is in the bubble (a placeholder matches the catalog's label): the page said what COPY says
  const SAY: Record<StepId, string[]> = {
    console: [COPY.tutorial.console],
    micro: [COPY.tutorial.micro],
    enceinte: [COPY.tutorial.enceinte],
    'console-enceinte': [COPY.tutorial.consoleEnceinte],
    'micro-console': [COPY.tutorial.microConsole],
    'lecture-console': [COPY.assist.sourceOff],
    multiprise: [COPY.tutorial.multiprise, COPY.tutorial.powerNote],
    'courant-console': [COPY.tutorial.courantConsole],
    'courant-enceinte': [COPY.tutorial.courantEnceinte],
    ecoute: [COPY.tutorial.ecoute],
    debrancher: [COPY.tutorial.debrancher],
    rebrancher: [COPY.tutorial.rebrancher],
  }
  const asRegExp = (s: string): RegExp => new RegExp('^' + s.split(/\{[a-z]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+') + '$')
  for (const e of manifest) {
    const said = e.bubble.filter((l) => !/^Parcours « /.test(l))
    // one bubble, the step's sentences in order, one space apart (the multiprise step says two)
    const want = SAY[e.step].join(' ')
    expect(said.some((l) => asRegExp(want).test(l)), `${e.file}: the bubble says « ${want} » (it showed ${JSON.stringify(e.bubble)})`).toBe(true)
  }
  expect(existsSync(STORYBOARD), 'docs/tutorial/storyboard.md exists').toBe(true)
  const text = readFileSync(STORYBOARD, 'utf8')
  for (const e of manifest) {
    expect(text, `the storyboard names ${e.file}`).toContain(e.file)
    for (const line of e.bubble) expect(text, `the storyboard quotes the bubble line of ${e.file} exactly: « ${line} »`).toContain(line)
  }
})
