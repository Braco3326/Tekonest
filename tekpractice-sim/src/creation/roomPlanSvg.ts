/**
 * Floor-plan thumbnails for the « Choisir un lieu » cards (C15), drawn from the
 * room data at build time by `tools/room-thumbs.ts`. Pure: string in, string out.
 *
 * - viewBox in metres, room centred on the origin (as `roomLayout`).
 * - Read as the Face view (ADR-0011, P14): front wall (stage, −z) at the top and
 *   world +x on the LEFT, as the 3D view shows it from the audience. So a plan
 *   and the 3D view never disagree about where « G » is.
 * - Zones are one `<rect>` each, styled by kind; doors are gaps in the walls;
 *   other openings are short marks just outside the wall; the front wall is
 *   marked in Ambre.
 * - Tekonest colours only: Nuit, Papier, Ambre, Prune (opacity for tints).
 */
import type { RoomFileT } from '../explore/roomSchema'

const NUIT = '#131114'
const PAPIER = '#F3EDE3'
const AMBRE = '#DD9349'
const PRUNE = '#612D45'

type Wall = 'front' | 'rear' | 'left' | 'right'
const WALLS: readonly Wall[] = ['front', 'rear', 'left', 'right']

/** Zone kinds drawn as a performance area (Prune) or an operator position (Ambre). */
const STAGE = new Set(['stage', 'pit'])
const OPERATOR = new Set(['foh', 'monitor-world', 'control-room', 'desk', 'gallery', 'booth'])

const n = (v: number): string => {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** World (x, z) → plan (left-right, top-bottom): x mirrored, z down. */
const px = (x: number): number => -x
const pz = (z: number): number => z

interface Opening {
  wall: Wall
  kind: string
  offset_m: number
  width_m: number
}

/** End points of a run along a wall, `a`→`b` measured from the wall centre (world units). */
function wallRun(wall: Wall, a: number, b: number, hw: number, hl: number): string {
  // front / rear run along x; left / right along z (as roomLayout).
  if (wall === 'front' || wall === 'rear') {
    const z = wall === 'front' ? -hl : hl
    return `M${n(px(a))} ${n(pz(z))}H${n(px(b))}`
  }
  const x = wall === 'left' ? -hw : hw
  return `M${n(px(x))} ${n(pz(a))}V${n(pz(b))}`
}

function svgOpen(width: number, length: number): { open: string; u: number; hw: number; hl: number } {
  const hw = width / 2
  const hl = length / 2
  const m = Math.max(0.6, Math.max(width, length) * 0.05)
  const u = Math.max(width, length) / 100 // one "pixel" at a 100-unit wide drawing
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-hw - m)} ${n(-hl - m)} ${n(width + 2 * m)} ${n(length + 2 * m)}">`
  return { open, u, hw, hl }
}

function shell(width: number, length: number, openings: readonly Opening[]): { head: string; tail: string } {
  const { open, u, hw, hl } = svgOpen(width, length)
  const floor = `<path d="M${n(px(-hw))} ${n(-hl)}H${n(px(hw))}V${n(hl)}H${n(px(-hw))}Z" fill="${PAPIER}" fill-opacity="0.05"/>`
  const runs: string[] = []
  const marks: string[] = []
  for (const wall of WALLS) {
    const half = wall === 'front' || wall === 'rear' ? hw : hl
    const doors = openings
      .filter((o) => o.wall === wall && o.kind === 'door')
      .map((o) => ({ a: Math.max(-half, o.offset_m - o.width_m / 2), b: Math.min(half, o.offset_m + o.width_m / 2) }))
      .filter((d) => d.b > d.a)
      .sort((p, q) => p.a - q.a)
    let cursor = -half
    for (const d of doors) {
      if (d.a > cursor) runs.push(wallRun(wall, cursor, d.a, hw, hl))
      cursor = Math.max(cursor, d.b)
    }
    if (cursor < half) runs.push(wallRun(wall, cursor, half, hw, hl))
    // Windows and other openings: a short mark just outside the wall.
    for (const o of openings.filter((p) => p.wall === wall && p.kind !== 'door')) {
      const a = Math.max(-half, o.offset_m - o.width_m / 2)
      const b = Math.min(half, o.offset_m + o.width_m / 2)
      if (b <= a) continue
      const out = 2.2 * u
      const hwO = wall === 'left' || wall === 'right' ? hw + out : hw
      const hlO = wall === 'front' || wall === 'rear' ? hl + out : hl
      marks.push(wallRun(wall, a, b, hwO, hlO))
    }
  }
  const walls = `<path data-walls="" d="${runs.join('')}" fill="none" stroke="${PAPIER}" stroke-width="${n(1.6 * u)}" stroke-linecap="square"/>`
  const windows = marks.length ? `<path data-openings="" d="${marks.join('')}" fill="none" stroke="${PAPIER}" stroke-width="${n(0.6 * u)}" stroke-opacity="0.7"/>` : ''
  // The front wall (stage side): an Ambre band just inside it.
  const inset = 2.4 * u
  const front = `<path data-wall="front" d="M${n(px(-hw + inset))} ${n(-hl + inset)}H${n(px(hw - inset))}" stroke="${AMBRE}" stroke-width="${n(1.2 * u)}"/>`
  return { head: open + floor, tail: walls + windows + front + '</svg>' }
}

function zoneRect(z: RoomFileT['zones'][number], u: number): string {
  const [cx, cz, w, d] = z.rect_m
  const x = Math.min(px(cx - w / 2), px(cx + w / 2))
  const y = pz(cz) - d / 2
  const geo = `<rect data-zone="${esc(z.id)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(d)}"`
  const sw = n(0.6 * u)
  if (STAGE.has(z.kind)) return `${geo} fill="${PRUNE}" fill-opacity="0.85" stroke="${PRUNE}" stroke-width="${sw}"/>`
  if (OPERATOR.has(z.kind)) return `${geo} fill="${AMBRE}" fill-opacity="0.3" stroke="${AMBRE}" stroke-width="${sw}"/>`
  if (z.kind === 'audience') return `${geo} fill="none" stroke="${PAPIER}" stroke-opacity="0.55" stroke-width="${sw}" stroke-dasharray="${n(1.5 * u)} ${n(1.5 * u)}"/>`
  return `${geo} fill="${NUIT}" fill-opacity="0.4" stroke="${PAPIER}" stroke-opacity="0.35" stroke-width="${sw}"/>`
}

/** The plan of a TEK Brain room (≤ 8 KB). */
export function roomPlanSvg(room: RoomFileT): string {
  const width = room.dimensions_m.width.typical
  const length = room.dimensions_m.length.typical
  const { head, tail } = shell(width, length, room.openings)
  const { u } = svgOpen(width, length)
  // Raised / larger zones first so small ones (FOH in the audience) stay visible on top.
  const zones = room.zones
    .map((z, i) => ({ z, i }))
    .sort((a, b) => b.z.rect_m[2] * b.z.rect_m[3] - a.z.rect_m[2] * a.z.rect_m[3] || a.i - b.i)
    .map(({ z }) => zoneRect(z, u))
    .join('')
  return head + zones + tail
}

/** A bare floor (the .glb sets, « Salle vide neutre »): outline + front wall, no zones. */
export function floorPlanSvg(width: number, length: number): string {
  const { head, tail } = shell(width, length, [])
  return head + tail
}
