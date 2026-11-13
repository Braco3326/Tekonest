/**
 * T7.4: the five packages seen at a glance, and the baseline images (onboarding packs, plan T7.4, spec 11.7 and 11.13; the errata of the spec override older text).
 *
 * 11.7 SQUINT TEST. Each package's workspace (the first room with the step card at step 1, 1366 x 768, the 3D canvas masked: hidden and its box painted magenta) is downsampled to 32 x 18 cells (a box average of the
 * pixels each cell covers: the blur of half-closed eyes). Two things are asserted:
 *  - DISTINCT: every pair of the five packages differs in >= 8 % of the 576 cells (the spec's number). A cell DIFFERS when its two mean colours are more than CELL_DELTA_E apart
 *    (CIELAB ΔE 1976). The spec fixes the grid and the 8 % but not what « differs » means for one cell; CELL_DELTA_E = 8 is this task's choice (the two dark tones of the shell,
 *    Nuit #131114 and the panel #1C191D, are ΔE 3.4 apart and count as the same). Every pair's share is printed (\`SQUINT\`).
 *  - BALANCE: each package follows the Nuit / Papier / Ambre / Prune balance that spec 7.2 declares for it. On a finer 128 x 72 box average (a 28 px panel band is a colour there and
 *    a smudge at 32 x 18), a cell is classed by its nearest reference colour (the brand four and the shell's tints) when that colour is within CLASS_DELTA_E; else it is « mixed »
 *    (text edges, glyphs, anti-aliasing). The shares are over the classed cells (the 3D view and the mixed cells are left out). The declared ranges are in BALANCE with the
 *    sentence of the spec each one comes from.
 * The comparer is proven to bite (a package against itself differs in 0 %; a synthetic grid at 7 % fails and one at 9 % passes).
 *
 * 11.13 SNAPSHOTS (`toHaveScreenshot`). Per package, the key screens: the start screen, the first room with the step card at step 1, the connect view (step 4 of the ten; package 5
 * has three steps: its « rebrancher » step is the connect view) and the closing card. Sizes: 1366 x 768 and 1024 x 768 for all four screens, 820 x 1180 for the start screen and the
 * room (the spec's three viewports are for the start screen and the workspace). Own file, retries off, a state wait before each capture (fonts loaded, models pending 0, no camera
 * move, no render over a sample window, the guide's icon / bubble / ring and the character's pose at rest), the WebGL canvas masked (hidden: the overlays stay), animations disabled, caret hidden, the pointer parked.
 * The baseline is created once, in this task (`--update-snapshots`), and committed; it is NEVER updated outside a task that says so.
 */
import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { DESIGN_IDS, packageById, type DesignId } from '../../src/design/packages'
import { CREATION_TOKENS } from '../../src/design/creationTokens'
import { waitRendersIdle } from './waits'
import { act, connect, expect, loadFresh, MODEL_LEFT, PROFILES, STEP_INTENTS, start, test, testSignal, waitStartScreen, waitStep } from './onboardingKit'

// No retry: a snapshot that flakes is a defect of the capture, not a thing to run again.
test.describe.configure({ retries: 0 })

type Size = { width: number; height: number }
const DESKTOP: Size = { width: 1366, height: 768 }
const TABLET: Size = { width: 1024, height: 768 }
const PORTRAIT: Size = { width: 820, height: 1180 }

const onModel = (id: DesignId): boolean => packageById(id).layout.start === 'playable-model'
const stepsOf = (id: DesignId): number => packageById(id).pacing.steps.length

// ── a state wait before every capture ──────────────────────────────────────────────────────────────────────────────────────────

/** The faces the shell draws with (src/creation/boot.ts imports exactly these four); each is loaded, then `document.fonts.ready`, then the load is VERIFIED. */
const FACES = [
  { css: '600 16px Tektur', family: 'Tektur', weight: '600' },
  { css: '400 16px "IBM Plex Sans"', family: 'IBM Plex Sans', weight: '400' },
  { css: '500 16px "IBM Plex Sans"', family: 'IBM Plex Sans', weight: '500' },
  { css: '600 16px "IBM Plex Sans"', family: 'IBM Plex Sans', weight: '600' },
] as const

