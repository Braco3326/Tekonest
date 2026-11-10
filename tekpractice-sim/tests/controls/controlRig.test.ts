/**
 * ControlRig on a headless scene (NullEngine): the parts exist at the right place, a value moves its part the right way, a hit pad
 * carries the control's identity, meters step, and disposal leaves nothing behind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Ray, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { ControlBank } from '../../src/controls/controlBank'
import { ControlRig } from '../../src/controls/controlRig'
import { controlHit } from '../../src/controls/controlHit'
import { parseControlLayout } from '../../src/controls/controlTypes'

/** The rig's label / dial textures draw on a 2D canvas: a do-nothing one headless. */
function fakeCanvas2d() {
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}
const g = globalThis as Record<string, unknown>
let savedDoc: unknown
beforeEach(() => {
  savedDoc = g.document
  g.document = { createElement: fakeCanvas2d, addEventListener() {}, removeEventListener() {} }
})
afterEach(() => {
  g.document = savedDoc
})

const SIZE = { w: 400, h: 100, d: 300 }
const RAW = {
  schema: 1,
  deviceId: 'dev',
  controls: [
    { id: 'fader', kind: 'fader', face: 'top', xMm: 200, yMm: 100, axis: 'y', travelMm: 100, default: 0, slot: true, sizeMm: { w: 14, h: 30, d: 12 } },
    { id: 'fader-x', kind: 'fader', face: 'top', xMm: 50, yMm: 200, axis: 'x', travelMm: 80, default: 0, sizeMm: { w: 30, h: 14, d: 12 } },
    { id: 'knob', kind: 'knob', face: 'top', xMm: 300, yMm: 100, default: 0.5, sweepDeg: 270, sizeMm: { w: 20, h: 20, d: 14 } },
    { id: 'key', kind: 'button', face: 'top', xMm: 100, yMm: 50, default: 0, label: 'ON', travelMm: 2, sizeMm: { w: 17, h: 19, d: 5 } },
    { id: 'sw', kind: 'switch', face: 'top', xMm: 120, yMm: 50, positions: 3, default: 1, sizeMm: { w: 10, h: 10, d: 12 } },
    { id: 'led', kind: 'led', face: 'top', xMm: 140, yMm: 50, sizeMm: { w: 4, h: 4, d: 2 } },
    { id: 'bar', kind: 'meter', face: 'top', xMm: 200, yMm: 20, axis: 'x', sizeMm: { w: 120, h: 5, d: 1.5 }, meter: { style: 'bar', source: 'bus', segments: 12, fromDb: -48, toDb: 0 } },
    { id: 'vu', kind: 'meter', face: 'top', xMm: 320, yMm: 20, sizeMm: { w: 50, h: 35, d: 4 }, meter: { style: 'vu', source: 'bus' } },
  ],
}

function build() {
  const scene = new Scene(new NullEngine())
  const root = new TransformNode('dev', scene)
  const { layout, errors } = parseControlLayout(RAW)
  expect(errors).toEqual([])
  const bank = new ControlBank(layout!.controls)
  const rig = new ControlRig(scene, root, 'd1', bank, SIZE)
  return { scene, root, bank, rig }
}

const local = (rig: ControlRig, id: string): Vector3 => {
  const part = rig.part(id)!
  part.mover.computeWorldMatrix(true)
  return part.mover.position.clone()
}

