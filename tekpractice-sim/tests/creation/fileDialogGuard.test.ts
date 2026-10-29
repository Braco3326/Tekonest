/**
 * Phase 4 final wave: the AudioContext made for « Choisir un fichier audio… » waits for the file. If the dialog is closed without a file and the browser
 * sends no `cancel` event, the window gets the focus back and, shortly after, nothing arrived: the unused context is closed (no leak).
 */
import { describe, expect, it } from 'vitest'
import { armCancelFallback, CANCEL_FALLBACK_MS } from '../../src/creation/fileDialogGuard'

function make() {
  const focusListeners = new Set<() => void>()
  const timers = new Map<number, { fn: () => void; ms: number }>()
  let seq = 0
  const deps = {
    onFocusBack: (fn: () => void) => {
      focusListeners.add(fn)
      return () => void focusListeners.delete(fn)
    },
    later: (fn: () => void, ms: number) => {
      timers.set(++seq, { fn, ms })
      return seq
    },
    clear: (id: number) => void timers.delete(id),
  }
  const focus = (): void => {
    for (const fn of [...focusListeners]) fn()
  }
  const flush = (): void => {
    for (const [id, t] of [...timers]) {
      timers.delete(id)
      t.fn()
    }
  }
  return { deps, focus, flush, focusListeners, timers }
}

describe('armCancelFallback', () => {
  it('window focus back + the delay with nothing chosen → the context is dropped, once', () => {
    const m = make()
    let waiting = true
    let dropped = 0
    armCancelFallback(m.deps, () => waiting, () => void dropped++)
    expect(m.timers.size).toBe(0) // nothing before the focus comes back
    m.focus()
    expect([...m.timers.values()].map((t) => t.ms)).toEqual([CANCEL_FALLBACK_MS])
    m.flush()
    expect(dropped).toBe(1)
    expect(m.focusListeners.size).toBe(0) // disarmed
    m.focus()
    m.flush()
    expect(dropped).toBe(1)
    void waiting
  })
  it('a file that arrived meanwhile (the context was taken) is not dropped', () => {
    const m = make()
    let waiting = true
    let dropped = 0
    armCancelFallback(m.deps, () => waiting, () => void dropped++)
    m.focus()
    waiting = false // the change event took the context
    m.flush()
    expect(dropped).toBe(0)
  })
  it('disarm() removes the listener and clears the timer (a change / cancel / another action happened)', () => {
    const m = make()
    let dropped = 0
    const disarm = armCancelFallback(m.deps, () => true, () => void dropped++)
    m.focus()
    expect(m.timers.size).toBe(1)
    disarm()
    expect(m.timers.size).toBe(0)
    expect(m.focusListeners.size).toBe(0)
    m.flush()
    expect(dropped).toBe(0)
    disarm() // idempotent
  })
  it('several focus events arm ONE timer', () => {
    const m = make()
    armCancelFallback(m.deps, () => true, () => undefined)
    m.focus()
    m.focus()
    expect(m.timers.size).toBe(1)
  })
  it('the delay leaves the browser time to send `change` after the focus comes back (more than a second)', () => {
    expect(CANCEL_FALLBACK_MS).toBeGreaterThanOrEqual(1000)
  })
})