async function fontsLoaded(page: Page): Promise<void> {
  const loaded = await page.evaluate(async (faces) => {
    await Promise.all(faces.map((f) => document.fonts.load(f.css, 'Étape 1 sur 10 « é » ’ Ab')))
    await document.fonts.ready
    const out: string[] = []
    document.fonts.forEach((f) => (f.status === 'loaded' ? out.push(`${f.family.replace(/"/g, '')} ${f.weight}`) : undefined))
    return out
  }, FACES)
  for (const f of FACES) expect(loaded, `font ${f.family} ${f.weight} is loaded before the capture`).toContain(`${f.family} ${f.weight}`)
}

interface Geo {
  icon: string | null
  bubble: string | null
  ring: string | null
  card: string | null
  /** The character's own pose (`data-state` of `svg.tpo`, src/guide/character.ts): a nod, a wave, a celebration or a walk is a moment, not a rest. */
  pose: string | null
}
/** The poses the character holds while nothing is happening; the others (walk, nod, wave, celebrate, shrug: 0.7 to 1 s each) end by themselves. */
const RESTING_POSES: readonly (string | null)[] = [null, 'idle', 'point', 'sleep']
const readGeo = (page: Page): Promise<Geo> =>
  page.evaluate(() => {
    const rect = (sel: string): string | null => {
      const e = document.querySelector<HTMLElement>(sel)
      if (e === null || e.hidden) return null
      const cs = getComputedStyle(e)
      const b = e.getBoundingClientRect()
      return cs.display === 'none' || cs.visibility === 'hidden' || b.width === 0 || b.height === 0 ? null : [b.x, b.y, b.width, b.height].map(Math.round).join(',')
    }
    return {
      icon: rect('.oscar-icon'),
      bubble: rect('.oscar-bubble'),
      ring: rect('.oscar-ring:not(.oscar-ring-drop)'),
      card: rect('[data-testid="tutorial-card"]'),
      pose: document.querySelector('svg.tpo')?.getAttribute('data-state') ?? null,
    }
  })

/**
 * The page at rest: fonts loaded; no model pending and the camera still (when the hook is up); no frame drawn over a sample window; the guide's icon, bubble, ring and the card at the
 * same place over two reads 350 ms apart (the guide glides and re-reads the page; this is the geometry spec's own settle), and the character in a resting pose (the first sound's celebration lasts a second, and the closing card is captured about 0.7 s after it appears: the likely cause of the one closing capture in 45 that differed by 398 px; the diff itself was not kept). Then the pointer is parked where no control is.
 */
async function atRest(page: Page, soundPlaying = false): Promise<void> {
  await fontsLoaded(page)
  await page.waitForFunction(() => window.__creation!.modelsPending() === 0 && !window.__creation!.cameraMoving(), null, { timeout: 30_000 })
  // While a sound plays the scene redraws every frame (the live meters of the console's screen: measured, 7 to 12 renders per 250 ms) and never goes idle: that screen's wait is on the
  // playing state instead, and the live part is the masked canvas.
  if (soundPlaying) await page.waitForFunction(() => window.__creation!.audioState().state === 'playing', null, { timeout: 30_000 })
  else await waitRendersIdle(page, 30_000)
  let last = ''
  await expect
    .poll(
      async () => {
        const g = await readGeo(page)
        const now = JSON.stringify(g)
        const same = now === last && RESTING_POSES.includes(g.pose)
        last = now
        await page.waitForTimeout(350)
        return same
      },
      { timeout: 20_000, message: 'the icon, the bubble, the ring, the card and the character never came to rest' },
    )
    .toBe(true)
  await page.mouse.move(0, 0) // no control sits at the page corner: no hover state in the capture
}

