/**
 * cableGravity — the physical shape of a cable (mission 3 A, « gravity first »). Pure: no Babylon, no DOM (unit-tested heart).
 *
 * Founder, 2026-11-15: « Gravity first: no cable may fly anywhere. A cable rests on the floor, on decks and on equipment, and hangs only where it
 * physically must. » The old shape (cablePath.ts `catenaryPoints`) is a parabola between the two ports, lifted to the floor where it would dip under
 * it: between two ports at different heights it stayed in the air for its whole length. Here a cable is built the way a real one lies:
 *
 * 1. From each port it leaves along the connector's outward direction and bends down (a quarter arc of radius `BEND_R`, the bend radius of a
 *    24 mm cable). A connector with no known outward direction (a microphone's XLR, the cable in hand) hangs straight down from the connector.
 * 2. Where that bend ends higher than the surface under it, the cable DROPS vertically onto the surface and bends into its run (a second arc).
 * 3. It runs ON the support surface: the floor / deck under it (`floorAt`) and the TOP of every device that rests on that surface (`SupportBox`).
 *    A device in the way is crossed OVER, never through: the run climbs it and comes down on a short ramp (`RAMP_SLOPE`), the only other place a
 *    run leaves its surface. A raised device (on a stand, flown, or with an unknown height) is no support: the cable passes under it.
 * 4. It rises to the other port the same way.
 * Two raised ports closer than `LOOP_M` (two devices of the same rack row, a short patch) make a small hanging loop instead, its lowest point clamped
 * to the surface: that is what such a cable does.
 *
 * The plan path of the run is the straight line between the two bends, or `route` (the hand-drawn route of part B: plan points [x, z] between them).
 * `supportReport` measures any drawn polyline against the same surface: the e2e oracle that no cable flies.
 */
import type { P3 } from './cablePath'

export interface XZ {
  x: number
  z: number
}

/** Radius of the bends at a connector and at the foot of a drop (m): about four diameters of a 24 mm cable. */
export const BEND_R = 0.05
/** A bend that ends more than this above the surface (m, over the clearance) drops onto it; nearer, it simply lies down. */
export const RAISED_EPS = 0.03
/** Two raised ports nearer than this in plan (m) hang as one small loop instead of dropping to the floor and rising again. */
export const LOOP_M = 0.4
/** Sag of that loop: at least 6 cm, else 40 % of its span. */
export const LOOP_SAG_MIN = 0.06
export const LOOP_SAG_FACTOR = 0.4
/** The steepest a cable climbs onto (or comes down from) a support it crosses: rise over run. A 27 cm console gets a 5.4 cm ramp, a 1.3 m stage 26 cm. */
export const RAMP_SLOPE = 5
/** Sampling step of the run along its plan path (m). Edges of devices and decks are found exactly, not at this step. */
export const SAMPLE_M = 0.05
/** At most this many samples per cable run (a very long run gets a longer step). */
export const MAX_SAMPLES = 4000
/** A device rests on a surface when its base is within this of it (m): only such a device supports a cable. */
export const GROUND_EPS = 0.02
/** Run points closer than this to the line through their neighbours (and never under it) are dropped (m). */
export const SIMPLIFY_TOL = 0.002
/** `supportReport`: a point is on its surface when its centre is within this of the surface plus the clearance (m). */
export const SUPPORT_TOL = 0.005

/**
 * A device's box as a support: centre (x, z) of its footprint, width `w` along its local x, depth `d` along its local z (front to rear), yaw about +y
 * in degrees (the 3D convention: local (lx, lz) -> world (x + lx cos + lz sin, z - lx sin + lz cos), as plan2d/geometry.ts), its base height and its
 * height `h` (m). Only devices whose height is on their own sheet are given (cableSupportSizes.json); unknown = not a support.
 */
export interface SupportBox {
  id?: string
  x: number
  z: number
  w: number
  d: number
  yawDeg: number
  base: number
  h: number
}

