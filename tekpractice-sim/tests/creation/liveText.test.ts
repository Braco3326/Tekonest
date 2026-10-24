import { describe, expect, it } from 'vitest'
import { createLiveText } from '../../src/creation/shell/liveText'

/** A `role="status"` region only announces a CHANGE: identical text must be cleared, then set on the next frame. */
describe('live region text (status bar re-announce)', () => {
  const setup = () => {
    const el = { textContent: '' as string | null }
    const frames: (() => void)[] = []
    const delays: number[] = []
    const set = createLiveText(el, (fn, ms) => {
      frames.push(fn)
      delays.push(ms)
    })
    const flush = () => frames.splice(0).forEach((f) => f())
    return { el, set, frames, flush, delays }
  }
  it('the re-set waits ~100 ms (one frame is too short for some screen readers to see the clear)', () => {
    const { set, delays } = setup()
    set('A', true)
    set('A', true)
    expect(delays).toEqual([100])
  })
  it('a new text is set at once', () => {
    const { el, set, frames } = setup()
    set('Sélectionné : Yamaha QL1')
    expect(el.textContent).toBe('Sélectionné : Yamaha QL1')
    expect(frames).toHaveLength(0)
  })
  it('the same text again, as an answer to a key: cleared now, set again on the next frame', () => {
    const { el, set, flush } = setup()
    set('Sélectionné : Yamaha QL1', true)
    set('Sélectionné : Yamaha QL1', true)
    expect(el.textContent).toBe('')
    flush()
    expect(el.textContent).toBe('Sélectionné : Yamaha QL1')
  })
  it('the same background text (« Prêt » after every edit) is not re-announced', () => {
    const { el, set, frames } = setup()
    set('Prêt')
    set('Prêt')
    expect(el.textContent).toBe('Prêt')
    expect(frames).toHaveLength(0)
  })
  it('a newer text wins over a pending re-announce', () => {
    const { el, set, flush } = setup()
    set('A', true)
    set('A', true)
    set('B')
    flush()
    expect(el.textContent).toBe('B')
  })
})
