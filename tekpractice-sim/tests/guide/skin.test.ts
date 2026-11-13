// The host-side skin of the new Oscar (plan T5.3 to T5.5, spec 10.1 to 10.3): the pure pieces (scope gate, ring bearing, which host state a change
// plays, the mute default) and the attach seam with a fake DOM (no browser in node: the real DOM is proven by tests/e2e/character.spec.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { packageById } from '../../src/design/packages'
import {
  BADGE_CLASS,
  GUIDE_MUTE_KEY,
  SKIN,
  attachSkin,
  dirFor,
  hostEventFor,
  muteDefaultStorage,
  quietByDefault,
  skinAllowed,
  stepAdvanced,
  type Celebrations,
} from '../../src/guide/skin'
import { HOST_CLASS } from '../../src/guide/character'
import { RESTORE_BURST } from '../../src/guide/restore'
import { RESTORE_BURST as MOUNT_RESTORE_BURST } from '../../src/guide/mount'
import { DEFAULT_STORAGE_KEY, createController } from '../../src/guide/vendor/core/controller'

describe('skinAllowed (controller ruling 4): the new Oscar only under ?design=1..5 in Mode Création', () => {
  it('triggers on ?design=1..5 (creation route)', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(skinAllowed(`?design=${n}`, 'creation')).toBe(true)
  })
  it('does not trigger on the plain address, a bad ?design, or the legacy route', () => {
    for (const s of ['', '?design=0', '?design=6', '?design=x', '?oscar=1']) expect(skinAllowed(s, 'creation')).toBe(false)
    expect(skinAllowed('?design=1', 'legacy')).toBe(false)
  })
})

describe('dirFor: the ring bearing seen from the icon, on four axes', () => {
  const at = (x: number, y: number) => ({ x: x - 5, y: y - 5, w: 10, h: 10 })
  const icon = at(500, 400)
  it('east, west, north, south by the larger component', () => {
    expect(dirFor(icon, at(800, 450))).toBe('east')
    expect(dirFor(icon, at(100, 300))).toBe('west')
    expect(dirFor(icon, at(520, 100))).toBe('north')
    expect(dirFor(icon, at(470, 700))).toBe('south')
  })
  it('a tie goes horizontal; a ring on the icon (no bearing) is null', () => {
    expect(dirFor(icon, at(600, 500))).toBe('east')
    expect(dirFor(icon, at(400, 300))).toBe('west')
    expect(dirFor(icon, at(500, 400))).toBeNull()
  })
  it('round 1, N8: a ring on the exact diagonal is horizontal (the tie rule), one pixel off it is the larger axis: a fixed answer, never a flip', () => {
    expect(dirFor(icon, at(600, 300))).toBe('east') // dx 100, dy -100
    expect(dirFor(icon, at(400, 500))).toBe('west') // dx -100, dy 100
    expect(dirFor(icon, at(600, 299))).toBe('north') // dy -101
    expect(dirFor(icon, at(601, 300))).toBe('east')
    expect(dirFor(icon, at(499, 501))).toBe('south') // dx -1, dy 101
    for (let i = 0; i < 3; i++) expect(dirFor(icon, at(600, 300))).toBe('east')
  })
  it('a rect that is not finite gives null', () => {
    expect(dirFor(icon, { x: Number.NaN, y: 0, w: 1, h: 1 })).toBeNull()
  })
})

