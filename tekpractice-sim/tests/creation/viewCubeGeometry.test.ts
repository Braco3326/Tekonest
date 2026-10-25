/**
 * View cube widget geometry (Task 17, C11): the pure part. The cube mesh sits
 * in WORLD axes (its camera mirrors the main camera's alpha / beta), so a world
 * hit point must map to the cube frame of cubeZones.ts (ADR-0014: droite = the
 * audience's right = Babylon world −x). Proof: looking from every zone's own
 * pose, the ray through the cube centre lands on that zone.
 */
import { describe, expect, it } from 'vitest'
import { classifyHit, ZONES, zoneAngles, zoneBox, zoneId } from '../../src/camera/cubeZones'
import {
  cubeSizePx,
  cubeToWorld,
  cubeViewport,
  CUBE_LAYER,
  MAIN_LAYER,
  worldToCube,
} from '../../src/creation/viewCubeGeometry'

/** Babylon ArcRotateCamera: eye = target + r·(cos α sin β, cos β, sin α sin β). */
const eyeDir = (alpha: number, beta: number): [number, number, number] => [
  Math.cos(alpha) * Math.sin(beta),
  Math.cos(beta),
  Math.sin(alpha) * Math.sin(beta),
]

describe('view cube frame ↔ world (Task 17)', () => {
  it('every zone, seen from its own pose, is the patch at the cube centre', () => {
    for (const s of ZONES) {
      const a = zoneAngles(s)
      const d = eyeDir(a.alpha, a.beta)
      // The ray from the eye to the cube centre enters the unit cube where the largest component reaches 0.5.
      const k = 0.5 / Math.max(...d.map(Math.abs))
      const hit = { x: d[0] * k, y: d[1] * k, z: d[2] * k }
      expect(zoneId(classifyHit(worldToCube(hit))), zoneId(s)).toBe(zoneId(s))
    }
  })
  it('the Face pose looks from world +z; droite is world −x, dessus world +y', () => {
    expect(worldToCube({ x: 0, y: 0, z: 0.5 })).toEqual({ x: 0, y: 0, z: 0.5 })
    expect(worldToCube({ x: -0.5, y: 0, z: 0 }).x).toBe(0.5)
    expect(worldToCube({ x: 0, y: 0.5, z: 0 }).y).toBe(0.5)
  })
  it('cubeToWorld is the inverse of worldToCube', () => {
    const p = { x: 0.1, y: -0.2, z: 0.3 }
    expect(cubeToWorld(worldToCube(p))).toEqual(p)
  })
  it('the hover box of a face stays inside the patch the classifier gives that face', () => {
    for (const s of ZONES) {
      const b = zoneBox(s)
      const c = { x: b.center[0], y: b.center[1], z: b.center[2] }
      // centre of the overlay, pushed onto the surface, classifies as its zone
      const onSurface = {
        x: s.x ? s.x * 0.5 : c.x,
        y: s.y ? s.y * 0.5 : c.y,
        z: s.z ? s.z * 0.5 : c.z,
      }
      expect(zoneId(classifyHit(onSurface)), zoneId(s)).toBe(zoneId(s))
    }
  })
})

describe('view cube size and viewport (C-a)', () => {
  it('120 px below 1600 px window width, 130 px from it', () => {
    expect(cubeSizePx(1366)).toBe(120)
    expect(cubeSizePx(1599)).toBe(120)
    expect(cubeSizePx(1600)).toBe(130)
    expect(cubeSizePx(2560)).toBe(130)
  })
  it('the cube square sits 16 px from the canvas top-left (Babylon viewport: origin bottom-left, normalised)', () => {
    const v = cubeViewport(1000, 600, 120)
    expect(v.x).toBeCloseTo(16 / 1000, 9)
    expect(v.width).toBeCloseTo(120 / 1000, 9)
    expect(v.height).toBeCloseTo(120 / 600, 9)
    expect(v.y).toBeCloseTo(1 - (16 + 120) / 600, 9)
  })
  it('a canvas smaller than the cube never gets a viewport outside [0, 1]', () => {
    const v = cubeViewport(100, 80, 120)
    for (const n of [v.x, v.y, v.width, v.height, v.x + v.width, v.y + v.height]) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
    }
    const z = cubeViewport(0, 0, 120)
    expect([z.x, z.y, z.width, z.height].every(Number.isFinite)).toBe(true)
  })
  it('layer masks: the main camera and the cube never see each other', () => {
    expect(CUBE_LAYER & MAIN_LAYER).toBe(0)
    expect(MAIN_LAYER).toBe(0x0fffffff) // Babylon's default mesh / camera mask: every other mesh stays visible
  })
})
