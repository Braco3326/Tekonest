// The patches this repo carries on top of the vendored guide module (src/guide/vendor), and the pin that keeps them honest.
//
// Three things are proven here:
//  1. placeBeside (core/motion.ts) takes a list of rects to stay clear of: it triggers (another side is chosen), it costs nothing without the list (the same
//     answer as the original code, for a sweep of targets and viewports), and when nothing is clear it takes the least overlap and says `crowded`.
//  2. the module's own `planMotion` hands the list to placeBeside for the pickup and the drop.
//  3. clearOf (core/motion.ts) finds the nearest place for a box that is clear of the host's rects, and says `crowded` when none is; its `heavy` rects (the icon)
//     are never given up when it has to settle for a crowded place: the host's controls take the overlap.
//  4. every patch written up in src/guide/VENDOR-PATCHES.md is declared in VENDOR.json (`patches`), its files are in the manifest, its symbols exist in the files
//     and its marker comment is in the file, so a re-vendor that drops a patch fails here and not on a learner's screen.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAP, ICON_SIZE, clearOf, placeBeside, planMotion, rectsIntersect } from '../../src/guide/vendor/core/motion'
import type { Rect } from '../../src/guide/vendor/core/types'

const VENDOR = join('src', 'guide', 'vendor')
const read = (p: string): string => readFileSync(p, 'utf8')

// ── the original placeBeside, pasted from commit 56b7866 (the vendored file before any patch) as the oracle for « no list = the same answer » ─────────────
// Only the indentation was changed (2 spaces) and the export dropped; the helpers it uses are the ones of that file, pasted too.

type Side = 'right' | 'left' | 'below' | 'above'
type Point = { x: number; y: number }
const GAPS: readonly number[] = [8, 4, 0]
const SIDES: readonly Side[] = ['right', 'left', 'below', 'above']
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}
function rectsIntersectOld(a: Rect, b: Rect): boolean {
  return overlapArea(a, b) > 0
}
function insideViewport(r: Rect, vp: { w: number; h: number }): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.w && r.y + r.h <= vp.h
}
interface Place {
  x: number
  y: number
  side: Side
  crowded: boolean
}
function originalPlaceBeside(t: Rect, vp: {
  w: number;
  h: number;
}, s: number): Place {
  const maxX = Math.max(0, vp.w - s);
  const maxY = Math.max(0, vp.h - s);
  const cy = t.y + t.h / 2 - s / 2;
  const cx = t.x + t.w / 2 - s / 2;
  const raw = (side: Side, gap: number): Point => {
    switch (side) {
      case "right":
        return { x: t.x + t.w + gap, y: cy };
      case "left":
        return { x: t.x - gap - s, y: cy };
      case "below":
        return { x: cx, y: t.y + t.h + gap };
      default:
        return { x: cx, y: t.y - gap - s };
    }
  };
  const box = (p: Point): Rect => ({ x: p.x, y: p.y, w: s, h: s });
  if (vp.w >= s && vp.h >= s) {
    for (const gap of GAPS) {
      for (const side of SIDES) {
        const p = raw(side, gap);
        const horizontal = side === "right" || side === "left";
        const primaryOk = horizontal ? p.x >= 0 && p.x <= maxX : p.y >= 0 && p.y <= maxY;
        if (!primaryOk)
          continue;
        const q = { x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) };
        if (!rectsIntersectOld(box(q), t) && insideViewport(box(q), vp))
          return { ...q, side, crowded: false };
      }
    }
  }
  let best: Place | null = null;
  let bestArea = Infinity;
  for (const side of SIDES) {
    const p = raw(side, GAP);
    const q = { x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) };
    const area = overlapArea(box(q), t);
    if (area < bestArea) {
      bestArea = area;
      best = { ...q, side, crowded: true };
    }
  }
  return best as Place;
}

