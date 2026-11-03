import { describe, expect, it, vi } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { mountCancelPlacement } from '../../src/creation/shell/cancelPlacement'

/** The few DOM members the module touches. */
function fakeDom() {
  const clicks: (() => void)[] = []
  const button = {
    type: '',
    className: '',
    textContent: '',
    hidden: false,
    dataset: {} as Record<string, string>,
    addEventListener: (_t: string, fn: () => void) => void clicks.push(fn),
    removeEventListener: (_t: string, fn: () => void) => void clicks.splice(clicks.indexOf(fn), 1),
    remove: vi.fn(),
  }
  const doc = { createElement: () => button, activeElement: null as unknown }
  const parent = { appendChild: vi.fn() }
  return { button, doc, parent, clicks }
}

describe('« Annuler la pose » button (Task 43b)', () => {
  it('is a real button named by the copy, in the view, hidden until a pose starts', () => {
    const d = fakeDom()
    mountCancelPlacement({ doc: d.doc as never, parent: d.parent as never, onCancel: vi.fn(), focusView: vi.fn() })
    expect(d.button.type).toBe('button')
    expect(d.button.textContent).toBe('Annuler la pose')
    expect(d.button.textContent).toBe(COPY.placement!.cancelButton)
    expect(d.button.hidden).toBe(true)
    expect(d.parent.appendChild).toHaveBeenCalledWith(d.button)
  })
  it('shows and hides with the pose; a click cancels', () => {
    const d = fakeDom()
    const onCancel = vi.fn()
    const c = mountCancelPlacement({ doc: d.doc as never, parent: d.parent as never, onCancel, focusView: vi.fn() })
    c.setVisible(true)
    expect(d.button.hidden).toBe(false)
    d.clicks[0]()
    expect(onCancel).toHaveBeenCalledTimes(1)
    c.setVisible(false)
    expect(d.button.hidden).toBe(true)
  })
  it('hiding under the focus gives the focus back to the 3D view; hiding without it does not', () => {
    const d = fakeDom()
    const focusView = vi.fn()
    const c = mountCancelPlacement({ doc: d.doc as never, parent: d.parent as never, onCancel: vi.fn(), focusView })
    c.setVisible(true)
    c.setVisible(false)
    expect(focusView).not.toHaveBeenCalled()
    c.setVisible(true)
    d.doc.activeElement = d.button
    c.setVisible(false)
    expect(focusView).toHaveBeenCalledTimes(1)
  })
  it('dispose removes the button and its listener; later calls do nothing', () => {
    const d = fakeDom()
    const c = mountCancelPlacement({ doc: d.doc as never, parent: d.parent as never, onCancel: vi.fn(), focusView: vi.fn() })
    c.dispose()
    expect(d.clicks).toHaveLength(0)
    expect(d.button.remove).toHaveBeenCalledTimes(1)
    c.setVisible(true)
    expect(d.button.hidden).toBe(true)
    c.dispose()
    expect(d.button.remove).toHaveBeenCalledTimes(1)
  })
})
