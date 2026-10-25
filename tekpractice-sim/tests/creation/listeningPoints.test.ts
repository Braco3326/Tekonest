/**
 * Task 20: named listening points (« Régie » always; « Premier rang », « Fond de salle »
 * when the room has an audience zone) and the orbit pose that looks at the stage from one.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { roomLayout, type RoomLayout, type RoomTemplate } from '../../src/explore/roomLayout'
import {
  activePoint,
  DEFAULT_LISTENER_POINT,
  defaultPoints,
  keySlot,
  pointForKey,
  pointLookAt,
  pointPose,
} from '../../src/creation/listeningPoints'
import { ORBIT_FEEL } from '../../src/camera/orbitFeel'

const dir = fileURLToPath(new URL('../../content/rooms/', import.meta.url))
const room = (id: string): RoomLayout => roomLayout(JSON.parse(readFileSync(`${dir}${id}.json`, 'utf8')) as RoomTemplate)
const roomIds = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.replace(/\.json$/, ''))

/** Where an ArcRotateCamera with this pose stands. */
const camPos = (p: { alpha: number; beta: number; radius: number; target: [number, number, number] }): number[] => [
  p.target[0] + p.radius * Math.cos(p.alpha) * Math.sin(p.beta),
  p.target[1] + p.radius * Math.cos(p.beta),
  p.target[2] + p.radius * Math.sin(p.alpha) * Math.sin(p.beta),
]

describe('defaultPoints (Task 20)', () => {
  it('concert-hall-medium: Régie at the centre of the foh zone, floor + 1.2 m', () => {
    const L = room('concert-hall-medium')
    const pts = defaultPoints(L, 1.2)
    expect(pts[0]).toEqual({ id: 'regie', label: 'Régie', position: [0, L.floorAt(0, 8) + 1.2, 8] })
  })
  it('concert-hall-medium: Premier rang 2 m in front of the stage edge, Fond de salle 1 m before the back of the last audience zone', () => {
    const L = room('concert-hall-medium')
    const pts = defaultPoints(L, 1.2)
    expect(pts.map((p) => p.id)).toEqual(['regie', 'premier-rang', 'fond-de-salle'])
    expect(pts.map((p) => p.label)).toEqual(['Régie', 'Premier rang', 'Fond de salle'])
    // stage rect z = -11.5 ± 4.5 → front edge at -7 → +2 m
    const [x1, y1, z1] = pts[1].position
    expect([x1, z1]).toEqual([0, -5])
    expect(y1).toBeCloseTo(L.floorAt(0, -5) + 1.2, 9)
    // last audience zone: the balcony z = 14.5 ± 1.5 (floor 3.5 m) → back at 16 → z 15
    const [x2, y2, z2] = pts[2].position
    expect([x2, z2]).toEqual([0, 15])
    expect(y2).toBeCloseTo(3.5 + 1.2, 9)
  })
  it('blank place (no layout): one « Centre » point at ear height', () => {
    expect(defaultPoints(null, 1.2)).toEqual([{ id: 'centre', label: 'Centre', position: [0, 1.2, 0] }])
  })
  it('ear height 1.7 shifts every point up by 0.5 m, x / z unchanged', () => {
    for (const L of [room('concert-hall-medium'), room('arena-large'), null]) {
      const a = defaultPoints(L, 1.2)
      const b = defaultPoints(L, 1.7)
      expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id))
      b.forEach((p, i) => {
        expect(p.position[0]).toBe(a[i].position[0])
        expect(p.position[2]).toBe(a[i].position[2])
        expect(p.position[1] - a[i].position[1]).toBeCloseTo(0.5, 9)
      })
    }
  })
  it('no foh zone: Régie at the centre of the control-room zone (French « régie », as roomLayout.spawn)', () => {
    const L = room('auditorium-amphitheatre-medium') // 16 × 20, control-room (5.5, 9) raised 1.2 m, no foh
    const regie = defaultPoints(L, 1.2)[0]
    expect(regie.id).toBe('regie')
    expect([regie.position[0], regie.position[2]]).toEqual([5.5, 9])
    expect(regie.position[1]).toBeCloseTo(1.2 + 1.2, 9)
    // a studio: the control room, looking at the front wall (−z, monitors / window), never behind
    const S = room('studio-control-room-small')
    const s = defaultPoints(S, 1.2)[0]
    expect([s.id, s.position[0], s.position[2]]).toEqual(['regie', 0, -0.3])
    expect(pointLookAt(S, s)[2]).toBeLessThan(s.position[2])
  })
  it('neither foh nor control-room: Régie at the room centre at 2/3 depth from the stage wall', () => {
    const L = room('classroom-lab-small') // 7 × 8, desks only
    const regie = defaultPoints(L, 1.2)[0]
    expect(regie.id).toBe('regie')
    expect(regie.position[0]).toBe(0)
    expect(regie.position[2]).toBeCloseTo(-4 + (2 / 3) * 8, 9)
    expect(regie.position[1]).toBeCloseTo(L.floorAt(0, regie.position[2]) + 1.2, 9)
  })
  it('a room without an audience zone has only Régie', () => {
    const pts = defaultPoints(room('studio-control-room-small'), 1.2)
    expect(pts.map((p) => p.id)).toEqual(['regie'])
  })
  it('every room: Régie first, ids unique, every point inside the room on its floor, Premier rang on an audience zone', () => {
    for (const id of roomIds) {
      const L = room(id)
      const pts = defaultPoints(L, 1.2)
      expect(pts[0]?.id, id).toBe('regie')
      expect(new Set(pts.map((p) => p.id)).size, id).toBe(pts.length)
      for (const p of pts) {
        const [x, y, z] = p.position
        expect(Math.abs(x), `${id} ${p.id}`).toBeLessThanOrEqual(L.width / 2)
        expect(Math.abs(z), `${id} ${p.id}`).toBeLessThanOrEqual(L.length / 2)
        expect(y, `${id} ${p.id}`).toBeCloseTo(L.floorAt(x, z) + 1.2, 9)
      }
      const front = pts.find((p) => p.id === 'premier-rang')
      if (front) {
        const [x, , z] = front.position
        const on = L.zones.some((zn) => zn.kind === 'audience' && Math.abs(x - zn.x) <= zn.w / 2 && Math.abs(z - zn.z) <= zn.d / 2)
        expect(on, id).toBe(true)
      }
      // two points never sit on top of each other (a shallow room keeps the distinct ones)
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const [a, b] = [pts[i].position, pts[j].position]
          expect(Math.hypot(a[0] - b[0], a[2] - b[2]), `${id} ${pts[i].id}/${pts[j].id}`).toBeGreaterThanOrEqual(1)
        }
    }
  })
})

