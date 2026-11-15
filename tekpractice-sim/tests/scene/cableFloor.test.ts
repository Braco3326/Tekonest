/**
 * Cables rest on the floor in EVERY room and at every length (founder, 2026-11-15: « the cables are shown underground »). Every room of content/rooms, every venue set
 * and the blank room: for ports at floor level, a connector's height, and a rack's height, over runs from 0.4 m to 25 m in eight directions, no point of the
 * drawn cable is lower than the floor under it plus the clearance, and the cable's ends are the ports exactly.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roomLayout } from '../../src/explore/roomLayout'
import { RoomFile } from '../../src/explore/roomSchema'
import { catenaryPoints, FLOOR_CLEARANCE, SEGMENTS_FULL } from '../../src/scene/cablePath'

const ROOMS = join(__dirname, '..', '..', 'content', 'rooms')
const files = readdirSync(ROOMS).filter((f) => f.endsWith('.json') && f !== 'index.json')

const PORT_HEIGHTS = [0, 0.05, 0.3, 1.0, 1.6]
const RUNS = [0.4, 1, 2.5, 6, 12, 25]
const DIRS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)

/** Every checked cable of a floor: returns the number of cables tested and the lowest clearance seen (m above the floor under the cable's inner points). */
function check(width: number, length: number, floorAt: (x: number, z: number) => number): { cables: number; lowest: number; endsMoved: number } {
  let cables = 0
  let lowest = Infinity
  let endsMoved = 0
  const xs = [-0.45, -0.2, 0, 0.25, 0.45].map((k) => k * width)
  const zs = [-0.45, -0.2, 0, 0.25, 0.45].map((k) => k * length)
  for (const x0 of xs)
    for (const z0 of zs)
      for (const h of PORT_HEIGHTS)
        for (const run of RUNS)
          for (const th of DIRS) {
            const x1 = x0 + run * Math.cos(th)
            const z1 = z0 + run * Math.sin(th)
            if (Math.abs(x1) > width / 2 || Math.abs(z1) > length / 2) continue
            const a = { x: x0, y: floorAt(x0, z0) + h, z: z0 }
            const b = { x: x1, y: floorAt(x1, z1) + h, z: z1 }
            const pts = catenaryPoints(a, b, SEGMENTS_FULL, { floorAt, clearance: FLOOR_CLEARANCE })
            cables++
            if (pts[0]!.y !== a.y || pts.at(-1)!.y !== b.y) endsMoved++
            for (const q of pts.slice(1, -1)) lowest = Math.min(lowest, q.y - floorAt(q.x, q.z))
          }
  return { cables, lowest, endsMoved }
}

describe('cables rest on the floor in every room, at every length', () => {
  it('there are rooms to check', () => expect(files.length).toBeGreaterThanOrEqual(30))

  for (const f of files) {
    it(`${f.replace('.json', '')}: no cable under the floor, ends on the ports`, () => {
      const parsed = RoomFile.safeParse(JSON.parse(readFileSync(join(ROOMS, f), 'utf8')))
      expect(parsed.success, `${f} parses`).toBe(true)
      if (!parsed.success) return
      const layout = roomLayout(parsed.data)
      const r = check(layout.width, layout.length, layout.floorAt)
      expect(r.cables).toBeGreaterThan(200)
      expect(r.lowest).toBeGreaterThanOrEqual(FLOOR_CLEARANCE - 1e-9)
      expect(r.endsMoved).toBe(0)
    })
  }

  it('the blank room and a venue set (flat floors)', () => {
    for (const [w, l] of [[12, 10], [20, 14], [40, 30]] as const) {
      const r = check(w, l, () => 0)
      expect(r.lowest).toBeGreaterThanOrEqual(FLOOR_CLEARANCE - 1e-9)
      expect(r.endsMoved).toBe(0)
    }
  })

  it('the check can fail: the same cables without the floor go far under it', () => {
    let lowest = Infinity
    for (const run of RUNS) {
      const pts = catenaryPoints({ x: 0, y: 0.05, z: 0 }, { x: run, y: 0.05, z: 0 }, SEGMENTS_FULL)
      lowest = Math.min(lowest, ...pts.map((q) => q.y))
    }
    expect(lowest).toBeLessThan(-3)
  })
})
