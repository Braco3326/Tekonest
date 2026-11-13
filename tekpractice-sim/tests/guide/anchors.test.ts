// Anchors: the ids the guide uses to name things on the bench, and the rects built from scene points.
import { describe, expect, it } from 'vitest'
import { anchorOf, isAnchor, rectFromPoint } from '../../src/guide/anchors'

const KINDS = ['device', 'port', 'control', 'nav'] as const

describe('anchorOf', () => {
  it('output always matches the anchor pattern', () => {
    const inputs = ['mixer-1', 'A', '', ' ', '...', '---', '___', 'é', '😀', 'x'.repeat(300), '\u0000', 'a/b', 'a:b', '\ud800']
    for (const kind of KINDS) {
      for (const a of inputs) {
        for (const b of ['', 'in 1', 'ÉCOUTE', '😀😀']) {
          const id = anchorOf(kind, [a, b], new Set())
          expect(isAnchor(id), `${kind} ${JSON.stringify(a.slice(0, 10))}/${JSON.stringify(b)} -> ${id}`).toBe(true)
          expect(id.startsWith(`${kind}:`)).toBe(true)
        }
      }
      expect(isAnchor(anchorOf(kind, [], new Set()))).toBe(true)
    }
  })

  it('keeps a plain id readable and joins parts with a dot', () => {
    expect(anchorOf('device', ['mixer-1'], new Set())).toBe('device:mixer-1')
    expect(anchorOf('port', ['mixer-1', 'out_l'], new Set())).toBe('port:mixer-1.out_l')
  })

  it('capitals, spaces, dots, accents and emoji are mapped', () => {
    expect(anchorOf('device', ['Console Façade'], new Set())).toBe('device:console-fa-ade')
    expect(anchorOf('device', ['A B'], new Set())).toBe('device:a-b')
    expect(anchorOf('device', ['été'], new Set())).toBe('device:-t-')
    // one code point (an emoji) becomes one dash, not two
    expect(anchorOf('device', ['a😀b'], new Set())).toBe('device:a-b')
    // a dot inside a part is allowed and kept
    expect(anchorOf('device', ['v1.2'], new Set())).toBe('device:v1.2')
  })

  it('two ids that normalise equal get distinct anchors, none is dropped', () => {
    const seen = new Set<string>()
    const ids = ['Mixer 1', 'mixer-1', 'MIXER-1', 'mixer 1', 'mixer.1', 'mixer-1']
    const out = ids.map((i) => anchorOf('device', [i], seen))
    expect(new Set(out).size).toBe(ids.length)
    for (const o of out) expect(isAnchor(o)).toBe(true)
    expect(out[0]).toBe('device:mixer-1')
    expect(out[1]).toBe('device:mixer-1-2')
    expect(seen.size).toBe(ids.length)
    for (const o of out) expect(seen.has(o)).toBe(true)
  })

  it('collisions stay distinct and valid at the length limit', () => {
    const seen = new Set<string>()
    const long = 'x'.repeat(200)
    const out = Array.from({ length: 12 }, () => anchorOf('device', [long], seen))
    expect(new Set(out).size).toBe(12)
    for (const o of out) {
      expect(isAnchor(o)).toBe(true)
      expect(o.length - 'device:'.length).toBeLessThanOrEqual(70)
    }
  })

  it('a 200 character id is cut to the limit', () => {
    const id = anchorOf('device', ['a'.repeat(200)], new Set())
    expect(id).toBe(`device:${'a'.repeat(70)}`)
    expect(isAnchor(id)).toBe(true)
    const port = anchorOf('port', ['d'.repeat(100), 'p'.repeat(100)], new Set())
    expect(port.length - 'port:'.length).toBeLessThanOrEqual(70)
    expect(isAnchor(port)).toBe(true)
    // both parts stay visible after the cut
    const [d, p] = port.slice('port:'.length).split('.')
    expect(d).toMatch(/^d+$/)
    expect(p).toMatch(/^p+$/)
    // a short part is kept whole, the long one gives way
    const mixed = anchorOf('port', ['d'.repeat(100), 'in-1'], new Set())
    expect(mixed.endsWith('.in-1')).toBe(true)
    expect(mixed.length - 'port:'.length).toBeLessThanOrEqual(70)
  })

  it('the same kind of anchors in different kinds do not collide through seen', () => {
    const seen = new Set<string>()
    const a = anchorOf('device', ['x'], seen)
    const b = anchorOf('control', ['x'], seen)
    expect(a).toBe('device:x')
    expect(b).toBe('control:x')
  })

  it('an empty or all-mapped id still gives a valid, distinct anchor', () => {
    const seen = new Set<string>()
    const out = [anchorOf('device', [''], seen), anchorOf('device', [''], seen), anchorOf('device', [], seen)]
    expect(new Set(out).size).toBe(3)
    for (const o of out) expect(isAnchor(o)).toBe(true)
  })

  it('is deterministic: the same inputs in the same order give the same anchors', () => {
    const run = (): string[] => {
      const seen = new Set<string>()
      return ['A b', 'a-b', 'a.b', 'A B'].map((i) => anchorOf('device', [i], seen))
    }
    expect(run()).toEqual(run())
  })
})

describe('isAnchor', () => {
  it('accepts the four kinds and rejects the rest', () => {
    for (const ok of ['device:a', 'port:a.b', 'control:a.b-c_d', 'nav:status', `device:${'a'.repeat(70)}`]) expect(isAnchor(ok)).toBe(true)
    for (const bad of ['', 'device:', 'device:A', 'device:a b', 'other:a', 'device:é', `device:${'a'.repeat(71)}`, 'device:a\n', ' device:a', 'device']) {
      expect(isAnchor(bad), JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('rectFromPoint', () => {
  it('rejects null, NaN, Infinity', () => {
    expect(rectFromPoint(null, 56)).toBeNull()
    expect(rectFromPoint({ x: NaN, y: 1 }, 56)).toBeNull()
    expect(rectFromPoint({ x: 1, y: NaN }, 56)).toBeNull()
    expect(rectFromPoint({ x: Infinity, y: 1 }, 56)).toBeNull()
    expect(rectFromPoint({ x: 1, y: -Infinity }, 56)).toBeNull()
    expect(rectFromPoint(undefined as unknown as null, 56)).toBeNull()
    expect(rectFromPoint({ x: '1', y: 2 } as unknown as { x: number; y: number }, 56)).toBeNull()
  })

  it('device rect is 56, port 24, control 28 and centred on the point', () => {
    expect(rectFromPoint({ x: 100, y: 200 }, 56)).toEqual({ x: 72, y: 172, w: 56, h: 56 })
    expect(rectFromPoint({ x: 100, y: 200 }, 24)).toEqual({ x: 88, y: 188, w: 24, h: 24 })
    expect(rectFromPoint({ x: 100, y: 200 }, 28)).toEqual({ x: 86, y: 186, w: 28, h: 28 })
  })

  it('a point at the origin is a real rect, never null', () => {
    expect(rectFromPoint({ x: 0, y: 0 }, 24)).toEqual({ x: -12, y: -12, w: 24, h: 24 })
  })
})
