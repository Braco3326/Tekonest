/**
 * ControlController without a browser: window and canvas are stand-ins, picking is scripted, the rig and the bank are real (NullEngine).
 * What it proves: a press on a control of the SELECTED device is taken (and stopped), a drag maps to the value as documented, keys and
 * switches behave, a double-click resets, and a press anywhere else is left alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Ray, Scene, TransformNode, Vector3, type ArcRotateCamera } from '@babylonjs/core'
import { ControlBank } from '../../src/controls/controlBank'
import { ControlRig } from '../../src/controls/controlRig'
import { parseControlLayout } from '../../src/controls/controlTypes'
import { ControlController } from '../../src/creation/controlController'
import { DisposableBag } from '../../src/util/disposable'
import type { DeviceInstance } from '../../src/scene/DeviceSpawner'

const RAW = {
  schema: 1,
  deviceId: 'dev',
  controls: [
    { id: 'fader', kind: 'fader', face: 'top', xMm: 200, yMm: 100, axis: 'y', travelMm: 100, default: 0.75, taper: 'fader-db', label: 'Master', sizeMm: { w: 14, h: 30, d: 12 } },
    { id: 'knob', kind: 'knob', face: 'top', xMm: 300, yMm: 100, default: 0.5, sizeMm: { w: 20, h: 20, d: 14 } },
    { id: 'on', kind: 'button', face: 'top', xMm: 100, yMm: 50, default: 1, group: 'g', sizeMm: { w: 17, h: 19, d: 5 } },
    { id: 'off', kind: 'button', face: 'top', xMm: 100, yMm: 80, default: 0, group: 'g', sizeMm: { w: 17, h: 19, d: 5 } },
    { id: 'push', kind: 'button', face: 'top', xMm: 140, yMm: 50, default: 0, latch: false, sizeMm: { w: 17, h: 19, d: 5 } },
    { id: 'sw', kind: 'switch', face: 'top', xMm: 160, yMm: 50, positions: 3, default: 0, sizeMm: { w: 10, h: 10, d: 12 } },
  ],
}

const g = globalThis as Record<string, unknown>
let saved: { window: unknown; document: unknown }

class FakeWindow extends EventTarget {}

function setup(selected: string | null = 'd1') {
  const win = new FakeWindow()
  g.window = win
  const hud = { style: {} as Record<string, string>, textContent: '', setAttribute() {}, remove: vi.fn() }
  g.document = { createElement: () => hud, body: { appendChild: vi.fn() } }
  const scene = new Scene(new NullEngine())
  const root = new TransformNode('dev', scene)
  const { layout } = parseControlLayout(RAW)
  const bank = new ControlBank(layout!.controls)
  const rig = new ControlRig(scene, root, 'd1', bank, { w: 400, h: 100, d: 300 })
  const inst = { instanceId: 'd1', controls: { bank, rig } } as unknown as DeviceInstance
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }), style: { cursor: '' } } as unknown as HTMLElement

  // Picking is scripted: whichever control `at` names is under the pointer, nothing in front of it.
  const state = { at: null as string | null, ray: new Ray(Vector3.Zero(), Vector3.Down()) }
  const pads = new Map(rig.pads().map((p) => [p.metadata.controlId as string, p]))
  const pick = vi.fn((_x: number, _y: number, pred?: (m: never) => boolean) => {
    if (state.at && pred && pred(pads.get(state.at) as never)) return { hit: true, pickedMesh: pads.get(state.at), distance: 1 }
    return { hit: false, pickedMesh: null, distance: 0 }
  })
  const host = {
    scene: { pick, createPickingRay: () => state.ray } as unknown as Scene,
    camera: {} as ArcRotateCamera,
    canvas,
    instance: (id: string) => (id === 'd1' ? inst : undefined),
    selected: () => selected,
    invalidate: vi.fn(),
  }
  const bag = new DisposableBag()
  new ControlController(host, bag)
  const slide = rig.slideOf('fader')!

  /** A ray that meets the fader's plane at `along` metres from the slot start. */
  const rayAt = (along: number): void => {
    const point = slide.origin.add(slide.dir.scale(along))
    state.ray = new Ray(point.add(slide.normal.scale(0.5)), slide.normal.scale(-1))
  }

  let t = 1000
  const fire = (type: string, over: Record<string, unknown> = {}): { stopped: boolean } => {
    const ev = new Event(type, { cancelable: true }) as Event & Record<string, unknown>
    let stopped = false
    const orig = ev.stopImmediatePropagation.bind(ev)
    ev.stopImmediatePropagation = () => {
      stopped = true
      orig()
    }
    const props: Record<string, unknown> = {
      target: canvas,
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      buttons: 0,
      timeStamp: t,
      ...over,
    }
    for (const [k, v] of Object.entries(props)) Object.defineProperty(ev, k, { value: v })
    win.dispatchEvent(ev)
    return { stopped }
  }
  const advance = (ms: number): void => {
    t += ms
  }
  return { bank, rig, state, host, bag, hud, fire, rayAt, advance, win }
}

