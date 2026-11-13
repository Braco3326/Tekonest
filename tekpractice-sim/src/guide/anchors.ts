// Anchors: the stable ids the guide uses to name a device, a port, a control or a piece of the shell.
//
// Scheme (the whole id is `<kind>:<body>` and the body is 1 to 70 characters of [a-z0-9._-]):
//   device:<device>             the device instance id
//   port:<device>.<port>        <device> is the body of the device's own anchor, <port> the port id
//   control:<device>.<control>  same, for a hands-on control
//   nav:<name>                  a piece of the shell (see NAV_SELECTORS in the creation bridge)
// Each part is lower-cased and every character outside [a-z0-9._-] (a space, an accent, an emoji, a slash...) becomes a dash, one
// dash per code point. Two different ids can map to the same body; `seen` (one set per snapshot) resolves that with a numeric
// suffix (-2, -3...) so no device is dropped and no two things share an anchor. Within one snapshot the same inputs in the same
// order always give the same anchors; the bridge keeps the reverse table (anchor to the real ref).
import type { Rect } from './vendor/core/types'

export type AnchorKind = 'device' | 'port' | 'control' | 'nav'

const BODY_MAX = 70
const ANCHOR = /^(device|port|control|nav):[a-z0-9._-]{1,70}$/

function slug(s: unknown): string {
  return String(s).toLowerCase().replace(/[^a-z0-9._-]/gu, '-')
}

/** Cut the parts so that they, joined by one dot each, fit BODY_MAX: the longest parts give way first, so every part stays visible. */
function fit(parts: string[]): string {
  const joined = parts.join('.')
  if (joined.length <= BODY_MAX) return joined
  const room = BODY_MAX - (parts.length - 1)
  let cap = room
  while (cap > 1 && parts.reduce((n, p) => n + Math.min(p.length, cap), 0) > room) cap--
  return parts.map((p) => p.slice(0, cap)).join('.')
}

export function anchorOf(kind: AnchorKind, parts: string[], seen: Set<string>): string {
  const body = fit(parts.map(slug)) || 'unnamed'
  let id = `${kind}:${body}`
  for (let n = 2; seen.has(id); n++) {
    const suffix = `-${n}`
    id = `${kind}:${body.slice(0, BODY_MAX - suffix.length)}${suffix}`
  }
  seen.add(id)
  return id
}

export function isAnchor(id: string): boolean {
  return typeof id === 'string' && ANCHOR.test(id)
}

/** A square of `size` px centred on a scene point, or null when there is no usable point (null, NaN, infinite, not numbers). */
export function rectFromPoint(p: { x: number; y: number } | null, size: number): Rect | null {
  if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  return { x: p.x - size / 2, y: p.y - size / 2, w: size, h: size }
}