// ── entering ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A first visit to `?design=id`: the start screen, up and focused (the entry stalls now and then under load: the load is repeated, as the kit does; a capture is never repeated). */
async function toStartScreen(page: Page, id: DesignId): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await loadFresh(page, `?design=${id}`)
      await waitStartScreen(page)
      return
    } catch (e) {
      if (attempt >= 3) throw e
      console.log(`RETRY the start screen of package ${id} (attempt ${attempt}): ${(e as Error).message.slice(0, 90).split('\n')[0]}`)
    }
  }
}
/** « Je découvre », « Faire le tutoriel » (real clicks): the first room is open, the drawer is open on its first tab, the step card is up. */
async function takeTutorial(page: Page, id: DesignId): Promise<void> {
  await start(page).getByRole('button', { name: PROFILES[0].label, exact: true }).click()
  await start(page).getByRole('button', { name: /^Faire le tutoriel/ }).click()
  await page.waitForFunction(() => window.__creation?.place() === 'blank')
  await expect(page.getByTestId('inventory-drawer')).toHaveAttribute('data-open', 'true', { timeout: 20_000 })
  await expect(page.getByTestId('tutorial-card')).toBeVisible({ timeout: 20_000 })
  await waitStep(page, 1, stepsOf(id))
}
/** Step k of the run: the real bench change that step k-1 waits for (the model route: the sound, then the unplug), as the geometry spec does. */
async function advance(page: Page, id: DesignId, k: number): Promise<void> {
  if (onModel(id)) {
    if (k === 2) await testSignal(page)
    else await act(page, [{ type: 'UNPLUG', a: MODEL_LEFT.a, b: MODEL_LEFT.b }])
  } else await act(page, [...STEP_INTENTS[k - 2]])
  await waitStep(page, k, stepsOf(id))
}

// ── 11.7 the squint test ───────────────────────────────────────────────────────────────────────────────────────────────────────

const COLS = 32
const ROWS = 18
const CELLS = COLS * ROWS
/** The grid the balance is read on (see balanceOf). */
const FINE_COLS = 128
const FINE_ROWS = 72
/** Spec 11.7: every pair differs in at least this share of the cells. */
const MIN_DIFFERING = 0.08
/**
 * This task's choice (the spec does not give one): two cell means more than this far apart in CIELAB (ΔE 1976, D65) differ. A perceptual distance, because the first try (Euclidean
 * sRGB) classed the grey of small light text on Nuit as Prune. 8 is a clear step to a squinting eye: Nuit #131114 against the panel #1C191D is ΔE 3.4 (one tone); Nuit against
 * Prune #612D45 is 21 and against Papier 90.
 */
const CELL_DELTA_E = 8
/** A cell counts as one of the reference colours when its mean is within this ΔE of it; otherwise it is « mixed » (text, glyph edges, anti-aliasing). */
const CLASS_DELTA_E = 12
/** The colour the 3D view is painted with in the squint shot: a magenta no package uses; its cells are excluded from the balance. */
const MASK_COLOUR = '#FF00FF'
/**
 * The WebGL canvas is MASKED by hiding it (`visibility: hidden`), not by Playwright's `mask` option: `mask` paints a box OVER everything in the canvas's rectangle, and the guide's icon,
 * bubble and ring, the inventory drawer and the view cube all sit in that rectangle (the first baseline showed a magenta slab and no drawer, no Oscar). Hidden, the canvas pixels (software
 * GL, never stable) are gone and every DOM overlay stays.
 */
const HIDE_CANVAS = 'canvas { visibility: hidden !important }'
/** The squint shot also paints the 3D view's own box MASK_COLOUR (the overlays stay on top of it). */
const SQUINT_STYLE = `${HIDE_CANVAS} .cr-viewport { background: ${MASK_COLOUR} !important }`

