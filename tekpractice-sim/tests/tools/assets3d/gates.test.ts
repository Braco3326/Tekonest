import { describe, expect, it } from 'vitest'
import {
  checkBudget,
  checkConnectorFit,
  checkParts,
  checkPortPositions,
  checkProportionDrift,
  checkSize,
  checkTextures,
  checkTransform,
  FILE_BYTES_MAX,
  runGates,
  TEXTURE_MAX_PX,
} from '../../../tools/assets3d/gates'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import type { GlbReport } from '../../../tools/assets3d/inspect'
import { buildPlacement } from '../../../tools/assets3d/placement'
import type { Placement } from '../../../tools/assets3d/placement'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { makeBoxGlb } from './helpers'

const MM = 0.001

/** A 100 x 50 x 200 mm device with one port on the io face and one knob on the top face. */
function deviceSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-mixer',
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 100, h: 50, d: 200 },
    ports: [{ portId: 'in-mic-1', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }],
    controls: [{ controlId: 'gain', kind: 'knob', face: 'top', xMm: 30, yMm: 100, axis: 'y', sizeMm: { w: 10, h: 10, d: 10 } }],
    sources: [],
    ...over,
  }
}

function connectorSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-jack',
    kind: 'connector',
    tier: 'connector',
    realSizeMm: { w: 6, h: 6, d: 20 },
    ports: [],
    controls: [],
    mating: { role: 'plug', outerMm: 3.4 },
    sources: [],
    ...over,
  }
}

type NodeDef = { name: string; pos: [number, number, number] }

/** The port and control nodes of a placement, as the builder would write them. */
function placedNodes(placement: Placement): NodeDef[] {
  return [
    ...placement.ports.map((p) => ({ name: p.name, pos: p.pos })),
    ...placement.controls.map((c) => ({ name: c.name, pos: c.pos })),
  ]
}

/** A real GlbReport (through the inspector) of a box with the given nodes; pivot bottom-centre. */
async function boxReport(sizeM: { w: number; h: number; d: number }, nodes: NodeDef[] = []): Promise<GlbReport> {
  return inspectGlb(await makeBoxGlb({ sizeM, nodes }))
}

/** A literal report of a clean 100 x 50 x 200 mm box (bottom-centre pivot), with `over` applied on top. */
function reportOf(over: Partial<GlbReport> = {}): GlbReport {
  return {
    bboxM: { min: [-0.05, 0, -0.1], max: [0.05, 0.05, 0.1] },
    triangles: 12,
    materials: 1,
    nodeNames: ['root'],
    nodes: [{ name: 'root', worldPos: [0, 0, 0], hasMesh: true }],
    topLevelCount: 1,
    rootScale: [1, 1, 1],
    rootRotation: [0, 0, 0, 1],
    extras: null,
    fileBytes: 1000,
    textures: [],
    ...over,
  }
}

/** Replaces the node list of a report (and its names) by `names`, all at the origin, plus the root. */
function withNodeNames(report: GlbReport, names: string[]): GlbReport {
  return {
    ...report,
    nodeNames: ['root', ...names],
    nodes: [{ name: 'root', worldPos: [0, 0, 0], hasMesh: true }, ...names.map((name) => ({ name, worldPos: [0, 0, 0] as [number, number, number], hasMesh: false }))],
  }
}

/** Moves one node of a report by `delta` metres. */
function moveNode(report: GlbReport, name: string, delta: [number, number, number]): GlbReport {
  return {
    ...report,
    nodes: report.nodes.map((n) => (n.name === name
      ? { ...n, worldPos: [n.worldPos[0] + delta[0], n.worldPos[1] + delta[1], n.worldPos[2] + delta[2]] as [number, number, number] }
      : n)),
  }
}

