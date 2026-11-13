// The tutorial's reserved slot (onboarding packs, plan T6.1, spec 6.6): a row of the shell grid that exists only while a tutorial runs. Fake DOM: the real layout is
// proven in the browser (tests/e2e/onboarding-stepcard.spec.ts).
import { describe, expect, it } from 'vitest'
import { TUTORIAL_SLOT_TESTID, closeTutorialSlot, openTutorialSlot, tutorialSlotOf } from '../../src/design/tutorialSlot'

interface FakeEl {
  tag: string
  className: string
  dataset: Record<string, string | undefined>
  children: FakeEl[]
  parent: FakeEl | null
  appendChild(c: FakeEl): FakeEl
  remove(): void
  querySelector(sel: string): FakeEl | null
}
function fake(withRoot = true) {
  const make = (tag: string): FakeEl => {
    const e: FakeEl = {
      tag,
      className: '',
      dataset: {},
      children: [],
      parent: null,
      appendChild(c) {
        if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c)
        c.parent = e
        e.children.push(c)
        return c
      },
      remove() {
        if (e.parent) e.parent.children = e.parent.children.filter((x) => x !== e)
        e.parent = null
      },
      querySelector(sel) {
        const want = /\[data-testid="([^"]+)"\]/.exec(sel)?.[1]
        const walk = (n: FakeEl): FakeEl | null => {
          for (const c of n.children) {
            if (want !== undefined && c.dataset.testid === want) return c
            const r = walk(c)
            if (r) return r
          }
          return null
        }
        return walk(e)
      },
    }
    return e
  }
  const body = make('body')
  const root = make('div')
  root.dataset.testid = 'creation-root'
  if (withRoot) body.appendChild(root)
  const doc = { createElement: make, querySelector: (s: string) => body.querySelector(s) }
  return { doc: doc as unknown as Document, root, body }
}

describe('openTutorialSlot / closeTutorialSlot', () => {
  it('open: one slot with the spec’s test id at the END of the shell (after the status bar in tab order), and the root says a tutorial row exists', () => {
    const { doc, root } = fake()
    const status = (() => {
      const f = (doc as unknown as { createElement(t: string): FakeEl }).createElement('footer')
      root.appendChild(f)
      return f
    })()
    const slot = openTutorialSlot(doc) as unknown as FakeEl
    expect(slot).not.toBeNull()
    expect(slot.dataset.testid).toBe('tutorial-slot')
    expect(TUTORIAL_SLOT_TESTID).toBe('tutorial-slot')
    expect(slot.className).toBe('cr-tutorial-slot')
    expect(root.children.at(-1)).toBe(slot)
    expect(root.children[0]).toBe(status)
    expect(root.dataset.tutorial).toBe('on')
    expect(tutorialSlotOf(doc)).toBe(slot as unknown as HTMLElement)
  })

  it('open twice: the same slot, never two', () => {
    const { doc, root } = fake()
    const a = openTutorialSlot(doc)
    const b = openTutorialSlot(doc)
    expect(a).toBe(b)
    expect(root.children.filter((c) => c.dataset.testid === 'tutorial-slot')).toHaveLength(1)
  })

  it('close: the slot leaves the DOM at once and the row is freed (the attribute goes)', () => {
    const { doc, root } = fake()
    openTutorialSlot(doc)
    closeTutorialSlot(doc)
    expect(root.children).toHaveLength(0)
    expect(root.dataset.tutorial).toBeUndefined()
    expect(tutorialSlotOf(doc)).toBeNull()
    closeTutorialSlot(doc) // twice: nothing happens
    expect(root.dataset.tutorial).toBeUndefined()
  })

  it('does not trigger: a page without the shell (the level page) has no slot and nothing is created', () => {
    const { doc, body } = fake(false)
    expect(openTutorialSlot(doc)).toBeNull()
    expect(body.children).toHaveLength(0)
    closeTutorialSlot(doc) // no throw
  })
})