/** The surface a cable lies on. */
export interface Support {
  /** Height (m) of the surface at (x, z): the floor / deck there, or the top of a device resting on it. */
  heightAt(x: number, z: number): number
  /** The same, leaving out the boxes whose footprint (grown by `margin`) holds `own` below their top: the surface around a connector, without its own device's body. */
  heightAtExcept(x: number, z: number, own: P3, margin: number): number
  /** The boxes that support (they rest on the floor, a deck or another supporting box). */
  readonly grounded: readonly SupportBox[]
  /** Where the plan segment p -> q enters and leaves supporting boxes: parameters in (0, 1), sorted. */
  crossings(p: XZ, q: XZ): number[]
}

const DEG = Math.PI / 180
const valid = (b: SupportBox): boolean =>
  [b.x, b.z, b.w, b.d, b.yawDeg, b.base, b.h].every(Number.isFinite) && b.w > 0 && b.d > 0 && b.h > 0

/** (x, z) in the box's own frame. */
function local(b: SupportBox, x: number, z: number): { lx: number; lz: number } {
  const t = b.yawDeg * DEG
  const c = Math.cos(t)
  const s = Math.sin(t)
  const dx = x - b.x
  const dz = z - b.z
  return { lx: dx * c - dz * s, lz: dx * s + dz * c }
}

const inside = (b: SupportBox, x: number, z: number): boolean => {
  const { lx, lz } = local(b, x, z)
  return Math.abs(lx) <= b.w / 2 + 1e-9 && Math.abs(lz) <= b.d / 2 + 1e-9
}

/** Half extents of a box's world AABB. */
function aabb(b: SupportBox): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const t = b.yawDeg * DEG
  const c = Math.abs(Math.cos(t))
  const s = Math.abs(Math.sin(t))
  const ex = (b.w / 2) * c + (b.d / 2) * s
  const ez = (b.w / 2) * s + (b.d / 2) * c
  return { minX: b.x - ex, maxX: b.x + ex, minZ: b.z - ez, maxZ: b.z + ez }
}

/** Slab test of the plan segment p -> q against a box: the parameters (0..1) where it enters and leaves, or null. */
function segmentBox(b: SupportBox, p: XZ, q: XZ): [number, number] | null {
  const a = local(b, p.x, p.z)
  const e = local(b, q.x, q.z)
  let t0 = 0
  let t1 = 1
  for (const [o, d, half] of [
    [a.lx, e.lx - a.lx, b.w / 2],
    [a.lz, e.lz - a.lz, b.d / 2],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(o) > half) return null
      continue
    }
    let ta = (-half - o) / d
    let tb = (half - o) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return null
  }
  return [t0, t1]
}

/**
 * The support surface of a room: its floor plus the boxes that rest on it. A box rests when its base is within `GROUND_EPS` of the surface under its
 * centre, boxes taken from the lowest base up (so a device standing on another one supports too). Lookups go through a grid of `cellM` cells: a few
 * box tests per point, whatever the rig.
 */