beforeEach(() => {
  saved = { window: g.window, document: g.document }
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  g.window = saved.window
  g.document = saved.document
})

describe('ControlController', () => {
  it('a press on a fader of the selected device is taken and stopped; dragging maps the pointer ray to the value along the slot', () => {
    const s = setup()
    s.state.at = 'fader'
    s.rayAt(0.075) // on the cap at 0.75 of the travel
    expect(s.fire('pointerdown', { clientX: 10, clientY: 10 }).stopped).toBe(true)
    expect(s.bank.get('fader')).toBeCloseTo(0.75, 6) // grabbing does not jump the cap
    s.rayAt(0.045) // 30 mm back toward the start
    const move = s.fire('pointermove', { clientX: 10, clientY: 30, buttons: 1 })
    expect(move.stopped).toBe(true)
    expect(s.bank.get('fader')).toBeCloseTo(0.45, 5)
    s.fire('pointerup')
    expect(s.hud.textContent).toMatch(/^Master · /)
    // released: a later move changes nothing
    s.rayAt(0.0)
    s.fire('pointermove', { buttons: 0 })
    expect(s.bank.get('fader')).toBeCloseTo(0.45, 5)
  })

  it('Shift makes the drag fine (a fifth of the motion) and the value stays inside 0..1', () => {
    const s = setup()
    s.state.at = 'fader'
    s.rayAt(0.075)
    s.fire('pointerdown')
    s.rayAt(0.045)
    s.fire('pointermove', { shiftKey: true, buttons: 1 })
    expect(s.bank.get('fader')).toBeCloseTo(0.75 - 0.3 / 5, 5)
    s.rayAt(5)
    s.fire('pointermove', { buttons: 1 })
    expect(s.bank.get('fader')).toBe(1)
  })

  it('leaves a press alone when the device is not selected, off any control, with a camera modifier, or with another button', () => {
    const s = setup(null)
    s.state.at = 'fader'
    s.rayAt(0.075)
    expect(s.fire('pointerdown').stopped).toBe(false)

    const t = setup('d1')
    t.state.at = null
    expect(t.fire('pointerdown').stopped).toBe(false)
    t.state.at = 'fader'
    t.rayAt(0.075)
    expect(t.fire('pointerdown', { ctrlKey: true }).stopped).toBe(false)
    expect(t.fire('pointerdown', { button: 2 }).stopped).toBe(false)
    expect(t.fire('pointerdown', { isPrimary: false }).stopped).toBe(false)
  })

  it('a knob turns up when the pointer goes up (220 px = the full range), Shift is fine', () => {
    const s = setup()
    s.state.at = 'knob'
    s.fire('pointerdown', { clientX: 100, clientY: 200 })
    s.fire('pointermove', { clientX: 100, clientY: 156, buttons: 1 }) // 44 px up
    expect(s.bank.get('knob')).toBeCloseTo(0.7, 6)
    s.fire('pointermove', { clientX: 100, clientY: 178, buttons: 1, shiftKey: true }) // 22 px down, fine
    expect(s.bank.get('knob')).toBeCloseTo(0.7 - 0.1 / 5, 6)
    s.fire('pointerup')
  })

  it('a latching key toggles on press; a radio key that is already pressed stays; a momentary key is on only while held', () => {
    const s = setup()
    s.state.at = 'on'
    s.fire('pointerdown')
    s.fire('pointerup')
    expect(s.bank.get('on')).toBe(1) // the pressed key of a radio pair stays pressed
    s.state.at = 'off'
    s.fire('pointerdown')
    s.fire('pointerup')
    expect(s.bank.get('off')).toBe(1)
    expect(s.bank.get('on')).toBe(0) // the pair excluded the other
    s.state.at = 'push'
    s.fire('pointerdown')
    expect(s.bank.get('push')).toBe(1)
    s.fire('pointerup')
    expect(s.bank.get('push')).toBe(0)
  })

  it('a switch steps to the next position and wraps', () => {
    const s = setup()
    s.state.at = 'sw'
    for (const want of [1, 2, 0]) {
      s.fire('pointerdown')
      s.fire('pointerup')
      expect(s.bank.get('sw')).toBe(want)
      s.advance(1000)
    }
  })

  it('a double-click on a fader or a knob puts it back to its default', () => {
    const s = setup()
    s.bank.set('knob', 0.9)
    s.state.at = 'knob'
    s.fire('pointerdown')
    s.fire('pointerup')
    s.advance(100)
    s.fire('pointerdown')
    expect(s.bank.get('knob')).toBe(0.5)

    s.bank.set('fader', 0.1)
    s.state.at = 'fader'
    s.rayAt(0.01)
    s.fire('pointerdown')
    s.fire('pointerup')
    s.advance(100)
    s.fire('pointerdown')
    expect(s.bank.get('fader')).toBe(0.75)
  })

  it('shows the value while held and asks for frames; dispose removes the listeners', () => {
    const s = setup()
    s.state.at = 'fader'
    s.rayAt(0.075)
    s.fire('pointerdown')
    expect(s.hud.textContent).toMatch(/Master · −?\d/)
    expect(s.host.invalidate).toHaveBeenCalled()
    s.fire('pointerup')
    s.bag.dispose()
    s.state.at = 'knob'
    expect(s.fire('pointerdown').stopped).toBe(false)
  })
})

