import { describe, expect, it } from 'vitest'
import { buildPlacement, toExtras } from '../../../tools/assets3d/placement'
import type { AssetSpecT, FaceT } from '../../../tools/assets3d/specSchema'

/** 468 x 272 x 562 mm: w = 0.468, h = 0.272, d = 0.562 m. */
const SIZE = { w: 468, h: 272, d: 562 }

/** A device spec with one port on `face` at (xMm, yMm). */
function withPort(face: FaceT, xMm: number, yMm: number, openingMm?: number): AssetSpecT {
  return {
    id: 'test-device',
    kind: 'device',
    tier: 'standard',
    realSizeMm: SIZE,
    ports: [{ portId: 'p1', face, xMm, yMm, confidence: 'manual', ...(openingMm === undefined ? {} : { openingMm }) }],
    controls: [],
    sources: [],
  }
}

/** A device spec with one control on `face` at (xMm, yMm). */
function withControl(face: FaceT, xMm: number, yMm: number): AssetSpecT {
  return {
    ...withPort('io', 0, 0),
    ports: [],
    controls: [{ controlId: 'gain1', kind: 'knob', face, xMm, yMm, axis: 'y', travelMm: 20, sizeMm: { w: 10, h: 12, d: 10 } }],
  }
}

const portOf = (face: FaceT, x: number, y: number) => buildPlacement(withPort(face, x, y)).ports[0]

describe('port inset (a jack deep in a recessed panel)', () => {
  const inset = (face: FaceT, mm: number): AssetSpecT => {
    const s = withPort(face, 100, 50)
    s.ports[0].insetMm = mm
    return s
  }
  it('moves the port inward along its outward axis and says by how much', () => {
    const io = buildPlacement(inset('io', 35)).ports[0]
    expect(io.pos[2]).toBeCloseTo(0.281 - 0.035, 9)
    expect(io.insetM).toBeCloseTo(0.035, 9)
    const top = buildPlacement(inset('top', 10)).ports[0]
    expect(top.pos[1]).toBeCloseTo(0.272 - 0.01, 9)
    const opp = buildPlacement(inset('opposite', 5)).ports[0]
    expect(opp.pos[2]).toBeCloseTo(-0.281 + 0.005, 9)
  })
  it('no inset leaves the port on the face plane and the field absent', () => {
    const p = buildPlacement(withPort('io', 100, 50)).ports[0]
    expect(p.pos[2]).toBeCloseTo(0.281, 9)
    expect(p.insetM).toBeUndefined()
  })
  it('a port with an inset gets no recess opening (the fix-up cuts the socket recess on the face plane only; inside a recessed panel it would punch a hole in the shell)', () => {
    const spec = withPort('io', 100, 50, 24)
    spec.ports[0].insetMm = 25
    const p = buildPlacement(spec).ports[0]
    expect(p.openingM).toBeUndefined()
    expect(buildPlacement(withPort('io', 100, 50, 24)).ports[0].openingM).toBeCloseTo(0.024, 9)
  })
  it('the extras carry the inset position (the app puts the cable end at the real jack)', () => {
    const spec = inset('io', 35)
    const ex = toExtras(spec, buildPlacement(spec))
    expect(ex.ports[0].pos[2]).toBeCloseTo(0.281 - 0.035, 9)
  })
})