describe('keys 1 / 2 / 3 are fixed slots (review Fix 1): 1 = Régie (Centre), 2 = Premier rang, 3 = Fond de salle', () => {
  it('keySlot by id; pointForKey never renumbers when a point is dropped', () => {
    expect(['regie', 'centre', 'premier-rang', 'fond-de-salle'].map(keySlot)).toEqual([1, 1, 2, 3])
    expect(keySlot('autre')).toBeNull()
    const tv = defaultPoints(room('tv-studio-plateau-large'), 1.2) // Premier rang lands on the Régie: dropped
    expect(tv.map((p) => p.id)).toEqual(['regie', 'fond-de-salle'])
    expect(pointForKey(tv, 1)!.id).toBe('regie')
    expect(pointForKey(tv, 2)).toBeNull()
    expect(pointForKey(tv, 3)!.id).toBe('fond-de-salle')
    const blank = defaultPoints(null, 1.2)
    expect(pointForKey(blank, 1)!.id).toBe('centre')
    expect(pointForKey(blank, 2)).toBeNull()
    expect(DEFAULT_LISTENER_POINT).toBe('regie')
  })
})

describe('activePoint', () => {
  it('the point with that id, else the first point (Centre in a blank place), null when none', () => {
    const pts = defaultPoints(room('concert-hall-medium'), 1.2)
    expect(activePoint(pts, 'premier-rang')!.id).toBe('premier-rang')
    expect(activePoint(defaultPoints(null, 1.2), 'regie')!.id).toBe('centre')
    expect(activePoint([], 'regie')).toBeNull()
  })
})

describe('pointPose: the orbit camera stands at the point and looks at the stage', () => {
  it('concert-hall-medium Régie: camera exactly at the point, target over the stage, beta inside the orbit guard', () => {
    const L = room('concert-hall-medium')
    const regie = defaultPoints(L, 1.2)[0]
    const look = pointLookAt(L, regie)
    // the stage centre (x, z) of the first stage zone
    expect([look[0], look[2]]).toEqual([0, -11.5])
    const pose = pointPose(regie.position, look, 60)
    const p = camPos(pose)
    expect(Math.hypot(p[0] - regie.position[0], p[1] - regie.position[1], p[2] - regie.position[2])).toBeLessThan(1e-9)
    expect(pose.beta).toBeLessThan(ORBIT_FEEL.upperBetaLimit)
    expect(pose.beta).toBeGreaterThan(ORBIT_FEEL.lowerBetaLimit)
  })
  it('every room and point: the camera stands on the point, looks toward the stage end (−z), within the orbit guard', () => {
    for (const id of [...roomIds, null]) {
      const L = id ? room(id) : null
      for (const pt of defaultPoints(L, 1.7)) {
        const look = pointLookAt(L, pt)
        const pose = pointPose(pt.position, look, 82)
        const p = camPos(pose)
        expect(Math.hypot(p[0] - pt.position[0], p[1] - pt.position[1], p[2] - pt.position[2]), `${id} ${pt.id}`).toBeLessThan(1e-6)
        expect(pose.radius, `${id} ${pt.id}`).toBeLessThanOrEqual(82)
        expect(pose.radius, `${id} ${pt.id}`).toBeGreaterThanOrEqual(2)
        expect(pose.beta, `${id} ${pt.id}`).toBeLessThan(ORBIT_FEEL.upperBetaLimit)
        expect(pose.beta, `${id} ${pt.id}`).toBeGreaterThan(ORBIT_FEEL.lowerBetaLimit)
      }
    }
  })
  it('a target farther than the radius limit is pulled toward the point along the same line', () => {
    const pose = pointPose([0, 1.2, 50], [0, 0, -50], 40)
    expect(pose.radius).toBeCloseTo(40, 9)
    const p = camPos(pose)
    expect(p[0]).toBeCloseTo(0, 9)
    expect(p[1]).toBeCloseTo(1.2, 9)
    expect(p[2]).toBeCloseTo(50, 9)
    expect(pose.target[2]).toBeLessThan(50)
  })
})
