import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNAP_M, MAX_SCALE, MIN_SCALE, SNAP_STEPS_M, fitView, footprintBounds, footprintCorners, footprintInsideRoom, gridLines, insideRoom, localToWorld, panBy, portAnchor,
  scaleBar, snap, toScreen, toWorld, zoomAt,
} from '../../src/plan2d/geometry'

describe('footprintInsideRoom (mission 3 fixes, item 1: the one « inside the room » test of the 2D page)', () => {
  // a 4 m x 4 m floor, origin at its centre; an M32-sized footprint (0.891 m across, 0.612 m deep)
  const room = { width: 4, length: 4 }
  const m32 = { w: 0.891, d: 0.612 }
  it('inside: a device in the middle of the floor', () => {
    expect(footprintInsideRoom({ x: 0, z: 0, rot: 0 }, m32, room)).toBe(true)
  })
  it('outside: a device past a wall, its centre too', () => {
    expect(footprintInsideRoom({ x: 3, z: 0, rot: 0 }, m32, room)).toBe(false)
    expect(footprintInsideRoom({ x: 0, z: -2.5, rot: 0 }, m32, room)).toBe(false)
  })
  it('straddling a wall: the centre on the floor but an edge past the wall is outside', () => {
    expect(footprintInsideRoom({ x: 1.8, z: 0, rot: 0 }, m32, room)).toBe(false)
    expect(footprintInsideRoom({ x: 0, z: 1.9, rot: 0 }, m32, room)).toBe(false)
  })
  it('turned 45°: a pose that fits square-on reaches past the wall once turned (half-width 0.531 m against 0.446 m)', () => {
    expect(footprintInsideRoom({ x: 1.5, z: 0, rot: 0 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: 1.5, z: 0, rot: 45 }, m32, room)).toBe(false)
  })
  it('turned 90°: the depth now lies across, so a pose past the wall square-on fits once turned', () => {
    expect(footprintInsideRoom({ x: 1.6, z: 0, rot: 0 }, m32, room)).toBe(false)
    expect(footprintInsideRoom({ x: 1.6, z: 0, rot: 90 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: 1.6, z: 0, rot: 270 }, m32, room)).toBe(true)
  })
  it('exactly on the wall is inside (square-on and turned 90°, every wall)', () => {
    expect(footprintInsideRoom({ x: 2 - 0.891 / 2, z: 0, rot: 0 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: -(2 - 0.891 / 2), z: 0, rot: 0 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: 0, z: 2 - 0.612 / 2, rot: 0 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: 0, z: -(2 - 0.891 / 2), rot: 90 }, m32, room)).toBe(true)
    expect(footprintInsideRoom({ x: 2 - 0.612 / 2, z: 2 - 0.891 / 2, rot: 90 }, m32, room)).toBe(true)
    // a tenth of a millimetre further is out
    expect(footprintInsideRoom({ x: 2 - 0.891 / 2 + 1e-4, z: 0, rot: 0 }, m32, room)).toBe(false)
  })
})

const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-9)

describe('snap', () => {
  it('offers 10, 25, 50 and 100 cm, 25 cm by default', () => {
    expect(SNAP_STEPS_M).toEqual([0.1, 0.25, 0.5, 1])
    expect(DEFAULT_SNAP_M).toBe(0.25)
  })
  it('rounds to the nearest multiple of the step without float noise', () => {
    expect(snap(0.37, 0.25)).toBe(0.25)
    expect(snap(0.38, 0.25)).toBe(0.5)
    expect(snap(0.3, 0.1)).toBe(0.3)
    expect(snap(-1.26, 0.5)).toBe(-1.5)
    expect(snap(2.49, 1)).toBe(2)
    expect(Object.is(snap(-0.01, 0.25), -0)).toBe(false)
  })
})

describe('metre / pixel transform (the plan read from the audience: stage wall at the top, world +x on the LEFT, as roomPlanSvg)', () => {
  const v = { scale: 50, cx: 0, cz: 0, w: 800, h: 600 }
  it('the room centre is the screen centre; +z (the audience side) goes down, +x goes left', () => {
    expect(toScreen(v, 0, 0)).toEqual({ sx: 400, sy: 300 })
    expect(toScreen(v, 1, 0)).toEqual({ sx: 350, sy: 300 })
    expect(toScreen(v, 0, 1)).toEqual({ sx: 400, sy: 350 })
  })
  it('toWorld is the inverse of toScreen', () => {
    const w = { scale: 37.5, cx: 1.2, cz: -3.4, w: 640, h: 480 }
    for (const [x, z] of [[0, 0], [2.5, -1], [-7, 4.25]] as const) {
      const s = toScreen(w, x, z)
      const back = toWorld(w, s.sx, s.sy)
      close(back.x, x)
      close(back.z, z)
    }
  })
  it('fitView fits the whole room with a margin, centred', () => {
    const f = fitView({ width: 24, length: 14 }, 1000, 600, 50)
    expect(f.scale).toBeCloseTo(Math.min(900 / 24, 500 / 14))
    expect([f.cx, f.cz]).toEqual([0, 0])
    const tl = toScreen(f, 12, -7) // the stage-side jardin corner: top-left
    expect(tl.sx).toBeGreaterThanOrEqual(50 - 1e-9)
    expect(tl.sy).toBeGreaterThanOrEqual(50 - 1e-9)
  })
  it('zoomAt keeps the point under the pointer still and clamps the scale', () => {
    const z = zoomAt(v, 2, 200, 100)
    const before = toWorld(v, 200, 100)
    const after = toWorld(z, 200, 100)
    close(after.x, before.x)
    close(after.z, before.z)
    expect(z.scale).toBe(100)
    expect(zoomAt(v, 1e6, 0, 0).scale).toBe(MAX_SCALE)
    expect(zoomAt(v, 1e-6, 0, 0).scale).toBe(MIN_SCALE)
  })
  it('panBy moves the drawing with the pointer', () => {
    const p = panBy(v, 30, -20)
    const a = toScreen(v, 1, 1)
    const b = toScreen(p, 1, 1)
    close(b.sx - a.sx, 30)
    close(b.sy - a.sy, -20)
  })
})