describe('ControlController: going into a screen', () => {
  it('two quick presses on bare glass (nothing of the app under them) ask the host to go into the screen and are stopped; a single press is left alone', () => {
    const win = new FakeWindow()
    g.window = win
    g.document = { createElement: () => ({ style: {}, setAttribute() {}, remove() {} }), body: { appendChild() {} } }
    const scene = new Scene(new NullEngine())
    const root = new TransformNode('dev', scene)
    const { layout } = parseControlLayout({
      schema: 1,
      deviceId: 'dev',
      controls: [{ id: 'scr', kind: 'screen', face: 'top', xMm: 200, yMm: 100, sizeMm: { w: 200, h: 100, d: 2 }, screen: { app: 'mixer-overview', pxW: 400, pxH: 200 } }],
    })
    const bank = new ControlBank(layout!.controls)
    const rig = new ControlRig(scene, root, 'd1', bank, { w: 400, h: 100, d: 300 })
    const inst = { instanceId: 'd1', controls: { bank, rig } } as unknown as DeviceInstance
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }), style: { cursor: '' } } as unknown as HTMLElement
    const pad = rig.pads()[0]
    const focusScreen = vi.fn()
    const part = rig.part('scr')!
    part.node.computeWorldMatrix(true)
    const c = part.node.getAbsolutePosition()
    const ray = new Ray(new Vector3(c.x, c.y + 0.5, c.z), new Vector3(0, -1, 0))
    const host = {
      scene: { pick: () => ({ hit: true, pickedMesh: pad, distance: 1 }), createPickingRay: () => ray } as unknown as Scene,
      camera: {} as ArcRotateCamera,
      canvas,
      instance: (id: string) => (id === 'd1' ? inst : undefined),
      selected: () => 'd1',
      invalidate: vi.fn(),
      focusScreen,
    }
    const bag = new DisposableBag()
    new ControlController(host, bag)
    let t = 1000
    const press = (): boolean => {
      const ev = new Event('pointerdown', { cancelable: true }) as Event & Record<string, unknown>
      let stopped = false
      const orig = ev.stopImmediatePropagation.bind(ev)
      ev.stopImmediatePropagation = () => {
        stopped = true
        orig()
      }
      for (const [k, v] of Object.entries({ target: canvas, button: 0, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, timeStamp: t }))
        Object.defineProperty(ev, k, { value: v })
      win.dispatchEvent(ev)
      return stopped
    }
    expect(press()).toBe(false) // first press on a screen with no app under it: the camera's
    expect(focusScreen).not.toHaveBeenCalled()
    t += 200
    expect(press()).toBe(true) // second, quickly: into the screen
    expect(focusScreen).toHaveBeenCalledWith('d1', 'scr')
    t += 900
    expect(press()).toBe(false) // too slow: a new first press
    bag.dispose()
  })
})

