// The new Oscar character (onboarding spec 10.2, plan T5.1): construction by DOM calls only, the pure state mapping (vendored state + host event ->
// drawn state), the pure timer plan, and the live object's timers (host states end after their duration; destroy clears every timer).
// Unit tests run in node: the DOM is a fake document that records every call and refuses markup strings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MascotState } from '../../src/guide/vendor/core/types'
import { MASCOT_STATES } from '../../src/guide/vendor/ui/mascot'
import { CREATION_TOKENS } from '../../src/design/creationTokens'
import {
  ARM_MIRROR,
  CHARACTER_CLASS,
  CHARACTER_STATES,
  DIRS,
  HOST_EVENT_MS,
  VENDOR_STATES,
  armTransformFor,
  createCharacter,
  initialModel,
  stateFor,
  step,
  type CharacterState,
  type HostEvent,
} from '../../src/guide/character'

const SVG_NS = 'http://www.w3.org/2000/svg'

interface FakeNode {
  ns: string
  tag: string
  attrs: Map<string, string>
  children: FakeNode[]
  parentNode: FakeNode | null
  setAttribute(k: string, v: string): void
  getAttribute(k: string): string | null
  removeAttribute(k: string): void
  appendChild(c: FakeNode): FakeNode
  removeChild(c: FakeNode): FakeNode
}

function fakeDocument() {
  const log = { ns: [] as string[], html: 0, markup: 0, created: 0 }
  const make = (ns: string, tag: string): FakeNode => {
    log.created++
    const node: FakeNode = {
      ns,
      tag,
      attrs: new Map(),
      children: [],
      parentNode: null,
      setAttribute(k, v) {
        node.attrs.set(k, String(v))
      },
      getAttribute(k) {
        return node.attrs.has(k) ? node.attrs.get(k)! : null
      },
      removeAttribute(k) {
        node.attrs.delete(k)
      },
      appendChild(c) {
        if (c.parentNode !== null) c.parentNode.removeChild(c)
        c.parentNode = node
        node.children.push(c)
        return c
      },
      removeChild(c) {
        node.children = node.children.filter((x) => x !== c)
        c.parentNode = null
        return c
      },
    }
    // A markup string anywhere is a failure: count it and refuse it.
    for (const prop of ['innerHTML', 'outerHTML']) {
      Object.defineProperty(node, prop, {
        set() {
          log.markup++
          throw new Error(`${prop} is not allowed`)
        },
        get() {
          return ''
        },
      })
    }
    Object.defineProperty(node, 'insertAdjacentHTML', {
      value() {
        log.markup++
        throw new Error('insertAdjacentHTML is not allowed')
      },
    })
    return node
  }
  const doc = {
    createElementNS(ns: string, tag: string) {
      log.ns.push(ns)
      return make(ns, tag)
    },
    createElement(tag: string) {
      log.html++
      return make('html', tag)
    },
  }
  return { doc: doc as unknown as Document, log }
}

const all = (n: FakeNode): FakeNode[] => [n, ...n.children.flatMap(all)]
const part = (svg: FakeNode, name: string): FakeNode => {
  const hits = all(svg).filter((n) => n.getAttribute('data-part') === name)
  expect(hits, `one group data-part="${name}"`).toHaveLength(1)
  return hits[0]
}
const num = (n: FakeNode, k: string): number => Number(n.getAttribute(k))
const build = () => {
  const f = fakeDocument()
  const c = createCharacter(f.doc)
  return { ...f, c, svg: c.svg as unknown as FakeNode }
}

