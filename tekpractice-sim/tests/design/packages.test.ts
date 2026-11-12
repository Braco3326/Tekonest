/**
 * T0.1: the design package skeleton (spec 7.1). `?design` parsing is strict
 * (exactly one `design` key, value 1..5); no `?design` means no attribute and
 * no active package, i.e. today's behaviour.
 */
import { describe, expect, it } from 'vitest'
import {
  DESIGN_IDS,
  activePackage,
  applyDesignAttribute,
  designFromSearch,
  packageById,
  type DesignId,
} from '../../src/design/packages'
import { TUTORIAL_EVENT } from '../../src/design/events'
import { CREATION_TOKENS } from '../../src/design/creationTokens'

describe('designFromSearch', () => {
  it.each([
    ['?design=1', 1],
    ['?design=2', 2],
    ['?design=3', 3],
    ['?design=4', 4],
    ['?design=5', 5],
    ['design=3', 3],
    ['?creation=1&design=4', 4],
    ['?design=5&creation=1', 5],
  ])('%s -> %s', (search, id) => {
    expect(designFromSearch(search)).toBe(id)
  })

  it.each([
    ['', 'empty'],
    ['?', 'bare question mark'],
    ['?design=0', 'zero'],
    ['?design=6', 'six'],
    ['?design=abc', 'letters'],
    ['?design=', 'empty value'],
    ['?design', 'no value'],
    ['?design=01', 'leading zero'],
    ['?design=1.0', 'decimal'],
    ['?design=-1', 'negative'],
    ['?design=%201', 'encoded space'],
    ['?design=1&design=2', 'two keys, different'],
    ['?design=1&design=1', 'two keys, same'],
    ['?Design=1', 'wrong case'],
    ['?designs=1', 'other key'],
    ['?creation=1', 'no design key'],
  ])('%s -> null (%s)', (search) => {
    expect(designFromSearch(search)).toBeNull()
  })
})

describe('activePackage / packageById', () => {
  it('no design: no active package', () => {
    expect(activePackage('')).toBeNull()
    expect(activePackage('?creation=1')).toBeNull()
    expect(activePackage('?design=9')).toBeNull()
  })

  it('a valid design returns its package, id matching', () => {
    for (const id of DESIGN_IDS) {
      expect(activePackage(`?design=${id}`)?.id).toBe(id)
      expect(packageById(id).id).toBe(id)
    }
  })
})

describe('the table skeleton', () => {
  const all = DESIGN_IDS.map((id) => packageById(id))

  it('has exactly the five ids', () => {
    expect([...DESIGN_IDS]).toEqual([1, 2, 3, 4, 5])
  })

  it('no two packages share a layout preset', () => {
    const keys = all.map((p) => JSON.stringify(p.layout))
    expect(new Set(keys).size).toBe(5)
  })

  it("no package puts Oscar at 'tl' (the view cube sits there)", () => {
    for (const p of all) expect(['br', 'bl', 'tr']).toContain(p.layout.oscarCorner)
  })

  it("placeholder colours are today's tokens (T4.1 replaces them; the distinct-colour-map test lands there)", () => {
    for (const p of all) {
      expect(p.colours.ground).toBe(CREATION_TOKENS.color.nuit)
      expect(p.colours.ink).toBe(CREATION_TOKENS.color.papier)
      expect(p.colours.accent).toBe(CREATION_TOKENS.color.ambre)
      expect(p.colours.focus).toBe(CREATION_TOKENS.color.ambre)
    }
  })

  it('package 5 starts on the playable model and paces three steps; package 4 has no hint', () => {
    expect(packageById(5).layout.start).toBe('playable-model')
    expect(packageById(5).pacing.steps).toEqual(['ecoute', 'debrancher', 'rebrancher'])
    expect(packageById(4).pacing.hintAfterMs).toBe(0)
  })

  it('every pacing has at least one step and a non-negative hint delay', () => {
    for (const p of all) {
      expect(p.pacing.steps.length).toBeGreaterThan(0)
      expect(p.pacing.hintAfterMs).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('applyDesignAttribute (html[data-design])', () => {
  const fakeRoot = () => {
    const attrs = new Map<string, string>()
    return {
      attrs,
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
    }
  }

  it('no ?design: no data-design attribute', () => {
    const root = fakeRoot()
    expect(applyDesignAttribute(root, '')).toBeNull()
    expect(root.attrs.has('data-design')).toBe(false)
  })

  it('an invalid ?design: no attribute either', () => {
    const root = fakeRoot()
    expect(applyDesignAttribute(root, '?design=1&design=2')).toBeNull()
    expect(root.attrs.size).toBe(0)
  })

  it('a valid ?design sets the attribute to the id', () => {
    for (const id of DESIGN_IDS) {
      const root = fakeRoot()
      const p = applyDesignAttribute(root, `?design=${id}`)
      expect(p?.id).toBe(id as DesignId)
      expect(root.attrs.get('data-design')).toBe(String(id))
    }
  })

  it('a stale attribute is removed when the search has no valid design', () => {
    const root = fakeRoot()
    root.attrs.set('data-design', '3')
    applyDesignAttribute(root, '')
    expect(root.attrs.has('data-design')).toBe(false)
  })
})

describe('events', () => {
  it('the tutorial event name is the spec constant', () => {
    expect(TUTORIAL_EVENT).toBe('tekpractice:tutorial')
  })
})

describe('the table is frozen (the colour map, steps and framing are shared between packages)', () => {
  const frozen = (o: unknown) => Object.isFrozen(o)

  it('every package and every nested object / array is frozen', () => {
    for (const id of DESIGN_IDS) {
      const p = packageById(id)
      for (const o of [p, p.colours, p.layout, p.layout.panels, p.pacing, p.pacing.steps, p.oscar, p.framing, p.framing.target]) {
        expect(frozen(o), `package ${id}`).toBe(true)
      }
    }
  })

  it('a write to a shared object throws instead of leaking into the four other packages', () => {
    const shared = packageById(1).colours as { accent: string }
    expect(() => {
      shared.accent = '#000000'
    }).toThrow(TypeError)
    expect(packageById(2).colours.accent).toBe(CREATION_TOKENS.color.ambre)
    expect(() => {
      ;(packageById(3).framing.target as unknown as number[])[1] = 9
    }).toThrow(TypeError)
  })
})