type Rgb = readonly [number, number, number]
type Grid = readonly Rgb[]
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
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
  const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116))
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
}
/** ΔE 1976: the Euclidean distance in CIELAB. */
const dist = (a: Rgb, b: Rgb): number => {
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

const C = CREATION_TOKENS.color
type Family = 'nuit' | 'papier' | 'ambre' | 'prune' | 'mask' | 'mixed'
/** The reference colours of each family: the brand four, the shell's dark tints (panel, hairline) and the Papier sheet's inset (spec 7.3, ADR 0017). */
const REFERENCES: readonly (readonly [Family, Rgb])[] = [
  ['nuit', hex(C.nuit)],
  ['nuit', hex(C.panel)],
  ['nuit', hex(C.panelLine)],
  ['papier', hex(C.papier)],
  ['papier', hex('#E6E0D7')], // the Papier sheet's inset (packages.ts, sheetInset)
  ['ambre', hex(C.ambre)],
  ['prune', hex(C.prune)],
  ['prune', hex('#704055')], // the wash on a Prune panel (packages.ts, washOnPrune)
  ['mask', hex(MASK_COLOUR)],
]
function classOf(c: Rgb): Family {
  let best: Family = 'mixed'
  let d = Infinity
  for (const [f, ref] of REFERENCES) {
    const x = dist(c, ref)
    if (x < d) [best, d] = [f, x]
  }
  return d <= CLASS_DELTA_E ? best : 'mixed'
}

/** The box average of an image on a cols x rows grid (every pixel is in exactly one cell; the cell edges are the image's width and height divided by cols and rows). */
async function downsample(png: Buffer, cols: number, rows: number): Promise<Grid> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const cells: Rgb[] = []
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * info.width) / cols)
      const x1 = Math.floor(((cx + 1) * info.width) / cols)
      const y0 = Math.floor((cy * info.height) / rows)
      const y1 = Math.floor(((cy + 1) * info.height) / rows)
      const sum = [0, 0, 0]
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) for (let k = 0; k < 3; k++) sum[k] += data[(y * info.width + x) * info.channels + k]
      const n = (x1 - x0) * (y1 - y0)
      cells.push([sum[0] / n, sum[1] / n, sum[2] / n])
    }
  return cells
}
/** The share of the cells at which two grids differ (see CELL_DELTA_E). */
const differing = (a: Grid, b: Grid): number => a.filter((c, i) => dist(c, b[i]) > CELL_DELTA_E).length / CELLS
const passesSquint = (a: Grid, b: Grid): boolean => differing(a, b) >= MIN_DIFFERING
type Balance = Record<Family, number>
/**
 * The share of each brand family over the CLASSED cells (not the masked canvas, not « mixed »); `mask` is the canvas's share of the whole screen and `mixed` the share of the
 * non-canvas cells that are none of the four (text and edges). Read on the fine grid: at 32 x 18 a 28 px panel band is blended into its neighbours and no longer a colour.
 */
function balanceOf(g: Grid): Balance {
  const n: Balance = { nuit: 0, papier: 0, ambre: 0, prune: 0, mask: 0, mixed: 0 }
  for (const c of g) n[classOf(c)]++
  const classed = n.nuit + n.papier + n.ambre + n.prune
  return { nuit: n.nuit / classed, papier: n.papier / classed, ambre: n.ambre / classed, prune: n.prune / classed, mask: n.mask / g.length, mixed: n.mixed / (g.length - n.mask) }
}
const pct = (x: number): string => (x * 100).toFixed(1) + ' %'

/**
 * Spec 7.2, the declared balance of each package, each with the words of the table it comes from. Two claims per package, kept apart:
 *  - `kind`: what the identity IS (a dark screen, a daylight Papier sheet, no Prune, a Prune frame), read as a plain threshold on the share of the classed cells;
 *  - `number`: the « Prune share » row (about 3, 20, 0, 45 %). « about N % » is read as N points either way, 15 for the 20 and 45 % rows; « 0 % » as at most 2 %; « ink and focus only »
 *    as at most 10 %; the 3 % row, read the same way, as at most 18 %. The spec does not say what the share is OF; it is read here over the classed cells of the screen outside the 3D view.
 * Both fail the test; nothing is listed as known. (A first read of this over a canvas MASK painted over the drawer showed package 1 at 35 % Prune: the mask had hidden the drawer. The
 * numbers below are read with the canvas hidden and the overlays on.)
 */
interface Declared {
  says: string
  kind: (b: Balance) => string | null
  number: (b: Balance) => string | null
}
const about = (b: Balance, n: number, pts: number): string | null => (Math.abs(b.prune * 100 - n) > pts ? `Prune ${pct(b.prune)} is not about ${n} % (+- ${pts} points)` : null)
const BALANCE: Record<DesignId, Declared> = {
  1: { says: '« one lit thing on a dark screen », Prune about 3 %', kind: (b) => (b.nuit < 0.6 ? `Nuit ${pct(b.nuit)} < 60 % (not a dark screen)` : null), number: (b) => (b.prune > 0.18 ? `Prune ${pct(b.prune)} > 18 % (about 3 %)` : null) },
  2: { says: '« Prune study-sheet bands », Prune about 20 %', kind: (b) => (b.nuit < 0.6 ? `Nuit ${pct(b.nuit)} < 60 % (dark panels)` : b.prune < 0.05 ? `Prune ${pct(b.prune)} < 5 % (no bands)` : null), number: (b) => about(b, 20, 15) },
  3: { says: '« a daylight Papier sheet », Prune ink and focus only', kind: (b) => (b.papier < 0.6 ? `Papier ${pct(b.papier)} < 60 % (not a daylight sheet)` : null), number: (b) => (b.prune > 0.1 ? `Prune ${pct(b.prune)} > 10 % (ink and focus only)` : null) },
  4: { says: '« flat, hairline console, no raised panel », Prune 0 %', kind: (b) => (b.nuit < 0.9 ? `Nuit ${pct(b.nuit)} < 90 % (a dark console)` : null), number: (b) => (b.prune > 0.02 ? `Prune ${pct(b.prune)} > 2 % (0 %)` : null) },
  5: { says: '« a Prune stage frame around the 3D view », Prune about 45 %', kind: (b) => (b.prune < 0.25 ? `Prune ${pct(b.prune)} < 25 % (no stage frame)` : null), number: (b) => about(b, 45, 15) },
}
/** The workspace as the squint test sees it: the first room, the step card at step 1, the canvas painted MASK_COLOUR. */
async function workspaceShot(page: Page, id: DesignId): Promise<Buffer> {
  await toStartScreen(page, id)
  await takeTutorial(page, id)
  await atRest(page)
  return page.screenshot({ style: SQUINT_STYLE, animations: 'disabled', caret: 'hide' })
}