describe('ControlController: while a device is being placed', () => {
  it('is inert: a press on a control belongs to the placement', () => {
    const s = setup()
    s.state.at = 'fader'
    s.rayAt(0.075)
    ;(s.host as unknown as { busy: () => boolean }).busy = () => true
    expect(s.fire('pointerdown').stopped).toBe(false)
    ;(s.host as unknown as { busy: () => boolean }).busy = () => false
    expect(s.fire('pointerdown').stopped).toBe(true)
  })
})

describe('ControlController: Alt + wheel', () => {
  const wheel = (s: ReturnType<typeof setup>, over: Record<string, unknown> = {}): { stopped: boolean } => {
    const ev = new Event('wheel', { cancelable: true }) as Event & Record<string, unknown>
    let stopped = false
    const orig = ev.stopImmediatePropagation.bind(ev)
    ev.stopImmediatePropagation = () => {
      stopped = true
      orig()
    }
    const props: Record<string, unknown> = { target: s.host.canvas, altKey: true, shiftKey: false, clientX: 5, clientY: 5, deltaY: -100, ...over }
    for (const [k, v] of Object.entries(props)) Object.defineProperty(ev, k, { value: v })
    s.win.dispatchEvent(ev)
    return { stopped }
  }

  it('nudges a fader or knob 2 % a notch (0.5 % with Shift), tells the simulation once after the wheel is still, and leaves the plain wheel to the camera', () => {
    const s = setup()
    const committed = vi.fn()
    ;(s.host as unknown as { committed: typeof committed }).committed = committed
    s.state.at = 'knob'
    expect(wheel(s).stopped).toBe(true)
    expect(s.bank.get('knob')).toBeCloseTo(0.52, 6)
    wheel(s, { deltaY: 100 })
    wheel(s, { deltaY: 100, shiftKey: true })
    expect(s.bank.get('knob')).toBeCloseTo(0.52 - 0.02 - 0.005, 6)
    expect(committed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(committed).toHaveBeenCalledTimes(1)
    expect(committed.mock.calls[0][1].id).toBe('knob')
    // the plain wheel (no Alt) is the camera's; a key is not wheel-operated
    expect(wheel(s, { altKey: false }).stopped).toBe(false)
    s.state.at = 'on'
    expect(wheel(s).stopped).toBe(false)
    // not on the selected device, or while placing: inert
    s.state.at = 'fader'
    ;(s.host as unknown as { busy: () => boolean }).busy = () => true
    expect(wheel(s).stopped).toBe(false)
  })
})

describe('ControlController: detented knob', () => {
  it('a slow drag still crosses to the next click (the drag keeps its own unquantised value), and the wheel moves a click a notch', () => {
    const s = setup()
    // make the knob a 5-position one by re-reading the layout with detents
    const { layout } = parseControlLayout({ ...RAW, controls: RAW.controls.map((c) => (c.id === 'knob' ? { ...c, detents: 5 } : c)) })
    const bank = new ControlBank(layout!.controls)
    const inst = (s.host.instance('d1') as unknown as { controls: { bank: ControlBank } })
    inst.controls.bank = bank
    s.state.at = 'knob'
    s.fire('pointerdown', { clientX: 0, clientY: 300 })
    expect(bank.get('knob')).toBe(0.5)
    for (let i = 1; i <= 12; i++) s.fire('pointermove', { clientX: 0, clientY: 300 - i * 4, buttons: 1 }) // 4 px a step: 0.018 each, 0.22 in all
    expect(bank.get('knob')).toBe(0.75) // 0.5 + 0.218 -> crossed one click, not stuck at 0.5
    s.fire('pointerup')
  })
})