describe('ControlRig', () => {
  it('builds one part per control and reports its meters', () => {
    const { rig } = build()
    expect(rig.size).toBe(8)
    expect(rig.hasMeters).toBe(true)
  })

  it('puts a control node at its real place on the face (top face, root frame, I/O edge at -Z)', () => {
    const { rig } = build()
    const p = rig.part('fader')!.node.position
    expect(p.x).toBeCloseTo(0, 6) // 200 mm of 400
    expect(p.y).toBeCloseTo(0.1, 6) // on the top face
    expect(p.z).toBeCloseTo(-0.15 + 0.1, 6) // 100 mm in from the I/O edge
  })

  it('a fader value slides the cap along its travel axis (y of the face -> local z, x -> local x), 0 at the start, 1 at the end', () => {
    const { rig, bank } = build()
    expect(local(rig, 'fader').z).toBeCloseTo(0, 9)
    bank.set('fader', 1)
    expect(local(rig, 'fader').z).toBeCloseTo(0.1, 9)
    bank.set('fader', 0.25)
    expect(local(rig, 'fader').z).toBeCloseTo(0.025, 9)
    bank.set('fader-x', 1)
    expect(local(rig, 'fader-x').x).toBeCloseTo(0.08, 9)
    expect(local(rig, 'fader-x').z).toBeCloseTo(0, 9)
  })

  it('exposes a fader slide as world geometry: origin at the start, a unit direction, its length', () => {
    const { rig } = build()
    const s = rig.slideOf('fader')!
    expect(s.length).toBeCloseTo(0.1, 6)
    expect(s.dir.length()).toBeCloseTo(1, 6)
    expect(s.normal.y).toBeCloseTo(1, 6)
    // top face y grows toward the front (+Z in the scene)
    expect(s.dir.z).toBeCloseTo(1, 6)
    expect(rig.slideOf('knob')).toBeNull()
  })

  it('a knob turns about the face normal by its sweep, centred at 0.5', () => {
    const { rig, bank } = build()
    expect(rig.part('knob')!.mover.rotation.y).toBeCloseTo(0, 9)
    bank.set('knob', 1)
    expect(rig.part('knob')!.mover.rotation.y).toBeCloseTo((270 / 2) * (Math.PI / 180), 9)
    bank.set('knob', 0)
    expect(rig.part('knob')!.mover.rotation.y).toBeCloseTo(-(270 / 2) * (Math.PI / 180), 9)
  })

  it('a key sinks by its travel when on; a switch tilts to its position', () => {
    const { rig, bank } = build()
    expect(rig.part('key')!.mover.position.y).toBe(0)
    bank.set('key', 1)
    expect(rig.part('key')!.mover.position.y).toBeCloseTo(-0.002, 9)
    expect(rig.part('sw')!.mover.rotation.x).toBeCloseTo(0, 9) // middle of 3
    bank.set('sw', 2)
    expect(rig.part('sw')!.mover.rotation.x).toBeGreaterThan(0.4)
    bank.set('sw', 0)
    expect(rig.part('sw')!.mover.rotation.x).toBeLessThan(-0.4)
  })

  it('a hit pad carries the control identity; only operable controls have one', () => {
    const { rig } = build()
    const hits = rig.pads().map((p) => controlHit(p)?.controlId)
    expect(hits.sort()).toEqual(['fader', 'fader-x', 'key', 'knob', 'sw'])
    expect(controlHit(rig.pads()[0])).toMatchObject({ isControl: true, instanceId: 'd1' })
    expect(rig.pads().every((p) => p.isPickable && p.visibility === 0)).toBe(true)
    expect(controlHit(null)).toBeNull()
  })

  it('meters step: a bar lights segments for a hot level and falls back; a VU needle swings', () => {
    const { rig } = build()
    const needle = rig.part('vu')!.mover
    const segMat = (): string[] => rig.part('bar')!.node.getChildMeshes().map((m) => m.material?.name ?? '')
    rig.levels = () => -3
    for (let t = 16; t < 1500; t += 16) rig.update(t)
    const hot = segMat().filter((n) => n.includes('bar-on')).length
    expect(hot).toBeGreaterThanOrEqual(11)
    expect(needle.rotation.y).toBeGreaterThan(0.5)
    rig.levels = () => -90
    for (let t = 1500; t < 6000; t += 16) rig.update(t)
    expect(segMat().filter((n) => n.includes('bar-on')).length).toBeLessThan(hot)
    expect(needle.rotation.y).toBeLessThan(-0.7)
  })

  it('metersLive = false freezes the meters (a device that is off)', () => {
    const { rig } = build()
    rig.metersLive = false
    expect(rig.update(100)).toBe(false)
  })

  it('hover tints one control at a time and clears', () => {
    const { rig } = build()
    rig.setHover('fader')
    rig.setHover('knob')
    rig.setHover(null)
    expect(rig.size).toBe(8) // no throw, nothing lost
  })

  it('dispose removes the parts, the materials and the bank subscription', () => {
    const { scene, rig, bank } = build()
    rig.dispose()
    expect(rig.size).toBe(0)
    expect(scene.getTransformNodeByName('ctl:d1:fader')).toBeNull()
    expect(() => bank.set('fader', 0.5)).not.toThrow()
  })
})

