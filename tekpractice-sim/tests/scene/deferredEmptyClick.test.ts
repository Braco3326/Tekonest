/**
 * Review fix (Tasks 3–4): the 300 ms deferred "empty click leaves focus" must
 * never fire after the view changed under it (refocus, Esc, Alt+H, pick-up).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmWindowMs, DeferredEmptyClick } from '../../src/scene/deferredEmptyClick'

describe('confirmWindowMs (tap during a click-focus flight)', () => {
  it('is the given window when flights animate', () => {
    expect(confirmWindowMs(450, true)).toBe(450)
  })
  it('is 0 with reduced motion: a cut leaves nothing moving to protect', () => {
    expect(confirmWindowMs(450, false)).toBe(0)
    expect(confirmWindowMs(600, false)).toBe(0)
  })
})
import { initialState, reduce, type FocusState } from '../../src/scene/focusMachine'

describe('DeferredEmptyClick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const harness = () => {
    let state: FocusState = reduce(initialState(), { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'a' }).state
    const fired: number[] = []
    const d = new DeferredEmptyClick(
      300,
      () => state,
      () => {
        fired.push(1)
        state = reduce(state, { type: 'EMPTY_CLICK' }).state
      },
    )
    return { d, fired, get: () => state, set: (s: FocusState) => (state = s) }
  }

  it('fires after the delay when nothing changed (leaves focus)', () => {
    const h = harness()
    h.d.schedule()
    vi.advanceTimersByTime(299)
    expect(h.fired).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(h.fired).toHaveLength(1)
    expect(h.get().mode).toBe('ensemble')
  })

  it('an empty click then focusInstance(b) within 300 ms keeps the new focus — even without cancel()', () => {
    const h = harness()
    h.d.schedule()
    h.set(reduce(h.get(), { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'b' }).state) // focusInstance
    vi.advanceTimersByTime(400)
    expect(h.fired).toHaveLength(0)
    expect(h.get()).toMatchObject({ mode: 'focus', focused: 'b' })
  })

  it('skips when the mode changed (Esc / Alt+H left focus first)', () => {
    const h = harness()
    h.d.schedule()
    h.set(reduce(h.get(), { type: 'HOME' }).state)
    vi.advanceTimersByTime(400)
    expect(h.fired).toHaveLength(0)
  })

  it('cancel() reports whether one was pending, and stops it', () => {
    const h = harness()
    expect(h.d.cancel()).toBe(false)
    h.d.schedule()
    expect(h.d.cancel()).toBe(true)
    vi.advanceTimersByTime(400)
    expect(h.fired).toHaveLength(0)
  })

  it('a new schedule replaces the old one (one fire)', () => {
    const h = harness()
    h.d.schedule()
    vi.advanceTimersByTime(200)
    h.d.schedule()
    vi.advanceTimersByTime(400)
    expect(h.fired).toHaveLength(1)
  })
})