export function buildSupport(floorAt: (x: number, z: number) => number, boxes: readonly SupportBox[] = [], cellM = 0.5): Support {
  const grounded: SupportBox[] = []
  const below = (x: number, z: number): number => {
    let h = floorAt(x, z)
    for (const g of grounded) if (inside(g, x, z)) h = Math.max(h, g.base + g.h)
    return h
  }
  for (const b of [...boxes].filter(valid).sort((p, q) => p.base - q.base)) if (Math.abs(b.base - below(b.x, b.z)) <= GROUND_EPS) grounded.push(b)

  const cells = new Map<string, number[]>()
  const key = (i: number, j: number): string => `${i},${j}`
  grounded.forEach((b, idx) => {
    const r = aabb(b)
    for (let i = Math.floor(r.minX / cellM); i <= Math.floor(r.maxX / cellM); i++)
      for (let j = Math.floor(r.minZ / cellM); j <= Math.floor(r.maxZ / cellM); j++) {
        const k = key(i, j)
        const list = cells.get(k)
        if (list) list.push(idx)
        else cells.set(k, [idx])
      }
  })
  const boundsOf = grounded.map(aabb)
  return {
    grounded,
    heightAt(x, z) {
      let h = floorAt(x, z)
      const list = cells.get(key(Math.floor(x / cellM), Math.floor(z / cellM)))
      if (list) for (const idx of list) if (inside(grounded[idx]!, x, z)) h = Math.max(h, grounded[idx]!.base + grounded[idx]!.h)
      return h
    },
    heightAtExcept(x, z, own, margin) {
      let h = floorAt(x, z)
      const list = cells.get(key(Math.floor(x / cellM), Math.floor(z / cellM)))
      if (list)
        for (const idx of list) {
          const g = grounded[idx]!
          if (!inside(g, x, z)) continue
          const o = local(g, own.x, own.z)
          if (own.y < g.base + g.h && Math.abs(o.lx) <= g.w / 2 + margin && Math.abs(o.lz) <= g.d / 2 + margin) continue // the connector's own device
          h = Math.max(h, g.base + g.h)
        }
      return h
    },
    crossings(p, q) {
      const out: number[] = []
      const minX = Math.min(p.x, q.x)
      const maxX = Math.max(p.x, q.x)
      const minZ = Math.min(p.z, q.z)
      const maxZ = Math.max(p.z, q.z)
      grounded.forEach((b, idx) => {
        const r = boundsOf[idx]!
        if (r.maxX < minX || r.minX > maxX || r.maxZ < minZ || r.minZ > maxZ) return
        const t = segmentBox(b, p, q)
        if (!t) return
        for (const v of t) if (v > 0 && v < 1) out.push(v)
      })
      return out.sort((m, n) => m - n)
    },
  }
}

/** One end of a cable: the connector, and the direction a cable leaves it (world; only its horizontal part is used). None = hangs straight down. */
export interface GravityEnd {
  at: P3
  out?: P3 | null
}

export interface GravityOptions {
  /** Height of the cable's centre above the surface when it rests on it (m): its radius plus a hair. */
  clearance: number
  /** A hand-drawn plan route (part B): the points [x, z] the run goes through between the two ends, in order. Absent = the straight line. */
  route?: readonly XZ[]
  /** Simplification tolerance of the run (m); a larger one (the budget's coarse shape) draws fewer points, never under the surface. */
  tolM?: number
  /** False: no connector or drop bends (the budget's coarse shape). */
  arcs?: boolean
}

interface Sample {
  x: number
  z: number
  u: number
  /** The surface height there. */
  g: number
  /** A route corner (kept by the simplification). */
  corner: boolean
}

const dist2 = (p: XZ, q: XZ): number => Math.hypot(q.x - p.x, q.z - p.z)

/** Samples of the surface along a plan polyline: a regular step, the exact edges of supporting boxes, and the edges of decks found by bisection. */
function sampleRun(plan: readonly XZ[], support: Support): Sample[] {
  const total = plan.slice(1).reduce((s, q, i) => s + dist2(plan[i]!, q), 0)
  const step = Math.max(SAMPLE_M, total / MAX_SAMPLES)
  const out: Sample[] = []
  let u0 = 0
  for (let k = 0; k + 1 < plan.length; k++) {
    const p = plan[k]!
    const q = plan[k + 1]!
    const len = dist2(p, q)
    const at = (t: number): XZ => ({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
    const n = Math.max(1, Math.ceil(len / step))
    const ts = new Set<number>()
    for (let i = 0; i <= n; i++) ts.add(i / n)
    const eps = len > 0 ? 1e-4 / len : 0
    for (const t of support.crossings(p, q)) {
      ts.add(Math.max(0, t - eps))
      ts.add(Math.min(1, t + eps))
    }
    const sorted = [...ts].sort((m, o) => m - o)
    // Deck edges (floorAt is opaque): bisect every change of height between two neighbours down to 0.1 mm.
    const withEdges: number[] = []
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]!
      withEdges.push(t)
      const t2 = sorted[i + 1]
      if (t2 === undefined) break
      const h1 = support.heightAt(at(t).x, at(t).z)
      const h2 = support.heightAt(at(t2).x, at(t2).z)
      if (Math.abs(h1 - h2) < 1e-9 || (t2 - t) * len < 2e-4) continue
      let lo = t
      let hi = t2
      while ((hi - lo) * len > 1e-4) {
        const mid = (lo + hi) / 2
        const hm = support.heightAt(at(mid).x, at(mid).z)
        if (Math.abs(hm - h1) < 1e-9) lo = mid
        else hi = mid
      }
      withEdges.push(lo, hi)
    }
    for (const t of withEdges) {
      if (k > 0 && t === 0) continue // the corner is the previous segment's last sample
      const xz = at(t)
      out.push({ ...xz, u: u0 + t * len, g: support.heightAt(xz.x, xz.z), corner: t === 0 || t === 1 })
    }
    u0 += len
  }
  if (out.length) {
    out[0]!.corner = true
    out[out.length - 1]!.corner = true
  }
  return out
}

