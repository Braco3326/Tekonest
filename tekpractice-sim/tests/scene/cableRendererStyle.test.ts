/** CableRenderer style options (Task 27, C18): colour by connection, dashes, hover highlight; legacy default unchanged. */
import { Color3, NullEngine, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TOKENS } from '../../src/design/tokens'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { CableBudget } from '../../src/scene/cablePath'
import type { PortRef } from '../../src/engine/types'

const A: PortRef = { instance: 'a', port: 'out' }
const B: PortRef = { instance: 'b', port: 'in' }
const p = (x: number, y = 0, z = 0): Vector3 => new Vector3(x, y, z)
const sum = (c: Color3): number => c.r + c.g + c.b

describe('CableRenderer style', () => {
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
  const cableMeshes = () => scene.meshes.filter((m) => m.name.startsWith('cable:'))
  const mat = (name: string): StandardMaterial => scene.getMeshByName(name)!.material as StandardMaterial
  const diffuse = (name: string): string => mat(name).diffuseColor.toHexString()
  /** Share of the cable's length (x from 0.2 to 2.8 m) that no triangle covers: a dashed cable has gaps, a plain tube none. */
  const uncovered = (name: string): number => {
    const m = scene.getMeshByName(name)!
    const pos = m.getVerticesData('position')!
    const idx = m.getIndices()!
    const bins = new Array<boolean>(260).fill(false)
    for (let t = 0; t < idx.length; t += 3) {
      const xs = [pos[idx[t]! * 3]!, pos[idx[t + 1]! * 3]!, pos[idx[t + 2]! * 3]!]
      const lo = Math.floor((Math.min(...xs) - 0.2) / 0.01)
      const hi = Math.floor((Math.max(...xs) - 0.2) / 0.01)
      for (let i = Math.max(0, lo); i <= Math.min(259, hi); i++) bins[i] = true
    }
    return bins.filter((c) => !c).length / bins.length
  }

  it('legacy default: no colorFor means the legacy committed colour, untouched', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    c.addCable('c1', p(0), p(2), [A, B])
    c.addCable('c2', p(0), p(2)) // legacy callers pass no ends
    expect(diffuse('cable:c1').toLowerCase()).toBe(TOKENS.color.cable.toLowerCase())
    expect(diffuse('cable:c2').toLowerCase()).toBe(TOKENS.color.cable.toLowerCase())
    expect(c.colorOf('c1')?.toLowerCase()).toBe(TOKENS.color.cable.toLowerCase())
  })

  it('colorFor gets the two ports and colours that cable; cables of one colour share a material', () => {
    const seen: [PortRef, PortRef][] = []
    const c = new CableRenderer(scene, new CableBudget(), {
      pulses: false,
      colorFor: (a, b) => {
        seen.push([a, b])
        return Color3.FromHexString(a.instance === 'a' ? '#FF6306' : '#43DCFE')
      },
    })
    c.addCable('c1', p(0), p(2), [A, B])
    c.addCable('c2', p(0, 0, 1), p(2, 0, 1), [{ instance: 'x', port: 'o' }, B])
    c.addCable('c3', p(0, 0, 2), p(2, 0, 2), [A, B])
    expect(seen[0]).toEqual([A, B])
    expect(diffuse('cable:c1')).toBe('#FF6306')
    expect(diffuse('cable:c2')).toBe('#43DCFE')
    expect(mat('cable:c1')).toBe(mat('cable:c3'))
    expect(c.colorOf('c2')).toBe('#43DCFE')
    expect(c.colorOf('nope')).toBeNull()
  })

  it('a coloured renderer asked for a cable without ends (a legacy call) keeps the legacy colour', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, colorFor: () => Color3.FromHexString('#FF6306') })
    c.addCable('c1', p(0), p(2))
    expect(diffuse('cable:c1').toLowerCase()).toBe(TOKENS.color.cable.toLowerCase())
  })

  it('dashFor draws a dashed cable: ONE mesh with the same name, spanning the cable, with gaps; a plain cable has none', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, colorFor: () => Color3.Red(), dashFor: (a) => a.instance === 'a' })
    c.addCable('plain', p(0), p(3), [{ instance: 'z', port: 'o' }, B])
    c.addCable('dash', p(0, 0, 1), p(3, 0, 1), [A, B])
    expect(cableMeshes().map((m) => m.name).sort()).toEqual(['cable:dash', 'cable:plain'])
    const dash = scene.getMeshByName('cable:dash')!
    expect(dash.getTotalVertices()).toBeGreaterThan(0)
    expect(dash.getBoundingInfo().boundingBox.extendSizeWorld.x).toBeGreaterThan(1.3)
    expect(mat('cable:dash')).toBe(mat('cable:plain'))
    expect(uncovered('cable:dash')).toBeGreaterThan(0.2)
    expect(uncovered('cable:plain')).toBe(0)
    c.removeCable('dash')
    expect(cableMeshes().map((m) => m.name)).toEqual(['cable:plain'])
  })

  it('setHighlighted swaps the cable to a brighter material then puts it back; a redraw while highlighted stays highlighted', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, colorFor: () => Color3.FromHexString('#FF6306') })
    c.addCable('c1', p(0), p(2), [A, B])
    c.addCable('c2', p(0, 0, 1), p(2, 0, 1), [A, B])
    const base = mat('cable:c1')
    c.setHighlighted('c1')
    expect(c.highlighted).toBe('c1')
    const hot = mat('cable:c1')
    expect(hot).not.toBe(base)
    expect(sum(hot.emissiveColor)).toBeGreaterThan(sum(base.emissiveColor))
    expect(mat('cable:c2')).toBe(base) // the other one is not touched
    expect(c.colorOf('c1')).toBe('#FF6306') // its signal colour is still reported
    c.addCable('c1', p(0), p(2.5), [A, B]) // a redraw (a device moved)
    expect(mat('cable:c1')).toBe(hot)
    c.setHighlighted(null)
    expect(c.highlighted).toBeNull()
    expect(mat('cable:c1')).toBe(base)
  })

  it('setHighlighted of an unknown cable highlights nothing; removing the highlighted cable clears it', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    c.addCable('c1', p(0), p(2), [A, B])
    c.setHighlighted('ghost')
    expect(c.highlighted).toBeNull()
    c.setHighlighted('c1')
    expect(c.highlighted).toBe('c1')
    c.removeCable('c1')
    expect(c.highlighted).toBeNull()
  })

  it('paths(): the drawn cables with their points, enabled ones only (a hidden cable cannot be hovered)', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    c.addCable('c1', p(0), p(2), [A, B])
    c.addCable('c2', p(0, 0, 1), p(2, 0, 1), [A, B])
    expect(c.paths().map(([id]) => id).sort()).toEqual(['c1', 'c2'])
    expect(c.paths()[0]![1].length).toBeGreaterThan(2)
    scene.getMeshByName('cable:c2')!.setEnabled(false)
    expect(c.paths().map(([id]) => id)).toEqual(['c1'])
  })

  it('revision is never reused: two renderers that drew the same cables never share one (a cache key survives a reload)', () => {
    const one = new CableRenderer(scene, new CableBudget(), { pulses: false })
    one.addCable('c1', p(0), p(2), [A, B])
    const two = new CableRenderer(scene, new CableBudget(), { pulses: false })
    two.addCable('c1', p(0), p(2), [A, B])
    expect(two.revision).not.toBe(one.revision)
    const before = two.revision
    two.removeCable('c1')
    expect(two.revision).toBeGreaterThan(before)
    one.dispose()
    two.dispose()
  })

  it('dispose releases the coloured and highlight materials and the meshes', () => {
    const before = scene.materials.length
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, colorFor: () => Color3.Red(), dashFor: () => true })
    c.addCable('c1', p(0), p(2), [A, B])
    c.setHighlighted('c1')
    c.dispose()
    expect(scene.materials.length).toBe(before)
    expect(cableMeshes()).toHaveLength(0)
  })
})
