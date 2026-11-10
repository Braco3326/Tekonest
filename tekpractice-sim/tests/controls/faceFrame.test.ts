import { describe, expect, it } from 'vitest'
import { faceFrame, topSurface } from '../../src/controls/faceFrame'

const S = { w: 400, h: 100, d: 300 }
const len = (v: number[]): number => Math.hypot(...v)
const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

describe('faceFrame (device root frame, I/O face at -Z)', () => {
  it('io face: 200 mm from the left of a 400 mm wide box is x = 0, on the -Z face, looking out toward -Z', () => {
    const f = faceFrame('io', 200, 30, S)
    expect(f.pos[0]).toBeCloseTo(0, 9)
    expect(f.pos[1]).toBeCloseTo(0.03, 9)
    expect(f.pos[2]).toBeCloseTo(-0.15, 9)
    expect(f.out).toEqual([0, 0, -1])
    expect(f.right).toEqual([1, 0, 0])
  })
  it('opposite face is the +Z face, x mirrored (seen from outside)', () => {
    const f = faceFrame('opposite', 50, 10, S)
    expect(f.pos[0]).toBeCloseTo(0.2 - 0.05, 9)
    expect(f.pos[2]).toBeCloseTo(0.15, 9)
    expect(f.out).toEqual([0, 0, 1])
  })
  it('top face: y = 0 is the I/O edge (z = -d/2), y grows toward the front (+z), normal up', () => {
    const a = faceFrame('top', 100, 0, S)
    const b = faceFrame('top', 100, 100, S)
    expect(a.pos[0]).toBeCloseTo(-0.1, 9)
    expect(a.pos[1]).toBeCloseTo(0.1, 9)
    expect(a.pos[2]).toBeCloseTo(-0.15, 9)
    expect(b.pos[2]).toBeCloseTo(-0.05, 9)
    expect(a.out).toEqual([0, 1, 0])
    expect(a.up).toEqual([0, 0, 1])
  })
  it('every face has an orthonormal frame', () => {
    for (const face of ['io', 'opposite', 'top', 'bottom', 'left', 'right'] as const) {
      const f = faceFrame(face, 10, 10, S)
      expect(len(f.right)).toBeCloseTo(1, 9)
      expect(len(f.up)).toBeCloseTo(1, 9)
      expect(len(f.out)).toBeCloseTo(1, 9)
      expect(dot(f.right, f.up)).toBeCloseTo(0, 9)
      expect(dot(f.right, f.out)).toBeCloseTo(0, 9)
      expect(dot(f.up, f.out)).toBeCloseTo(0, 9)
    }
  })
  it('a sloped top (wedge profile) lifts the point to the surface and tilts the frame to it', () => {
    const profile: [number, number][] = [[0, 100], [100, 100], [200, 80]]
    const flat = faceFrame('top', 100, 50, S, profile)
    expect(flat.pos[1]).toBeCloseTo(0.1, 9)
    expect(flat.out[2]).toBeCloseTo(0, 9)
    const slope = faceFrame('top', 100, 150, S, profile)
    expect(slope.pos[1]).toBeCloseTo(0.09, 9) // halfway down the slope
    // the surface falls toward the front (+z): the normal leans toward the front, the face-up axis points down the slope
    expect(slope.out[2]).toBeGreaterThan(0)
    expect(slope.up[1]).toBeLessThan(0)
    expect(dot(slope.up, slope.out)).toBeCloseTo(0, 9)
    expect(len(slope.out)).toBeCloseTo(1, 9)
  })
  it('topSurface clamps beyond the ends of the profile', () => {
    expect(topSurface([[10, 50], [20, 40]], 0)).toEqual({ heightMm: 50, slope: 0 })
    expect(topSurface([[10, 50], [20, 40]], 99)).toEqual({ heightMm: 40, slope: 0 })
    expect(topSurface([[10, 50], [20, 40]], 15)).toEqual({ heightMm: 45, slope: -1 })
  })
})