// ── placeBeside ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const VP = { w: 1366, h: 768 }
const T: Rect = { x: 500, y: 300, w: 100, h: 40 }
const S = ICON_SIZE
const boxOf = (p: { x: number; y: number }): Rect => ({ x: p.x, y: p.y, w: S, h: S })

describe('placeBeside: the list of rects to stay clear of', () => {
  it('without the list the icon goes right of the target (the premise of the next tests)', () => {
    const p = placeBeside(T, VP, S)
    expect(p.side).toBe('right')
    expect(p.x).toBe(T.x + T.w + GAP)
    expect(p.crowded).toBe(false)
  })

  it('TRIGGERS: a rect where the icon would go sends it to another side, clear of the target and of the rect, not crowded', () => {
    const where = placeBeside(T, VP, S)
    const avoid: Rect[] = [{ x: where.x - 2, y: where.y - 2, w: S + 4, h: S + 4 }]
    const p = placeBeside(T, VP, S, avoid)
    expect(p.side).not.toBe('right')
    expect(p.crowded).toBe(false)
    expect(rectsIntersect(boxOf(p), T)).toBe(false)
    expect(rectsIntersect(boxOf(p), avoid[0])).toBe(false)
    expect(boxOf(p).x).toBeGreaterThanOrEqual(0)
    expect(boxOf(p).y + S).toBeLessThanOrEqual(VP.h)
  })

  it('the first side that is free wins, in the order right, left, below, above', () => {
    const right = placeBeside(T, VP, S)
    const left = { x: T.x - GAP - S, y: T.y + T.h / 2 - S / 2, w: S, h: S }
    expect(placeBeside(T, VP, S, [{ ...boxOf(right) }]).side).toBe('left')
    expect(placeBeside(T, VP, S, [boxOf(right), left]).side).toBe('below')
  })

  it('a rect that is not near the icon changes nothing, and unusable rects in the list are ignored', () => {
    const base = placeBeside(T, VP, S)
    expect(placeBeside(T, VP, S, [{ x: 0, y: 0, w: 30, h: 30 }])).toEqual(base)
    const junk = [{ x: Number.NaN, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 10 }, null, undefined] as unknown as Rect[]
    expect(placeBeside(T, VP, S, junk)).toEqual(base)
  })

  it('CHARACTERIZATION (passes on the original code, which is pasted above from 56b7866): with no list, an empty list, or no rect near, the answer is the original code answer over a sweep of targets and viewports', () => {
    let n = 0
    let seed = 12345
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const viewports = [VP, { w: 1024, h: 768 }, { w: 820, h: 1180 }, { w: 375, h: 667 }, { w: 60, h: 60 }, { w: 40, h: 900 }]
    for (const vp of viewports) {
      for (let i = 0; i < 400; i++) {
        const t: Rect = { x: rnd() * vp.w * 1.2 - vp.w * 0.1, y: rnd() * vp.h * 1.2 - vp.h * 0.1, w: 1 + rnd() * 400, h: 1 + rnd() * 300 }
        const want = originalPlaceBeside(t, vp, S)
        expect(placeBeside(t, vp, S), JSON.stringify({ vp, t })).toEqual(want)
        expect(placeBeside(t, vp, S, []), JSON.stringify({ vp, t })).toEqual(want)
        expect(placeBeside(t, vp, S, [{ x: -1000, y: -1000, w: 10, h: 10 }]), JSON.stringify({ vp, t })).toEqual(want)
        n++
      }
    }
    expect(n).toBe(viewports.length * 400)
  })

  it('SLIDES: when all four sides are covered but a clear place is within three icon sizes, the icon goes there, not crowded, still clear of the target', () => {
    const right = placeBeside(T, VP, S)
    const avoid: Rect[] = [
      { x: right.x - 5, y: right.y - 5, w: S + 10, h: S + 10 },
      { x: T.x - GAP - S - 5, y: right.y - 5, w: S + 10, h: S + 10 },
      { x: T.x + T.w / 2 - S / 2 - 5, y: T.y + T.h - 5, w: S + 10, h: S + 20 },
      { x: T.x + T.w / 2 - S / 2 - 5, y: T.y - GAP - S - 5, w: S + 10, h: S + 10 },
    ]
    const p = placeBeside(T, VP, S, avoid)
    expect(p.crowded).toBe(false)
    expect(rectsIntersect(boxOf(p), T)).toBe(false)
    for (const a of avoid) expect(rectsIntersect(boxOf(p), a)).toBe(false)
    expect(Math.hypot(p.x - right.x, p.y - right.y)).toBeLessThanOrEqual(3 * S + 20)
  })

  it('EVERYTHING AVOIDED: the least overlap is taken and the answer says crowded; the target is still cleared', () => {
    const everything: Rect = { x: 0, y: 0, w: VP.w, h: VP.h }
    const p = placeBeside(T, VP, S, [everything])
    expect(p.crowded).toBe(true)
    expect(rectsIntersect(boxOf(p), T)).toBe(false)
    expect(p.side).toBe('right') // all equal: the first candidate
    // the first box is covered twice: the next candidate, which is covered once, wins
    const q = placeBeside(T, VP, S, [everything, boxOf(p)])
    expect(q.crowded).toBe(true)
    expect(q.side).toBe('left')
    expect(rectsIntersect(boxOf(q), T)).toBe(false)
  })

  it('a target that fills the viewport still gets an answer: crowded (the icon is on the target), but off the rects when a place is near', () => {
    const t: Rect = { x: 0, y: 0, w: VP.w, h: VP.h }
    const noList = placeBeside(t, VP, S)
    const avoid: Rect[] = [boxOf(noList)]
    const p = placeBeside(t, VP, S, avoid)
    expect(p.crowded).toBe(true)
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    expect(rectsIntersect(boxOf(p), avoid[0])).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x + S).toBeLessThanOrEqual(VP.w)
    // no list: the original answer, untouched
    expect(placeBeside(t, VP, S, [])).toEqual(noList)
  })
})