describe('hostEventFor (spec 10.2 « celebrate sparingly »)', () => {
  const none: Celebrations = { connected: false, sounded: false }
  const ev = (type: string) => ({ type, at: 1 })
  it('the first accepted connection of the session celebrates; the next one nods', () => {
    const a = hostEventFor([ev('connect')], none)
    expect(a).toEqual({ event: 'celebrate', seen: { connected: true, sounded: false } })
    expect(hostEventFor([ev('connect')], a.seen).event).toBe('nod')
  })
  it('the first sound celebrates, a later sound plays nothing', () => {
    const a = hostEventFor([ev('playStarted')], { connected: true, sounded: false })
    expect(a).toEqual({ event: 'celebrate', seen: { connected: true, sounded: true } })
    expect(hostEventFor([ev('playStarted')], a.seen).event).toBeNull()
  })
  it('a refused connection shrugs (outranks a nod of the same change, not a celebration)', () => {
    expect(hostEventFor([ev('connectRefused')], none).event).toBe('shrug')
    expect(hostEventFor([ev('connect'), ev('connectRefused')], { connected: true, sounded: false }).event).toBe('shrug')
    expect(hostEventFor([ev('connect'), ev('connectRefused')], none).event).toBe('celebrate')
  })
  it('round 1, N2: a change the app made (appChange in the same poll: undo, redo, a load, the power helper) is not the learner’s: no state, nothing spent', () => {
    expect(hostEventFor([ev('connect'), ev('appChange')], none)).toEqual({ event: null, seen: none })
    expect(hostEventFor([ev('connect'), ev('appChange')], { connected: true, sounded: false }).event).toBeNull()
    // a sound is still a sound, and a refusal still a refusal
    expect(hostEventFor([ev('playStarted'), ev('appChange')], none).event).toBe('celebrate')
    expect(hostEventFor([ev('connectRefused'), ev('appChange')], none).event).toBe('shrug')
  })
  it('round 1, N3: the restore burst is the one shared constant', () => {
    expect(RESTORE_BURST).toBe(3)
    expect(MOUNT_RESTORE_BURST).toBe(RESTORE_BURST)
  })
  it('does not trigger: no event, other events, or a restore burst (more than three devices in one poll)', () => {
    expect(hostEventFor([], none)).toEqual({ event: null, seen: none })
    expect(hostEventFor([ev('deviceAdded'), ev('toggle'), ev('disconnect')], none).event).toBeNull()
    const burst = [ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded'), ev('connect')]
    expect(hostEventFor(burst, none)).toEqual({ event: null, seen: none })
  })
})

describe('stepAdvanced (a step done = nod)', () => {
  const run = (k: number) => ({ status: 'running' as const, k })
  it('triggers: the next step of a running tutorial, or its end', () => {
    expect(stepAdvanced(run(3), run(4))).toBe(true)
    expect(stepAdvanced(run(10), { status: 'done', k: 0 })).toBe(true)
  })
  it('does not trigger: a start, the same step, a restart, a skip of the whole tutorial, an interruption, no previous look', () => {
    expect(stepAdvanced({ status: 'idle', k: 0 }, run(1))).toBe(false)
    expect(stepAdvanced(run(4), run(4))).toBe(false)
    expect(stepAdvanced(run(6), run(1))).toBe(false)
    expect(stepAdvanced(run(6), { status: 'skipped', k: 0 })).toBe(false)
    expect(stepAdvanced(run(6), { status: 'idle', k: 0 })).toBe(false)
    expect(stepAdvanced(null, run(2))).toBe(false)
  })
})

describe('quietByDefault (T5.5): package proactive false, or the sound engineer profile', () => {
  it('triggers: package 4, or the « metier » profile on any package', () => {
    expect(packageById(4).oscar.proactive).toBe(false)
    expect(quietByDefault(packageById(4), null)).toBe(true)
    for (const n of [1, 2, 3, 5] as const) expect(quietByDefault(packageById(n), 'metier')).toBe(true)
  })
  it('does not trigger: the other packages with the other profiles or none; no package at all (the plain address keeps today)', () => {
    for (const n of [1, 2, 3, 5] as const) for (const p of [null, 'decouvre', 'etudie', 'projet', 'nobody', 4]) expect(quietByDefault(packageById(n), p)).toBe(false)
    expect(quietByDefault(null, 'metier')).toBe(false)
  })
})

describe('muteDefaultStorage (T5.5): the default only where nothing is stored', () => {
  const base = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init))
    return {
      m,
      s: { getItem: vi.fn((k: string) => m.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void m.set(k, v)), removeItem: vi.fn((k: string) => void m.delete(k)) },
    }
  }
  it('the mute key reads « 1 » when nothing is stored and the policy says quiet (triggers)', () => {
    const b = base()
    expect(muteDefaultStorage(b.s, () => true).getItem(GUIDE_MUTE_KEY)).toBe('1')
    expect(GUIDE_MUTE_KEY).toBe(`${DEFAULT_STORAGE_KEY}.muted`)
  })
  it('a stored choice always wins; another key is untouched; a policy that says speak reads nothing (does not trigger)', () => {
    expect(muteDefaultStorage(base({ [GUIDE_MUTE_KEY]: '0' }).s, () => true).getItem(GUIDE_MUTE_KEY)).toBe('0')
    expect(muteDefaultStorage(base({ [GUIDE_MUTE_KEY]: '1' }).s, () => false).getItem(GUIDE_MUTE_KEY)).toBe('1')
    expect(muteDefaultStorage(base({ other: 'x' }).s, () => true).getItem('other')).toBe('x')
    expect(muteDefaultStorage(base().s, () => false).getItem(GUIDE_MUTE_KEY)).toBeNull()
  })
  it('writes and removals go through; the default is never written by the wrapper itself', () => {
    const b = base()
    const w = muteDefaultStorage(b.s, () => true)
    w.getItem(GUIDE_MUTE_KEY)
    expect(b.s.setItem).not.toHaveBeenCalled()
    w.setItem(GUIDE_MUTE_KEY, '0')
    expect(b.m.get(GUIDE_MUTE_KEY)).toBe('0')
    expect(w.getItem(GUIDE_MUTE_KEY)).toBe('0')
    w.removeItem?.('x')
    expect(b.s.removeItem).toHaveBeenCalledWith('x')
  })
  it('the real vendored controller starts muted through it, writes nothing until the learner acts, and an unmute is stored', async () => {
    const b = base()
    const c = createController({ brain: { ask: async () => ({ kind: 'answer', text: '', lines: [] }) } as never, flows: [], clock: () => 0, storage: muteDefaultStorage(b.s, () => true) })
    expect(c.getView().muted).toBe(true)
    expect(b.m.has(GUIDE_MUTE_KEY)).toBe(false)
    await c.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    await c.dispatch({ type: 'chip', id: 'mute' })
    expect(c.getView().muted).toBe(false)
    expect(b.m.get(GUIDE_MUTE_KEY)).toBe('0')
    const again = createController({ brain: {} as never, flows: [], clock: () => 0, storage: muteDefaultStorage(b.s, () => true) })
    expect(again.getView().muted, 'the learner who unmuted stays unmuted').toBe(false)
  })
})

