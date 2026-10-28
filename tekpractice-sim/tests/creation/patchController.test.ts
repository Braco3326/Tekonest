import { afterEach, describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { PortRef } from '../../src/engine/types'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { DisposableBag } from '../../src/util/disposable'
import { PatchController, type PatchHost, type PatchUi } from '../../src/creation/patchController'
import { portKey, type PortMark } from '../../src/creation/portProxies'

const registry = loadCatalog(catalogJson)

class FakeCanvas extends EventTarget {
  focus = vi.fn()
}

const SM58_OUT: PortRef = { instance: 'sm58', port: 'out-xlr' }
const QL_MIC1: PortRef = { instance: 'ql1', port: 'in-mic-1' }
const QL_MIC2: PortRef = { instance: 'ql1', port: 'in-mic-2' }
const K12_POWER: PortRef = { instance: 'k12', port: 'power-in' }

/** Points on the fake canvas: the pointer's px map to a port through `at`. */
function setup(over: { busy?: () => boolean } = {}) {
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [0, 0, 0] })
  history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [1, 0, 0] })
  history.do({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12', position: [2, 0, 0] })
  history.clear()
  const canvas = new FakeCanvas()
  const hits = new Map<string, PortRef>() // "x,y" -> the port under that canvas point
  const aim = (x: number, y: number, ref: PortRef): void => void hits.set(`${x},${y}`, ref)
  let walking = false
  const marks: { hover: PortRef | null; marks: ReadonlyMap<string, PortMark> | null }[] = []
  const host: PatchHost = {
    canvasElement: canvas as unknown as HTMLElement,
    get walking() {
      return walking
    },
    portAtPoint: (x, y) => hits.get(`${x},${y}`) ?? null,
    portScreen: (r) => ({ x: 100 + r.port.length, y: 50 }),
    markPorts: (hover, m) => void marks.push({ hover, marks: m }),
    onPortViewChange: null,
  }
  const calls = {
    hover: [] as string[],
    hideHover: 0,
    errors: [] as string[],
    clearError: 0,
    offers: [] as { text: string; buttonName: string; onUnplug: () => void }[],
    clearOffer: 0,
  }
  const ui: PatchUi = {
    showHover: (t) => void calls.hover.push(t),
    moveHover: () => {},
    hideHover: () => void calls.hideHover++,
    pinError: (t) => void calls.errors.push(t),
    moveError: () => {},
    clearError: () => void calls.clearError++,
    offerUnplug: (o) => void calls.offers.push({ text: o.text, buttonName: o.buttonName, onUnplug: o.onUnplug }),
    moveOffer: () => {},
    clearOffer: () => void calls.clearOffer++,
    hasFocus: () => false,
  }
  const scheduler = { invalidate: vi.fn() }
  const announce = vi.fn()
  const bag = new DisposableBag()
  const ctrl = new PatchController(host, history, store, scheduler as never, bag, {
    ui,
    busy: over.busy ?? (() => false),
    describe: (r) => `desc:${r.instance}.${r.port}`,
    portName: (r) => `${r.instance} · ${r.port}`,
    allPorts: () =>
      store.design().rig.instances.flatMap((i) => registry.deviceById.get(i.deviceId)!.ports.map((p) => ({ instance: i.instanceId, port: p.portId }))),
    rejectionTitle: (e) => `title:${e.ruleId ?? e.code}`,
    announce,
    undoLabel: () => 'Ctrl+Z',
  })
  return { store, history, canvas, host, ui, calls, marks, ctrl, announce, aim, scheduler, bag, setWalking: (w: boolean) => (walking = w) }
}

const lastMarks = (s: ReturnType<typeof setup>) => s.marks[s.marks.length - 1]?.marks ?? null
const ev = (type: string, init: Record<string, unknown> = {}) => {
  const e = new Event(type, { cancelable: true }) as Event & Record<string, unknown>
  // Event has read-only getters (timeStamp): own properties shadow them.
  for (const [k, v] of Object.entries({ button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1, buttons: 0, timeStamp: 0, offsetX: 0, offsetY: 0, ...init }))
    Object.defineProperty(e, k, { value: v, configurable: true })
  const stop = vi.spyOn(e, 'stopImmediatePropagation')
  return Object.assign(e, { stop })
}
const click = (s: ReturnType<typeof setup>, x: number, y: number) => {
  s.canvas.dispatchEvent(ev('pointerdown', { offsetX: x, offsetY: y, timeStamp: 1000 }))
  const up = ev('pointerup', { offsetX: x, offsetY: y, timeStamp: 1100 })
  s.canvas.dispatchEvent(up)
  return up
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('click a first port: pending + green / dim', () => {
  it('a free port becomes pending; compatible ports glow ok, the rest dim, the pending one is marked', () => {
    const s = setup()
    expect(s.ctrl.pending).toBeNull()
    expect(s.ctrl.click(SM58_OUT)).toBe(true)
    expect(s.ctrl.pending).toEqual(SM58_OUT)
    const m = lastMarks(s)!
    expect(m.get(portKey(SM58_OUT))).toBe('pending')
    expect(m.get(portKey(QL_MIC1))).toBe('ok') // out -> in, XLR male -> female, mic -> mic
    expect(m.get(portKey(K12_POWER))).toBe('dim') // a mains inlet is not a mic input
    expect(m.get(portKey({ instance: 'ql1', port: 'out-main-l' }))).toBe('dim') // out -> out (R3)
    expect(s.announce).toHaveBeenCalledWith(expect.stringContaining('sm58 · out-xlr'))
  })

  it('a second click on the pending port cancels the cable (no history entry)', () => {
    const s = setup()
    s.ctrl.click(SM58_OUT)
    s.ctrl.click(SM58_OUT)
    expect(s.ctrl.pending).toBeNull()
    expect(lastMarks(s)).toBeNull()
    expect(s.history.sizes.undo).toBe(0)
  })
})

describe('click a second port', () => {
  it('a compatible port connects as ONE undo entry and clears the pending state', () => {
    const s = setup()
    s.ctrl.click(SM58_OUT)
    s.ctrl.click(QL_MIC2)
    expect(s.store.design().rig.connections).toHaveLength(1)
    expect(s.history.sizes.undo).toBe(1)
    expect(s.history.undoLabel).toBe('Brancher sm58 · out-xlr à ql1 · in-mic-2')
    expect(s.ctrl.pending).toBeNull()
    expect(lastMarks(s)).toBeNull()
    expect(s.announce).toHaveBeenLastCalledWith(expect.stringContaining('Branché'))
    s.history.undo()
    expect(s.store.design().rig.connections).toHaveLength(0)
  })

  it('a refused connection pins the rule title at the second port, never throws, records nothing, keeps the first port', () => {
    const s = setup()
    s.ctrl.click(K12_POWER) // an input...
    expect(() => s.ctrl.click(QL_MIC2)).not.toThrow() // ...to an input: R3
    expect(s.calls.errors).toEqual([expect.stringContaining('title:R3')])
    expect(s.store.design().rig.connections).toHaveLength(0)
    expect(s.history.sizes.undo).toBe(0)
    expect(s.ctrl.pending).toEqual(K12_POWER) // the cable stays in hand for a retry
    expect(s.ctrl.errorAt).toEqual(QL_MIC2)
  })

  it('the refusal reaches the status list through history.onRefused', () => {
    const s = setup()
    const refused = vi.fn()
    s.history.onRefused(refused)
    s.ctrl.click(K12_POWER)
    s.ctrl.click(QL_MIC2)
    expect(refused).toHaveBeenCalledTimes(1)
    expect(refused.mock.calls[0][0].type).toBe('CONNECT')
  })

  it('a retry that works clears the pinned error', () => {
    const s = setup()
    s.ctrl.click(SM58_OUT)
    s.ctrl.click({ instance: 'ql1', port: 'out-main-l' }) // out -> out
    expect(s.ctrl.errorAt).not.toBeNull()
    const clears = s.calls.clearError
    s.ctrl.click(QL_MIC1)
    expect(s.ctrl.errorAt).toBeNull()
    expect(s.calls.clearError).toBeGreaterThan(clears)
    expect(s.store.design().rig.connections).toHaveLength(1)
  })

  it('an occupied second port is a refusal (PORT_OCCUPIED), not an unplug offer', () => {
    const s = setup()
    s.history.do({ type: 'CONNECT', a: SM58_OUT, b: QL_MIC1 })
    s.ctrl.click({ instance: 'ql1', port: 'out-main-l' })
    s.ctrl.click(QL_MIC1)
    expect(s.calls.errors[0]).toContain('title:PORT_OCCUPIED')
    expect(s.calls.offers).toHaveLength(0)
  })
})

describe('click an occupied port: « Débrancher »', () => {
  it('with nothing pending it offers to unplug; confirming dispatches UNPLUG as ONE undo entry', () => {
    const s = setup()
    s.history.do({ type: 'CONNECT', a: SM58_OUT, b: QL_MIC1 })
    const before = s.history.sizes.undo
    s.ctrl.click(QL_MIC1)
    expect(s.ctrl.pending).toBeNull()
    expect(s.calls.offers).toHaveLength(1)
    expect(s.calls.offers[0].text).toContain('ql1 · in-mic-1')
    expect(s.calls.offers[0].text).toContain('sm58 · out-xlr')
    expect(s.store.design().rig.connections).toHaveLength(1) // an offer changes nothing
    s.calls.offers[0].onUnplug()
    expect(s.store.design().rig.connections).toHaveLength(0)
    expect(s.history.sizes.undo).toBe(before + 1)
    expect(s.history.peekUndo()!.forward[0].type).toBe('UNPLUG')
    s.history.undo()
    expect(s.store.design().rig.connections).toHaveLength(1)
  })

  it('Esc (cancel) closes the offer', () => {
    const s = setup()
    s.history.do({ type: 'CONNECT', a: SM58_OUT, b: QL_MIC1 })
    s.ctrl.click(SM58_OUT)
    expect(s.ctrl.cancel()).toBe(true)
    expect(s.calls.clearOffer).toBeGreaterThan(0)
  })
})

describe('inert while something else owns the pointer', () => {
  it('a placement ghost or an open drag: no pending, no offer, no hover', () => {
    let busy = true
    const s = setup({ busy: () => busy })
    expect(s.ctrl.click(SM58_OUT)).toBe(false)
    expect(s.ctrl.pending).toBeNull()
    s.aim(5, 5, SM58_OUT)
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 5, offsetY: 5 }))
    expect(s.calls.hover).toEqual([])
    busy = false
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 5, offsetY: 5 }))
    expect(s.calls.hover).toHaveLength(1)
  })

  it('the walk view: nothing', () => {
    const s = setup()
    s.setWalking(true)
    expect(s.ctrl.click(SM58_OUT)).toBe(false)
    expect(s.ctrl.pending).toBeNull()
  })

  it('a pending cable survives a placement and is still there after it', () => {
    let busy = false
    const s = setup({ busy: () => busy })
    s.ctrl.click(SM58_OUT)
    busy = true
    expect(s.ctrl.click(QL_MIC2)).toBe(false) // the click that drops a ghost is not a connection
    expect(s.store.design().rig.connections).toHaveLength(0)
    busy = false
    expect(s.ctrl.pending).toEqual(SM58_OUT)
  })
})