describe('clearOf: the nearest place clear of the host rects', () => {
  const box = (p: { x: number; y: number }, size = { w: S, h: S }): Rect => ({ x: p.x, y: p.y, w: size.w, h: size.h })
  const hits = (p: { x: number; y: number }, avoid: Rect[], size = { w: S, h: S }): boolean => avoid.some((a) => rectsIntersect(box(p, size), a))
  const SIZE = { w: S, h: S }

  it('a place that is already clear comes back untouched (no list, an empty list, rects far away, unusable rects)', () => {
    const from = { x: 100.5, y: 200.25 }
    for (const avoid of [[], [{ x: 900, y: 600, w: 50, h: 50 }], [{ x: Number.NaN, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 5 }]] as Rect[][])
      expect(clearOf(from, SIZE, VP, avoid)).toEqual({ ...from, crowded: false })
  })

  it('TRIGGERS: a rect on the place moves the box to the nearest clear place, inside the viewport, not crowded', () => {
    const from = { x: 100, y: 100 }
    const avoid: Rect[] = [{ x: 90, y: 90, w: 100, h: 100 }]
    const p = clearOf(from, SIZE, VP, avoid)
    expect(p.crowded).toBe(false)
    expect(hits(p, avoid)).toBe(false)
    expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeLessThanOrEqual(70) // one push past the rect edge, not a trip across the screen
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
  })

  it('a column of buttons (a panel of controls) is stepped around: the answer is clear of all of them and near', () => {
    const column: Rect[] = Array.from({ length: 20 }, (_, i) => ({ x: 1100, y: 40 + i * 36, w: 240, h: 32 }))
    const from = { x: 1294, y: 668 }
    const p = clearOf(from, SIZE, VP, column)
    expect(p.crowded).toBe(false)
    expect(hits(p, column)).toBe(false)
    expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeLessThan(260)
  })

  it('a big box (a bubble) is moved clear too, and stays inside the viewport', () => {
    const bubble = { w: 330, h: 220 }
    const avoid: Rect[] = [{ x: 0, y: 500, w: 900, h: 268 }, { x: 1100, y: 32, w: 260, h: 700 }]
    const p = clearOf({ x: 700, y: 520 }, bubble, VP, avoid)
    expect(hits(p, avoid, bubble)).toBe(false)
    expect(p.x + bubble.w).toBeLessThanOrEqual(VP.w)
    expect(p.y + bubble.h).toBeLessThanOrEqual(VP.h)
  })

  it('EVERYTHING AVOIDED: the least overlapping place and crowded (here the strip at the right edge, the only part of the screen not fully covered)', () => {
    const vp = { w: 300, h: 300 }
    const p = clearOf({ x: 100, y: 100 }, SIZE, vp, [{ x: 0, y: 0, w: 270, h: 300 }])
    expect(p.crowded).toBe(true)
    expect(p.x).toBe(vp.w - S) // 244: 26 px of overlap, the least anywhere
    const all = clearOf({ x: 100, y: 100 }, SIZE, vp, [{ x: 0, y: 0, w: 300, h: 300 }])
    expect(all).toEqual({ x: 100, y: 100, crowded: true }) // every place is equal: where it started
  })

  it('is deterministic, and many rects stay bounded: 400 rects cost a counted number of rect reads, not a wall-clock time', () => {
    let reads = 0
    const rects: Rect[] = Array.from({ length: 400 }, (_, i) => {
      const r = { y: Math.floor(i / 20) * 36, w: 55, h: 32 } as Rect
      Object.defineProperty(r, 'x', {
        enumerable: true,
        get: () => {
          reads++
          return (i % 20) * 60
        },
      })
      return r
    })
    const a = clearOf({ x: 300, y: 300 }, SIZE, VP, rects)
    const once = reads
    expect(clearOf({ x: 300, y: 300 }, SIZE, VP, rects)).toEqual(a)
    expect(reads - once).toBe(once) // the same work twice
    // the search is bounded: 4 rounds of at most 48 places, one grid of 24 px: a few million reads at the very most for 400 rects
    expect(once).toBeLessThan(4_000_000)
  })
})

