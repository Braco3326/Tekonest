// G14b: what Oscar's icon and bubble keep clear of besides the page's controls (spec 11.3; findings F1 to F3 of the T7.1b geometry spec).
//
// The vendored widget places the icon beside the rect it rings (a device's 56 px marker) and the bubble near it (8 px off), then moves both off the host's
// obstacles. The host adds, here:
// - the BODY of the device the step points at (its box on screen, `bodyRects` of the bridge), less the marker itself: the widget drops any obstacle whose centre
//   lies in a target (it is the target), and the marker is already kept clear. Given only the marker, the icon stood on the console it pointed at;
// - a MARGIN around that body (or around the target when it is not on a device): four strips TARGET_CLEARANCE_PX wide, so the bubble keeps the ledger's 30 px
//   from the ring (the widget draws the ring RING_PAD = 4 px outside the target);
// - the CENTRE of the 3D view (CENTRE_SHARE of its width and height, less the body and the target): the device a step points at is framed in the middle.
// All three are SOFT: when the open bubble cannot be placed clear of the page's controls, the target and the icon WITH them (a dense layout, an open drawer), the
// centre is given up first; then the body and the margin, down to thin strips that only keep the bubble off the ring, which is the widget's own placement as it
// was before G14b (`chooseClearance`): the guide never covers a control to keep a measure free, and where there is no room it does what it did. The check runs the
// vendored placement functions themselves (read only), so it predicts what the widget will do; the choice is kept while its inputs hold (src/guide/mount.ts), so
// the icon moving does not make it loop. The mount asks for all this only while the « Premiers pas » tutorial runs (ADR 0021). The vendored widget is untouched
// (it reads all this through its `obstacles` option).
import type { Rect } from './vendor/core/types'
import { ICON_SIZE, clearOf, placeBeside } from './vendor/core/motion'
import { DEFAULT_CORNER, NO_INSETS, placeBubble, placeBubbleNear, type Corner, type Insets } from './vendor/ui/layout'

/** 30 px from the ring (the ledger's measure, spec 11.3) + the ring's own 4 px outside the target + 2 px for the sub-pixel rounding of the ring and the bubble. */
export const TARGET_CLEARANCE_PX = 36
/** The last resort: never ON the ring (the widget draws it RING_PAD = 4 px outside the target; + 2 px of rounding), even where the 30 px margin finds no room. */
export const RING_CLEARANCE_PX = 6
/** The free centre of the view: 20 % x 20 % (the ledger's measure). */
export const CENTRE_SHARE = 0.2
/** Below this window width (a phone) the bubble spans the window: no side of the centre can hold it, so the centre box is not asked for. */
export const CENTRE_MIN_WINDOW_PX = 768
/** A zone (body or target) larger than this share of the window (the place picker, a whole panel) gets no margin: the guide would have nowhere left to stand. */
const MAX_HALO_TARGET_SHARE = 0.25

const finiteRect = (r: Rect | null | undefined): r is Rect =>
  r !== null && r !== undefined && [r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n)) && r.w > 0 && r.h > 0
const holdsCentreOf = (zone: Rect, t: Rect): boolean => {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  return cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h
}

/** Four strips `px` wide around `t` (top and bottom span the corners), none on `t`. */
export function haloOf(t: Rect, px: number): Rect[] {
  return [
    { x: t.x - px, y: t.y - px, w: t.w + 2 * px, h: px },
    { x: t.x - px, y: t.y + t.h, w: t.w + 2 * px, h: px },
    { x: t.x - px, y: t.y, w: px, h: t.h },
    { x: t.x + t.w, y: t.y, w: px, h: t.h },
  ]
}

/** `a` without `b`: `a` when they do not meet, nothing when `b` covers it, else up to four disjoint pieces (above, below, left, right of `b`). */
export function minus(a: Rect, b: Rect): Rect[] {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  if (!(x1 > x0) || !(y1 > y0)) return [a]
  const out: Rect[] = []
  if (y0 > a.y) out.push({ x: a.x, y: a.y, w: a.w, h: y0 - a.y })
  if (a.y + a.h > y1) out.push({ x: a.x, y: y1, w: a.w, h: a.y + a.h - y1 })
  if (x0 > a.x) out.push({ x: a.x, y: y0, w: x0 - a.x, h: y1 - y0 })
  if (a.x + a.w > x1) out.push({ x: x1, y: y0, w: a.x + a.w - x1, h: y1 - y0 })
  return out
}

/** The centre box of the view: CENTRE_SHARE of its width and height, centred. */
export function centreBoxOf(v: Rect): Rect {
  return { x: v.x + (v.w * (1 - CENTRE_SHARE)) / 2, y: v.y + (v.h * (1 - CENTRE_SHARE)) / 2, w: v.w * CENTRE_SHARE, h: v.h * CENTRE_SHARE }
}

export interface ClearanceInput {
  view: Rect | null
  targets: readonly (Rect | null | undefined)[]
  window: { w: number; h: number }
  /** The bench devices' bodies on screen (`TpBridge.bodyRects`); the one holding a target's centre is that target's device. */
  bodies?: readonly Rect[]
}

export interface ClearanceParts {
  /** The device body under each target, less the target: always kept off. */
  body: Rect[]
  /** The 30 px margin around each zone (the body, or the target off a device). */
  halo: Rect[]
  /** The thin strips that only keep off the ring. */
  ring: Rect[]
  /** The centre box of the view less the zones and the targets. */
  centre: Rect[]
}