describe('Esc', () => {
  it('cancel() clears the pending cable and the pinned error in one go; false when there was nothing', () => {
    const s = setup()
    expect(s.ctrl.cancel()).toBe(false)
    s.ctrl.click(K12_POWER)
    s.ctrl.click(QL_MIC2) // refused: error pinned, cable still in hand
    expect(s.ctrl.cancel()).toBe(true)
    expect(s.ctrl.pending).toBeNull()
    expect(s.ctrl.errorAt).toBeNull()
    expect(lastMarks(s)).toBeNull()
    expect(s.ctrl.cancel()).toBe(false)
    expect(s.history.sizes.undo).toBe(0)
  })
})

describe('the rig changes under a pending cable', () => {
  it('removing the pending port’s device drops the cable', () => {
    const s = setup()
    s.ctrl.click(SM58_OUT)
    s.history.do({ type: 'REMOVE', instanceId: 'sm58' })
    expect(s.ctrl.pending).toBeNull()
    expect(lastMarks(s)).toBeNull()
  })

  it('a new design (a place change, Nouveau) clears pending, error and offer', () => {
    const s = setup()
    s.ctrl.click(K12_POWER)
    s.ctrl.click(QL_MIC2)
    s.history.do({ type: 'APPLY_DESIGN', design: { roomId: null, rig: { instances: [], connections: [], controls: {} }, placements: [] } })
    expect(s.ctrl.pending).toBeNull()
    expect(s.ctrl.errorAt).toBeNull()
  })

  it('another cable taking a port while a cable is pending updates the glow', () => {
    const s = setup()
    s.ctrl.click({ instance: 'ql1', port: 'out-main-l' })
    expect(lastMarks(s)!.get(portKey({ instance: 'k12', port: 'in-line-a' }))).toBe('ok')
    s.history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm2', position: [3, 0, 0] })
    s.history.do({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12', port: 'in-line-a' } })
    expect(lastMarks(s)!.get(portKey({ instance: 'k12', port: 'in-line-a' }))).toBe('dim')
  })
})

describe('hover label (never permanent)', () => {
  it('shows once for the port under the pointer, not again for the same port, hides on leave', () => {
    const s = setup()
    s.aim(10, 10, QL_MIC1)
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 10, offsetY: 10 }))
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 10, offsetY: 10 }))
    expect(s.calls.hover).toEqual(['desc:ql1.in-mic-1'])
    expect(s.marks[s.marks.length - 1].hover).toEqual(QL_MIC1)
    s.canvas.dispatchEvent(ev('pointerleave'))
    expect(s.calls.hideHover).toBeGreaterThan(0)
    expect(s.marks[s.marks.length - 1].hover).toBeNull()
  })

  it('moving off the port hides the label; a button held (an orbit drag) shows none', () => {
    const s = setup()
    s.aim(10, 10, QL_MIC1)
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 10, offsetY: 10 }))
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 99, offsetY: 99 }))
    expect(s.calls.hideHover).toBeGreaterThan(0)
    const n = s.calls.hover.length
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 10, offsetY: 10, buttons: 1 }))
    expect(s.calls.hover.length).toBe(n)
  })

  it('no hover label on the port that already carries the pinned error (one label per port)', () => {
    const s = setup()
    s.ctrl.click(K12_POWER)
    s.ctrl.click(QL_MIC2)
    const n = s.calls.hover.length
    s.aim(7, 7, QL_MIC2)
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 7, offsetY: 7 }))
    expect(s.calls.hover.length).toBe(n)
  })
})