describe('clearOf with heavy rects: a place clear of what must stay uncovered, the least overlap with the rest', () => {
  // The phone, read from the page at the moment of the defect (the frames just after a resize to 375 x 812, the side panels still at their 1280 px widths): the two
  // panels together span the whole width, a 351 x 341 bubble fits clear of neither, and the icon rests at the right edge.
  const PHONE = { w: 375, h: 812 }
  const BUBBLE = { w: 351, h: 341 }
  const panels: Rect[] = [
    { x: 200, y: 32, w: 175, h: 752 },
    { x: 0, y: 32, w: 200, h: 752 },
    // the menu bar's items, then a status bar control (the whole list as the page gave it; with fewer items the plain search happens to land clear of the icon)
    { x: 12, y: 0, w: 54.6875, h: 31 },
    { x: 66.6875, y: 0, w: 44.296875, h: 31 },
    { x: 110.984375, y: 0, w: 67.84375, h: 31 },
    { x: 178.828125, y: 0, w: 66.96875, h: 31 },
    { x: 245.796875, y: 0, w: 60.234375, h: 31 },
    { x: 306.03125, y: 0, w: 42.1875, h: 31 },
    { x: 348.21875, y: 0, w: 26.78125, h: 31 },
    { x: 369.609375, y: 786.5, w: 5.390625, h: 24 },
  ]
  const icon: Rect = { x: 319, y: 643.5, w: 56, h: 56 }
  const at = (p: { x: number; y: number }): Rect => ({ x: p.x, y: p.y, w: BUBBLE.w, h: BUBBLE.h })

  it('TRIGGERS: when no place is clear of everything, the answer is still clear of what must stay uncovered (the icon), and inside the viewport', () => {
    const from = { x: 16, y: 262.5 }
    // what clearOf alone does with the icon among the rects: the least overlap in total, which covers the icon (the defect this function closes)
    const plain = clearOf(from, BUBBLE, PHONE, [...panels, icon])
    expect(plain.crowded).toBe(true)
    expect(rectsIntersect(at(plain), icon)).toBe(true)
    const p = clearOf(from, BUBBLE, PHONE, panels, [icon])
    expect(p.crowded).toBe(true) // the panels cannot be avoided at this width: said, not hidden
    expect(rectsIntersect(at(p), icon)).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x + BUBBLE.w).toBeLessThanOrEqual(PHONE.w)
    expect(p.y + BUBBLE.h).toBeLessThanOrEqual(PHONE.h)
  })

  it('DOES NOT TRIGGER: when a place is clear of everything it is the one clearOf gives; with nothing to keep it is clearOf', () => {
    const avoid: Rect[] = [{ x: 90, y: 90, w: 100, h: 100 }]
    const keep: Rect[] = [{ x: 400, y: 300, w: 56, h: 56 }]
    const from = { x: 100, y: 100 }
    expect(clearOf(from, { w: S, h: S }, VP, avoid, keep)).toEqual(clearOf(from, { w: S, h: S }, VP, [...avoid, ...keep]))
    expect(clearOf(from, { w: S, h: S }, VP, avoid, keep).crowded).toBe(false)
    expect(clearOf({ x: 16, y: 262.5 }, BUBBLE, PHONE, panels, [])).toEqual(clearOf({ x: 16, y: 262.5 }, BUBBLE, PHONE, panels))
  })
})

