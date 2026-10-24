import { describe, expect, it } from 'vitest'
import { fitPlacementsToRoom } from '../../src/creation/fitToRoom'
import type { DesignState, Placement } from '../../src/trials/trial'

const design = (placements: Placement[]): DesignState => ({
  roomId: 'room:concert-hall-medium',
  rig: {
    instances: placements.map((p) => ({ instanceId: p.instanceId, deviceId: p.deviceId })),
    connections: [{ a: { instance: 'a', port: 'out' }, b: { instance: 'b', port: 'in' } }],
    controls: { a: { power: true } },
  },
  placements,
})
const flat = (): number => 0
const room = { width: 10, length: 8 }

describe('fitPlacementsToRoom (« Garder le matériel »)', () => {
  it('clamps a placement outside a 10 × 8 room inside with a 0.5 m margin', () => {
    const d = design([
      { instanceId: 'a', deviceId: 'x', position_m: [20, 0, -30], yawDeg: 15 },
      { instanceId: 'b', deviceId: 'x', position_m: [-7, 0, 9], yawDeg: 0 },
    ])
    const out = fitPlacementsToRoom(d, room, flat)
    expect(out.placements[0].position_m).toEqual([4.5, 0, -3.5])
    expect(out.placements[0].yawDeg).toBe(15)
    expect(out.placements[1].position_m).toEqual([-4.5, 0, 3.5])
  })
  it('keeps a placement already inside where it is', () => {
    const d = design([{ instanceId: 'a', deviceId: 'x', position_m: [1, 0, 2], yawDeg: 0 }])
    expect(fitPlacementsToRoom(d, room, flat).placements[0].position_m).toEqual([1, 0, 2])
  })
  it('honours a custom margin', () => {
    const d = design([{ instanceId: 'a', deviceId: 'x', position_m: [20, 0, 0], yawDeg: 0 }])
    expect(fitPlacementsToRoom(d, room, flat, 1).placements[0].position_m[0]).toBe(4)
  })
  it('a floor device (mount absent or floor) lands on floorAt(x, z)', () => {
    const stage = (_x: number, z: number): number => (z < -2 ? 1 : 0)
    const d = design([
      { instanceId: 'a', deviceId: 'x', position_m: [0, 0, -30], yawDeg: 0 },
      { instanceId: 'b', deviceId: 'x', position_m: [0, 3, 1], yawDeg: 0, mount: 'floor' },
    ])
    const out = fitPlacementsToRoom(d, room, stage)
    expect(out.placements[0].position_m).toEqual([0, 1, -3.5])
    expect(out.placements[1].position_m).toEqual([0, 0, 1])
  })
  it('a stand / flown device keeps its height above the floor', () => {
    const stage = (_x: number, z: number): number => (z < -2 ? 1 : 0)
    const d = design([
      { instanceId: 'a', deviceId: 'x', position_m: [0, 1.5, -9], yawDeg: 0, mount: 'stand' },
      { instanceId: 'b', deviceId: 'x', position_m: [0, 6, 1], yawDeg: 0, mount: 'flown' },
    ])
    // The old room's floor is unknown: it is read with floorAt at the old point
    // (z = -9 → 1 m), so the stand is 0.5 m above it → 1.5 m at the clamped point (z = -3.5, floor 1 m).
    const out = fitPlacementsToRoom(d, room, stage)
    expect(out.placements[0].position_m[1]).toBeCloseTo(1.5, 9)
    expect(out.placements[0].mount).toBe('stand')
    expect(out.placements[1].position_m).toEqual([0, 6, 1])
  })
  it('a stand device never ends below the floor', () => {
    const d = design([{ instanceId: 'a', deviceId: 'x', position_m: [0, -2, 0], yawDeg: 0, mount: 'stand' }])
    expect(fitPlacementsToRoom(d, room, () => 0.4).placements[0].position_m[1]).toBe(0.4)
  })
  it('the rig and roomId are unchanged, the input is not mutated', () => {
    const d = design([{ instanceId: 'a', deviceId: 'x', position_m: [20, 0, -30], yawDeg: 0 }])
    const copy = structuredClone(d)
    const out = fitPlacementsToRoom(d, room, flat)
    expect(out.rig).toEqual(copy.rig)
    expect(out.roomId).toBe(copy.roomId)
    expect(d).toEqual(copy)
  })
  it('a room smaller than twice the margin puts everything on the centre line', () => {
    const d = design([{ instanceId: 'a', deviceId: 'x', position_m: [3, 0, 3], yawDeg: 0 }])
    expect(fitPlacementsToRoom(d, { width: 0.6, length: 0.8 }, flat).placements[0].position_m).toEqual([0, 0, 0])
  })
})
