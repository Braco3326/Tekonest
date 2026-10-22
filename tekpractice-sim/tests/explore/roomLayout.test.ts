import { describe, expect, it } from 'vitest'
import { roomLayout, type RoomTemplate } from '../../src/explore/roomLayout'
import { resolveMove } from '../../src/explore/collision'

const hall: RoomTemplate = {
  id: 'concert-hall-medium',
  name_fr: 'Salle de concert',
  dimensions_m: {
    length: { min: 25, typical: 32, max: 40 },
    width: { min: 15, typical: 18, max: 22 },
    height: { min: 6, typical: 9, max: 10 },
  },
  zones: [
    { id: 'scene', kind: 'stage', rect_m: [0, -11.5, 14, 9], floor_y_m: 1.3 },
    { id: 'fosse', kind: 'audience', rect_m: [0, 3, 18, 20], floor_y_m: 0 },
    { id: 'regie-facade', kind: 'foh', rect_m: [0, 8, 4, 3], floor_y_m: 0 },
  ],
  openings: [
    { wall: 'rear', kind: 'door', offset_m: -5, width_m: 2, height_m: 2.2 },
    { wall: 'left', kind: 'door', offset_m: 4, width_m: 1.4, height_m: 2.2 },
    { wall: 'front', kind: 'window', offset_m: 0, width_m: 2, height_m: 1 },
  ],
  procedural: { wall_color: '#121212', floor_color: '#3a3a3a', ceiling_color: '#0c0c0c', prop_hints: [] },
  lighting: { mood: 'salle noire', color_temp_k: 3200 },
}

describe('room layout (procedural rooms from TEK Brain templates)', () => {
  it('uses the typical dimensions: width along x, length along z', () => {
    const l = roomLayout(hall)
    expect(l).toMatchObject({ width: 18, length: 32, height: 9 })
  })

  it('splits a wall around a door (front = −z stage end, rear = +z, left = −x, right = +x)', () => {
    const l = roomLayout(hall)
    const rear = l.wallSegments.filter((s) => s.wall === 'rear')
    // full-height pieces left and right of the door + a lintel above it
    expect(rear.filter((s) => s.bottom === 0)).toHaveLength(2)
    const lintel = rear.find((s) => s.bottom > 0)!
    expect(lintel.bottom).toBeCloseTo(2.2)
    expect(rear.every((s) => s.z0 === 16 && s.z1 === 16)).toBe(true)
    const left = l.wallSegments.filter((s) => s.wall === 'left')
    expect(left.every((s) => s.x0 === -9)).toBe(true)
    // windows do not open the collision wall
    expect(l.wallSegments.filter((s) => s.wall === 'front' && s.bottom === 0)).toHaveLength(1)
  })

  it('lets the walker leave through a door but not through a wall', () => {
    const l = roomLayout(hall)
    const throughDoor = resolveMove({ x: -5, z: 14 }, { x: -5, z: 18 }, 0.3, l.colliders)
    expect(throughDoor.z).toBeGreaterThan(16)
    const throughWall = resolveMove({ x: 5, z: 14 }, { x: 5, z: 18 }, 0.3, l.colliders)
    expect(throughWall.z).toBeLessThan(16)
  })

  it('a doorway is not an exit into the void: an outer boundary stops the walker just outside', () => {
    const l = roomLayout(hall)
    const out = resolveMove({ x: -5, z: 14 }, { x: -5, z: 30 }, 0.3, l.colliders)
    expect(out.z).toBeGreaterThan(16) // through the door…
    expect(out.z).toBeLessThan(16 + 2.5) // …but not far
  })

  it('raises the floor on stage zones (walk up onto the stage)', () => {
    const l = roomLayout(hall)
    expect(l.floorAt(0, -11)).toBeCloseTo(1.3)
    expect(l.floorAt(0, 5)).toBe(0)
    expect(l.floorAt(0, 40)).toBe(0) // outside: ground
  })

  it('spawns at the FOH position looking at the stage (−z)', () => {
    const s = roomLayout(hall).spawn
    expect(s).toMatchObject({ x: 0, z: 8 })
    expect(Math.abs(s.yaw)).toBeCloseTo(Math.PI)
  })

  it('without FOH/control room, spawns near the rear wall facing the front', () => {
    const s = roomLayout({ ...hall, zones: [] }).spawn
    expect(s.z).toBeCloseTo(16 - 1.5)
    expect(s.x).toBe(0)
  })
})
