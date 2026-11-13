/**
 * T0.1: the design package skeleton (spec 7.1). `?design` parsing is strict
 * (exactly one `design` key, value 1..5); no `?design` means no attribute and
 * no active package, i.e. today's behaviour.
 */
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { TUTORIAL_STEPS } from '../../src/guide/tutorial'
import {
  ALLOWED_COLOURS,
  PRACTICE_CLASS,
  applyLookAttributes,
  lookOfRoot,
  DESIGN_IDS,
  activePackage,
  applyDesignAttribute,
  designFromSearch,
  packageById,
  type DesignId,
} from '../../src/design/packages'
import { TUTORIAL_EVENT } from '../../src/design/events'
import { ENSEMBLE_LOWER_RADIUS } from '../../src/camera/orbitFeel'
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

  it('no two packages share a colour map (T4.1: five balances of the brand family, one per package)', () => {
    const keys = all.map((p) => JSON.stringify(p.colours))
    expect(new Set(keys).size).toBe(5)
  })

  it('every colour of every map is a brand colour or a declared derived tint (nothing outside the family)', () => {
    for (const p of all) for (const [role, hex] of Object.entries(p.colours)) expect(ALLOWED_COLOURS.has(hex.toUpperCase()), `package ${p.id} ${role} ${hex}`).toBe(true)
  })

  it('every package carries a COPY name key that exists, and the five names differ', () => {
    const nameOf = (key: string): string | undefined => COPY.design?.[key.replace(/^design\./, '')]
    for (const p of all) expect(typeof nameOf(p.nameKey), `package ${p.id} ${p.nameKey}`).toBe('string')
    expect(new Set(all.map((p) => nameOf(p.nameKey))).size).toBe(5)
  })

  it('every pacing step id exists in the tutorial step list (the twelve of the one list)', () => {
    const known = new Set<string>(TUTORIAL_STEPS.map((s) => s.id))
    for (const p of all) for (const id of p.pacing.steps) expect(known.has(id), `package ${p.id} step ${id}`).toBe(true)
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

describe('first-sound framing (T2.5, spec 5)', () => {
  it('every package frames the neutral room closer than its 19.2 m overview and not closer than the orbit camera\'s own 2 m lower limit', () => {
    for (const id of DESIGN_IDS) {
      const f = packageById(id).framing
      expect(f.radius, `package ${id}`).toBeGreaterThanOrEqual(ENSEMBLE_LOWER_RADIUS)
      expect(f.radius, `package ${id}`).toBeLessThan(19.2)
      expect(Number.isFinite(f.alpha) && Number.isFinite(f.beta) && f.target.every(Number.isFinite), `package ${id}`).toBe(true)
      expect(f.beta, `package ${id}: above the floor, short of straight down`).toBeGreaterThan(0.1)
      expect(f.beta, `package ${id}`).toBeLessThan(Math.PI / 2)
    }
  })
})

describe('lookOfRoot / applyLookAttributes (T4.3: the layout and the look apply on a practice address only)', () => {
  const root = (attrs: Record<string, string>, classes: string[]) => ({
    getAttribute: (k: string) => attrs[k] ?? null,
    classList: { contains: (c: string) => classes.includes(c) },
  })

  it('a valid data-design on a practice address (the class main.ts sets) is the package; either alone is not', () => {
    for (const id of DESIGN_IDS) expect(lookOfRoot(root({ 'data-design': String(id) }, [PRACTICE_CLASS]))?.id).toBe(id)
    expect(lookOfRoot(root({ 'data-design': '2' }, []))).toBeNull() // an exam address (R-A): the attribute is there, the class is not
    expect(lookOfRoot(root({}, [PRACTICE_CLASS]))).toBeNull() // a plain address
    expect(lookOfRoot(root({ 'data-design': '7' }, [PRACTICE_CLASS]))).toBeNull()
    expect(lookOfRoot(root({ 'data-design': '' }, [PRACTICE_CLASS]))).toBeNull()
  })

  const fake = () => {
    const attrs = new Map<string, string>()
    return { attrs, setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) }
  }

  it('writes the surface style, the density, the drawer behaviour and the shortcut placement of the package, and nothing else', () => {
    for (const id of DESIGN_IDS) {
      const r = fake()
      const p = packageById(id)
      applyLookAttributes(r, p)
      expect([...r.attrs.keys()].sort()).toEqual(['data-density', 'data-drawer', 'data-shortcuts', 'data-surface'])
      expect(r.attrs.get('data-surface')).toBe(p.layout.surfaceStyle)
      expect(r.attrs.get('data-density')).toBe(p.layout.density)
      expect(r.attrs.get('data-drawer')).toBe(p.layout.drawer)
      // T6.2: where the menu shows each item's shortcut: beside the label where the package asks, at the end of the row otherwise (today's look)
      expect(r.attrs.get('data-shortcuts')).toBe(p.layout.shortcutsBesideControls ? 'beside' : 'end')
    }
  })

  it('no package: the four attributes are removed (a stale one never survives)', () => {
    const r = fake()
    applyLookAttributes(r, packageById(3))
    applyLookAttributes(r, null)
    expect(r.attrs.size).toBe(0)
  })
})

describe('T6.2: the final rows of the table (spec 7.2), one assertion per row', () => {
  // A characterization test: it passes on the rows as T0.1 to T4.3 left them and pins them as the spec's table. Mutation: change any one cell below in packages.ts (for example package 4's
  // checklist to 'panel', or package 2's presenter to 'step-card') and exactly this test fails.
  const ROWS = {
    1: { presenter: 'step-card', checklist: 'chip', shortcuts: false, corner: 'br', leads: true, proactive: true, hint: 20_000, drawer: 'stay-open', density: 'comfortable', surface: 'raised', start: 'neutral-room', panels: { tree: false, props: false } },
    2: { presenter: 'checklist', checklist: 'panel', shortcuts: true, corner: 'bl', leads: false, proactive: true, hint: 30_000, drawer: 'stay-open', density: 'dense', surface: 'banded', start: 'neutral-room', panels: { tree: true, props: true } },
    3: { presenter: 'step-card', checklist: 'chip', shortcuts: false, corner: 'tr', leads: true, proactive: true, hint: 20_000, drawer: 'stay-open', density: 'comfortable', surface: 'sheet', start: 'neutral-room', panels: { tree: false, props: true } },
    4: { presenter: 'checklist', checklist: 'chip', shortcuts: true, corner: 'br', leads: false, proactive: false, hint: 0, drawer: 'close-after-place', density: 'dense', surface: 'flat', start: 'neutral-room', panels: { tree: true, props: true } },
    5: { presenter: 'step-card', checklist: 'chip', shortcuts: false, corner: 'bl', leads: true, proactive: true, hint: 25_000, drawer: 'close-after-place', density: 'comfortable', surface: 'framed', start: 'playable-model', panels: { tree: true, props: false } },
  } as const
  for (const id of DESIGN_IDS)
    it(`package ${id}`, () => {
      const p = packageById(id)
      const r = ROWS[id]
      expect({
        presenter: p.presenter,
        checklist: p.layout.checklist,
        shortcuts: p.layout.shortcutsBesideControls,
        corner: p.layout.oscarCorner,
        leads: p.oscar.leads,
        proactive: p.oscar.proactive,
        hint: p.pacing.hintAfterMs,
        drawer: p.layout.drawer,
        density: p.layout.density,
        surface: p.layout.surfaceStyle,
        start: p.layout.start,
        panels: p.layout.panels,
      }).toEqual(r)
    })
  it('the checklist is a permanent panel in package 2 only; the step card is the presenter of packages 1, 3 and 5', () => {
    expect(DESIGN_IDS.filter((id) => packageById(id).layout.checklist === 'panel')).toEqual([2])
    expect(DESIGN_IDS.filter((id) => packageById(id).presenter === 'step-card')).toEqual([1, 3, 5])
  })
  it('the shortcuts sit beside the controls in packages 2 and 4 only', () => {
    expect(DESIGN_IDS.filter((id) => packageById(id).layout.shortcutsBesideControls)).toEqual([2, 4])
  })
  it('a package that is not proactive is the one with no hint (package 4)', () => {
    expect(DESIGN_IDS.filter((id) => !packageById(id).oscar.proactive)).toEqual([4])
    expect(DESIGN_IDS.filter((id) => packageById(id).pacing.hintAfterMs === 0)).toEqual([4])
  })
})