test.describe('11.7 squint test: the five packages are told apart at a glance', () => {
  test.use({ viewport: DESKTOP })
  test.setTimeout(300_000)

  test('the comparer bites: a package against itself, and the 8 % edge', () => {
    const flat: Grid = Array.from({ length: CELLS }, () => hex(C.nuit))
    expect(differing(flat, flat)).toBe(0)
    expect(passesSquint(flat, flat), 'a package against itself must fail the squint test').toBe(false)
    const change = (n: number): Grid => flat.map((c, i) => (i < n ? hex(C.papier) : c))
    expect(passesSquint(flat, change(Math.floor(CELLS * 0.07))), '7 % of the cells changed is not enough').toBe(false)
    expect(passesSquint(flat, change(Math.ceil(CELLS * 0.09))), '9 % of the cells changed is enough').toBe(true)
    // two dark tints of the shell are one tone to a squinting eye
    expect(differing(flat, flat.map(() => hex(C.panel)))).toBe(0)
    // and the balance reader sees what it is given
    expect(balanceOf(flat).nuit).toBe(1)
    expect(balanceOf(change(CELLS / 2)).papier).toBeCloseTo(0.5, 5)
  })

  test('every pair of the five packages differs in at least 8 % of the 32 x 18 cells, and each follows the balance spec 7.2 declares', async ({ page }) => {
    const grids = new Map<DesignId, Grid>()
    const fine = new Map<DesignId, Grid>()
    for (const id of DESIGN_IDS) {
      const shot = await workspaceShot(page, id)
      grids.set(id, await downsample(shot, COLS, ROWS))
      fine.set(id, await downsample(shot, FINE_COLS, FINE_ROWS))
    }

    const lines: string[] = []
    const failures: string[] = []
    for (const id of DESIGN_IDS) {
      const b = balanceOf(fine.get(id)!)
      const kind = BALANCE[id].kind(b)
      const number = BALANCE[id].number(b)
      lines.push(`package ${id}: Nuit ${pct(b.nuit)}, Papier ${pct(b.papier)}, Ambre ${pct(b.ambre)}, Prune ${pct(b.prune)} of the classed cells; mixed ${pct(b.mixed)}, canvas ${pct(b.mask)} of the screen | declared ${BALANCE[id].says} | kind: ${kind ?? 'ok'} | number: ${number ?? 'ok'}`)
      if (kind) failures.push(`package ${id} balance: ${kind}`)
      if (number) failures.push(`package ${id} Prune share: ${number}`)
    }
    for (const a of DESIGN_IDS)
      for (const b of DESIGN_IDS) {
        if (b <= a) continue
        const share = differing(grids.get(a)!, grids.get(b)!)
        lines.push(`pair ${a}-${b}: ${pct(share)} of ${CELLS} cells differ`)
        if (share < MIN_DIFFERING) failures.push(`packages ${a} and ${b} differ in ${pct(share)} of the cells, need >= ${pct(MIN_DIFFERING)}`)
      }
    console.log('SQUINT metric: 32 x 18 box average, a cell differs above dE ' + CELL_DELTA_E + '; balance on ' + FINE_COLS + ' x ' + FINE_ROWS + ', a cell is classed within dE ' + CLASS_DELTA_E + '\n' + lines.map((l) => 'SQUINT ' + l).join('\n'))
    expect(failures, failures.join('\n')).toEqual([])
  })
})