describe('scale bar', () => {
  it('is the longest round length that fits, labelled in metres or centimetres', () => {
    expect(scaleBar(50, 160)).toEqual({ m: 2, px: 100, label: '2 m' })
    expect(scaleBar(400, 160)).toEqual({ m: 0.2, px: 80, label: '20 cm' })
    expect(scaleBar(8, 160)).toEqual({ m: 20, px: 160, label: '20 m' })
  })
})

describe('footprint and orientation (yaw as in 3D: 0 = the front faces +z, toward the audience)', () => {
  it('local front (0, +1) is world +z at 0 deg and world +x at 90 deg', () => {
    const p0 = localToWorld({ x: 0, z: 0, rot: 0 }, 0, 1)
    close(p0.x, 0)
    close(p0.z, 1)
    const p90 = localToWorld({ x: 1, z: 1, rot: 90 }, 0, 1)
    close(p90.x, 2)
    close(p90.z, 1)
  })
  it('the corners of a 0.4 x 0.2 m footprint, and its bounds swap at 90 deg', () => {
    const c = footprintCorners({ x: 1, z: 2, rot: 0 }, { w: 0.4, d: 0.2 })
    expect(c.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100])).toEqual([[0.8, 1.9], [1.2, 1.9], [1.2, 2.1], [0.8, 2.1]])
    const b = footprintBounds({ x: 0, z: 0, rot: 90 }, { w: 0.4, d: 0.2 })
    close(b.maxX - b.minX, 0.2)
    close(b.maxZ - b.minZ, 0.4)
  })
  it('port anchors sit on the REAR edge (local -z), spread in order from one side to the other', () => {
    const d = { x: 0, z: 0, rot: 0 }
    const size = { w: 0.6, d: 0.4 }
    const a = [0, 1, 2].map((i) => portAnchor(d, size, i, 3))
    for (const p of a) close(p.z, -0.2)
    expect(a.map((p) => Math.round(p.x * 100) / 100)).toEqual([-0.2, 0, 0.2])
    const r = portAnchor({ x: 0, z: 0, rot: 180 }, size, 0, 1)
    close(r.z, 0.2) // turned to face the stage: the rear is now toward the audience
  })
  it('insideRoom: the footprint must fit in the floor (origin at its centre)', () => {
    expect(insideRoom(footprintBounds({ x: 0, z: 0, rot: 0 }, { w: 1, d: 1 }), { width: 4, length: 4 })).toBe(true)
    expect(insideRoom(footprintBounds({ x: 1.8, z: 0, rot: 0 }, { w: 1, d: 1 }), { width: 4, length: 4 })).toBe(false)
  })
})

describe('metre grid', () => {
  it('lists the whole-metre lines inside the room', () => {
    expect(gridLines({ width: 3, length: 2 }, 1)).toEqual({ xs: [-1, 0, 1], zs: [-1, 0, 1] })
  })
})

describe('deviceMatrix: the unit square of a glyph onto the screen', () => {
  it('maps the glyph corners onto the footprint corners, at any yaw', async () => {
    const { deviceMatrix } = await import('../../src/plan2d/geometry')
    const v = { scale: 40, cx: 0.5, cz: -0.25, w: 600, h: 400 }
    for (const rot of [0, 90, 135, 270]) {
      const pose = { x: 1.2, z: 0.7, rot }
      const size = { w: 0.6, d: 0.3 }
      const [a, b, c, d, e, f] = deviceMatrix(v, pose, size)
      const corners = footprintCorners(pose, size).map((p) => toScreen(v, p.x, p.z))
      // unit corners in the same order: rear left, rear right, front right, front left
      const unit = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const
      unit.forEach(([u, w], i) => {
        close(a * u + c * w + e, corners[i]!.sx)
        close(b * u + d * w + f, corners[i]!.sy)
      })
    }
  })
})
