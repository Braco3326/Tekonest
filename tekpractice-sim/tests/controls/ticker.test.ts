import { describe, expect, it, vi } from 'vitest'
import { ControlTicker } from '../../src/controls/ticker'
import type { ControlRig } from '../../src/controls/controlRig'

function fakeRig(hasMeters: boolean, redraws = true): ControlRig & { update: ReturnType<typeof vi.fn> } {
  return { hasMeters, update: vi.fn(() => redraws) } as unknown as ControlRig & { update: ReturnType<typeof vi.fn> }
}

function harness() {
  let now = 0
  let pending: (() => void) | null = null
  let nextId = 1
  const request = vi.fn((cb: () => void) => {
    pending = cb
    return nextId++
  })
  const cancel = vi.fn(() => {
    pending = null
  })
  const onFrame = vi.fn()
  const ticker = new ControlTicker(onFrame, () => now, request, cancel)
  const advance = (ms: number): void => {
    now += ms
    const cb = pending
    pending = null
    cb?.()
  }
  return { ticker, onFrame, request, cancel, advance, pendingFrame: () => pending !== null }
}

describe('ControlTicker', () => {
  it('holds no timer without a rig with meters', () => {
    const h = harness()
    h.ticker.add(fakeRig(false))
    expect(h.ticker.running).toBe(false)
    expect(h.request).not.toHaveBeenCalled()
  })

  it('runs while a rig with meters is registered, steps it, and asks for a frame only when it redrew', () => {
    const h = harness()
    const rig = fakeRig(true)
    h.ticker.add(rig)
    expect(h.ticker.running).toBe(true)
    h.advance(40)
    expect(rig.update).toHaveBeenCalledTimes(1)
    expect(h.onFrame).toHaveBeenCalledTimes(1)

    const still = fakeRig(true, false)
    h.ticker.add(still)
    h.advance(40)
    expect(h.onFrame).toHaveBeenCalledTimes(2) // the first rig still redraws
    h.ticker.remove(rig)
    h.advance(40)
    expect(h.onFrame).toHaveBeenCalledTimes(2) // only the still one left: no frame requested
  })

  it('throttles to about 30 steps a second', () => {
    const h = harness()
    const rig = fakeRig(true)
    h.ticker.add(rig)
    h.advance(40)
    h.advance(5)
    h.advance(5)
    expect(rig.update).toHaveBeenCalledTimes(1)
    h.advance(30)
    expect(rig.update).toHaveBeenCalledTimes(2)
  })

  it('stops and cancels the pending frame when the last rig leaves, and on dispose', () => {
    const h = harness()
    const rig = fakeRig(true)
    h.ticker.add(rig)
    h.ticker.remove(rig)
    expect(h.ticker.running).toBe(false)
    expect(h.cancel).toHaveBeenCalled()
    h.ticker.add(rig)
    h.ticker.dispose()
    expect(h.ticker.running).toBe(false)
    expect(h.pendingFrame()).toBe(false)
  })
})
