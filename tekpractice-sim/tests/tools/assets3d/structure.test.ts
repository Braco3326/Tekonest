import { describe, expect, it } from 'vitest'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { PART_PARAMS, expandStructure, validateStructure } from '../../../tools/assets3d/structure'

const base = (structure: unknown): AssetSpecT =>
  AssetSpec.parse({ id: 'test-box', kind: 'device', tier: 'hero', realSizeMm: { w: 300, h: 40, d: 200 }, ports: [], controls: [], sources: [], structure })

describe('structure sheet schema', () => {
  it('accepts a sheet of parts with repetition, colours and notes', () => {
    const spec = base({ bodyHeightMm: 30, parts: [{ kind: 'fader', face: 'top', xMm: 20, yMm: 40, count: 8, pitchXMm: 25, params: { slotLenMm: 100 }, colour: '#202020', note: 'channel faders' }] })
    expect(spec.structure?.parts).toHaveLength(1)
    expect(spec.structure?.bodyHeightMm).toBe(30)
  })
  it('refuses an unknown kind, an unknown key, a bad colour and an empty sheet', () => {
    expect(() => base({ parts: [{ kind: 'wheel', face: 'top', xMm: 1, yMm: 1 }] })).toThrow()
    expect(() => base({ parts: [{ kind: 'knob', face: 'top', xMm: 1, yMm: 1, size: 3 }] })).toThrow()
    expect(() => base({ parts: [{ kind: 'knob', face: 'top', xMm: 1, yMm: 1, colour: 'red' }] })).toThrow()
    expect(() => base({ parts: [] })).toThrow()
  })
  it('validateStructure refuses unknown param names, a socket without type, a type on a non-socket, a foot off the bottom, too many instances', () => {
    expect(validateStructure(base({ parts: [{ kind: 'knob', face: 'top', xMm: 1, yMm: 1, params: { dia: 5 } }] }))[0]).toContain("no param 'dia'")
    expect(validateStructure(base({ parts: [{ kind: 'socket', face: 'io', xMm: 1, yMm: 1 }] }))[0]).toContain('needs its type')
    expect(validateStructure(base({ parts: [{ kind: 'knob', face: 'top', xMm: 1, yMm: 1, type: 'xlr' }] }))[0]).toContain('only a socket has a type')
    expect(validateStructure(base({ parts: [{ kind: 'foot', face: 'top', xMm: 1, yMm: 1 }] }))[0]).toContain('bottom face')
    expect(validateStructure(base({ parts: [{ kind: 'led', face: 'top', xMm: 1, yMm: 1, count: 256 }, { kind: 'led', face: 'top', xMm: 1, yMm: 1, count: 256 }, { kind: 'led', face: 'top', xMm: 1, yMm: 1, count: 256 }] }))[0]).toContain('600')
    expect(validateStructure(base({ parts: [{ kind: 'socket', face: 'io', xMm: 1, yMm: 1, type: 'xlr', params: { diaMm: 19.5 } }] }))).toEqual([])
  })
  it('every kind has a parameter list', () => {
    for (const kind of ['knob', 'button', 'fader', 'socket', 'screw', 'led', 'keys', 'slot', 'foot'] as const) expect(PART_PARAMS[kind].length).toBeGreaterThan(0)
  })
})

describe('expandStructure', () => {
  it('places a grid row-major with pitches on the face frame (top: x right, y from the io edge) and gives the inward ray', () => {
    const spec = base({ parts: [{ kind: 'button', face: 'top', xMm: 50, yMm: 20, count: 5, cols: 2, pitchXMm: 10, pitchYMm: 15 }] })
    const inst = expandStructure(spec)
    expect(inst).toHaveLength(5)
    // top face: x_w = x - w/2, z_w = d/2 - y; the ray starts 0.5 m above and points down
    expect(inst[0].origin[0]).toBeCloseTo(0.05 - 0.15, 9)
    expect(inst[0].origin[2]).toBeCloseTo(0.1 - 0.02, 9)
    expect(inst[0].dir).toEqual([-0, -1, -0])
    expect(inst[1].origin[0]).toBeCloseTo(0.06 - 0.15, 9) // second column
    expect(inst[2].origin[2]).toBeCloseTo(0.1 - 0.035, 9) // second row
    expect(inst[4].origin[0]).toBeCloseTo(0.05 - 0.15, 9) // third row, first column
    expect(inst[0].xAxis).toEqual([1, 0, 0])
    expect(inst[0].yAxis).toEqual([0, 0, -1])
  })
  it('uses the side faces axes and the opposite face mirror like the ports', () => {
    const spec = base({ parts: [{ kind: 'knob', face: 'opposite', xMm: 10, yMm: 5 }, { kind: 'knob', face: 'left', xMm: 10, yMm: 5 }] })
    const [front, left] = expandStructure(spec)
    expect(front.origin[0]).toBeCloseTo(0.15 - 0.01, 9)
    expect(front.origin[2]).toBeCloseTo(-0.1 - 0.5, 9)
    expect(left.origin[2]).toBeCloseTo(-0.1 + 0.01, 9)
    expect(left.origin[0]).toBeCloseTo(-0.15 - 0.5, 9)
  })
})
