/** CableRenderer line cues and outline (mission 3, cable cues): one pattern per cable type, ONE mesh per cable, a dark underlay that is never a thing of its own. */
import { Color3, Mesh, NullEngine, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CABLE_TYPE_COLOUR, type CableType } from '../../src/design/cablePalette'
import { PIECE_MAX, cue3dOf } from '../../src/design/cablePattern'
import { CableRenderer, type CableOptions } from '../../src/scene/CableRenderer'
import { CableBudget } from '../../src/scene/cablePath'
import type { PortRef } from '../../src/engine/types'

const TYPES = Object.keys(CABLE_TYPE_COLOUR) as CableType[]
const OUTLINE = '#0A090B'
const p = (x: number, y = 0.05, z = 0): Vector3 => new Vector3(x, y, z)
/** The cable type is carried by the port name in these tests. */
const ends = (t: string): [PortRef, PortRef] => [{ instance: 'a', port: t }, { instance: 'b', port: t }]

/** Separate connected pieces of triangles in a mesh (1 = a continuous tube). */
function pieces(m: Mesh): number {
  const idx = m.getIndices()!
  const pos = m.getVerticesData('position')!
  // merged pieces may share no index; split by index connectivity, joining vertices at the same place (a tube's seam)
  const key = (v: number) => `${pos[v * 3]!.toFixed(5)},${pos[v * 3 + 1]!.toFixed(5)},${pos[v * 3 + 2]!.toFixed(5)}`
  const parent = new Map<string, string>()
  const find = (v: string): string => {
    let r = v
    while ((parent.get(r) ?? r) !== r) r = parent.get(r)!
    parent.set(v, r)
    return r
  }
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [find(key(idx[t]!)), find(key(idx[t + 1]!)), find(key(idx[t + 2]!))]
    parent.set(b, a)
    parent.set(find(c), find(a))
  }
  return new Set([...new Set(idx)].map((v) => find(key(v)))).size
}
const lowest = (m: Mesh): number => {
  const pos = m.getVerticesData('position')!
  let lo = Infinity
  for (let i = 1; i < pos.length; i += 3) lo = Math.min(lo, pos[i]!)
  return lo
}