/** The lowest the run may be at each sample: the surface, or a ramp of `RAMP_SLOPE` down from a higher support nearby (never through it). */
function envelope(s: readonly Sample[]): number[] {
  const h = s.map((q) => q.g)
  for (let i = 1; i < h.length; i++) h[i] = Math.max(h[i]!, h[i - 1]! - RAMP_SLOPE * (s[i]!.u - s[i - 1]!.u))
  for (let i = h.length - 2; i >= 0; i--) h[i] = Math.max(h[i]!, h[i + 1]! - RAMP_SLOPE * (s[i + 1]!.u - s[i]!.u))
  return h
}

/** Linear interpolation of the run's height at arc length u. */
function heightAlong(s: readonly Sample[], y: readonly number[], u: number): number {
  if (u <= s[0]!.u) return y[0]!
  const last = s.length - 1
  if (u >= s[last]!.u) return y[last]!
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid]!.u <= u) lo = mid
    else hi = mid
  }
  const span = s[hi]!.u - s[lo]!.u
  const k = span > 0 ? (u - s[lo]!.u) / span : 0
  return y[lo]! + (y[hi]! - y[lo]!) * k
}

/** The plan point at arc length u of a polyline. */
function planAt(plan: readonly XZ[], u: number): XZ {
  let left = u
  for (let k = 0; k + 1 < plan.length; k++) {
    const len = dist2(plan[k]!, plan[k + 1]!)
    if (left <= len || k + 2 === plan.length) {
      const t = len > 0 ? Math.min(1, Math.max(0, left / len)) : 0
      return { x: plan[k]!.x + (plan[k + 1]!.x - plan[k]!.x) * t, z: plan[k]!.z + (plan[k + 1]!.z - plan[k]!.z) * t }
    }
    left -= len
  }
  return { ...plan[plan.length - 1]! }
}

/** The bend from a connector: a quarter arc outward and down, each point kept on or above the surface. Returns the arc (without the port). */
function connectorBend(end: GravityEnd, support: Support, c: number, arcs: boolean): P3[] {
  const o = end.out
  if (!o) return []
  const hl = Math.hypot(o.x, o.z)
  if (!(hl > 0.3 * Math.hypot(o.x, o.y, o.z))) return [] // a connector facing up or down: the cable hangs from it
  const dx = o.x / hl
  const dz = o.z / hl
  const out: P3[] = []
  for (const deg of arcs ? [30, 60, 90] : [90]) {
    const th = deg * DEG
    const x = end.at.x + dx * BEND_R * Math.sin(th)
    const z = end.at.z + dz * BEND_R * Math.sin(th)
    const arcY = end.at.y - BEND_R * (1 - Math.cos(th))
    // The connector's own device is not under its bend (a jack is often recessed in its panel): the bend leaves the body, it is not laid on top of it.
    out.push({ x, y: Math.max(arcY, support.heightAtExcept(x, z, end.at, 0.01) + c), z })
  }
  return out
}

