/**
 * The entrepreneur's card, DOM over a fake (onboarding packs T6.4; T6 review N1, N4, N5): show / hide are idempotent, the slot is the LAST child of the shell root, `data-gear` follows it,
 * the dismiss button calls the owner, a show or a hide tells the page what a window resize tells it (after the current call stack), and the slot is inert while the place picker covers the
 * shell and listed with the picker's covers so it is inert at the picker's next opening too. The look and the layout are proven in tests/e2e/onboarding-entrepreneur.spec.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fakeShellDom, type FakeEl } from '../guide/fakeShellDom'
import { GEAR_SLOT_TESTID, mountOwnGearCard } from '../../src/creation/onboarding/ownGearCard'

const setup = (extra: { covers?: HTMLElement[]; covered?: () => boolean } = {}) => {
  const { doc, root } = fakeShellDom()
  const events: string[] = []
  const win = { dispatchEvent: (e: { type: string }) => void events.push(e.type) }
  const withWin = { ...(doc as object), defaultView: win } as unknown as Document
  const onDismiss = vi.fn()
  const card = mountOwnGearCard({ doc: withWin, root: root as unknown as HTMLElement, onDismiss, ...extra })
  return { card, root, events, onDismiss }
}
const slot = (root: FakeEl): FakeEl | null => root.querySelector(`[data-testid="${GEAR_SLOT_TESTID}"]`)

describe('mountOwnGearCard', () => {
  it('show builds ONE slot as the last child of the root and marks the root; a second show changes nothing', () => {
    const { card, root } = setup()
    const before = root.children.length
    card.show()
    card.show()
    expect(root.children.length).toBe(before + 1)
    expect(root.children[root.children.length - 1].dataset.testid).toBe(GEAR_SLOT_TESTID)
    expect(root.dataset.gear).toBe('on')
    expect(card.shown).toBe(true)
  })
  it('hide removes the slot and clears the mark; a hide with nothing shown does nothing', () => {
    const { card, root, events } = setup()
    card.hide()
    expect(events, 'nothing was shown, nothing to tell').toEqual([])
    card.show()
    card.hide()
    expect(slot(root)).toBeNull()
    expect(root.dataset.gear).toBeUndefined()
    expect(card.shown).toBe(false)
    card.hide()
  })
  it('the dismiss button calls the owner (the owner remembers it and hides the card)', () => {
    const { card, root, onDismiss } = setup()
    card.show()
    const btn = slot(root)!.querySelector('[data-testid="own-gear-dismiss"]')!
    btn.listeners.click.forEach((fn) => fn())
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
  it('N4: a show and a hide each tell the page what a window resize tells it, after the current call stack (Oscar rests clear of the row, and back)', async () => {
    const { card, events } = setup()
    card.show()
    expect(events, 'not re-entrantly').toEqual([])
    await Promise.resolve()
    expect(events).toEqual(['resize'])
    card.hide()
    await Promise.resolve()
    expect(events).toEqual(['resize', 'resize'])
  })
  it('N5: the slot is inert while the picker is open, and is in the picker’s covers while it shows (inert at its next opening), out of them when hidden', () => {
    const covers: FakeEl[] = []
    const { card, root } = setup({ covers: covers as unknown as HTMLElement[], covered: () => true })
    card.show()
    const el = slot(root)!
    expect((el as unknown as { inert?: boolean }).inert).toBe(true)
    expect(covers).toContain(el)
    card.hide()
    expect(covers).not.toContain(el)
  })
  it('does not trigger: with the picker closed the slot is not inert', () => {
    const { card, root } = setup({ covers: [] as unknown as HTMLElement[], covered: () => false })
    card.show()
    expect((slot(root) as unknown as { inert?: boolean }).inert).toBe(false)
  })
})