describe('ControlRig: reverse faders and screens', () => {
  const RAW2 = {
    schema: 1,
    deviceId: 'dev',
    controls: [
      // value 0 at the front (y = 300 mm from the I/O edge), value 1 100 mm nearer the edge
      { id: 'rev', kind: 'fader', face: 'top', xMm: 100, yMm: 250, axis: 'y', travelMm: 100, reverse: true, default: 0, slot: true, sizeMm: { w: 14, h: 30, d: 12 } },
      { id: 'fader-1', kind: 'fader', face: 'top', xMm: 200, yMm: 250, axis: 'y', travelMm: 100, taper: 'fader-db', default: 0.75, sizeMm: { w: 14, h: 30, d: 12 } },
      { id: 'scr', kind: 'screen', face: 'top', xMm: 200, yMm: 100, sizeMm: { w: 200, h: 100, d: 2 }, screen: { app: 'mixer-overview', pxW: 400, pxH: 200 } },
    ],
  }

  function buildWithScreen() {
    let fills = 0
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'fillRect' ? () => fills++ : () => ({ width: 10, addColorStop() {} })), set: () => true })
    g.document = { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx }), addEventListener() {}, removeEventListener() {} }
    const scene = new Scene(new NullEngine())
    const root = new TransformNode('dev', scene)
    const { layout, errors } = parseControlLayout(RAW2)
    expect(errors).toEqual([])
    const bank = new ControlBank(layout!.controls)
    const rig = new ControlRig(scene, root, 'd1', bank, SIZE)
    return { scene, bank, rig, fills: () => fills }
  }

  it('a reverse fader travels toward the I/O edge: its cap moves to -z and its slide direction points toward the edge', () => {
    const { rig, bank } = buildWithScreen()
    bank.set('rev', 1)
    expect(rig.part('rev')!.mover.position.z).toBeCloseTo(-0.1, 9)
    const s = rig.slideOf('rev')!
    expect(s.dir.z).toBeCloseTo(-1, 6) // top face y grows toward +z; reverse flips it
    expect(rig.slideOf('fader-1')!.dir.z).toBeCloseTo(1, 6)
  })

  it('a screen draws its app on build, is a live part (the ticker runs for it), and redraws when a value changes or on the clock', () => {
    const { rig, bank, fills } = buildWithScreen()
    expect(rig.hasMeters).toBe(true)
    const first = fills()
    expect(first).toBeGreaterThan(0) // drawn when built
    expect(rig.update(1000)).toBe(true) // animated app: redraws on the clock
    const second = fills()
    expect(second).toBeGreaterThan(first)
    bank.set('fader-1', 0.4)
    rig.update(1010) // within 66 ms of the last draw: not yet
    expect(fills()).toBe(second)
    rig.update(1100)
    expect(fills()).toBeGreaterThan(second)
  })

  it('maps a picking ray to the canvas pixel under it, even past the glass edge, and a touch reaches the app', () => {
    const { rig, bank } = buildWithScreen()
    const part = rig.part('scr')!
    part.node.computeWorldMatrix(true)
    const c = part.node.getAbsolutePosition()
    const down = (dx: number, dz: number): Ray => new Ray(new Vector3(c.x + dx, c.y + 0.5, c.z + dz), new Vector3(0, -1, 0))
    // plane centre -> canvas centre
    expect(rig.screenPointAt('scr', down(0, 0))!.x).toBeCloseTo(200, 3)
    expect(rig.screenPointAt('scr', down(0, 0))!.y).toBeCloseTo(100, 3)
    // A screen on a TOP face is read from the front (the operator), so it is turned half a turn from the face axes: 50 mm toward the face's
    // right (world +x) is toward the LEFT of the canvas, and 25 mm toward the front (+z, the face's up) is toward the BOTTOM of it.
    const p = rig.screenPointAt('scr', down(0.05, 0.025))!
    expect(p.x).toBeCloseTo(100, 3)
    expect(p.y).toBeCloseTo(150, 3)
    expect(rig.screenPointAt('scr', down(0.2, 0))!.x).toBeLessThan(0) // beyond the edge: still a number
    expect(rig.screenPointAt('nope', down(0, 0))).toBeNull()
    // a touch on the first strip's track moves the fader the strip stands for
    const r = rig.screenTouch('scr', 'down', 200, 80)
    expect(r.handled).toBe(true)
    expect(bank.get('fader-1')).not.toBe(0.75)
    expect(rig.screenTouch('nope', 'down', 0, 0)).toEqual({ handled: false })
  })

  it('a screen whose app is unknown is skipped (logged), the rest of the layout still builds', () => {
    const scene = new Scene(new NullEngine())
    const root = new TransformNode('dev', scene)
    const { layout } = parseControlLayout({ ...RAW2, controls: [{ ...RAW2.controls[2], screen: { app: 'nope', pxW: 100, pxH: 100 } }, RAW2.controls[1]] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rig = new ControlRig(scene, root, 'd1', new ControlBank(layout!.controls), SIZE)
    expect(rig.size).toBe(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