// ── attachSkin with a fake DOM ─────────────────────────────────────────────────────────────────────────────────────

interface El {
  tag: string
  cls: Set<string>
  attrs: Map<string, string>
  children: El[]
  parent: El | null
  text: string
  rect: { left: number; top: number; width: number; height: number }
  hidden: boolean
}
function fakeDom(o: { drop?: string } = {}) {
  const made: El[] = []
  const el = (tag: string, cls: string[] = [], attrs: Record<string, string> = {}): El => {
    const e: El = { tag, cls: new Set(cls), attrs: new Map(Object.entries(attrs)), children: [], parent: null, text: '', rect: { left: 0, top: 0, width: 0, height: 0 }, hidden: false }
    made.push(e)
    return e
  }
  const add = (p: El, c: El): El => {
    if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c)
    c.parent = p
    p.children.push(c)
    return c
  }
  const landmark = el('aside')
  const root = add(landmark, el('div', ['oscar-guide']))
  const ring = add(root, el('div', ['oscar-ring']))
  add(root, el('div', ['oscar-ring', 'oscar-ring-drop']))
  const wrap = add(root, el('div', ['oscar-icon-wrap']))
  const icon = add(wrap, el('button', ['oscar-icon'], { 'aria-expanded': 'false' }))
  const mascot = add(icon, el('svg', ['oscar-mascot'], { 'data-state': 'idle' }))
  const bubble = add(root, el('div', ['oscar-bubble']))
  const header = add(bubble, el('div', ['oscar-header']))
  const title = add(header, el('div', ['oscar-title']))
  add(header, el('button', ['oscar-mute']))
  icon.rect = { left: 500, top: 400, width: 56, height: 56 }
  ring.rect = { left: 100, top: 410, width: 40, height: 40 }
  const matches = (e: El, sel: string): boolean => {
    const [base, not] = sel.split(':not(')
    const m = /^(\w+)?((?:\.[\w-]+)*)$/.exec(base)
    if (!m) return false
    if (m[1] && m[1] !== e.tag) return false
    for (const c of m[2].split('.').filter(Boolean)) if (!e.cls.has(c)) return false
    if (not) return !matches(e, not.replace(/\)$/, ''))
    return true
  }
  const live = (e: El): unknown => {
    const node = {
      __el: e,
      classList: { add: (c: string) => void e.cls.add(c), remove: (c: string) => void e.cls.delete(c), contains: (c: string) => e.cls.has(c) },
      getAttribute: (k: string) => e.attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => void e.attrs.set(k, v),
      removeAttribute: (k: string) => void e.attrs.delete(k),
      get hidden() {
        return e.hidden
      },
      set textContent(v: string) {
        e.text = v
      },
      get textContent() {
        return e.text
      },
      get parentNode() {
        return e.parent ? live(e.parent) : null
      },
      get nextSibling() {
        if (!e.parent) return null
        const i = e.parent.children.indexOf(e)
        const n = e.parent.children[i + 1]
        return n ? live(n) : null
      },
      getBoundingClientRect: () => ({ ...e.rect, x: e.rect.left, y: e.rect.top, right: e.rect.left + e.rect.width, bottom: e.rect.top + e.rect.height }),
      querySelector: (sel: string) => {
        if (o.drop !== undefined && sel === o.drop) return null
        const walk = (n: El): El | null => {
          for (const c of n.children) {
            if (matches(c, sel)) return c
            const d = walk(c)
            if (d) return d
          }
          return null
        }
        const f = walk(e)
        return f ? live(f) : null
      },
      appendChild: (c: { __el: El }) => add(e, c.__el) && c,
      insertBefore: (c: { __el: El }, ref: { __el: El } | null) => {
        if (c.__el.parent) c.__el.parent.children = c.__el.parent.children.filter((x) => x !== c.__el)
        c.__el.parent = e
        const i = ref ? e.children.indexOf(ref.__el) : -1
        if (i < 0) e.children.push(c.__el)
        else e.children.splice(i, 0, c.__el)
        return c
      },
      removeChild: (c: { __el: El }) => {
        e.children = e.children.filter((x) => x !== c.__el)
        c.__el.parent = null
        return c
      },
      remove: () => {
        if (e.parent) e.parent.children = e.parent.children.filter((x) => x !== e)
        e.parent = null
      },
    }
    return node
  }
  const doc = {
    createElement: (tag: string) => live(el(tag)),
    createElementNS: (_ns: string, tag: string) => live(el(tag)),
  }
  const observers: FakeObserver[] = []
  class FakeObserver {
    targets: { el: El; opts: MutationObserverInit }[] = []
    disconnected = false
    constructor(public cb: (records: { target: unknown; attributeName: string | null }[]) => void) {
      observers.push(this)
    }
    observe(t: { __el: El }, opts: MutationObserverInit): void {
      this.targets.push({ el: t.__el, opts })
    }
    disconnect(): void {
      this.disconnected = true
    }
    fire(e: El, attributeName: string): void {
      this.cb([{ target: live(e), attributeName }])
    }
  }
  return { landmark: live(landmark) as ParentNode, doc: doc as unknown as Document, Observer: FakeObserver as unknown as typeof MutationObserver, observers, root, icon, mascot, ring, wrap, header, title, made }
}