describe('CableRenderer line cues', () => {
  let engine: NullEngine
  let scene: Scene
  beforeEach(() => {
    engine = new NullEngine()
    scene = new Scene(engine)
  })
  afterEach(() => {
    scene.dispose()
    engine.dispose()
  })
  const opts = (more: Partial<CableOptions> = {}): CableOptions => ({
    pulses: false,
    floorAt: () => 0,
    colorFor: (a) => Color3.FromHexString(CABLE_TYPE_COLOUR[a.port as CableType]),
    cueFor: (a) => cue3dOf(a.port as CableType),
    outline: OUTLINE,
    ...more,
  })
  const cableMeshes = () => scene.meshes.filter((m) => m.name.startsWith('cable:'))
  const main = (id: string) => scene.getMeshByName(`cable:${id}`) as Mesh
  const outline = (id: string) => scene.getMeshByName(`cable-outline:${id}`) as Mesh

  it('every cable type builds ONE mesh named like a plain cable, with its outline as a child that is not pickable and not a cable of its own', () => {
    const c = new CableRenderer(scene, new CableBudget(), opts())
    TYPES.forEach((t, i) => c.addCable(t, p(0, 0.05, i), p(3, 0.05, i), ends(t)))
    expect(cableMeshes().map((m) => m.name).sort()).toEqual(TYPES.map((t) => `cable:${t}`).sort())
    for (const t of TYPES) {
      const m = main(t)
      const o = outline(t)
      expect(m.isPickable, t).toBe(false)
      expect(o, t).toBeTruthy()
      expect(o.isPickable, t).toBe(false)
      expect(o.parent, t).toBe(m)
      const om = o.material as StandardMaterial
      expect(om.emissiveColor.toHexString(), t).toBe(OUTLINE)
      expect(Object.values(CABLE_TYPE_COLOUR)).not.toContain(om.emissiveColor.toHexString())
      // an inverted hull: only its back faces are drawn, so it rims the cable without covering it
      expect(om.backFaceCulling && om.cullBackFaces === false, t).toBe(true)
      expect(c.cueInfo(t)).toMatchObject({ type: t, fallback: false })
    }
    expect(c.paths().map(([id]) => id).sort()).toEqual([...TYPES].sort()) // the hover / pick oracle lists cables, never outlines
  })

  it('each pattern draws its own way: solid lines are one tube, dashes and dots are separate pieces, mains is a tube with collars', () => {
    const c = new CableRenderer(scene, new CableBudget(), opts())
    TYPES.forEach((t, i) => c.addCable(t, p(0, 0.05, i), p(3, 0.05, i), ends(t)))
    for (const t of ['analog-bal', 'analog-unbal', 'speaker'] as const) expect(pieces(main(t)), t).toBe(1)
    for (const t of ['digital', 'network', 'clock', 'control', 'dc'] as const) expect(pieces(main(t)), t).toBeGreaterThanOrEqual(10)
    expect(pieces(main('mains'))).toBeGreaterThan(1) // the tube and its collars
    expect(pieces(main('network'))).not.toBe(pieces(main('digital')))
    // the thicker sheet line is the thicker tube
    const r = (t: string) => main(t).getBoundingInfo().boundingBox.extendSizeWorld.z
    expect(r('speaker')).toBeGreaterThan(r('analog-bal'))
    expect(r('analog-bal')).toBeGreaterThan(r('analog-unbal'))
    // the outline follows the pieces (a dash's outline under the dash, nothing under a gap)
    expect(pieces(outline('digital'))).toBe(pieces(main('digital')))
  })

  it('the cue never changes the drawn path: points, length and the hover oracle are the same as a plain cable', () => {
    const plain = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0 })
    const cued = new CableRenderer(scene, new CableBudget(), opts())
    for (const t of TYPES) {
      plain.addCable(`p-${t}`, p(0), p(4, 0.6, 1), ends(t))
      cued.addCable(`c-${t}`, p(0), p(4, 0.6, 1), ends(t))
      const a = plain.paths().find(([id]) => id === `p-${t}`)![1]
      const b = cued.paths().find(([id]) => id === `c-${t}`)![1]
      expect(b, t).toEqual(a)
    }
  })

  it('the tube, its beads or collars and its outline rest on the floor (a thicker cue is lifted, never sunk), and never float more than 2 cm', () => {
    const c = new CableRenderer(scene, new CableBudget(), opts())
    TYPES.forEach((t, i) => c.addCable(t, p(0, 0.05, i), p(5, 0.05, i), ends(t)))
    for (const t of TYPES) {
      expect(lowest(main(t)), t).toBeGreaterThanOrEqual(0)
      expect(lowest(outline(t)), t).toBeGreaterThanOrEqual(0)
      expect(lowest(outline(t)), t).toBeLessThan(0.02)
    }
  })

  it('a long run is capped: never more than PIECE_MAX pieces', () => {
    const c = new CableRenderer(scene, new CableBudget(), opts())
    for (const t of TYPES) c.addCable(t, p(0, 0.05, 0), p(90, 0.05, 0), ends(t))
    for (const t of TYPES) {
      expect(pieces(main(t)), t).toBeLessThanOrEqual(PIECE_MAX + 1)
      expect(c.cueInfo(t)!.pieces, t).toBeLessThanOrEqual(PIECE_MAX)
    }
    expect(c.cueInfo('digital')!.pieces).toBe(PIECE_MAX)
  })

  it('over the point budget a cable falls back to the plain tube with its outline: never dropped', () => {
    const roomy = new CableRenderer(scene, new CableBudget(), opts())
    roomy.addCable('first', p(0, 0.05, 0), p(3, 0.05, 0), ends('digital'))
    expect(roomy.cueInfo('first')).toMatchObject({ fallback: false })
    const c = new CableRenderer(scene, new CableBudget(2), opts()) // no gravity path fits in 2 points
    c.addCable('over', p(0, 0.05, 1), p(3, 0.05, 1), ends('digital'))
    expect(c.cueInfo('over')).toMatchObject({ type: 'digital', fallback: true, pieces: 0 })
    expect(pieces(main('over'))).toBe(1)
    expect(outline('over')).toBeTruthy()
    expect(c.paths().map(([id]) => id)).toEqual(['over'])
  })

  it('hide, hover and dispose: the outline goes with its cable; the hover tint is on the cable, the outline stays dark', () => {
    const c = new CableRenderer(scene, new CableBudget(), opts())
    c.addCable('d', p(0), p(3), ends('digital'))
    c.addCable('m', p(0, 0.05, 1), p(3, 0.05, 1), ends('mains'))
    const outlineMat = outline('d').material
    const base = main('d').material
    c.setHighlighted('d')
    expect(main('d').material).not.toBe(base)
    expect(outline('d').material).toBe(outlineMat)
    c.setHighlighted(null)
    main('d').setEnabled(false)
    expect(outline('d').isEnabled()).toBe(false)
    expect(c.paths().map(([id]) => id)).toEqual(['m'])
    c.removeCable('d')
    expect(scene.getMeshByName('cable-outline:d')).toBeNull()
    expect(c.cueInfo('d')).toBeNull()
    const before = scene.materials.length
    c.dispose()
    expect(scene.meshes.filter((m) => m.name.startsWith('cable'))).toHaveLength(0)
    expect(scene.materials.length).toBeLessThan(before)
    expect(scene.materials.some((m) => m.name.startsWith('cable:'))).toBe(false)
  })

  it('without a cue (legacy callers, dashFor) nothing changes: no outline, the old dash', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0, dashFor: (a) => a.port === 'x' })
    c.addCable('plain', p(0), p(3), ends('y'))
    c.addCable('dash', p(0, 0.05, 1), p(3, 0.05, 1), ends('x'))
    expect(scene.meshes.some((m) => m.name.startsWith('cable-outline:'))).toBe(false)
    expect(pieces(main('plain'))).toBe(1)
    expect(pieces(main('dash'))).toBeGreaterThanOrEqual(10)
    expect(c.cueInfo('plain')).toMatchObject({ type: null, pieces: 0 })
  })
})