/** One-sided simplification of a run: a point goes when the line through its kept neighbours passes within `tol` above it (never below it). */
function simplifyRun(pts: readonly (P3 & { u: number; corner: boolean })[], tol: number): P3[] {
  if (pts.length <= 2) return pts.map(({ x, y, z }) => ({ x, y, z }))
  const keep: number[] = [0]
  let i = 0
  while (i < pts.length - 1) {
    let j = i + 1
    for (let cand = i + 2; cand < pts.length; cand++) {
      if (pts[cand - 1]!.corner) break // never across a route corner
      const a = pts[i]!
      const b = pts[cand]!
      const span = b.u - a.u
      let ok = span > 0
      for (let k = i + 1; ok && k < cand; k++) {
        const p = pts[k]!
        const yc = a.y + ((b.y - a.y) * (p.u - a.u)) / span
        if (yc < p.y - 1e-9 || yc > p.y + tol) ok = false
      }
      if (!ok) break
      j = cand
    }
    keep.push(j)
    i = j
  }
  return keep.map((k) => ({ x: pts[k]!.x, y: pts[k]!.y, z: pts[k]!.z }))
}

/** A plain copy of a point (a Babylon Vector3 keeps x, y, z behind getters: a spread would lose them). */
const cp = (p: P3): P3 => ({ x: p.x, y: p.y, z: p.z })

const same = (p: P3, q: P3): boolean => Math.abs(p.x - q.x) < 1e-7 && Math.abs(p.y - q.y) < 1e-7 && Math.abs(p.z - q.z) < 1e-7

/**
 * The drawn path of a cable from `a` to `b` (see the module header). The first and last points are the two ports exactly; every other point is on or
 * above the support surface plus `clearance`, and above it only on a connector bend, a drop, a ramp onto a support or the loop of two close raised ports.
 */
export function gravityPath(a: GravityEnd, b: GravityEnd, support: Support, opts: GravityOptions): P3[] {
  const c = opts.clearance
  const arcs = opts.arcs !== false
  const tol = opts.tolM ?? SIMPLIFY_TOL
  const bendA = connectorBend(a, support, c, arcs)
  const bendB = connectorBend(b, support, c, arcs)
  const tipA = bendA.at(-1) ?? cp(a.at)
  const tipB = bendB.at(-1) ?? cp(b.at)
  const plan: XZ[] = [{ x: tipA.x, z: tipA.z }, ...(opts.route ?? []).map((q) => ({ x: q.x, z: q.z })), { x: tipB.x, z: tipB.z }].filter(
    (q, i, all) => i === 0 || dist2(all[i - 1]!, q) > 1e-6
  )
  if (plan.length === 1) plan.push({ ...plan[0]! })
  const samples = sampleRun(plan, support)
  const runY = envelope(samples).map((h) => h + c)
  const L = samples.at(-1)!.u
  const near = (u0: number, u1: number): number => {
    let m = -Infinity
    for (let i = 0; i < samples.length; i++) if (samples[i]!.u >= u0 - 1e-9 && samples[i]!.u <= u1 + 1e-9) m = Math.max(m, runY[i]!)
    return Number.isFinite(m) ? m : heightAlong(samples, runY, u0)
  }
  const raisedA = tipA.y > near(0, Math.min(L, 2 * BEND_R)) + RAISED_EPS
  const raisedB = tipB.y > near(Math.max(0, L - 2 * BEND_R), L) + RAISED_EPS
  const head: P3[] = [cp(a.at), ...bendA]
  const tail: P3[] = [...bendB].reverse().concat([cp(b.at)])

  // Two raised ports close together, no route: one small loop between the two bends, its lowest point never under the surface.
  if (!opts.route?.length && L < LOOP_M && (raisedA || raisedB)) {
    const sag = Math.max(LOOP_SAG_MIN, LOOP_SAG_FACTOR * L)
    const n = arcs ? 12 : 4
    const mid: P3[] = []
    for (let i = 1; i < n; i++) {
      const t = i / n
      const xz = planAt(plan, t * L)
      const line = tipA.y + (tipB.y - tipA.y) * t - sag * 4 * t * (1 - t)
      mid.push({ x: xz.x, y: Math.max(line, heightAlong(samples, runY, t * L), support.heightAt(xz.x, xz.z) + c), z: xz.z })
    }
    return dedupe([...head, ...mid, ...tail])
  }

  const dirAt = (u: number, sign: 1 | -1): XZ => {
    const p = planAt(plan, u)
    const q = planAt(plan, u + sign * Math.min(BEND_R, L / 2))
    const l = dist2(p, q)
    return l > 0 ? { x: (q.x - p.x) / l, z: (q.z - p.z) / l } : { x: 0, z: 0 }
  }
  /** The drop at one end: straight down from the tip, then a bend into the run. Returns the points from the tip down (tip excluded) and the run length it uses. */
  const drop = (tip: P3, u: number, sign: 1 | -1): { pts: P3[]; used: number } => {
    const y0 = heightAlong(samples, runY, u)
    const room = L >= 4 * BEND_R && arcs
    const pts: P3[] = []
    if (!room) {
      pts.push({ x: tip.x, y: y0, z: tip.z })
      return { pts, used: 0 }
    }
    if (tip.y > y0 + BEND_R + 1e-3) pts.push({ x: tip.x, y: y0 + BEND_R, z: tip.z })
    const d = dirAt(u, sign)
    for (const deg of [30, 60, 90]) {
      const th = deg * DEG
      const du = BEND_R * (1 - Math.cos(th))
      const y = Math.min(tip.y, y0 + BEND_R * (1 - Math.sin(th)))
      const uu = u + sign * du
      const x = tip.x + d.x * du
      const z = tip.z + d.z * du
      pts.push({ x, y: Math.max(y, heightAlong(samples, runY, uu), support.heightAt(x, z) + c), z })
    }
    return { pts, used: BEND_R }
  }
  const dropA = raisedA ? drop(tipA, 0, 1) : { pts: [] as P3[], used: 0 }
  const dropB = raisedB ? drop(tipB, L, -1) : { pts: [] as P3[], used: 0 }
  // An end that is not raised meets the run where it is; one lower than the run there (a support beside it) climbs straight up to it.
  const meet = (tip: P3, u: number): P3[] => {
    const y = heightAlong(samples, runY, u)
    return tip.y < y - 1e-3 ? [{ x: tip.x, y, z: tip.z }] : []
  }
  const startA = raisedA ? dropA.pts : meet(tipA, 0)
  const startB = raisedB ? dropB.pts : meet(tipB, L)
  const uMin = dropA.used
  const uMax = L - dropB.used
  const run = samples
    .map((s, i) => ({ x: s.x, y: runY[i]!, z: s.z, u: s.u, corner: s.corner }))
    .filter((s) => s.u > uMin + 1e-6 && s.u < uMax - 1e-6)
  return dedupe([...head, ...startA, ...simplifyRun(run, tol), ...[...startB].reverse(), ...tail])
}

