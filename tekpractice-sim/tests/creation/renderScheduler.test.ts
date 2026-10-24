import { describe, expect, it, vi } from 'vitest'
import { hasInertia, RenderScheduler, type InertiaSource } from '../../src/creation/renderScheduler'

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
