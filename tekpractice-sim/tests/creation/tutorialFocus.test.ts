// G14c fix (b): the tutorial's device is brought into the 3D view only when it is not there, once per change, never selected (src/creation/onboarding/tutorialFocus.ts).
import { describe, expect, it } from 'vitest'
import { TUTORIAL_FOCUS_EVENT } from '../../src/design/events'
import { pointOnView, wireTutorialFocus } from '../../src/creation/onboarding/tutorialFocus'

const fakeWin = () => {
  const ls: ((e: Event) => void)[] = []
  return {
    win: { addEventListener: (t: string, f: (e: Event) => void) => void (t === TUTORIAL_FOCUS_EVENT && ls.push(f)) } as unknown as Pick<Window, 'addEventListener'>,
    send: (instance: unknown) => ls.forEach((f) => f({ detail: { instance } } as unknown as Event)),
  }
}

describe('wireTutorialFocus', () => {
  it('flies to the device when it is off view; leaves it when on view; acts once per change; null and junk do nothing', () => {
    const w = fakeWin()
    const shown: string[] = []
    const visible = new Set(['k'])
    wireTutorialFocus({ win: w.win, onView: (id) => visible.has(id), show: (id) => (shown.push(id), true) })
    w.send('q')
    expect(shown).toEqual(['q'])
    w.send('q') // the same focus again (a bench change on the same step): nothing moves
    expect(shown).toEqual(['q'])
    w.send('k') // on view: left alone
    w.send(null)
    w.send(42)
    w.send('')
    expect(shown).toEqual(['q'])
    w.send('q') // a new change back to the console, off view again
    expect(shown).toEqual(['q', 'q'])
  })

  it('a throwing reader never escapes; no window, no listener', () => {
    const w = fakeWin()
    wireTutorialFocus({ win: w.win, onView: () => { throw new Error('x') }, show: () => true })
    expect(() => w.send('q')).not.toThrow()
    expect(() => wireTutorialFocus({ win: null, onView: () => true, show: () => true })).not.toThrow()
  })
})

describe('pointOnView', () => {
  const canvas = { closest: () => null } as unknown as Element
  const panel = { closest: () => null } as unknown as Element
  const oscar = { closest: (s: string) => (s.includes('oscar') ? ({} as Element) : null) } as unknown as Element
  const view = { left: 100, top: 50, right: 900, bottom: 600 }
  const at = (el: Element | null) => ({ elementFromPoint: () => el })
  it('inside the view and on the canvas (or under Oscar): on view; outside the view, under a panel, or no point: not', () => {
    expect(pointOnView(at(canvas), canvas, view, { x: 400, y: 300 })).toBe(true)
    expect(pointOnView(at(oscar), canvas, view, { x: 400, y: 300 })).toBe(true)
    expect(pointOnView(at(panel), canvas, view, { x: 400, y: 300 })).toBe(false)
    expect(pointOnView(at(canvas), canvas, view, { x: 65, y: 300 })).toBe(false)
    expect(pointOnView(at(canvas), canvas, view, null)).toBe(false)
  })
})