describe('planMotion hands the list to placeBeside', () => {
  const plan = (avoid?: Rect[], gesture: 'point' | 'drag' = 'point', to?: Rect) =>
    planMotion({ from: { x: 10, y: 10 }, target: T, ...(to ? { to } : {}), viewport: VP, gesture, reducedMotion: true, iconSize: S, ...(avoid ? { avoid } : {}) })

  it('the icon ends beside the target but not on the avoided rect; without the list nothing changes', () => {
    const free = plan()
    const last = free.keyframes[free.keyframes.length - 1]
    const avoid: Rect[] = [{ x: last.x - 2, y: last.y - 2, w: S + 4, h: S + 4 }]
    const moved = plan(avoid)
    const end = moved.keyframes[moved.keyframes.length - 1]
    expect(moved.ok).toBe(true)
    expect(rectsIntersect({ x: end.x, y: end.y, w: S, h: S }, avoid[0])).toBe(false)
    expect(moved.crowded).toBe(false)
    expect(plan([])).toEqual(free)
  })

  it('a drag: both the pickup and the drop beside the drop target stay clear of the list', () => {
    const drop: Rect = { x: 900, y: 500, w: 80, h: 30 }
    const free = plan(undefined, 'drag', drop)
    const end = free.keyframes[free.keyframes.length - 1]
    const avoid: Rect[] = [{ x: end.x - 1, y: end.y - 1, w: S + 2, h: S + 2 }]
    const moved = plan(avoid, 'drag', drop)
    const last = moved.keyframes[moved.keyframes.length - 1]
    expect(rectsIntersect({ x: last.x, y: last.y, w: S, h: S }, avoid[0])).toBe(false)
  })
})

// ── the pin ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Patch {
  id: string
  files: string[]
  symbols: string[]
  pinTest: string
}
const manifest = (): { files: { path: string }[]; patches?: Patch[] } => JSON.parse(read(join(VENDOR, 'VENDOR.json')))