describe('pointer clicks', () => {
  it('a press-and-release on a port is a patch click; the release is NOT stopped (the camera pointer input must see it, or it keeps orbiting)', () => {
    const s = setup()
    s.aim(20, 20, SM58_OUT)
    const up = click(s, 20, 20)
    expect(s.ctrl.pending).toEqual(SM58_OUT)
    expect(up.stop).not.toHaveBeenCalled()
  })

  it('a press that travelled (an orbit drag) is not a click', () => {
    const s = setup()
    s.aim(20, 20, SM58_OUT)
    s.canvas.dispatchEvent(ev('pointerdown', { offsetX: 60, offsetY: 60, timeStamp: 1000 }))
    const up = ev('pointerup', { offsetX: 20, offsetY: 20, timeStamp: 1100 })
    s.canvas.dispatchEvent(up)
    expect(s.ctrl.pending).toBeNull()
    expect(up.stop).not.toHaveBeenCalled()
  })

  it('a click that is not on a port is left to the select / miss handlers', () => {
    const s = setup()
    const up = click(s, 300, 300)
    expect(s.ctrl.pending).toBeNull()
    expect(up.stop).not.toHaveBeenCalled()
  })

  it('right button, touch-less secondary pointers and modifier pans are not patch clicks', () => {
    const s = setup()
    s.aim(20, 20, SM58_OUT)
    s.canvas.dispatchEvent(ev('pointerdown', { offsetX: 20, offsetY: 20, button: 2 }))
    s.canvas.dispatchEvent(ev('pointerup', { offsetX: 20, offsetY: 20, button: 2 }))
    expect(s.ctrl.pending).toBeNull()
    s.canvas.dispatchEvent(ev('pointerdown', { offsetX: 20, offsetY: 20, shiftKey: true }))
    s.canvas.dispatchEvent(ev('pointerup', { offsetX: 20, offsetY: 20, shiftKey: true }))
    expect(s.ctrl.pending).toBeNull()
  })

  it('while busy (a drag of the selected device) the release is left alone: nothing is taken from the drag', () => {
    const s = setup({ busy: () => true })
    s.aim(20, 20, SM58_OUT)
    const up = click(s, 20, 20)
    expect(s.ctrl.pending).toBeNull()
    expect(up.stop).not.toHaveBeenCalled()
  })

  it('clickAt (the release of a click on the selected device) takes a port click, and says no on anything else', () => {
    const s = setup()
    s.aim(20, 20, SM58_OUT)
    expect(s.ctrl.clickAt(20, 20)).toBe(true)
    expect(s.ctrl.pending).toEqual(SM58_OUT)
    expect(s.ctrl.clickAt(99, 99)).toBe(false)
  })
})

