/**
 * The drawer's press state machine (Task 43b fix round, S5): window listeners exist only while an item is pressed, a drag is started past 6 px, ended by a
 * release or a pointer cancel, a lost release (move with no button) is a release, `dispose()` removes everything, and a stuck press (its pointerup never
 * delivered) does not block the next one. Node has no DOM: a minimal fake document that records what the module does.
 */
import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { mountInventoryDrawer, type InventoryDrawerDeps } from '../../src/creation/shell/inventoryDrawer'

const registry = loadCatalog(catalogJson)

type Handler = (e: Record<string, unknown>) => void

class FakeEl {
  children: FakeEl[] = []
  dataset: Record<string, string> = {}
  className = ''
  textContent = ''
  inert = false
  listeners = new Map<string, Handler[]>()
  scrollHeight = 0
  clientHeight = 0
  constructor(readonly tag: string) {}
  setAttribute(): void {}
  removeAttribute(): void {}
  append(...c: FakeEl[]): void {
    this.children.push(...c)
  }
  appendChild(c: FakeEl): FakeEl {
    this.children.push(c)
    return c
  }
  replaceChildren(...c: FakeEl[]): void {
    this.children = c
  }
  removeChild(c: FakeEl): FakeEl {
    this.children = this.children.filter((x) => x !== c)
    return c
  }
  replaceWith(): void {}
  addEventListener(t: string, fn: Handler): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn])
  }
  removeEventListener(): void {}
  focus(): void {}
  releasePointerCapture = vi.fn()
  getBoundingClientRect(): object {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  fire(t: string, e: Record<string, unknown> = {}): void {
    for (const fn of this.listeners.get(t) ?? []) fn(e)
  }
}

function fakeWindow() {
  const l = new Map<string, Set<Handler>>()
  /** The drawer's stay-open watcher (T4.3): a MutationObserver on the view's `data-placing`; the test fires its callbacks by hand. */
  const observers = new Set<{ cb: () => void }>()
  class FakeMutationObserver {
    constructor(readonly cb: () => void) {}
    observe(): void {
      observers.add(this)
    }
    disconnect(): void {
      observers.delete(this)
    }
  }
  const win = {
    MutationObserver: FakeMutationObserver,
    observers,
    mutate: (): void => {
      for (const o of [...observers]) o.cb()
    },
    addEventListener: (t: string, fn: Handler) => void (l.get(t) ?? l.set(t, new Set()).get(t)!).add(fn),
    removeEventListener: (t: string, fn: Handler) => void l.get(t)?.delete(fn),
    fire: (t: string, e: Record<string, unknown>) => {
      for (const fn of [...(l.get(t) ?? [])]) fn(e)
    },
    count: () => [...l.values()].reduce((n, s) => n + s.size, 0),
  }
  return win
}

function setup(over: Partial<InventoryDrawerDeps> = {}, look: { drawer?: string | null; pickerOpen?: boolean } = {}) {
  const win = fakeWindow()
  const created: FakeEl[] = []
  const parent = new FakeEl('div')
  const doc = {
    defaultView: win,
    activeElement: null,
    // the shell writes `data-drawer` on <html> from the active package (T4.3); none = no package
    documentElement: { getAttribute: (name: string): string | null => (name === 'data-drawer' ? (look.drawer ?? null) : null) },
    querySelector: (sel: string): object | null => (look.pickerOpen && sel === '.cr-pick:not([hidden])' ? {} : null),
    createElement: (tag: string) => {
      const e = new FakeEl(tag)
      created.push(e)
      return e
    },
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
  }
  const calls = {
    start: vi.fn((_id: string, _at: { x: number; y: number }, _alt: boolean) => true),
    move: vi.fn(),
    end: vi.fn(),
    choose: vi.fn(),
  }
  const drawer = mountInventoryDrawer({
    doc: doc as never,
    parent: parent as never,
    registry,
    proposals: () => [],
    betaStatus: () => 'ready' as const,
    onChoose: calls.choose,
    returnFocus: () => {},
    isToggleKey: () => false,
    keyLabel: () => 'Espace',
    onDragStart: calls.start,
    onDragMove: calls.move,
    onDragEnd: calls.end,
    ...over,
  })
  drawer.open()
  const items = created.filter((e) => e.className === 'cr-inv-item')
  const item = items[0]
  const down = (it = item, id = 1, x = 100, y = 100, extra: Record<string, unknown> = {}) =>
    it.fire('pointerdown', { pointerId: id, isPrimary: true, button: 0, clientX: x, clientY: y, buttons: 1, altKey: false, ...extra })
  const ev = (id: number, x: number, y: number, extra: Record<string, unknown> = {}) => ({ pointerId: id, clientX: x, clientY: y, buttons: 1, altKey: false, ...extra })
  return { win, drawer, calls, items, item, down, ev, parent, created, doc }
}