/** The write-up: one `### Patch <id>` heading per patch, then `File:`, `Symbol:` and `Marker:` lines (the marker is the comment that sits above the patched code). */
function written(): { id: string; files: string[]; symbols: string[]; marker: string }[] {
  const md = read(join('src', 'guide', 'VENDOR-PATCHES.md'))
  const out: { id: string; files: string[]; symbols: string[]; marker: string }[] = []
  for (const block of md.split(/^### Patch /m).slice(1)) {
    const id = block.split('\n')[0].trim()
    const list = (key: string): string[] => [...block.matchAll(new RegExp(`^- ${key}: \`([^\`]+)\``, 'gm'))].map((m) => m[1])
    out.push({ id, files: list('File'), symbols: list('Symbol'), marker: list('Marker')[0] ?? '' })
  }
  return out
}

describe('the third patch: the page watcher sees the attributes the shell changes', () => {
  it('ui/watch.ts observes data-props, data-tree, data-open and inert as well as its original five, so a panel fold or a drawer closing moves the icon with no other event', () => {
    const text = read(join(VENDOR, 'ui', 'watch.ts'))
    const filter = /attributeFilter:\s*\[([^\]]*)\]/.exec(text)
    expect(filter, 'the observer has an attributeFilter').not.toBeNull()
    const names = [...filter![1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    for (const n of ['class', 'style', 'hidden', 'open', 'data-oscar-anchor', 'data-props', 'data-tree', 'data-open', 'inert']) expect(names, n).toContain(n)
  })
})

describe('VENDOR.json keeps the upstream hash of every patched file', () => {
  it('a file named by a patch has an upstreamSha256 different from its own sha256; a file no patch names has none', () => {
    const m = JSON.parse(read(join(VENDOR, 'VENDOR.json'))) as { files: { path: string; sha256: string; upstreamSha256?: string }[]; patches: Patch[] }
    const patched = new Set(m.patches.flatMap((p) => p.files))
    for (const f of m.files) {
      if (patched.has(f.path)) {
        expect(f.upstreamSha256, `${f.path} has the upstream hash`).toMatch(/^[0-9a-f]{64}$/)
        expect(f.upstreamSha256, `${f.path} differs from upstream`).not.toBe(f.sha256)
      } else expect(f.upstreamSha256, `${f.path} is not patched`).toBeUndefined()
    }
  })
})

describe('VENDOR-PATCHES.md and VENDOR.json agree', () => {
  it('there is at least one patch, and the write-up and the manifest name the same ones', () => {
    expect(existsSync(join('src', 'guide', 'VENDOR-PATCHES.md'))).toBe(true)
    const md = written()
    const json = manifest().patches ?? []
    expect(md.length).toBeGreaterThan(0)
    expect(json.map((p) => p.id).sort()).toEqual(md.map((p) => p.id).sort())
  })

  it('every patch: its files are in the manifest, its symbols exist, its marker is in the file, the pin test is this file', () => {
    const m = manifest()
    const listed = new Set(m.files.map((f) => f.path))
    for (const w of written()) {
      const p = (m.patches ?? []).find((x) => x.id === w.id)
      expect(p, `patch ${w.id} is in VENDOR.json`).toBeDefined()
      expect([...p!.files].sort(), `${w.id} files`).toEqual([...w.files].sort())
      expect([...p!.symbols].sort(), `${w.id} symbols`).toEqual([...w.symbols].sort())
      expect(p!.pinTest).toBe('tests/guide/vendorPatches.test.ts')
      expect(existsSync(p!.pinTest)).toBe(true)
      expect(w.marker, `${w.id} has a marker`).not.toBe('')
      for (const f of w.files) {
        expect(listed.has(f), `${f} is in the manifest`).toBe(true)
        const text = read(join(VENDOR, f))
        expect(text, `${f} carries the marker of ${w.id}`).toContain(w.marker)
      }
      for (const sym of w.symbols) {
        const declared = w.files.some((f) => new RegExp(`(?:function|const|interface|type)\\s+${sym}\\b|\\b${sym}\\??:`).test(read(join(VENDOR, f))))
        expect(declared, `${sym} is declared in ${w.files.join(', ')}`).toBe(true)
      }
    }
  })

  it('a patch that is not written up cannot be declared (the other direction)', () => {
    const md = new Set(written().map((p) => p.id))
    for (const p of manifest().patches ?? []) expect(md.has(p.id), `${p.id} has a section in VENDOR-PATCHES.md`).toBe(true)
  })
})