describe('wouldTake (the shell asks it before the release handler runs)', () => {
  it('is true on a port, false elsewhere, and changes nothing', () => {
    const s = setup()
    s.aim(20, 20, SM58_OUT)
    expect(s.ctrl.wouldTake(20, 20)).toBe(true)
    expect(s.ctrl.wouldTake(99, 99)).toBe(false)
    expect(s.ctrl.pending).toBeNull()
    expect(s.marks).toHaveLength(0)
  })

  it('is false while inert (a ghost, a drag, the walk view)', () => {
    let busy = true
    const s = setup({ busy: () => busy })
    s.aim(20, 20, SM58_OUT)
    expect(s.ctrl.wouldTake(20, 20)).toBe(false)
    busy = false
    s.setWalking(true)
    expect(s.ctrl.wouldTake(20, 20)).toBe(false)
  })
})

describe('release', () => {
  it('disposing the bag removes every listener and clears the host hook; nothing reacts afterwards', () => {
    const live = DisposableBag.liveListeners
    const s = setup()
    expect(DisposableBag.liveListeners).toBeGreaterThan(live)
    expect(s.host.onPortViewChange).toBeTypeOf('function')
    s.ctrl.click(SM58_OUT)
    s.bag.dispose()
    expect(DisposableBag.liveListeners).toBe(live)
    expect(s.host.onPortViewChange).toBeNull()
    expect(s.ctrl.pending).toBeNull()
    s.aim(10, 10, QL_MIC1)
    s.canvas.dispatchEvent(ev('pointermove', { offsetX: 10, offsetY: 10 }))
    expect(s.calls.hover).toEqual([])
    // and a store change no longer calls into the controller
    expect(() => s.history.do({ type: 'REMOVE', instanceId: 'sm58' })).not.toThrow()
  })

  it('reset() (a place change) clears pending, error and offer', () => {
    const s = setup()
    s.ctrl.click(K12_POWER)
    s.ctrl.click(QL_MIC2)
    s.ctrl.reset()
    expect(s.ctrl.pending).toBeNull()
    expect(s.ctrl.errorAt).toBeNull()
  })
})
