// The step card's DOM machinery on a fake shell (unit tests run in node; the real layout is tests/e2e/onboarding-stepcard.spec.ts): the slot follows the record, destroy is final (T6a C1),
// and the synthetic resize that tells the page the row moved is deferred past the current call stack (T6a N5).
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TUTORIAL_RECORD, type TutorialRecord } from '../../src/design/tutorialRecord'
import { mountStepCard } from '../../src/guide/stepCard'
import { fakeShellDom, type FakeEl } from './fakeShellDom'

const STEPS = ['console', 'micro', 'enceinte'] as const
const rec = (o: Partial<TutorialRecord>): TutorialRecord => ({ ...EMPTY_TUTORIAL_RECORD, early: [], shown: [], passed: [], ...o })
const running = rec({ status: 'running', k: 2, n: 3, step: 'micro' })
const slots = (root: FakeEl): number => root.children.filter((c) => c.dataset.testid === 'tutorial-slot').length

function card(initial: TutorialRecord) {
  const dom = fakeShellDom()
  const dispatched: string[] = []
  ;(dom.doc as unknown as { defaultView: unknown }).defaultView = { dispatchEvent: (e: Event) => void dispatched.push(e.type) }
  let current = initial
  const c = mountStepCard({ doc: dom.doc, steps: [...STEPS], presenter: 'step-card', record: () => current, closing: () => ['a', 'b'], skip: () => {} })!
  return { ...dom, c, dispatched, set: (r: TutorialRecord) => (current = r) }
}

describe('mountStepCard on a fake shell', () => {
  it('nothing until a run is on; the slot appears with it and leaves when the record says skipped', () => {
    const t = card(rec({ status: 'idle' }))
    t.c.update()
    expect(slots(t.root)).toBe(0)
    t.set(running)
    t.c.update()
    expect(slots(t.root)).toBe(1)
    expect(t.root.dataset.tutorial).toBe('on')
    expect(t.root.querySelector('[data-testid="tutorial-step-count"]')?.textContent).toBe('Étape 2 sur 3')
    t.set(rec({ status: 'skipped' }))
    t.c.update()
    expect(slots(t.root)).toBe(0)
    expect(t.root.dataset.tutorial).toBeUndefined()
  })

  it('C1: after destroy an update opens nothing, even with a record that still says running; destroy twice is harmless', () => {
    const t = card(running)
    t.c.update()
    expect(slots(t.root)).toBe(1)
    t.c.destroy()
    t.c.destroy()
    expect(slots(t.root)).toBe(0)
    t.c.update()
    expect(slots(t.root)).toBe(0)
    expect(t.root.dataset.tutorial).toBeUndefined()
  })

  it('N5: the resize that tells the page the row opened is sent after the current call stack, not inside update', async () => {
    const t = card(running)
    t.c.update()
    expect(t.dispatched, 'not re-entrantly inside update').toEqual([])
    await Promise.resolve()
    expect(t.dispatched).toEqual(['resize'])
    t.set(rec({ status: 'skipped' }))
    t.c.update()
    expect(t.dispatched, 'closing is deferred too').toEqual(['resize'])
    await Promise.resolve()
    expect(t.dispatched).toEqual(['resize', 'resize'])
  })

  it('a record write that changes nothing sends no resize', async () => {
    const t = card(running)
    t.c.update()
    await Promise.resolve()
    t.c.update()
    t.c.update()
    await Promise.resolve()
    expect(t.dispatched).toEqual(['resize'])
  })

  it('does not trigger: a page with no shell gets no card at all', () => {
    const dom = fakeShellDom({ shell: false })
    const c = mountStepCard({ doc: dom.doc, steps: [...STEPS], presenter: 'step-card', record: () => running, closing: () => [], skip: vi.fn() })!
    c.update()
    expect(dom.body.children).toHaveLength(0)
  })
})