describe('checkSize', () => {
  const spec = deviceSpec()

  it('passes the exact size', async () => {
    const r = checkSize(await boxReport({ w: 0.1, h: 0.05, d: 0.2 }), spec)
    expect(r).toMatchObject({ gate: 'size', ok: true })
  })

  it('passes within 0.5 percent and fails at 1 percent', async () => {
    // d = 200 mm: 0.5 percent is 1 mm.
    expect(checkSize(await boxReport({ w: 0.1, h: 0.05, d: 0.2009 }), spec).ok).toBe(true)
    const bad = checkSize(await boxReport({ w: 0.1, h: 0.05, d: 0.202 }), spec)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('d')
    expect(bad.detail).toContain('202.00')
  })

  it('size tolerance is at least 0.5 mm for a 6 mm part', async () => {
    const small = deviceSpec({ realSizeMm: { w: 6, h: 6, d: 6 } })
    expect(checkSize(await boxReport({ w: 0.0064, h: 0.006, d: 0.006 }), small).ok).toBe(true)
    expect(checkSize(await boxReport({ w: 0.0066, h: 0.006, d: 0.006 }), small).ok).toBe(false)
  })

  it('size tolerance is 0.5 percent for a 468 mm part', async () => {
    const big = deviceSpec({ realSizeMm: { w: 468, h: 50, d: 200 } })
    // 0.5 percent of 468 mm is 2.34 mm.
    expect(checkSize(await boxReport({ w: 0.4703, h: 0.05, d: 0.2 }), big).ok).toBe(true)
    expect(checkSize(await boxReport({ w: 0.4704, h: 0.05, d: 0.2 }), big).ok).toBe(false)
  })

  it.each([
    ['w', (e: number) => ({ w: 0.006 + e, h: 0.006, d: 0.006 })],
    ['h', (e: number) => ({ w: 0.006, h: 0.006 + e, d: 0.006 })],
    ['d', (e: number) => ({ w: 0.006, h: 0.006, d: 0.006 + e })],
  ] as const)('only the %s axis off: 0.4 mm passes, 0.6 mm fails, and the detail names the axis', async (axis, size) => {
    const small = deviceSpec({ realSizeMm: { w: 6, h: 6, d: 6 } })
    expect(checkSize(await boxReport(size(0.0004)), small).ok).toBe(true)
    const bad = checkSize(await boxReport(size(0.0006)), small)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain(`${axis} measures`)
  })

  it('fails closed on a NaN bbox', () => {
    const r = checkSize(reportOf({ bboxM: { min: [-0.05, Number.NaN, -0.1], max: [0.05, 0.05, 0.1] } }), spec)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/not finite/i)
  })

  it('measures the world bbox, so an unapplied root scale shows up', async () => {
    const r = await inspectGlb(await makeBoxGlb({ sizeM: { w: 10, h: 5, d: 20 }, scale: 0.01 }))
    expect(checkSize(r, spec).ok).toBe(true)
  })
})