// ── 11.13 the snapshots ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the page is made to do before a capture (a test-side normalisation, no product file touched):
 *  - the WebGL canvas is hidden (a style tag: `toHaveScreenshot` takes a stylesheet by path, not by text);
 *  - the inventory drawer's height is pinned to a whole number of pixels. It is `height: 36%` of the view (253.797 px at 1366 x 768), so its top edge and its text sit on a fraction of a
 *    pixel, and Chromium rasterised the tab labels one pixel apart on about 4 page loads in 10 (the same page, the same state, two stable pictures; measured over 12 loads each: the fractional
 *    drawer gave two hashes of the tab row, the drawer at a whole 254 px gave one, `will-change`, `translateZ(0)`, a resize, `--font-render-hinting=none` and `--disable-lcd-text` did not
 *    settle it). The pin moves the drawer by at most half a pixel (it stays anchored at the bottom).
 */
async function prepare(page: Page): Promise<void> {
  await page.evaluate((css) => {
    if (document.getElementById('visual-hide-canvas') === null) {
      const el = document.createElement('style')
      el.id = 'visual-hide-canvas'
      el.textContent = css
      document.head.append(el)
    }
    const drawer = document.querySelector<HTMLElement>('[data-testid="inventory-drawer"]')
    if (drawer !== null) {
      drawer.style.removeProperty('height')
      const h = drawer.getBoundingClientRect().height
      if (h > 0) drawer.style.setProperty('height', `${Math.round(h)}px`, 'important')
    }
  }, HIDE_CANVAS)
}

/**
 * One capture: the viewport, the WebGL canvas hidden, animations finished and cancelled, caret hidden, and the console's live level readout (`.cr-listen-meters`: a level in dBFS and a bar
 * that follow the playing sound, a different number every time) masked. `soft` so one run lists every screen that moved. No pixel tolerance.
 */
async function snap(page: Page, name: string, soundPlaying = false): Promise<void> {
  await atRest(page, soundPlaying)
  await prepare(page)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) // the pinned height is laid out and painted
  await expect.soft(page).toHaveScreenshot(name, { mask: [page.locator('.cr-listen-meters')], animations: 'disabled', caret: 'hide', maxDiffPixels: 0 })
}

const SCREENS: readonly { size: Size; closing: boolean }[] = [
  { size: DESKTOP, closing: true },
  { size: TABLET, closing: true },
  { size: PORTRAIT, closing: false },
]

for (const { size, closing } of SCREENS) {
  test.describe(`11.13 snapshots at ${size.width} x ${size.height}`, () => {
    test.use({ viewport: size })
    test.setTimeout(240_000)

    for (const id of DESIGN_IDS) {
      const n = stepsOf(id)
      const tag = `pkg-${id}-${size.width}x${size.height}`
      test(`package ${id}: start screen, first room at step 1${closing ? ', connect view, closing card' : ''}`, async ({ page }) => {
        // 1. the start screen (first stage)
        await toStartScreen(page, id)
        await snap(page, `${tag}-start.png`)

        // 2. the first room, the step card at step 1
        await takeTutorial(page, id)
        await snap(page, `${tag}-room.png`)
        if (!closing) return

        // 3. the connect view: step 4 of the ten (package 5: its third and last step, « rebrancher », after the sound and the unplug)
        const connectStep = onModel(id) ? 3 : 4
        for (let k = 2; k <= connectStep; k++) await advance(page, id, k)
        await expect(page.locator('.oscar-live')).toContainText(`étape ${connectStep} sur ${n}`, { timeout: 15_000 })
        await snap(page, `${tag}-connect.png`, onModel(id)) // package 5's sound has played since its step 1

        // 4. the closing card: every step done, a sound playing (package 5: the replug of the cable the connect view unplugged)
        if (onModel(id)) await act(page, [connect(MODEL_LEFT.a.instance, MODEL_LEFT.a.port, MODEL_LEFT.b.instance, MODEL_LEFT.b.port)])
        else {
          for (let k = connectStep + 1; k <= n; k++) await advance(page, id, k)
          await testSignal(page)
        }
        await expect(page.getByTestId('tutorial-closing')).toBeVisible({ timeout: 20_000 })
        await snap(page, `${tag}-closing.png`, true)
      })
    }
  })
}
