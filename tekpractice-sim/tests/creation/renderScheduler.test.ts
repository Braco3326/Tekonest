import { describe, expect, it, vi } from 'vitest'
import {
  cameraSignature, hasInertia, registerScheduler, RenderScheduler, requestRender,
  type InertiaSource, type SignatureCamera,
} from '../../src/creation/renderScheduler'

const arc = (over: Partial<SignatureCamera> = {}): SignatureCamera => ({
  uniqueId: 1, alpha: 1, beta: 1, radius: 5, target: { x: 0, y: 0, z: 0 }, ...over,
})

describe('cameraSignature', () => {
  it('is equal for an unchanged camera and "none" without one', () => {
    expect(cameraSignature(arc())).toBe(cameraSignature(arc()))
    expect(cameraSignature(null)).toBe('none')
  })
  it('changes with each arc channel and with the camera identity', () => {
    const base = cameraSignature(arc())
    for (const over of [
      { alpha: 1.1 }, { beta: 1.1 }, { radius: 5.1 }, { target: { x: 0.1, y: 0, z: 0 } },
      { target: { x: 0, y: 0.1, z: 0 } }, { target: { x: 0, y: 0, z: 0.1 } }, { uniqueId: 2 },
    ]) expect(cameraSignature(arc(over))).not.toBe(base)
  })
  it('covers position / rotation of a non-arc (walk) camera', () => {
    const walk = (p: number, r: number): SignatureCamera => ({ uniqueId: 9, position: { x: p, y: 1, z: 0 }, rotation: { x: 0, y: r, z: 0 } })
    expect(cameraSignature(walk(0, 0))).toBe(cameraSignature(walk(0, 0)))
    expect(cameraSignature(walk(0.1, 0))).not.toBe(cameraSignature(walk(0, 0)))
    expect(cameraSignature(walk(0, 0.1))).not.toBe(cameraSignature(walk(0, 0)))
  })
})

describe('RenderScheduler camera signature (instant writes, camera switch)', () => {
  function makeCam() {
    const render = vi.fn()
    const state = { cam: arc() as SignatureCamera | null }
    const s = new RenderScheduler({ render, camera: () => null, tweening: () => false, activeCamera: () => state.cam })
    return { s, render, state }
  }
  it('an instant pose write renders exactly one frame, then idles', () => {
    const { s, render, state } = makeCam(); s.tick()
    for (let i = 0; i < 10; i++) expect(s.tick()).toBe(false)
    state.cam!.alpha = 2 // a cut (reduced motion), nothing else signals
    expect(s.tick()).toBe(true)
    expect(s.tick()).toBe(false)
    expect(render).toHaveBeenCalledTimes(2)
  })
  it('switching the active camera renders', () => {
    const { s, state } = makeCam(); s.tick()
    state.cam = arc({ uniqueId: 7 })
    expect(s.tick()).toBe(true)
    expect(s.tick()).toBe(false)
  })
  it('without an activeCamera hook nothing changes (legacy hooks keep working)', () => {
    const render = vi.fn()
    const s = new RenderScheduler({ render, camera: () => null, tweening: () => false })
    s.tick(); expect(s.tick()).toBe(false)
  })
})

describe('requestRender', () => {
  it('is a no-op until a scheduler is registered, then invalidates it', () => {
    registerScheduler(null)
    expect(() => requestRender()).not.toThrow()
    const { s } = make(); s.tick()
    registerScheduler(s)
    expect(s.shouldRender()).toBe(false)
    requestRender()
    expect(s.shouldRender()).toBe(true)
    registerScheduler(null)
  })
})

const still = (): InertiaSource => ({ inertialAlphaOffset: 0, inertialBetaOffset: 0, inertialRadiusOffset: 0, inertialPanningX: 0, inertialPanningY: 0 })
function make(over: Partial<{ cam: InertiaSource | null; tween: boolean; busy: boolean }> = {}) {
  const render = vi.fn()
  const state = { cam: still() as InertiaSource | null, tween: false, busy: false, ...over }
  const s = new RenderScheduler({ render, camera: () => state.cam, tweening: () => state.tween, busy: () => state.busy })
  return { s, render, state }
}

describe('RenderScheduler', () => {
  it('renders the first frame, then nothing without a signal', () => {
    const { s, render } = make()
    expect(s.tick()).toBe(true)
    for (let i = 0; i < 100; i++) expect(s.tick()).toBe(false)
    expect(render).toHaveBeenCalledTimes(1)
    expect(s.renders).toBe(1)
  })
  it('invalidate() renders exactly one frame', () => {
    const { s, render } = make(); s.tick()
    s.invalidate(); s.tick(); s.tick()
    expect(render).toHaveBeenCalledTimes(2)
  })
  it('keeps rendering while the camera has inertia, stops when the offsets reach 0', () => {
    const { s, render, state } = make(); s.tick()
    state.cam!.inertialAlphaOffset = 0.01
    s.tick(); s.tick()
    state.cam!.inertialAlphaOffset = 0
    s.tick()
    expect(render).toHaveBeenCalledTimes(3)
  })
  it('each inertia channel counts (beta, radius, pan x/y)', () => {
    for (const k of ['inertialBetaOffset', 'inertialRadiusOffset', 'inertialPanningX', 'inertialPanningY'] as const) {
      const c = still(); c[k] = -0.2
      expect(hasInertia(c)).toBe(true)
    }
    expect(hasInertia(still())).toBe(false)
    expect(hasInertia(null)).toBe(false)
  })
  it('a tween keeps rendering', () => {
    const { s, render, state } = make({ tween: true }); s.tick(); s.tick(); s.tick()
    state.tween = false; s.tick()
    expect(render).toHaveBeenCalledTimes(3)
  })
  it('a lease keeps rendering until released; release is idempotent and renders the final frame', () => {
    const { s, render } = make(); s.tick()
    const release = s.hold('meters')
    s.tick(); s.tick()
    expect(s.leaseNames).toEqual(['meters'])
    release(); release()
    s.tick(); s.tick()
    expect(s.leaseNames).toEqual([])
    expect(render).toHaveBeenCalledTimes(4) // first + 2 leased + 1 final after release
  })
  it('two holders of the same lease name both have to release', () => {
    const { s } = make(); s.tick()
    const r1 = s.hold('x'); const r2 = s.hold('x')
    r1(); s.tick()
    expect(s.shouldRender()).toBe(true)
    r2(); s.tick()
    expect(s.shouldRender()).toBe(false)
  })
  it('busy() (legacy) keeps rendering', () => {
    const { s, state } = make({ busy: true }); s.tick()
    expect(s.shouldRender()).toBe(true)
    state.busy = false
    expect(s.shouldRender()).toBe(false)
  })
})
