import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DisposableBag } from '../../src/util/disposable'
import { createToast, TOAST_MS } from '../../src/creation/shell/toast'
import { REANNOUNCE_MS } from '../../src/creation/shell/liveText'

const fakeEl = () => ({ hidden: true, textContent: '' as string | null })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('toast (Task 25, CA-12)', () => {
  it('lasts 2.5 s', () => {
    expect(TOAST_MS).toBe(2500)
  })

  it('shows the message in its region, then hides and empties it after 2.5 s', () => {
    const el = fakeEl()
    const t = createToast(el, new DisposableBag())
    t.show('Rien ici')
    expect(el.hidden).toBe(false)
    expect(t.visible).toBe(true)
    vi.advanceTimersByTime(REANNOUNCE_MS)
    expect(el.textContent).toBe('Rien ici')
    vi.advanceTimersByTime(TOAST_MS - REANNOUNCE_MS - 1)
    expect(el.hidden).toBe(false)
    vi.advanceTimersByTime(1)
    expect(el.hidden).toBe(true)
    expect(el.textContent).toBe('')
    expect(t.visible).toBe(false)
    expect(vi.getTimerCount()).toBe(0) // nothing left running once it ended
  })

  it('the text is set into an already rendered, empty region (so a polite live region announces it)', () => {
    const el = fakeEl()
    const seen: { hidden: boolean; text: string | null }[] = []
    const t = createToast(el, new DisposableBag())
    t.show('Rien ici')
    seen.push({ hidden: el.hidden, text: el.textContent })
    vi.advanceTimersByTime(REANNOUNCE_MS)
    seen.push({ hidden: el.hidden, text: el.textContent })
    expect(seen).toEqual([
      { hidden: false, text: '' },
      { hidden: false, text: 'Rien ici' },
    ])
  })

  it('a second miss restarts the 2.5 s and says the same text again', () => {
    const el = fakeEl()
    const t = createToast(el, new DisposableBag())
    t.show('Rien ici')
    vi.advanceTimersByTime(2000)
    t.show('Rien ici')
    expect(el.textContent).toBe('') // cleared, then set again: re-announced
    vi.advanceTimersByTime(REANNOUNCE_MS)
    expect(el.textContent).toBe('Rien ici')
    vi.advanceTimersByTime(TOAST_MS - REANNOUNCE_MS - 1)
    expect(el.hidden).toBe(false) // 2.5 s from the SECOND show, not the first
    vi.advanceTimersByTime(1)
    expect(el.hidden).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('dismiss hides it at once and leaves no timer', () => {
    const el = fakeEl()
    const t = createToast(el, new DisposableBag())
    t.show('Rien ici')
    t.dismiss()
    expect(el.hidden).toBe(true)
    expect(el.textContent).toBe('')
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(TOAST_MS * 2) // the late timers of a dismissed toast write nothing
    expect(el.textContent).toBe('')
  })

  it('disposing the bag (the page goes) clears the timers; a later show does nothing', () => {
    const el = fakeEl()
    const bag = new DisposableBag()
    const t = createToast(el, bag)
    t.show('Rien ici')
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    bag.dispose()
    expect(vi.getTimerCount()).toBe(0)
    expect(el.hidden).toBe(true)
    t.show('Rien ici')
    expect(el.hidden).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
