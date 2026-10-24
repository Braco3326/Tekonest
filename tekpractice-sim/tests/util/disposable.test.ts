import { describe, expect, it, vi } from 'vitest'
import { DisposableBag } from '../../src/util/disposable'

function fakeTarget() {
  const live = new Set<string>()
  return {
    live,
    addEventListener: vi.fn((t: string, _f: unknown, o?: unknown) => void live.add(`${t}:${JSON.stringify(o ?? null)}`)),
    removeEventListener: vi.fn((t: string, _f: unknown, o?: unknown) => void live.delete(`${t}:${JSON.stringify(o ?? null)}`)),
  }
}
describe('DisposableBag', () => {
  it('every listen() has a matching remove with the same options after dispose()', () => {
    const t = fakeTarget(); const bag = new DisposableBag(); const fn = () => {}
    bag.listen(t, 'keydown', fn, true); bag.listen(t, 'wheel', fn, { passive: false })
    expect(t.live.size).toBe(2)
    bag.dispose()
    expect(t.live.size).toBe(0)
    expect(t.removeEventListener).toHaveBeenCalledWith('keydown', fn, true)
  })
  it('is idempotent and LIFO', () => {
    const order: number[] = []; const bag = new DisposableBag()
    bag.add(() => order.push(1)); bag.add(() => order.push(2))
    bag.dispose(); bag.dispose()
    expect(order).toEqual([2, 1])
  })
  it('a throwing disposer does not stop the others', () => {
    const bag = new DisposableBag(); const ok = vi.fn()
    bag.add(ok); bag.add(() => { throw new Error('x') })
    expect(() => bag.dispose()).not.toThrow()
    expect(ok).toHaveBeenCalled()
  })
  it('add() after dispose runs at once', () => {
    const bag = new DisposableBag(); bag.dispose(); const fn = vi.fn(); bag.add(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('observe() removes the observer', () => {
    const obs = { add: vi.fn(() => 'o1'), remove: vi.fn(() => true) }; const bag = new DisposableBag()
    bag.observe(obs, () => {}); bag.dispose()
    expect(obs.remove).toHaveBeenCalledWith('o1')
  })
  it('liveListeners counts listeners across bags', () => {
    const before = DisposableBag.liveListeners; const bag = new DisposableBag(); const t = fakeTarget()
    bag.listen(t, 'a', () => {}); bag.listen(t, 'b', () => {})
    expect(DisposableBag.liveListeners).toBe(before + 2)
    bag.dispose()
    expect(DisposableBag.liveListeners).toBe(before)
  })
})