function dedupe(pts: P3[]): P3[] {
  const out: P3[] = []
  for (const p of pts) if (!out.length || !same(out[out.length - 1]!, p)) out.push(p)
  return out
}

/**
 * The cable in hand: `n` points from the port to the pointer (the same count every frame, so the tube is updated in place), laid by gravity: it drops
 * from the port, lies on the surface and rises to the pointer that holds it (or hangs as a loop when the pointer is near). Every point is on or above
 * the surface plus the clearance.
 */
export function hangInHand(from: P3, to: P3, n: number, support: Support, clearance: number): P3[] {
  const path = gravityPath({ at: from }, { at: to }, support, { clearance })
  const lengths = [0]
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z))
  const total = lengths.at(-1)!
  const out: P3[] = []
  let seg = 1
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out.push(cp(from))
      continue
    }
    if (i === n - 1) {
      out.push(cp(to))
      continue
    }
    const target = (total * i) / (n - 1)
    while (seg < path.length - 1 && lengths[seg]! < target) seg++
    const p = path[seg - 1]!
    const q = path[Math.min(seg, path.length - 1)]!
    const span = lengths[seg]! - lengths[seg - 1]!
    const k = span > 0 ? (target - lengths[seg - 1]!) / span : 0
    const x = p.x + (q.x - p.x) * k
    const z = p.z + (q.z - p.z) * k
    out.push({ x, y: Math.max(p.y + (q.y - p.y) * k, support.heightAt(x, z) + clearance), z })
  }
  return out
}