describe('checkTransform', () => {
  it('passes a bottom-centre pivot with scale 1 and no rotation', async () => {
    const r = checkTransform(await boxReport({ w: 0.1, h: 0.05, d: 0.2 }), deviceSpec())
    expect(r).toMatchObject({ gate: 'transform', ok: true })
  })

  it('transform fails for a negative scale', async () => {
    const report = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, scale: -1 }))
    const r = checkTransform(report, deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/negative/i)
  })

  it('fails a scale that is not 1', async () => {
    const report = await inspectGlb(await makeBoxGlb({ sizeM: { w: 10, h: 5, d: 20 }, scale: 0.01 }))
    const r = checkTransform(report, deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/scale/i)
  })

  it('fails a rotated root', async () => {
    const report = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, rotateYDeg: 90 }))
    const r = checkTransform(report, deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/rotation/i)
  })

  it('accepts the negated identity quaternion', () => {
    expect(checkTransform(reportOf({ rootRotation: [0, 0, 0, -1] }), deviceSpec()).ok).toBe(true)
  })

  it('fails more than one top-level node', async () => {
    const report = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, strayRoots: [{ name: 'extra' }] }))
    const r = checkTransform(report, deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('2')
  })

  it('device pivot is bottom-centre within 0.5 mm', async () => {
    const ok = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, meshOnChild: { pos: [0.0004, 0.0004, -0.0004] } }))
    expect(checkTransform(ok, deviceSpec()).ok).toBe(true)
    const lifted = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, meshOnChild: { pos: [0, 0.0006, 0] } }))
    const r = checkTransform(lifted, deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/pivot/i)
    const shifted = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, meshOnChild: { pos: [0, 0, 0.0006] } }))
    expect(checkTransform(shifted, deviceSpec()).ok).toBe(false)
  })

  it('a device centred on y (pivot at mid-height) fails', async () => {
    const report = await inspectGlb(await makeBoxGlb({ sizeM: { w: 0.1, h: 0.05, d: 0.2 }, meshOnChild: { pos: [0, -0.025, 0] } }))
    expect(checkTransform(report, deviceSpec()).ok).toBe(false)
  })

  it('scale 1.001 fails and 1 + 1e-7 passes', () => {
    const bad = checkTransform(reportOf({ rootScale: [1.001, 1, 1] }), deviceSpec())
    expect(bad.ok).toBe(false)
    expect(bad.detail).toMatch(/scale/i)
    expect(checkTransform(reportOf({ rootScale: [1 + 1e-7, 1, 1 - 1e-7] }), deviceSpec()).ok).toBe(true)
  })

  it('device: the x-centre alone off by 0.6 mm fails, 0.4 mm passes', async () => {
    const size = { w: 0.1, h: 0.05, d: 0.2 }
    expect(checkTransform(await inspectGlb(await makeBoxGlb({ sizeM: size, meshOnChild: { pos: [0.0004, 0, 0] } })), deviceSpec()).ok).toBe(true)
    const bad = checkTransform(await inspectGlb(await makeBoxGlb({ sizeM: size, meshOnChild: { pos: [0.0006, 0, 0] } })), deviceSpec())
    expect(bad.ok).toBe(false)
    expect(bad.detail).toMatch(/centred/i)
  })

  it('connector: the x-centre alone off by 0.6 mm fails, 0.4 mm passes', async () => {
    const size = { w: 0.006, h: 0.006, d: 0.02 }
    expect(checkTransform(await inspectGlb(await makeBoxGlb({ sizeM: size, meshOnChild: { pos: [0.0004, -0.003, 0.01] } })), connectorSpec()).ok).toBe(true)
    const bad = checkTransform(await inspectGlb(await makeBoxGlb({ sizeM: size, meshOnChild: { pos: [0.0006, -0.003, 0.01] } })), connectorSpec())
    expect(bad.ok).toBe(false)
    expect(bad.detail).toMatch(/centre/i)
  })

  it('fails closed on NaN in the scale, the rotation and the bbox', () => {
    const scale = checkTransform(reportOf({ rootScale: [Number.NaN, 1, 1] }), deviceSpec())
    expect(scale.ok).toBe(false)
    expect(scale.detail).toMatch(/scale.*not finite/i)
    const rot = checkTransform(reportOf({ rootRotation: [0, 0, 0, Number.NaN] }), deviceSpec())
    expect(rot.ok).toBe(false)
    expect(rot.detail).toMatch(/rotation.*not finite/i)
    for (const spec of [deviceSpec(), connectorSpec()]) {
      const box = checkTransform(reportOf({ bboxM: { min: [Number.NaN, 0, 0], max: [0.05, 0.05, 0.1] } }), spec)
      expect(box.ok).toBe(false)
      expect(box.detail).toMatch(/bbox.*not finite/i)
    }
  })

  describe('connector pivot is the mating-face centre', () => {
    const spec = connectorSpec()
    // The box helper is bottom-centre; moving the mesh child by (0, -h/2, +d/2) puts z in [0, d] and x, y centred.
    const sizeM = { w: 0.006, h: 0.006, d: 0.02 }

    it('passes with the body along +Z from the mating face', async () => {
      const report = await inspectGlb(await makeBoxGlb({ sizeM, meshOnChild: { pos: [0, -0.003, 0.01] } }))
      expect(checkTransform(report, spec)).toMatchObject({ gate: 'transform', ok: true })
    })

    it('passes at 0.4 mm and fails at 0.6 mm off the face', async () => {
      const near = await inspectGlb(await makeBoxGlb({ sizeM, meshOnChild: { pos: [0, -0.003, 0.0104] } }))
      expect(checkTransform(near, spec).ok).toBe(true)
      const far = await inspectGlb(await makeBoxGlb({ sizeM, meshOnChild: { pos: [0, -0.003, 0.0106] } }))
      expect(checkTransform(far, spec).ok).toBe(false)
    })

    it('fails a body centred on the origin (device-style pivot)', async () => {
      const report = await inspectGlb(await makeBoxGlb({ sizeM }))
      const r = checkTransform(report, spec)
      expect(r.ok).toBe(false)
      expect(r.detail).toMatch(/mating/i)
    })

    it('fails a body extending along -Z', async () => {
      const report = await inspectGlb(await makeBoxGlb({ sizeM, meshOnChild: { pos: [0, -0.003, -0.01] } }))
      expect(checkTransform(report, spec).ok).toBe(false)
    })

    it('fails a body off-centre in y', async () => {
      const report = await inspectGlb(await makeBoxGlb({ sizeM, meshOnChild: { pos: [0, 0, 0.01] } }))
      expect(checkTransform(report, spec).ok).toBe(false)
    })
  })
})

