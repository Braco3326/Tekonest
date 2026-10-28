import { describe, expect, it, vi } from 'vitest'
import type { PortRef } from '../../src/engine/types'
import { CableHoverController, type CableHoverHost, type CableHoverUi } from '../../src/creation/cableHover'
import { DisposableBag } from '../../src/util/disposable'

class FakeCanvas extends EventTarget {}

const ev = (type: string, init: Record<string, unknown> = {}) => {
  const e = new Event(type, { cancelable: true })
  for (const [k, v] of Object.entries({ pointerType: 'mouse', buttons: 0, offsetX: 0, offsetY: 0, clientX: 0, clientY: 0, ...init }))
    Object.defineProperty(e, k, { value: v, configurable: true })
  return e
}

/** A fake page: `cableAt` maps canvas points to cables, `portAt` to ports, `deviceAt` to devices. */
function setup(over: { busy?: () => boolean } = {}) {
  const canvas = new FakeCanvas()
  const cables = new Map<string, string>()
  const ports = new Map<string, PortRef>()
  const devices = new Set<string>()
  let walking = false
  const key = (x: number, y: number): string => `${x},${y}`
  const views: (() => void)[] = []
  const picks = { port: 0, device: 0, cable: 0 }
  const calls = { highlighted: [] as (string | null)[], shown: [] as { text: string; at: { x: number; y: number } }[], moved: [] as { x: number; y: number }[], hidden: 0 }
  const host: CableHoverHost = {
    canvasElement: canvas as unknown as HTMLElement,
    get walking() {
      return walking
    },
    cableAtPoint: (x, y) => (picks.cable++, cables.get(key(x, y)) ?? null),
    portAtPoint: (x, y) => (picks.port++, ports.get(key(x, y)) ?? null),
    setHoveredCable: (k) => void calls.highlighted.push(k),
    listenView: (fn) => {
      views.push(fn)
      return () => void views.splice(views.indexOf(fn), 1)
    },
  }
  const ui: CableHoverUi = {
    showHover: (text, at) => void calls.shown.push({ text, at }),
    moveHover: (at) => void calls.moved.push(at),
    hideHover: () => void calls.hidden++,
  }
  const storeListeners: (() => void)[] = []
  const bag = new DisposableBag()
  const ctrl = new CableHoverController(host, bag, {
    ui,
    busy: over.busy ?? (() => false),
    deviceAt: (x, y) => (picks.device++, devices.has(key(x, y))),
    describe: (k) => (k === 'unknown' ? null : `text:${k}`),
    subscribe: (fn) => {
      storeListeners.push(fn)
      return () => void storeListeners.splice(storeListeners.indexOf(fn), 1)
    },
  })
  const move = (x: number, y: number, init: Record<string, unknown> = {}): void =>
    void canvas.dispatchEvent(ev('pointermove', { offsetX: x, offsetY: y, clientX: x + 300, clientY: y + 40, ...init }))
  return {
    canvas, cables, ports, devices, calls, picks, ctrl, bag, move, key, views, storeListeners,
    setWalking: (w: boolean) => (walking = w),
    aimCable: (x: number, y: number, id: string) => void cables.set(key(x, y), id),
    aimPort: (x: number, y: number) => void ports.set(key(x, y), { instance: 'i', port: 'p' }),
    aimDevice: (x: number, y: number) => void devices.add(key(x, y)),
  }
}

describe('hovering a cable', () => {
  it('highlights it and shows its text at the pointer (page px)', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    expect(s.ctrl.hovered).toBe('k1')
    expect(s.calls.highlighted).toEqual(['k1'])
    expect(s.calls.shown).toEqual([{ text: 'text:k1', at: { x: 310, y: 50 } }])
  })
  it('over no cable: nothing is highlighted, nothing is shown, and no label is hidden (it may be a port label)', () => {
    const s = setup()
    s.move(5, 5)
    s.move(6, 6)
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.highlighted).toEqual([])
    expect(s.calls.shown).toEqual([])
    expect(s.calls.hidden).toBe(0)
  })
  it('moving along the same cable repositions the label without re-highlighting', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimCable(20, 10, 'k1')
    s.move(10, 10)
    s.move(20, 10)
    expect(s.calls.highlighted).toEqual(['k1'])
    expect(s.calls.shown).toHaveLength(1)
    expect(s.calls.moved).toEqual([{ x: 320, y: 50 }])
  })
  it('moving to another cable switches the highlight and the text', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimCable(30, 10, 'k2')
    s.move(10, 10)
    s.move(30, 10)
    expect(s.calls.highlighted).toEqual(['k1', 'k2'])
    expect(s.calls.shown.map((c) => c.text)).toEqual(['text:k1', 'text:k2'])
  })
  it('leaving the cable clears the highlight and hides the label once', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.move(50, 50)
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(1)
    s.move(60, 60)
    expect(s.calls.highlighted).toEqual(['k1', null]) // idle: nothing more
    expect(s.calls.hidden).toBe(1)
  })
  it('a cable the text cannot describe (gone from the design) is not hovered', () => {
    const s = setup()
    s.aimCable(10, 10, 'unknown')
    s.move(10, 10)
    expect(s.calls.highlighted).toEqual([])
    expect(s.calls.shown).toEqual([])
  })
})