/** The zone of a target: the smallest body that holds its centre, else the target itself. */
function zoneOf(t: Rect, bodies: readonly Rect[]): Rect {
  let best: Rect | null = null
  for (const b of bodies) if (finiteRect(b) && holdsCentreOf(b, t) && (best === null || b.w * b.h < best.w * best.h)) best = b
  return best ?? t
}

export function clearanceParts(input: ClearanceInput): ClearanceParts {
  try {
    const targets = input.targets.filter(finiteRect)
    const bodies = input.bodies ?? []
    const { w, h } = input.window
    const body: Rect[] = []
    const halo: Rect[] = []
    const ring: Rect[] = []
    const zones: Rect[] = []
    for (const t of targets) {
      const zone = zoneOf(t, bodies)
      zones.push(zone)
      if (zone !== t) {
        // the body less every target (a piece whose centre lay in a target would be dropped by the widget as that target)
        let pieces = [zone]
        for (const o of targets) pieces = pieces.flatMap((p) => minus(p, o))
        body.push(...pieces)
      }
      if (!(w > 0 && h > 0) || zone.w * zone.h <= MAX_HALO_TARGET_SHARE * w * h) {
        halo.push(...haloOf(zone, TARGET_CLEARANCE_PX))
        ring.push(...haloOf(zone, RING_CLEARANCE_PX))
      }
    }
    const v = input.view
    let centre: Rect[] = []
    if (finiteRect(v) && w >= CENTRE_MIN_WINDOW_PX) {
      centre = [centreBoxOf(v)]
      for (const z of [...zones, ...targets]) centre = centre.flatMap((c) => minus(c, z))
      centre = centre.filter(finiteRect)
    }
    return { body: body.filter(finiteRect), halo, ring, centre }
  } catch {
    return { body: [], halo: [], ring: [], centre: [] }
  }
}

/** Everything when there is room for everything: the bodies, the margin, the centre. */
export function guideClearance(input: ClearanceInput): Rect[] {
  const { body, halo, centre } = clearanceParts(input)
  return [...body, ...halo, ...centre]
}

/** The widget's own rule: an obstacle whose centre lies in a target is that target (vendored `offTarget`, widget.ts). */
const offTarget = (list: readonly Rect[], targets: readonly Rect[]): Rect[] => (targets.length === 0 ? [...list] : list.filter((a) => !targets.some((t) => holdsCentreOf(t, a))))

export type ClearanceChoiceInput = ClearanceInput & {
  controls: readonly Rect[]
  bubble: { w: number; h: number } | null
  restIcon: Rect | null
  /** The widget's home corner and insets: where it starts the bubble when no place beside the target holds it (vendored `placeBubble`). */
  home?: Corner
  insets?: Insets
}
/**
 * What to hand the widget now, besides the controls: the bodies, the margin and the centre when the open bubble still has a place clear of the page's controls,
 * the targets and the icon with them; else the bodies and the margin when that leaves room; else only the thin strips that keep the bubble off the ring. The icon
 * is where the widget will put it for that choice (the vendored `placeBeside` beside the last target: the drop of a drag), or where it is (`restIcon`) at rest.
 * The bubble is searched for the way the widget searches it (its `layoutBubble`): from the place beside the targets (`placeBubbleNear`, with its height cap) or
 * from its home dock, then `clearOf` from there; a search from anywhere else can find a narrow place the widget's own search misses.
 * No bubble open: everything (the icon alone always finds room).
 */
export function chooseClearance(input: ClearanceChoiceInput): Rect[] {
  return clearanceChoice(input).rects
}
/** The same choice with its level (0: everything, 1: the centre given up, 2: no room), starting at `from`. */
export function clearanceChoice(input: ClearanceChoiceInput, from = 0): { level: number; rects: Rect[] } {
  try {
    const { body, halo, ring, centre } = clearanceParts(input)
    const everything = [...body, ...halo, ...centre]
    const b = input.bubble
    if (b === null || !(b.w > 0) || !(b.h > 0) || everything.length === 0) return { level: 0, rects: everything }
    const vp = input.window
    const targets = input.targets.filter(finiteRect)
    const last = targets[targets.length - 1]
    // from the strictest to the loosest
    const tiers = [everything, [...body, ...halo]]
    for (let level = Math.max(0, from); level < tiers.length; level++) {
      const tier = tiers[level]
      if (tier.length === 0) continue
      const avoid = offTarget([...input.controls, ...tier], targets)
      const p = last === undefined ? null : placeBeside(last, vp, ICON_SIZE, avoid)
      // the icon where the widget will put it for this choice; where it is now only at rest (mid-glide between two steps it says nothing about this step, and
      // reading it made the choice depend on timing: measured, G14b)
      const iconBox = p === null ? input.restIcon : { x: p.x, y: p.y, w: ICON_SIZE, h: ICON_SIZE }
      const icons = [iconBox].filter(finiteRect)
      const near = targets.length === 0 ? null : placeBubbleNear(b, vp, targets, iconBox)
      const size = near !== null && near.maxHeight !== null ? { w: b.w, h: near.maxHeight } : b
      const start = near !== null ? near.pos : placeBubble(input.home ?? DEFAULT_CORNER, b, vp, iconBox === null ? [...targets] : [...targets, iconBox], input.insets ?? NO_INSETS)
      if (!clearOf(start, size, vp, [...avoid, ...targets, ...icons], icons).crowded) return { level, rects: tier }
    }
    // No room: only the strips that keep the bubble off the ring, which is the widget's own placement from before G14b. Keeping the body here was measured worse (G14b
    // report): at 1024 x 768 with the drawer open the bubble then lands on a control (the view cube, the Propriétés rail) instead of on the device.
    return { level: 2, rects: ring }
  } catch {
    return { level: 2, rects: [] }
  }
}