describe('attachSkin (T5.3, T5.4): the character on the vendored icon, mirrored by one MutationObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const attach = (d: ReturnType<typeof fakeDom>) => attachSkin(d.landmark, { doc: d.doc, Observer: d.Observer, badge: 'Oscar · Assistant' })

  it('puts the host class on the .oscar-guide root, the character svg in .oscar-icon, the badge right after the title', () => {
    const d = fakeDom()
    const s = attach(d)
    expect(s).not.toBeNull()
    expect(d.root.cls.has(HOST_CLASS)).toBe(true)
    expect(d.icon.cls.has(HOST_CLASS)).toBe(false)
    const svg = d.icon.children.find((c) => c.tag === 'svg' && c !== d.mascot)!
    expect(svg.attrs.get('class')).toBe('tpo')
    expect(d.header.children.indexOf(d.title) + 1).toBe(d.header.children.findIndex((c) => c.cls.has(BADGE_CLASS)))
    expect(d.header.children.find((c) => c.cls.has(BADGE_CLASS))!.text).toBe('Oscar · Assistant')
  })

  it('pin: a vendored part missing (renamed by a re-vendor) attaches nothing: no host class, no svg, no badge, no observer', () => {
    for (const sel of [SKIN.root, SKIN.icon, SKIN.mascot, SKIN.ring, SKIN.iconWrap, SKIN.header, SKIN.title]) {
      const d = fakeDom({ drop: sel })
      expect(attach(d), sel).toBeNull()
      expect(d.root.cls.has(HOST_CLASS), sel).toBe(false)
      expect(d.observers, sel).toHaveLength(0)
      expect(d.header.children.some((c) => c.cls.has(BADGE_CLASS)), sel).toBe(false)
    }
  })

  it('round 1, N4: the badge is aria-hidden (the vendored title carries the meaning for a screen reader)', () => {
    const d = fakeDom()
    attach(d)
    expect(d.header.children.find((c) => c.cls.has(BADGE_CLASS))!.attrs.get('aria-hidden')).toBe('true')
  })

  it('round 1, S4: the vendored celebrate is drawn as a nod once the session’s two celebrations are spent; before, it celebrates', () => {
    const d = fakeDom()
    const s = attach(d)!
    d.mascot.attrs.set('data-state', 'celebrate')
    d.observers[0].fire(d.mascot, 'data-state')
    expect(s.character.state()).toBe('celebrate')
    d.mascot.attrs.set('data-state', 'idle')
    d.observers[0].fire(d.mascot, 'data-state')
    s.setCelebrationsSpent(true)
    d.mascot.attrs.set('data-state', 'celebrate')
    d.observers[0].fire(d.mascot, 'data-state')
    expect(s.character.state()).toBe('nod')
    vi.advanceTimersByTime(600)
    expect(s.character.state()).toBe('idle')
    // a host celebration still running is not cut by the mapped nod (ranks)
    s.play('celebrate')
    d.mascot.attrs.set('data-state', 'point')
    d.observers[0].fire(d.mascot, 'data-state')
    d.mascot.attrs.set('data-state', 'celebrate')
    d.observers[0].fire(d.mascot, 'data-state')
    expect(s.character.state()).toBe('celebrate')
  })

  it('one observer, attributes only: data-state on svg.oscar-mascot, style and hidden on the ring, style on the icon wrap, aria-expanded on the icon', () => {
    const d = fakeDom()
    attach(d)
    expect(d.observers).toHaveLength(1)
    const t = d.observers[0].targets.map((x) => [x.el, x.opts.attributeFilter, x.opts.attributes, x.opts.childList ?? false, x.opts.subtree ?? false])
    expect(t).toEqual([
      [d.mascot, ['data-state'], true, false, false],
      [d.ring, ['style', 'hidden'], true, false, false],
      [d.wrap, ['style'], true, false, false],
      [d.icon, ['aria-expanded'], true, false, false],
    ])
  })

  it('mirrors data-state: the vendored no draws shrug; an unchanged attribute draws nothing new', () => {
    const d = fakeDom()
    const s = attach(d)!
    const svg = () => d.icon.children.find((c) => c.attrs.get('class') === 'tpo')!
    d.mascot.attrs.set('data-state', 'no')
    d.observers[0].fire(d.mascot, 'data-state')
    expect(svg().attrs.get('data-state')).toBe('shrug')
    d.mascot.attrs.set('data-state', 'point')
    d.observers[0].fire(d.mascot, 'data-state')
    expect(s.character.state()).toBe('point')
  })

  it('data-dir follows the ring (west here, then north after the ring moved); a hidden ring keeps the last direction', () => {
    const d = fakeDom()
    attach(d)
    const svg = () => d.icon.children.find((c) => c.attrs.get('class') === 'tpo')!
    expect(svg().attrs.get('data-dir')).toBe('west')
    d.ring.rect = { left: 510, top: 50, width: 40, height: 40 }
    d.observers[0].fire(d.ring, 'style')
    expect(svg().attrs.get('data-dir')).toBe('north')
    d.ring.hidden = true
    d.ring.rect = { left: 900, top: 420, width: 40, height: 40 }
    d.observers[0].fire(d.ring, 'hidden')
    expect(svg().attrs.get('data-dir')).toBe('north')
  })

  it('the first open of the bubble waves, once per mount (aria-expanded true); a close or a second open does not', () => {
    const d = fakeDom()
    const s = attach(d)!
    d.icon.attrs.set('aria-expanded', 'true')
    d.observers[0].fire(d.icon, 'aria-expanded')
    expect(s.character.state()).toBe('wave')
    vi.advanceTimersByTime(1200)
    expect(s.character.state()).toBe('idle')
    d.icon.attrs.set('aria-expanded', 'false')
    d.observers[0].fire(d.icon, 'aria-expanded')
    d.icon.attrs.set('aria-expanded', 'true')
    d.observers[0].fire(d.icon, 'aria-expanded')
    expect(s.character.state()).toBe('idle')
  })

  it('destroy disconnects the observer, removes the svg, the badge and the host class; twice is safe; no timer left', () => {
    const d = fakeDom()
    const s = attach(d)!
    s.play('wave')
    s.destroy()
    s.destroy()
    expect(d.observers[0].disconnected).toBe(true)
    expect(d.root.cls.has(HOST_CLASS)).toBe(false)
    expect(d.icon.children).toEqual([d.mascot])
    expect(d.header.children.some((c) => c.cls.has(BADGE_CLASS))).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('no MutationObserver in the environment: nothing is attached (the vendored mascot stays as it is)', () => {
    const d = fakeDom()
    expect(attachSkin(d.landmark, { doc: d.doc, Observer: undefined, badge: 'x' })).toBeNull()
    expect(d.root.cls.has(HOST_CLASS)).toBe(false)
  })
})