describe('buildPlacement', () => {
  it('reports the size in metres', () => {
    expect(buildPlacement(withPort('io', 0, 0)).sizeM).toEqual({ w: 0.468, h: 0.272, d: 0.562 })
  })

  it('io face port lands at z=+d/2 and x offset from centre', () => {
    const p = portOf('io', 234, 100)
    expect(p.pos[0]).toBeCloseTo(0, 9)
    expect(p.pos[1]).toBeCloseTo(0.1, 9)
    expect(p.pos[2]).toBeCloseTo(0.281, 9)
    expect(p.outward).toEqual([0, 0, 1])
  })

  it('io face: x grows to the right, seen from outside (x_w = x - w/2)', () => {
    expect(portOf('io', 0, 50).pos[0]).toBeCloseTo(-0.234, 9)
    expect(portOf('io', 468, 50).pos[0]).toBeCloseTo(0.234, 9)
    expect(portOf('io', 400, 50).pos[0]).toBeCloseTo(0.166, 9)
  })

  it('opposite face mirrors x and sits at z=-d/2', () => {
    const io = portOf('io', 100, 60)
    const opp = portOf('opposite', 100, 60)
    expect(opp.pos[0]).toBeCloseTo(-io.pos[0], 9)
    expect(opp.pos[0]).toBeCloseTo(0.134, 9)
    expect(opp.pos[1]).toBeCloseTo(0.06, 9)
    expect(opp.pos[2]).toBeCloseTo(-0.281, 9)
    expect(opp.outward).toEqual([0, 0, -1])
  })

  it('top face port sits at y=h, with y depth running from the I/O edge back', () => {
    const p = portOf('top', 100, 100)
    expect(p.pos[0]).toBeCloseTo(-0.134, 9)
    expect(p.pos[1]).toBeCloseTo(0.272, 9)
    expect(p.pos[2]).toBeCloseTo(0.181, 9)
    expect(p.outward).toEqual([0, 1, 0])
    // y=0 of the top face is the I/O edge (z=+d/2)
    expect(portOf('top', 0, 0).pos[2]).toBeCloseTo(0.281, 9)
  })

  it('bottom face port sits at y=0 and mirrors x', () => {
    const p = portOf('bottom', 100, 100)
    expect(p.pos[0]).toBeCloseTo(0.134, 9)
    expect(p.pos[1]).toBe(0)
    expect(p.pos[2]).toBeCloseTo(0.181, 9)
    expect(p.outward).toEqual([0, -1, 0])
  })

  it('left face port sits at x=-w/2, x_local running from the back towards the I/O face', () => {
    const p = portOf('left', 100, 50)
    expect(p.pos[0]).toBeCloseTo(-0.234, 9)
    expect(p.pos[1]).toBeCloseTo(0.05, 9)
    expect(p.pos[2]).toBeCloseTo(-0.181, 9)
    expect(p.outward).toEqual([-1, 0, 0])
    expect(portOf('left', 562, 0).pos[2]).toBeCloseTo(0.281, 9)
  })

  it('right face port sits at x=+w/2, x_local running from the I/O face towards the back', () => {
    const p = portOf('right', 100, 50)
    expect(p.pos[0]).toBeCloseTo(0.234, 9)
    expect(p.pos[1]).toBeCloseTo(0.05, 9)
    expect(p.pos[2]).toBeCloseTo(0.181, 9)
    expect(p.outward).toEqual([1, 0, 0])
    expect(portOf('right', 0, 0).pos[2]).toBeCloseTo(0.281, 9)
  })

  it('port names are port_<portId> and the opening is carried in metres when present', () => {
    const plain = buildPlacement(withPort('io', 0, 0))
    expect(plain.ports[0].name).toBe('port_p1')
    expect(plain.ports[0].openingM).toBeUndefined()
    expect(buildPlacement(withPort('io', 0, 0, 7)).ports[0].openingM).toBeCloseTo(0.007, 9)
  })

  it('control names are ctrl_<id> and carry kind, axis, size and travel in metres', () => {
    const c = buildPlacement(withControl('top', 234, 281)).controls[0]
    expect(c.name).toBe('ctrl_gain1')
    expect(c.kind).toBe('knob')
    expect(c.axis).toBe('y')
    expect(c.sizeM).toEqual({ w: 0.01, h: 0.012, d: 0.01 })
    expect(c.travelM).toBeCloseTo(0.02, 9)
    expect(c.pos[0]).toBeCloseTo(0, 9)
    expect(c.pos[1]).toBeCloseTo(0.272, 9)
    expect(c.pos[2]).toBeCloseTo(0, 9)
  })

  it('a control without travel has no travelM', () => {
    const spec = withControl('io', 10, 10)
    delete spec.controls[0].travelMm
    expect(buildPlacement(spec).controls[0].travelM).toBeUndefined()
  })

  it('a connector spec has its size and no ports or controls', () => {
    const spec: AssetSpecT = {
      id: 'xlr-male', kind: 'connector', tier: 'connector', realSizeMm: { w: 25, h: 25, d: 70 }, ports: [], controls: [], sources: [],
    }
    const pl = buildPlacement(spec)
    expect(pl.sizeM).toEqual({ w: 0.025, h: 0.025, d: 0.07 })
    expect(pl.ports).toEqual([])
    expect(pl.controls).toEqual([])
  })
})

describe('toExtras', () => {
  it('writes schema 1, the real size in mm and the port / control positions by id', () => {
    const spec = withPort('io', 234, 100)
    spec.controls = withControl('top', 234, 281).controls
    const extras = toExtras(spec, buildPlacement(spec))
    expect(extras.schema).toBe(1)
    expect(extras.realSizeMm).toEqual(SIZE)
    expect(extras.ports).toHaveLength(1)
    expect(extras.ports[0].portId).toBe('p1')
    expect(extras.ports[0].pos[2]).toBeCloseTo(0.281, 9)
    expect(extras.controls).toHaveLength(1)
    expect(extras.controls[0]).toMatchObject({ controlId: 'gain1', axis: 'y', kind: 'knob' })
    expect(extras.controls[0].pos[1]).toBeCloseTo(0.272, 9)
  })

  it('is plain JSON (survives a round trip)', () => {
    const spec = withPort('left', 100, 50)
    const extras = toExtras(spec, buildPlacement(spec))
    expect(JSON.parse(JSON.stringify(extras))).toEqual(extras)
  })
})