describe('checkParts', () => {
  const spec = deviceSpec()
  const placement = buildPlacement(spec)

  it('passes exactly the placement names', async () => {
    const r = checkParts(await boxReport(placement.sizeM, placedNodes(placement)), placement)
    expect(r).toMatchObject({ gate: 'parts', ok: true })
  })

  it('allows a mesh node besides the root', async () => {
    const report = withNodeNames(reportOf(), ['body', 'port_in-mic-1', 'ctrl_gain'])
    expect(checkParts(report, placement).ok).toBe(true)
  })

  it('parts fails on a suffixed name port_in-mic-1.001', async () => {
    const nodes = placedNodes(placement).map((n) => (n.name === 'port_in-mic-1' ? { ...n, name: 'port_in-mic-1.001' } : n))
    const r = checkParts(await boxReport(placement.sizeM, nodes), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('port_in-mic-1.001')
    expect(r.detail).toMatch(/suffix/i)
  })

  it('parts fails on a stray Cube node', async () => {
    const nodes = [...placedNodes(placement), { name: 'Cube', pos: [0, 0, 0] as [number, number, number] }]
    const r = checkParts(await boxReport(placement.sizeM, nodes), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('Cube')
  })

  it.each(['Camera', 'Light', 'cube', 'Light.002'])('fails a stray %s node', async (name) => {
    const report = withNodeNames(reportOf(), ['port_in-mic-1', 'ctrl_gain', name])
    const r = checkParts(report, placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain(name)
  })

  it('fails a numeric suffix on a plain node', () => {
    const report = withNodeNames(reportOf(), ['port_in-mic-1', 'ctrl_gain', 'body.001'])
    const r = checkParts(report, placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('body.001')
  })

  it('a dotted id such as out-6.35 is fine, the exporter suffix .001 is not', () => {
    const dotted = buildPlacement(deviceSpec({
      ports: [{ portId: 'out-6.35', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }],
      controls: [],
    }))
    expect(checkParts(withNodeNames(reportOf(), ['port_out-6.35']), dotted).ok).toBe(true)
    const bad = checkParts(withNodeNames(reportOf(), ['port_out.001']), buildPlacement(deviceSpec({
      ports: [{ portId: 'out', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }],
      controls: [],
    })))
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('port_out.001')
    expect(bad.detail).toMatch(/suffix/i)
  })

  it('parts fails when a control is missing', async () => {
    const nodes = placedNodes(placement).filter((n) => n.name !== 'ctrl_gain')
    const r = checkParts(await boxReport(placement.sizeM, nodes), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/missing/i)
    expect(r.detail).toContain('ctrl_gain')
  })

  it('fails when a port is missing', async () => {
    const nodes = placedNodes(placement).filter((n) => n.name !== 'port_in-mic-1')
    const r = checkParts(await boxReport(placement.sizeM, nodes), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('port_in-mic-1')
  })

  it('fails an extra port_ or ctrl_ node that the placement does not have', async () => {
    const nodes = [...placedNodes(placement), { name: 'port_extra', pos: [0, 0, 0] as [number, number, number] }, { name: 'ctrl_extra', pos: [0, 0, 0] as [number, number, number] }]
    const r = checkParts(await boxReport(placement.sizeM, nodes), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/extra/i)
    expect(r.detail).toContain('port_extra')
    expect(r.detail).toContain('ctrl_extra')
  })

  it('fails a duplicated port node', () => {
    const report = withNodeNames(reportOf(), ['port_in-mic-1', 'port_in-mic-1', 'ctrl_gain'])
    expect(checkParts(report, placement).ok).toBe(false)
  })

  it('a connector placement (no ports, no controls) passes a bare mesh', () => {
    const r = checkParts(withNodeNames(reportOf(), ['body']), buildPlacement(connectorSpec()))
    expect(r.ok).toBe(true)
  })
})

describe('checkPortPositions', () => {
  const spec = deviceSpec()
  const placement = buildPlacement(spec)
  const sizeM = placement.sizeM
  const port = 'port_in-mic-1'

  it('passes ports and controls at their placed positions', async () => {
    const r = checkPortPositions(await boxReport(sizeM, placedNodes(placement)), placement)
    expect(r).toMatchObject({ gate: 'portPositions', ok: true })
  })

  it('port position fails at 0.4 mm off and passes at 0.2 mm off', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    expect(checkPortPositions(moveNode(base, port, [0.2 * MM, 0, 0]), placement).ok).toBe(true)
    const bad = checkPortPositions(moveNode(base, port, [0.4 * MM, 0, 0]), placement)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain(port)
  })

  it('a control is held to the same 0.3 mm rule', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    expect(checkPortPositions(moveNode(base, 'ctrl_gain', [0, 0, 0.2 * MM]), placement).ok).toBe(true)
    const bad = checkPortPositions(moveNode(base, 'ctrl_gain', [0, 0, 0.4 * MM]), placement)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('ctrl_gain')
  })

  it('Euclidean tolerance: 0.2 mm on any single axis passes, a 0.2/0.2/0.2 mm diagonal (0.346 mm) fails', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    const d = 0.2 * MM
    for (const delta of [[d, 0, 0], [0, d, 0], [0, 0, d]] as [number, number, number][]) {
      expect(checkPortPositions(moveNode(base, 'ctrl_gain', delta), placement).ok).toBe(true)
    }
    const bad = checkPortPositions(moveNode(base, 'ctrl_gain', [d, d, d]), placement)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('ctrl_gain')
    expect(bad.detail).toContain('0.35')
  })

  it('face plane tolerance is 0.2 mm: 0.15 mm off passes, 0.25 mm off fails', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    const withMaxZ = (z: number): GlbReport => ({ ...base, bboxM: { min: base.bboxM.min, max: [0.05, 0.05, z] } })
    expect(checkPortPositions(withMaxZ(0.1 + 0.15 * MM), placement).ok).toBe(true)
    const bad = checkPortPositions(withMaxZ(0.1 + 0.25 * MM), placement)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toMatch(/face plane/i)
  })

  it('fails closed on NaN in a node position and in the bbox', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    const nanPort = { ...base, nodes: base.nodes.map((n) => (n.name === port ? { ...n, worldPos: [Number.NaN, 0.025, 0.1] as [number, number, number] } : n)) }
    const a = checkPortPositions(nanPort, placement)
    expect(a.ok).toBe(false)
    expect(a.detail).toMatch(/not finite/i)
    const nanCtrl = { ...base, nodes: base.nodes.map((n) => (n.name === 'ctrl_gain' ? { ...n, worldPos: [0, Number.NaN, 0] as [number, number, number] } : n)) }
    expect(checkPortPositions(nanCtrl, placement).ok).toBe(false)
    const nanBox = { ...base, bboxM: { min: [-0.05, 0, Number.NaN] as [number, number, number], max: base.bboxM.max } }
    const b = checkPortPositions(nanBox, placement)
    expect(b.ok).toBe(false)
    expect(b.detail).toMatch(/bbox.*not finite/i)
  })

  it('a port left at the origin fails', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    const r = checkPortPositions(moveNode(base, port, [0.03, -0.025, -0.1]), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain(port)
  })

  it('fails a node that is not in the report', async () => {
    const base = await boxReport(sizeM, placedNodes(placement).filter((n) => n.name !== port))
    const r = checkPortPositions(base, placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain(port)
  })

  it('port off the face plane fails: the real body face is 1 mm further out', async () => {
    // The port sits at its placed z = +100 mm, but the measured body reaches z = +101 mm.
    const base = await boxReport(sizeM, placedNodes(placement))
    const report = { ...base, bboxM: { min: base.bboxM.min, max: [0.05, 0.05, 0.101] as [number, number, number] } }
    const r = checkPortPositions(report, placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain(port)
    expect(r.detail).toMatch(/face plane/i)
  })

  it('a port 0.1 mm off the real face plane still passes', async () => {
    const base = await boxReport(sizeM, placedNodes(placement))
    const report = { ...base, bboxM: { min: base.bboxM.min, max: [0.05, 0.05, 0.1001] as [number, number, number] } }
    expect(checkPortPositions(report, placement).ok).toBe(true)
  })

  it('uses the minimum extreme for a negative outward component', async () => {
    const opposite = buildPlacement(deviceSpec({
      ports: [{ portId: 'back', face: 'opposite', xMm: 20, yMm: 25, confidence: 'manual' }],
      controls: [],
    }))
    const base = await boxReport(opposite.sizeM, placedNodes(opposite))
    expect(checkPortPositions(base, opposite).ok).toBe(true)
    const deeper = { ...base, bboxM: { min: [-0.05, 0, -0.1015] as [number, number, number], max: base.bboxM.max } }
    expect(checkPortPositions(deeper, opposite).ok).toBe(false)
  })

  it('uses the y extremes for a top-face port', async () => {
    const top = buildPlacement(deviceSpec({
      ports: [{ portId: 'phones', face: 'top', xMm: 50, yMm: 100, confidence: 'manual' }],
      controls: [],
    }))
    const base = await boxReport(top.sizeM, placedNodes(top))
    expect(checkPortPositions(base, top).ok).toBe(true)
    const taller = { ...base, bboxM: { min: base.bboxM.min, max: [0.05, 0.0505, 0.1] as [number, number, number] } }
    expect(checkPortPositions(taller, top).ok).toBe(false)
  })

  it('port outside the face rectangle fails', async () => {
    // The io port is at x = -30 mm; the measured body only spans x in [-20, +50] mm.
    const base = await boxReport(sizeM, placedNodes(placement))
    const report = { ...base, bboxM: { min: [-0.02, 0, -0.1] as [number, number, number], max: base.bboxM.max } }
    const r = checkPortPositions(report, placement)
    expect(r.ok).toBe(false)
    expect(r.detail).toContain(port)
    expect(r.detail).toMatch(/face rectangle/i)
  })

  it('a control is not required to sit on a face plane', async () => {
    // Move the knob 5 mm up above the top face: only the 0.3 mm rule applies, so this fails on position, not on the plane.
    const base = await boxReport(sizeM, placedNodes(placement))
    const r = checkPortPositions(moveNode(base, 'ctrl_gain', [0, 0.005, 0]), placement)
    expect(r.ok).toBe(false)
    expect(r.detail).not.toMatch(/face plane/i)
  })
})

describe('checkBudget', () => {
  it('budget fails a connector at 801 triangles and passes at 800', () => {
    const spec = connectorSpec()
    expect(checkBudget(reportOf({ triangles: 800 }), spec)).toMatchObject({ gate: 'budget', ok: true })
    const bad = checkBudget(reportOf({ triangles: 801 }), spec)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('801')
  })

  it('has no floor: a tiny connector passes', () => {
    expect(checkBudget(reportOf({ triangles: 12 }), connectorSpec()).ok).toBe(true)
  })

  it.each(['standard', 'hero'] as const)('%s tier passes at 4000 triangles and fails at 4001', (tier) => {
    const spec = deviceSpec({ tier })
    expect(checkBudget(reportOf({ triangles: 4000 }), spec).ok).toBe(true)
    expect(checkBudget(reportOf({ triangles: 4001 }), spec).ok).toBe(false)
  })

  it('fails two materials', () => {
    const r = checkBudget(reportOf({ materials: 2 }), deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/material/i)
  })

  it('passes one material and none', () => {
    expect(checkBudget(reportOf({ materials: 1 }), deviceSpec()).ok).toBe(true)
    expect(checkBudget(reportOf({ materials: 0 }), deviceSpec()).ok).toBe(true)
  })

  it('fails closed on NaN triangles or materials', () => {
    const t = checkBudget(reportOf({ triangles: Number.NaN }), deviceSpec())
    expect(t.ok).toBe(false)
    expect(t.detail).toMatch(/triangles.*not finite/i)
    expect(checkBudget(reportOf({ materials: Number.NaN }), deviceSpec()).ok).toBe(false)
  })

  it('reports both problems in one detail', () => {
    const r = checkBudget(reportOf({ triangles: 5000, materials: 3 }), deviceSpec())
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('5000')
    expect(r.detail).toMatch(/material/i)
  })
})

describe('checkConnectorFit', () => {
  const socket = (openingMm: number | undefined): AssetSpecT => connectorSpec({ id: 'sock', mating: { role: 'socket', openingMm } })
  const plug = (outerMm: number | undefined): AssetSpecT => connectorSpec({ id: 'plg', mating: { role: 'plug', outerMm } })

  it('connector fit passes 0.2 mm under, fails 0.5 mm under, and fails oversize', () => {
    expect(checkConnectorFit(plug(6.1), socket(6.3))).toMatchObject({ gate: 'connectorFit', ok: true })
    const loose = checkConnectorFit(plug(5.8), socket(6.3))
    expect(loose.ok).toBe(false)
    expect(loose.detail).toContain('0.50')
    const tight = checkConnectorFit(plug(6.4), socket(6.3))
    expect(tight.ok).toBe(false)
    expect(tight.detail).toMatch(/oversize|larger/i)
  })

  it('passes an exact fit and exactly 0.3 mm under', () => {
    expect(checkConnectorFit(plug(6.3), socket(6.3)).ok).toBe(true)
    expect(checkConnectorFit(plug(6.0), socket(6.3)).ok).toBe(true)
  })

  it('fails when the plug outer diameter is missing', () => {
    const r = checkConnectorFit(plug(undefined), socket(6.3))
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('outerMm')
  })

  it('fails when the socket opening is missing', () => {
    const r = checkConnectorFit(plug(6.1), socket(undefined))
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('openingMm')
  })

  it('fails closed on a NaN or non-finite outerMm or openingMm, naming the value', () => {
    for (const [p, s, field] of [
      [Number.NaN, 6.3, 'outerMm'],
      [6.1, Number.NaN, 'openingMm'],
      [Number.POSITIVE_INFINITY, 6.3, 'outerMm'],
      [6.1, Number.POSITIVE_INFINITY, 'openingMm'],
      [Number.NEGATIVE_INFINITY, 6.3, 'outerMm'],
    ] as const) {
      const r = checkConnectorFit(plug(p), socket(s))
      expect(r.ok).toBe(false)
      expect(r.detail).toContain(field)
      expect(r.detail).toMatch(/not finite/)
    }
  })

  it('fails when a spec has no mating block', () => {
    const r = checkConnectorFit(connectorSpec({ mating: undefined }), socket(6.3))
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/mating/i)
  })

  it('fails when the roles are not plug and socket', () => {
    expect(checkConnectorFit(socket(6.3), socket(6.3)).ok).toBe(false)
    expect(checkConnectorFit(plug(6.1), plug(6.1)).ok).toBe(false)
    const swapped = checkConnectorFit(socket(6.3), plug(6.1))
    expect(swapped.ok).toBe(false)
    expect(swapped.detail).toMatch(/role/i)
  })
})

describe('checkProportionDrift', () => {
  const spec = deviceSpec() // 100 x 50 x 200 mm, d is the largest axis

  it('passes an exact copy and a uniformly scaled copy', () => {
    expect(checkProportionDrift({ w: 0.1, h: 0.05, d: 0.2 }, spec)).toMatchObject({ gate: 'proportionDrift', ok: true })
    expect(checkProportionDrift({ w: 10, h: 5, d: 20 }, spec).ok).toBe(true)
  })

  it('proportion drift fails at 6 percent and passes at 4 percent', () => {
    const bad = checkProportionDrift({ w: 0.106, h: 0.05, d: 0.2 }, spec)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('6.0')
    const ok = checkProportionDrift({ w: 0.104, h: 0.05, d: 0.2 }, spec)
    expect(ok.ok).toBe(true)
    expect(ok.detail).toContain('4.0')
  })

  it('measures drift on any axis, in either direction', () => {
    expect(checkProportionDrift({ w: 0.1, h: 0.047, d: 0.2 }, spec).ok).toBe(false) // h 6 percent small
    expect(checkProportionDrift({ w: 0.1, h: 0.05, d: 0.18 }, spec).ok).toBe(false) // d shrinks 10 percent, so w and h read 11 percent large
  })

  it('exactly 5 percent passes, 5.1 percent fails, and the printed percent has two decimals', () => {
    // 0.1 * 1.05 is 0.10500000000000001: its drift is 0.050000000000000044 in floating point, ABOVE 0.05, so this
    // passes only thanks to the 1e-9 slack (0.105 itself would land below 0.05 and pin nothing)
    const w = 0.1 * 1.05
    expect(Math.abs(w / 0.1 - 1) > 0.05).toBe(true)
    const exact = checkProportionDrift({ w, h: 0.05, d: 0.2 }, spec)
    expect(exact.ok).toBe(true)
    expect(exact.detail).toContain('5.00 %')
    const bad = checkProportionDrift({ w: 0.1051, h: 0.05, d: 0.2 }, spec)
    expect(bad.ok).toBe(false)
    expect(bad.detail).toContain('5.10 %')
  })

  it('fails closed on NaN or non-finite sizes', () => {
    expect(checkProportionDrift({ w: Number.NaN, h: 0.05, d: 0.2 }, spec).ok).toBe(false)
    expect(checkProportionDrift({ w: 0.1, h: 0.05, d: Number.POSITIVE_INFINITY }, spec).ok).toBe(false)
  })

  it('fails a non-positive or non-finite spec axis with a clear detail', () => {
    for (const w of [0, -100, Number.NaN]) {
      const r = checkProportionDrift({ w: 0.1, h: 0.05, d: 0.2 }, deviceSpec({ realSizeMm: { w, h: 50, d: 200 } }))
      expect(r.ok).toBe(false)
      expect(r.detail).toMatch(/spec/i)
    }
  })

  it('a permuted axis order drifts', () => {
    expect(checkProportionDrift({ w: 0.2, h: 0.05, d: 0.1 }, spec).ok).toBe(false)
  })

  it('fails a degenerate size', () => {
    expect(checkProportionDrift({ w: 0, h: 0, d: 0 }, spec).ok).toBe(false)
  })
})

describe('checkTextures', () => {
  const tex = (px: number, name = 'baseColor') => ({ name, width: px, height: px, mimeType: 'image/webp' })
  const standard = deviceSpec()
  const connector = connectorSpec()

  it('exports the tier limits', () => {
    expect(TEXTURE_MAX_PX).toEqual({ connector: 512, standard: 1024, hero: 1024 })
    expect(FILE_BYTES_MAX).toEqual({ connector: 250_000, standard: 1_500_000, hero: 1_500_000 })
  })

  it('textures gate: 1024 px passes, 1025 px fails for standard; 512 passes and 513 fails for connector; file size at the maximum passes and one byte over fails; missing or NaN data fails closed', () => {
    expect(checkTextures(reportOf({ textures: [tex(1024)] }), standard)).toMatchObject({ gate: 'textures', ok: true })
    const big = checkTextures(reportOf({ textures: [tex(1025, 'normal')] }), standard)
    expect(big.ok).toBe(false)
    expect(big.detail).toMatch(/normal/)
    expect(big.detail).toMatch(/1025/)
    expect(big.detail).toMatch(/1024/)
    // the longest side counts, not the first
    expect(checkTextures(reportOf({ textures: [{ name: 'tall', width: 16, height: 1025, mimeType: 'image/webp' }] }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ textures: [tex(1024), tex(1024, 'normal')] }), deviceSpec({ tier: 'hero' })).ok).toBe(true)

    expect(checkTextures(reportOf({ textures: [tex(512)] }), connector).ok).toBe(true)
    expect(checkTextures(reportOf({ textures: [tex(513)] }), connector).ok).toBe(false)

    expect(checkTextures(reportOf({ fileBytes: 1_500_000 }), standard).ok).toBe(true)
    const over = checkTextures(reportOf({ fileBytes: 1_500_001 }), standard)
    expect(over.ok).toBe(false)
    expect(over.detail).toMatch(/1500001/)
    expect(over.detail).toMatch(/1500000/)
    expect(checkTextures(reportOf({ fileBytes: 250_000 }), connector).ok).toBe(true)
    expect(checkTextures(reportOf({ fileBytes: 250_001 }), connector).ok).toBe(false)

    // fail closed
    expect(checkTextures(reportOf({ fileBytes: Number.NaN }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ fileBytes: Number.POSITIVE_INFINITY }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ fileBytes: undefined as unknown as number }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ textures: [{ ...tex(512), width: Number.NaN }] }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ textures: [{ ...tex(512), height: undefined as unknown as number }] }), standard).ok).toBe(false)
    expect(checkTextures(reportOf({ textures: undefined as unknown as GlbReport['textures'] }), standard).ok).toBe(false)
  })

  it('a model without textures passes when its file size is within the limit', () => {
    const r = checkTextures(reportOf({ textures: [], fileBytes: 70_000 }), standard)
    expect(r.ok).toBe(true)
    expect(r.detail).toMatch(/70000/)
  })

  it('lists every problem at once', () => {
    const r = checkTextures(reportOf({ textures: [tex(2048, 'a'), tex(2048, 'b')], fileBytes: 9_000_000 }), standard)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/a/)
    expect(r.detail).toMatch(/b/)
    expect(r.detail).toMatch(/9000000/)
  })
})

describe('runGates', () => {
  const spec = deviceSpec()
  const placement = buildPlacement(spec)

  it('returns size, transform, parts, portPositions, budget in that order, all passing for a clean asset', async () => {
    const results = runGates(await boxReport(placement.sizeM, placedNodes(placement)), spec, placement)
    expect(results.map((r) => r.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget'])
    expect(results.filter((r) => !r.ok)).toEqual([])
  })

  it('never short-circuits: every gate reports even when all fail', () => {
    const broken = reportOf({
      bboxM: { min: [0, 0.2, 0], max: [1, 1, 1] },
      triangles: 99999,
      materials: 4,
      topLevelCount: 2,
      rootScale: [-1, 1, 1],
      nodeNames: ['root', 'Cube'],
      nodes: [{ name: 'root', worldPos: [0, 0, 0], hasMesh: true }, { name: 'Cube', worldPos: [0, 0, 0], hasMesh: false }],
    })
    const results = runGates(broken, spec, placement)
    expect(results.map((r) => r.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget'])
    expect(results.every((r) => !r.ok)).toBe(true)
    expect(results.every((r) => r.detail.length > 0)).toBe(true)
  })
})