describe('construction (spec 10.2): DOM calls only', () => {
  it('builds every node with createElementNS in the SVG namespace, never createElement or a markup string', () => {
    const { log, svg } = build()
    expect(log.created).toBeGreaterThan(10)
    expect(log.html).toBe(0)
    expect(log.markup).toBe(0)
    expect(new Set(log.ns)).toEqual(new Set([SVG_NS]))
    expect(svg.tag).toBe('svg')
  })

  it('is a 64 x 64 decorative svg: viewBox, aria-hidden, not focusable, its own class (not the vendored oscar-mascot)', () => {
    const { svg } = build()
    expect(svg.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.getAttribute('class')).toBe(CHARACTER_CLASS)
    expect(svg.getAttribute('class')).not.toMatch(/oscar-mascot/)
  })

  it('has no raster, no foreign content, no link and no data URI anywhere', () => {
    const { svg } = build()
    for (const n of all(svg)) {
      expect(['image', 'foreignObject', 'use', 'script', 'style', 'a']).not.toContain(n.tag)
      for (const [k, v] of n.attrs) {
        expect(k).not.toMatch(/href/i)
        expect(v).not.toMatch(/data:|url\(|<|javascript:/i)
      }
    }
  })

  it('has the four named groups head, cups, arm and led, each a <g>', () => {
    const { svg } = build()
    for (const name of ['head', 'cups', 'arm', 'led']) expect(part(svg, name).tag).toBe('g')
  })

  it('head = a Papier disc r 15 with a Nuit outline 3, two upright Nuit pill eyes 4 x 7 and the two mouths (shrug flat, celebrate smile)', () => {
    const { svg } = build()
    const head = part(svg, 'head')
    const disc = all(head).find((n) => n.tag === 'circle')!
    expect(num(disc, 'r')).toBe(15)
    expect(disc.getAttribute('fill')).toBe(CREATION_TOKENS.color.papier)
    expect(disc.getAttribute('stroke')).toBe(CREATION_TOKENS.color.nuit)
    expect(num(disc, 'stroke-width')).toBe(3)
    const eyes = all(head).filter((n) => n.getAttribute('data-part') === 'eye')
    expect(eyes).toHaveLength(2)
    for (const e of eyes) {
      expect(e.tag).toBe('rect')
      expect([num(e, 'width'), num(e, 'height')]).toEqual([4, 7])
      expect(e.getAttribute('fill')).toBe(CREATION_TOKENS.color.nuit)
    }
    const mouths = all(head)
      .map((n) => n.getAttribute('data-part'))
      .filter((p) => p !== null && p.startsWith('mouth'))
    expect(mouths.sort()).toEqual(['mouth-flat', 'mouth-smile'])
  })

  it('cups = two Ambre rounded rects 14 x 22 rx 3 with a Nuit outline 3, and the Ambre band (stroke 5, square caps)', () => {
    const { svg } = build()
    const cups = part(svg, 'cups')
    const rects = all(cups).filter((n) => n.tag === 'rect')
    expect(rects).toHaveLength(2)
    for (const r of rects) {
      expect([num(r, 'width'), num(r, 'height'), num(r, 'rx')]).toEqual([14, 22, 3])
      expect(r.getAttribute('fill')).toBe(CREATION_TOKENS.color.ambre)
      expect(r.getAttribute('stroke')).toBe(CREATION_TOKENS.color.nuit)
      expect(num(r, 'stroke-width')).toBe(3)
    }
    const band = all(cups).find((n) => n.getAttribute('data-part') === 'band')!
    expect(band.getAttribute('stroke')).toBe(CREATION_TOKENS.color.ambre)
    expect(num(band, 'stroke-width')).toBe(5)
    expect(band.getAttribute('stroke-linecap')).toBe('square')
    expect(band.getAttribute('fill')).toBe('none')
  })

  it('proportions: on a Prune coin; cups break out of it by 4 on each side, the band by 4 at the top, 9 above the head; wider than tall', () => {
    const { svg } = build()
    const coin = all(svg).find((n) => n.getAttribute('data-part') === 'coin')!
    expect(coin.getAttribute('fill')).toBe(CREATION_TOKENS.color.prune)
    const [cx, cy, r] = [num(coin, 'cx'), num(coin, 'cy'), num(coin, 'r')]
    const disc = all(part(svg, 'head')).find((n) => n.tag === 'circle')!
    const rects = all(part(svg, 'cups')).filter((n) => n.tag === 'rect')
    const left = Math.min(...rects.map((x) => num(x, 'x')))
    const right = Math.max(...rects.map((x) => num(x, 'x') + num(x, 'width')))
    expect(cx - r - left).toBe(4)
    expect(right - (cx + r)).toBe(4)
    // The band's outer edge: its path apex (from the data the module exposes on the node) minus half its stroke.
    const band = all(part(svg, 'cups')).find((n) => n.getAttribute('data-part') === 'band')!
    const apex = Number(band.getAttribute('data-apex-y'))
    const outer = apex - num(band, 'stroke-width') / 2
    expect(cy - r - outer).toBe(4)
    expect(num(disc, 'cy') - num(disc, 'r') - outer).toBe(9)
    // Silhouette (band + cups): wider than tall.
    const bottom = Math.max(...rects.map((x) => num(x, 'y') + num(x, 'height')))
    expect(right - left).toBeGreaterThan(bottom - outer)
  })

  it('arm = one arm ending in a square hand; led = an Ambre standby dot on the Prune coin (never Ambre on Papier)', () => {
    const { svg } = build()
    const arm = part(svg, 'arm')
    const hand = all(arm).find((n) => n.getAttribute('data-part') === 'hand')!
    expect(hand.tag).toBe('rect')
    expect(num(hand, 'width')).toBe(num(hand, 'height'))
    expect(hand.getAttribute('rx')).toBeNull()
    const led = all(part(svg, 'led')).find((n) => n.tag === 'circle')!
    expect(led.getAttribute('fill')).toBe(CREATION_TOKENS.color.ambre)
    const coin = all(svg).find((n) => n.getAttribute('data-part') === 'coin')!
    const d = Math.hypot(num(led, 'cx') - num(coin, 'cx'), num(led, 'cy') - num(coin, 'cy'))
    expect(d + num(led, 'r')).toBeLessThanOrEqual(num(coin, 'r'))
    // Not on the head disc either.
    const disc = all(part(svg, 'head')).find((n) => n.tag === 'circle')!
    const dh = Math.hypot(num(led, 'cx') - num(disc, 'cx'), num(led, 'cy') - num(disc, 'cy'))
    expect(dh - num(led, 'r')).toBeGreaterThan(num(disc, 'r') + num(disc, 'stroke-width') / 2)
  })

  it('starts in idle facing east, data-state and data-dir on the svg', () => {
    const { svg } = build()
    expect(svg.getAttribute('data-state')).toBe('idle')
    expect(svg.getAttribute('data-dir')).toBe('east')
  })
})

describe('mapping (spec 10.2): stateFor(vendorState, hostEvent)', () => {
  it('the module knows exactly the seven vendored states', () => {
    expect([...VENDOR_STATES]).toEqual([...MASCOT_STATES])
    const check: MascotState = VENDOR_STATES[0]
    expect(check).toBe('idle')
  })

  it('maps each vendored state to itself, except no -> shrug (not a headshake)', () => {
    const want: Record<MascotState, CharacterState> = {
      idle: 'idle',
      walk: 'walk',
      point: 'point',
      think: 'think',
      celebrate: 'celebrate',
      no: 'shrug',
      sleep: 'sleep',
    }
    for (const v of VENDOR_STATES) expect(stateFor(v, null)).toBe(want[v])
  })

  it('an unknown vendored value draws idle (triggers) and a known one does not fall back (does not trigger)', () => {
    for (const bad of [undefined, null, '', 'shake', 'IDLE', 3]) expect(stateFor(bad, null)).toBe('idle')
    expect(stateFor('think', null)).toBe('think')
  })

  it('a host event (nod, wave) is drawn over idle, walk, point and think', () => {
    for (const v of ['idle', 'walk', 'point', 'think'] as const)
      for (const e of ['nod', 'wave'] as const) expect(stateFor(v, e)).toBe(e)
  })

  it('celebrate, no (shrug) and sleep outrank a host event (feedback and a muted guide win)', () => {
    for (const e of ['nod', 'wave'] as const) {
      expect(stateFor('celebrate', e)).toBe('celebrate')
      expect(stateFor('no', e)).toBe('shrug')
      expect(stateFor('sleep', e)).toBe('sleep')
    }
  })

  it('the nine drawn states are the table of spec 10.2', () => {
    expect([...CHARACTER_STATES].sort()).toEqual(['celebrate', 'idle', 'nod', 'point', 'shrug', 'sleep', 'think', 'walk', 'wave'])
    expect(HOST_EVENT_MS).toEqual({ nod: 600, wave: 1200 })
  })
})

describe('timer plan (pure): step(model, action)', () => {
  it('a host event starts a timer of exactly its duration', () => {
    for (const e of ['nod', 'wave'] as const) {
      const r = step(initialModel(), { type: 'host', event: e })
      expect(r.model.host).toBe(e)
      expect(r.timer).toEqual({ kind: 'start', ms: HOST_EVENT_MS[e] })
    }
  })

  it('the end of the timer returns to the controller state it recorded meanwhile', () => {
    let m = step(initialModel(), { type: 'host', event: 'nod' }).model
    m = step(m, { type: 'vendor', state: 'point' }).model
    expect(stateFor(m.vendor, m.host)).toBe('nod')
    const end = step(m, { type: 'hostEnd' })
    expect(end.model).toEqual({ vendor: 'point', host: null })
    expect(end.timer).toBeNull()
  })

  it('an outranking vendored state cancels the host event and clears its timer (triggers)', () => {
    const m = step(initialModel(), { type: 'host', event: 'wave' }).model
    const r = step(m, { type: 'vendor', state: 'no' })
    expect(r.model).toEqual({ vendor: 'no', host: null })
    expect(r.timer).toEqual({ kind: 'clear' })
  })

  it('a non-outranking vendored state keeps the host event and its timer (does not trigger)', () => {
    const m = step(initialModel(), { type: 'host', event: 'wave' }).model
    const r = step(m, { type: 'vendor', state: 'walk' })
    expect(r.model).toEqual({ vendor: 'walk', host: 'wave' })
    expect(r.timer).toBeNull()
  })

  it('a host event while celebrating, shrugging or asleep is ignored, no timer', () => {
    for (const v of ['celebrate', 'no', 'sleep'] as const) {
      const m = step(initialModel(), { type: 'vendor', state: v }).model
      const r = step(m, { type: 'host', event: 'nod' })
      expect(r.model).toEqual({ vendor: v, host: null })
      expect(r.timer).toBeNull()
    }
  })
})

describe('direction (spec 10.2 pointer): data-dir, the arm mirrored for west', () => {
  it('only west mirrors the arm group (about the vertical axis x = 32)', () => {
    expect(armTransformFor('west')).toBe(ARM_MIRROR)
    expect(ARM_MIRROR).toBe('matrix(-1 0 0 1 64 0)')
    for (const d of ['east', 'north', 'south'] as const) expect(armTransformFor(d)).toBeNull()
  })

  it('setDir writes data-dir and the mirror on the arm; an unknown value is ignored', () => {
    const { c, svg } = build()
    const arm = part(svg, 'arm')
    c.setDir('west')
    expect(svg.getAttribute('data-dir')).toBe('west')
    expect(arm.getAttribute('transform')).toBe(ARM_MIRROR)
    c.setDir('sideways')
    expect(svg.getAttribute('data-dir')).toBe('west')
    c.setDir('north')
    expect(svg.getAttribute('data-dir')).toBe('north')
    expect(arm.getAttribute('transform')).toBeNull()
    expect([...DIRS]).toEqual(['east', 'west', 'north', 'south'])
  })
})

describe('live object: host states end after their duration (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  for (const e of ['nod', 'wave'] as HostEvent[]) {
    it(`${e} lasts ${HOST_EVENT_MS[e]} ms, then the controller's state comes back`, () => {
      const { c, svg } = build()
      c.setState('think')
      c.play(e)
      expect(svg.getAttribute('data-state')).toBe(e)
      c.setState('point') // the controller moved on while the host state runs
      vi.advanceTimersByTime(HOST_EVENT_MS[e] - 1)
      expect(svg.getAttribute('data-state')).toBe(e)
      vi.advanceTimersByTime(1)
      expect(svg.getAttribute('data-state')).toBe('point')
      expect(c.state()).toBe('point')
      expect(vi.getTimerCount()).toBe(0)
    })
  }

  it('a second host event replaces the first: one timer only, its own duration', () => {
    const { c, svg } = build()
    c.play('wave')
    vi.advanceTimersByTime(500)
    c.play('nod')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(600)
    expect(svg.getAttribute('data-state')).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('the vendored no during a wave shows shrug at once and leaves no timer', () => {
    const { c, svg } = build()
    c.play('wave')
    c.setState('no')
    expect(svg.getAttribute('data-state')).toBe('shrug')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('setState with the vendored value: no -> shrug on the svg', () => {
    const { c, svg } = build()
    c.setState('no')
    expect(svg.getAttribute('data-state')).toBe('shrug')
  })
})

describe('destroy clears every timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a running host event timer is cleared, the svg leaves its parent, later calls do nothing', () => {
    const f = fakeDocument()
    const parent = (f.doc.createElementNS(SVG_NS, 'g') as unknown) as FakeNode
    const c = createCharacter(f.doc)
    parent.appendChild(c.svg as unknown as FakeNode)
    c.play('wave')
    expect(vi.getTimerCount()).toBe(1)
    c.destroy()
    expect(vi.getTimerCount()).toBe(0)
    expect(parent.children).toHaveLength(0)
    const svg = c.svg as unknown as FakeNode
    const before = svg.getAttribute('data-state')
    c.play('nod')
    c.setState('point')
    c.setDir('west')
    expect(vi.getTimerCount()).toBe(0)
    expect(svg.getAttribute('data-state')).toBe(before)
    expect(svg.getAttribute('data-dir')).toBe('east')
    c.destroy() // twice is harmless
  })

  it('injected timers: destroy calls clearTimeout with the id setTimeout returned', () => {
    const f = fakeDocument()
    const set = vi.fn((_fn: () => void, _ms: number): unknown => 42)
    const clear = vi.fn((_id: unknown): void => undefined)
    const c = createCharacter(f.doc, { timers: { setTimeout: set, clearTimeout: clear } })
    c.play('nod')
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]).toEqual([expect.any(Function), 600])
    c.destroy()
    expect(clear).toHaveBeenCalledWith(42)
  })
})
