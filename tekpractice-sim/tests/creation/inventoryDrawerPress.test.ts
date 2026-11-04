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
  const win = {
    addEventListener: (t: string, fn: Handler) => void (l.get(t) ?? l.set(t, new Set()).get(t)!).add(fn),
    removeEventListener: (t: string, fn: Handler) => void l.get(t)?.delete(fn),
    fire: (t: string, e: Record<string, unknown>) => {
      for (const fn of [...(l.get(t) ?? [])]) fn(e)
    },
    count: () => [...l.values()].reduce((n, s) => n + s.size, 0),
  }
  return win
}

function setup(over: Partial<InventoryDrawerDeps> = {}) {
  const win = fakeWindow()
  const created: FakeEl[] = []
  const doc = {
    defaultView: win,
    activeElement: null,
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
    parent: new FakeEl('div') as never,
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
  return { win, drawer, calls, items, item, down, ev }
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