describe('drawer press and drag (pointer events)', () => {
  it('has items to press, and no window listener before a press', () => {
    const s = setup()
    expect(s.items.length).toBeGreaterThan(3)
    expect(s.win.count()).toBe(0)
  })

  it('a press adds exactly the three window listeners; a release without travel removes them, starts nothing, and the click still chooses', () => {
    const s = setup()
    s.down()
    expect(s.win.count()).toBe(3)
    s.win.fire('pointermove', s.ev(1, 104, 103)) // 5 px
    s.win.fire('pointerup', s.ev(1, 104, 103))
    expect(s.win.count()).toBe(0)
    expect(s.calls.start).not.toHaveBeenCalled()
    expect(s.calls.end).not.toHaveBeenCalled()
    s.item.fire('click', { detail: 1 })
    expect(s.calls.choose).toHaveBeenCalledTimes(1)
  })

  it('past 6 px: the drag starts once (device, position), the drawer closes, moves are forwarded, the release ends it and removes the listeners; the click after it chooses nothing', () => {
    const s = setup()
    s.down(s.item, 1, 100, 100)
    s.win.fire('pointermove', s.ev(1, 107.1, 100)) // 7.1 px
    expect(s.calls.start).toHaveBeenCalledTimes(1)
    expect(s.calls.start.mock.calls[0][0]).toBe(s.item.dataset.deviceId)
    expect(s.calls.start.mock.calls[0][1]).toEqual({ x: 107.1, y: 100 })
    expect(s.drawer.isOpen).toBe(false)
    s.win.fire('pointermove', s.ev(1, 200, 150))
    expect(s.calls.move).toHaveBeenLastCalledWith({ x: 200, y: 150 }, false)
    expect(s.calls.start).toHaveBeenCalledTimes(1)
    s.win.fire('pointerup', s.ev(1, 210, 160))
    expect(s.calls.end).toHaveBeenCalledWith({ x: 210, y: 160 }, false, false)
    expect(s.win.count()).toBe(0)
    s.item.fire('click', { detail: 0 })
    expect(s.calls.choose).toHaveBeenCalledTimes(1) // a keyboard click (detail 0) is never swallowed
    s.item.fire('click', { detail: 1 })
    expect(s.calls.choose).toHaveBeenCalledTimes(1) // the pointer click right after a drag is
  })

  it('exactly 6 px does not start a drag', () => {
    const s = setup()
    s.down(s.item, 1, 100, 100)
    s.win.fire('pointermove', s.ev(1, 106, 100))
    expect(s.calls.start).not.toHaveBeenCalled()
    s.win.fire('pointerup', s.ev(1, 106, 100))
  })

  it('a pointer cancel after the drag started ends it as cancelled and removes the listeners', () => {
    const s = setup()
    s.down()
    s.win.fire('pointermove', s.ev(1, 160, 100))
    s.win.fire('pointercancel', s.ev(1, 170, 100))
    expect(s.calls.end).toHaveBeenCalledTimes(1)
    expect(s.calls.end.mock.calls[0][2]).toBe(true)
    expect(s.win.count()).toBe(0)
    s.win.fire('pointerup', s.ev(1, 170, 100)) // nothing is listening any more
    expect(s.calls.end).toHaveBeenCalledTimes(1)
  })

  it('a pointer cancel before the threshold (the browser took the gesture for a pan) ends the press quietly', () => {
    const s = setup()
    s.down()
    s.win.fire('pointercancel', s.ev(1, 101, 100))
    expect(s.win.count()).toBe(0)
    expect(s.calls.start).not.toHaveBeenCalled()
    expect(s.calls.end).not.toHaveBeenCalled()
  })

  it('a move with no button down (the pointerup was lost) is the release', () => {
    const s = setup()
    s.down()
    s.win.fire('pointermove', s.ev(1, 160, 100))
    s.win.fire('pointermove', s.ev(1, 170, 100, { buttons: 0 }))
    expect(s.calls.end).toHaveBeenCalledWith({ x: 170, y: 100 }, false, false)
    expect(s.win.count()).toBe(0)
  })

  it('another pointer\'s events are ignored', () => {
    const s = setup()
    s.down(s.item, 1)
    s.win.fire('pointermove', s.ev(2, 300, 300))
    s.win.fire('pointerup', s.ev(2, 300, 300))
    expect(s.calls.start).not.toHaveBeenCalled()
    expect(s.win.count()).toBe(3)
    s.win.fire('pointerup', s.ev(1, 100, 100))
  })

  it('dispose() mid-press removes the listeners; what comes after does nothing', () => {
    const s = setup()
    s.down()
    s.win.fire('pointermove', s.ev(1, 160, 100))
    s.drawer.dispose()
    expect(s.win.count()).toBe(0)
    s.win.fire('pointermove', s.ev(1, 200, 100))
    s.win.fire('pointerup', s.ev(1, 200, 100))
    expect(s.calls.move).not.toHaveBeenCalled()
    expect(s.calls.end).not.toHaveBeenCalled()
  })

  it('S5: a stuck press (its pointerup never came) does not block the next primary pointer; a drag in progress is ended as cancelled', () => {
    const s = setup()
    s.down(s.item, 1, 100, 100)
    s.win.fire('pointermove', s.ev(1, 160, 100)) // dragging, then the pointerup is lost
    s.down(s.items[1], 2, 300, 300) // a new finger on the reopened drawer
    expect(s.calls.end).toHaveBeenCalledTimes(1)
    expect(s.calls.end.mock.calls[0][2]).toBe(true)
    expect(s.win.count()).toBe(3) // one press, not two
    s.win.fire('pointermove', s.ev(2, 340, 300))
    expect(s.calls.start).toHaveBeenCalledTimes(2)
    expect(s.calls.start.mock.calls[1][0]).toBe(s.items[1].dataset.deviceId)
    s.win.fire('pointerup', s.ev(2, 340, 300))
    expect(s.win.count()).toBe(0)
  })

  it('a second finger (not primary) and a right button never start a press', () => {
    const s = setup()
    s.down(s.item, 1, 100, 100, { isPrimary: false })
    s.down(s.item, 1, 100, 100, { button: 2 })
    expect(s.win.count()).toBe(0)
  })

  it('N5: a drag the shell refuses (false) leaves the drawer open and ends the press', () => {
    const s = setup({ onDragStart: () => false })
    s.down()
    s.win.fire('pointermove', s.ev(1, 160, 100))
    expect(s.drawer.isOpen).toBe(true)
    expect(s.win.count()).toBe(0)
  })

  it('without drag callbacks a press adds no listener at all (the click-only drawer of before)', () => {
    const s = setup({ onDragStart: undefined, onDragMove: undefined, onDragEnd: undefined })
    s.down()
    expect(s.win.count()).toBe(0)
  })
})