/** A stretch of a drawn cable that is off its surface. */
export interface SupportSpan {
  /** Where it starts and ends along the cable (m of drawn length from the first port). */
  startM: number
  endM: number
  /** Its plan length (m): how far it goes over the ground. A vertical drop has none. */
  planM: number
  /** Highest point of the span above the surface plus the clearance (m). */
  maxAboveM: number
  /** The span touches a port (a connector bend, a drop, a loop). */
  atEnd: boolean
}

export interface SupportReport {
  /** Points of the polyline (the two ports included). */
  points: number
  /** Lowest inner point relative to the surface plus the clearance (m; negative = under the surface). 0 when there is no inner point. */
  minAboveM: number
  /** Highest inner point above the surface plus the clearance (m). */
  maxAboveM: number
  /** Longest plan length (m) of a run of points off their surface. A flying cable is as long as its run; a drop is a few centimetres. */
  longestUnsupportedM: number
  /** The same, for runs that do not touch a port (ramps onto a support, a bridge). */
  longestMidSpanM: number
  spans: SupportSpan[]
}

/** `supportReport` walks the polyline at this step (m of drawn length), so a span is measured where it is, not where the points happen to be. */
export const REPORT_STEP_M = 0.01

/**
 * How a drawn polyline sits on a support surface (any polyline: the oracle does not trust the builder). The cable is walked every `REPORT_STEP_M`
 * (and at every point); each place is on its surface (within `tolM` of the surface plus the clearance) or off it, and consecutive places off it make
 * a span. The two ports are not judged (they are where the devices put them), nor is the depth of the first and last segments and of anything
 * within two bend radii (plan) of a port (a connector sits on its device's face, often recessed inside its footprint).
 */
export function supportReport(points: readonly P3[], support: Support, clearance: number, tolM = SUPPORT_TOL): SupportReport {
  const n = points.length
  const above = (p: P3): number => p.y - (support.heightAt(p.x, p.z) + clearance)
  let minAboveM = n > 2 ? Infinity : 0
  let maxAboveM = n > 2 ? -Infinity : 0
  const nearPort = (p: P3): boolean => dist2(p, points[0]!) < 2 * BEND_R || dist2(p, points[n - 1]!) < 2 * BEND_R
  for (let i = 1; i < n - 1; i++) {
    if (!nearPort(points[i]!)) minAboveM = Math.min(minAboveM, above(points[i]!))
    maxAboveM = Math.max(maxAboveM, above(points[i]!))
  }
  // The walk: every place along the cable but the two ports, with its arc length and whether it is off the surface.
  const walk: { p: P3; s: number; off: number }[] = []
  let s0 = 0
  for (let i = 1; i < n; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const k = Math.max(1, Math.min(500, Math.ceil(len / REPORT_STEP_M)))
    for (let j = 1; j <= k; j++) {
      if (i === n - 1 && j === k) break // the far port
      const t = j / k
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
      const off = above(p)
      // Within a connector's bend of a port the cable is in its own device's panel (a recessed jack): not judged for depth.
      if (i > 1 && i < n - 1 && !nearPort(p)) minAboveM = Math.min(minAboveM, off)
      walk.push({ p, s: s0 + len * t, off })
    }
    s0 += len
  }
  if (!Number.isFinite(minAboveM)) minAboveM = 0
  if (!Number.isFinite(maxAboveM)) maxAboveM = 0
  const spans: SupportSpan[] = []
  let i = 0
  while (i < walk.length) {
    if (walk[i]!.off <= tolM) {
      i++
      continue
    }
    let j = i
    let planM = 0
    let top = walk[i]!.off
    while (j + 1 < walk.length && walk[j + 1]!.off > tolM) {
      planM += dist2(walk[j]!.p, walk[j + 1]!.p)
      top = Math.max(top, walk[j + 1]!.off)
      j++
    }
    spans.push({ startM: walk[i]!.s, endM: walk[j]!.s, planM, maxAboveM: top, atEnd: i === 0 || j === walk.length - 1 })
    i = j + 1
  }
  const longest = (list: SupportSpan[]): number => list.reduce((m, sp) => Math.max(m, sp.planM), 0)
  return { points: n, minAboveM, maxAboveM, longestUnsupportedM: longest(spans), longestMidSpanM: longest(spans.filter((sp) => !sp.atEnd)), spans }
}
