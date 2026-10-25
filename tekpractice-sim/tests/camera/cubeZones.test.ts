import { describe, expect, it } from 'vitest'
import { classifyHit, nearestZone, zoneAngles, zoneBox, zoneId, zoneLabel, ZONES } from '../../src/camera/cubeZones'
import { DEFAULT_FRONT_ALPHA, DESSUS_BETA, FACE_BETA } from '../../src/camera/viewCube'

describe('cube zones', () => {
  it('26 unique zones: 6 faces, 12 edges, 8 corners', () => {
    expect(ZONES).toHaveLength(26)
    expect(new Set(ZONES.map(zoneId)).size).toBe(26)
    const nz = (s: { x: number; y: number; z: number }) => [s.x, s.y, s.z].filter((v) => v !== 0).length
    expect([1, 2, 3].map((k) => ZONES.filter((s) => nz(s) === k).length)).toEqual([6, 12, 8])
  })
  it('classifies face centre, edge band and corner with threshold 0.5', () => {
    expect(zoneId(classifyHit({ x: 0, y: 0, z: 0.5 }))).toBe('face')
    expect(zoneId(classifyHit({ x: 0, y: 0.4, z: 0.5 }))).toBe('dessus-face')
    expect(zoneId(classifyHit({ x: 0.4, y: 0.4, z: 0.5 }))).toBe('dessus-face-droite')
    expect(zoneId(classifyHit({ x: -0.3, y: 0, z: -0.5 }))).toBe('arriere-gauche')
    expect(zoneId(classifyHit({ x: 0.2, y: -0.2, z: 0.5 }))).toBe('face') // |2·0.2| = 0.4 < 0.5
  })
  it('angles: face = front, droite = front + π/2, top = north-up, corners at the true isometric beta', () => {
    expect(zoneAngles({ x: 0, y: 0, z: 1 })).toEqual({ alpha: DEFAULT_FRONT_ALPHA, beta: FACE_BETA })
    expect(zoneAngles({ x: 1, y: 0, z: 0 }).alpha).toBeCloseTo(DEFAULT_FRONT_ALPHA + Math.PI / 2)
    expect(zoneAngles({ x: 0, y: 1, z: 0 })).toEqual({ alpha: DEFAULT_FRONT_ALPHA, beta: DESSUS_BETA })
    expect(zoneAngles({ x: 1, y: 1, z: 1 }).beta).toBeCloseTo(0.9553, 4)
    expect(zoneAngles({ x: 0, y: 1, z: 1 }).beta).toBeCloseTo(Math.PI / 4)
    expect(zoneAngles({ x: -1, y: -1, z: 0 }).beta).toBeCloseTo((3 * Math.PI) / 4)
    expect(zoneAngles({ x: 1, y: -1, z: -1 }).beta).toBeCloseTo(Math.PI - 0.9553, 4)
  })
  it('nearestZone inverts zoneAngles for all 26 zones', () => {
    for (const s of ZONES) {
      const { alpha, beta } = zoneAngles(s)
      expect(zoneId(nearestZone(alpha, beta))).toBe(zoneId(s))
    }
  })
  it('French labels joined with « · »', () => {
    expect(zoneLabel({ x: 0, y: 0, z: 1 })).toBe('Face')
    expect(zoneLabel({ x: 0, y: 1, z: 1 })).toBe('Dessus · Face')
    expect(zoneLabel({ x: -1, y: 0, z: -1 })).toBe('Arrière · Gauche')
    expect(zoneLabel({ x: 1, y: -1, z: -1 })).toBe('Dessous · Arrière · Droite')
    expect(zoneLabel({ x: 0, y: -1, z: 0 })).toBe('Dessous')
  })
  it('zoneBox edge and corner', () => {
    const e = zoneBox({ x: 0, y: 1, z: 1 })
    expect(e.center[0]).toBeCloseTo(0)
    expect(e.center[1]).toBeCloseTo(0.385)
    expect(e.center[2]).toBeCloseTo(0.385)
    expect(e.size).toEqual([0.5, 0.25, 0.25])
    const c = zoneBox({ x: 1, y: -1, z: 1 })
    expect(c.center[0]).toBeCloseTo(0.385)
    expect(c.center[1]).toBeCloseTo(-0.385)
    expect(c.center[2]).toBeCloseTo(0.385)
    expect(c.size).toEqual([0.25, 0.25, 0.25])
  })
  it('alpha for arriere and gauche', () => {
    expect(zoneAngles({ x: 0, y: 0, z: -1 }).alpha).toBeCloseTo(DEFAULT_FRONT_ALPHA + Math.PI)
    expect(zoneAngles({ x: -1, y: 0, z: 0 }).alpha).toBeCloseTo(DEFAULT_FRONT_ALPHA - Math.PI / 2)
  })
  it('classifyHit boundary |2v| = 0.5 is the middle band', () => {
    expect(zoneId(classifyHit({ x: 0.25, y: 0, z: 0.5 }))).toBe('face')
    expect(zoneId(classifyHit({ x: 0.26, y: 0, z: 0.5 }))).toBe('face-droite')
  })
  it('nearestZone handles alpha off by a full turn', () => {
    const { beta } = zoneAngles({ x: 0, y: 0, z: 1 })
    expect(zoneId(nearestZone(DEFAULT_FRONT_ALPHA - 2 * Math.PI + 0.05, beta))).toBe('face')
    expect(zoneId(nearestZone(DEFAULT_FRONT_ALPHA + 4 * Math.PI - 0.05, beta))).toBe('face')
  })
  it('zoneBox: hover overlay sits on the surface', () => {
    const b = zoneBox({ x: 0, y: 0, z: 1 })
    expect(b.center[0]).toBeCloseTo(0)
    expect(b.center[1]).toBeCloseTo(0)
    expect(b.center[2]).toBeCloseTo(0.385)
    expect(b.size[0]).toBeCloseTo(0.5)
    expect(b.size[1]).toBeCloseTo(0.5)
    expect(b.size[2]).toBeCloseTo(0.25)
    const c = zoneBox({ x: -1, y: 0, z: 0 })
    expect(c.center[0]).toBeCloseTo(-0.385)
  })
})