describe('stay-open (design package layout, plan T4.3): the drawer comes back when the pose it started is over', () => {
  /** What the host does: a pose started by a choice or a drag marks the view `data-placing`; the end removes it. */
  const poseOn = (s: ReturnType<typeof setup>): void => void (s.parent.dataset.placing = 'true')
  const poseOff = (s: ReturnType<typeof setup>): void => {
    delete s.parent.dataset.placing
    s.win.mutate()
  }
  const open = (over: Partial<InventoryDrawerDeps> = {}, look: { drawer?: string | null; pickerOpen?: boolean } = { drawer: 'stay-open' }) => setup(over, look)

  it('a choice closes the drawer for the pose and the end of the pose opens it again, once, with nothing left watching', () => {
    let s!: ReturnType<typeof setup>
    s = open({ onChoose: () => poseOn(s) })
    s.item.fire('click', { detail: 1 })
    expect(s.drawer.isOpen).toBe(false)
    expect(s.win.observers.size).toBe(1)
    poseOff(s)
    expect(s.drawer.isOpen).toBe(true)
    expect(s.win.observers.size).toBe(0)
    poseOn(s) // a pose that did not come from the drawer: nothing is waiting for it
    poseOff(s)
    expect(s.drawer.isOpen).toBe(true)
  })

  it('close-after-place (or no package): the drawer stays closed, and nothing watches', () => {
    for (const look of [{ drawer: 'close-after-place' }, { drawer: null }]) {
      let s!: ReturnType<typeof setup>
      s = open({ onChoose: () => poseOn(s) }, look)
      s.item.fire('click', { detail: 1 })
      expect(s.win.observers.size).toBe(0)
      poseOff(s)
      expect(s.drawer.isOpen).toBe(false)
    }
  })

  it('S5 (a): a choice the host refused (no pose started) brings the drawer back at once and arms nothing: a later pose is not the drawer own', () => {
    const s = open()
    s.item.fire('click', { detail: 1 })
    expect(s.drawer.isOpen).toBe(true)
    expect(s.win.observers.size).toBe(0)
    s.drawer.close()
    poseOn(s)
    poseOff(s)
    expect(s.drawer.isOpen).toBe(false)
  })

  it('round 2: after a refused choice made with Enter in the filter field, the focus goes back to the field (the drawer opens without taking it from the keyboard user)', () => {
    const s = open()
    const field = s.created.find((e) => e.className === 'cr-drawer-filter-input')!
    const focus = vi.fn()
    field.focus = focus
    ;(s.doc as unknown as { activeElement: unknown }).activeElement = field
    s.item.fire('click', { detail: 0 }) // a refused choice
    expect(s.drawer.isOpen).toBe(true)
    expect(focus).toHaveBeenCalledTimes(1)
    // not from the field (a click on a card): the focus is left where it is
    focus.mockClear()
    ;(s.doc as unknown as { activeElement: unknown }).activeElement = null
    s.item.fire('click', { detail: 1 })
    expect(focus).not.toHaveBeenCalled()
  })

  it('S5 (b): the filter text the learner typed is still there when the drawer comes back after a pose (a normal open clears it)', () => {
    let s!: ReturnType<typeof setup>
    s = open({ onChoose: () => poseOn(s) })
    const field = s.created.find((e) => e.className === 'cr-drawer-filter-input')!
    ;(field as unknown as { value: string }).value = 'sm58'
    s.item.fire('click', { detail: 1 })
    poseOff(s)
    expect(s.drawer.isOpen).toBe(true)
    expect((field as unknown as { value: string }).value).toBe('sm58')
    s.drawer.close()
    s.drawer.open() // by hand: the field is cleared as it always was
    expect((field as unknown as { value: string }).value).toBe('')
  })

  it('S5 (c): with a host path (`reopen`) the return goes through it, not around it (the host dismisses a pinned refusal, syncs the Bêta sheets, refuses while the view is locked)', () => {
    const reopen = vi.fn()
    let s!: ReturnType<typeof setup>
    s = open({ onChoose: () => poseOn(s), reopen })
    s.item.fire('click', { detail: 1 })
    expect(reopen).not.toHaveBeenCalled() // the pose is on
    poseOff(s)
    expect(reopen).toHaveBeenCalledTimes(1)
    expect(s.drawer.isOpen).toBe(false) // the host decides when it opens (here a spy: it did not)
    // a refused choice goes through the same path, at once
    s.item.fire('click', { detail: 1 }) // closed drawer: nothing to choose from, no second call
    expect(reopen).toHaveBeenCalledTimes(1)
  })

  it('a pose that ends while the place picker covers the workspace does not bring the drawer back over it', () => {
    let s!: ReturnType<typeof setup>
    s = open({ onChoose: () => poseOn(s) }, { drawer: 'stay-open', pickerOpen: true })
    s.item.fire('click', { detail: 1 })
    poseOff(s)
    expect(s.drawer.isOpen).toBe(false)
    expect(s.win.observers.size).toBe(0)
  })

  it('a drag out of the drawer is a pose too: it comes back when the drag ends', () => {
    let s!: ReturnType<typeof setup>
    s = open({ onDragStart: () => (poseOn(s), true) })
    s.down(s.item, 1, 100, 100)
    s.win.fire('pointermove', s.ev(1, 160, 100))
    expect(s.drawer.isOpen).toBe(false)
    s.win.fire('pointerup', s.ev(1, 200, 100))
    poseOff(s)
    expect(s.drawer.isOpen).toBe(true)
  })

  it('opened by hand while a pose is in progress, or disposed: nothing is left watching', () => {
    let s!: ReturnType<typeof setup>
    s = open({ onChoose: () => poseOn(s) })
    s.item.fire('click', { detail: 1 })
    expect(s.win.observers.size).toBe(1)
    s.drawer.open()
    expect(s.win.observers.size).toBe(0)
    s.drawer.close()
    s.item.fire('click', { detail: 1 }) // choose again from the reopened (now closed) drawer: armed once more
    s.drawer.open()
    s.item.fire('click', { detail: 1 })
    expect(s.win.observers.size).toBe(1)
    s.drawer.dispose()
    expect(s.win.observers.size).toBe(0)
  })
})