describe('priority: a port or a device under the pointer wins', () => {
  it('a port under the pointer: no cable hover, and the port label (shown by the patch controller) is left alone', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimPort(10, 10)
    s.move(10, 10)
    expect(s.calls.highlighted).toEqual([])
    expect(s.calls.shown).toEqual([])
    expect(s.calls.hidden).toBe(0)
  })
  it('the pointer slides from a cable onto a port: the cable highlight goes, the label is NOT hidden (it is the port label now)', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimCable(12, 10, 'k1')
    s.aimPort(12, 10)
    s.move(10, 10)
    s.move(12, 10)
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(0)
    expect(s.ctrl.hovered).toBeNull()
  })
  it('a device under the pointer: no cable hover; sliding onto one hides the cable label', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimCable(12, 10, 'k1')
    s.aimDevice(12, 10)
    s.move(12, 10)
    expect(s.calls.highlighted).toEqual([])
    s.move(10, 10)
    expect(s.ctrl.hovered).toBe('k1')
    s.move(12, 10)
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(1)
  })
})

describe('cost: the cheap cable test goes first (the shell already does two scene picks per move)', () => {
  it('no cable near the pointer: ZERO port and device picks on a move, however many moves', () => {
    const s = setup()
    for (let i = 0; i < 20; i++) s.move(5 + i, 5)
    expect(s.picks.cable).toBe(20)
    expect(s.picks.port).toBe(0)
    expect(s.picks.device).toBe(0)
  })
  it('a camera change with the pointer resting on no cable costs no scene pick either', () => {
    const s = setup()
    s.move(5, 5)
    for (let i = 0; i < 10; i++) s.views[0]!()
    expect(s.picks.port).toBe(0)
    expect(s.picks.device).toBe(0)
  })
  it('the scene picks run only near a cable (to see whether a port or a device wins)', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    expect(s.picks.port).toBe(1)
    expect(s.picks.device).toBe(1)
  })
  it('the pointer slides off a cable onto a port farther than the cable tolerance: the label is the port label, not hidden here', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.aimPort(30, 10) // no cable within reach of (30, 10)
    s.move(10, 10)
    s.move(30, 10)
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(0)
  })
  it('the pointer slides off a cable onto nothing: the label is hidden once', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.move(30, 10)
    expect(s.calls.hidden).toBe(1)
  })
})

describe('inert states', () => {
  it('a button held (an orbit drag), a touch pointer, a placement (busy) and the walk view show no hover and clear a showing one', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.move(10, 10, { buttons: 1 })
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.highlighted).toEqual(['k1', null])
    s.move(10, 10, { pointerType: 'touch' })
    expect(s.ctrl.hovered).toBeNull()
    s.setWalking(true)
    s.move(10, 10)
    expect(s.ctrl.hovered).toBeNull()
    s.setWalking(false)
    s.move(10, 10)
    expect(s.ctrl.hovered).toBe('k1')
  })
  it('busy (a ghost or a drag owns the pointer)', () => {
    let busy = false
    const s = setup({ busy: () => busy })
    s.aimCable(10, 10, 'k1')
    busy = true
    s.move(10, 10)
    expect(s.calls.highlighted).toEqual([])
    busy = false
    s.move(10, 10)
    expect(s.ctrl.hovered).toBe('k1')
    busy = true
    s.move(10, 10)
    expect(s.ctrl.hovered).toBeNull()
  })
  it('the pointer leaving the canvas clears the hover', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.canvas.dispatchEvent(ev('pointerleave'))
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.hidden).toBe(1)
  })
})

describe('the view and the rig change under the pointer', () => {
  it('a camera move or a resize re-reads the cable under the last pointer position: the label follows, or goes', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    expect(s.views).toHaveLength(1)
    s.views[0]!() // the camera moved but the cable is still there
    expect(s.calls.moved.length).toBe(1)
    s.cables.clear() // ... now the cable is elsewhere
    s.views[0]!()
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(1)
  })
  it('a view change with the pointer outside the canvas does nothing', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.canvas.dispatchEvent(ev('pointerleave'))
    s.views[0]!()
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.shown).toHaveLength(1)
  })
  it('a rig change drops the hover (the cable may be gone); the next move picks again', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.storeListeners[0]!()
    expect(s.ctrl.hovered).toBeNull()
    expect(s.calls.highlighted).toEqual(['k1', null])
    s.move(10, 10)
    expect(s.ctrl.hovered).toBe('k1')
  })
  it('reset (a place change) drops the hover and forgets the pointer', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.ctrl.reset()
    expect(s.ctrl.hovered).toBeNull()
    s.views[0]!()
    expect(s.ctrl.hovered).toBeNull() // no pointer known: a view change picks nothing
  })
})

describe('teardown', () => {
  it('dispose removes every listener, hides the label and clears the highlight', () => {
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    const before = DisposableBag.liveListeners
    s.bag.dispose()
    expect(DisposableBag.liveListeners).toBeLessThan(before)
    expect(s.calls.highlighted).toEqual(['k1', null])
    expect(s.calls.hidden).toBe(1)
    expect(s.views).toHaveLength(0)
    expect(s.storeListeners).toHaveLength(0)
    const n = s.calls.highlighted.length
    s.move(10, 10)
    expect(s.calls.highlighted).toHaveLength(n)
  })
  it('does not work by itself: no timer is scheduled by a hover', () => {
    const timer = vi.spyOn(globalThis, 'setTimeout')
    const s = setup()
    s.aimCable(10, 10, 'k1')
    s.move(10, 10)
    s.move(50, 50)
    expect(timer).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
