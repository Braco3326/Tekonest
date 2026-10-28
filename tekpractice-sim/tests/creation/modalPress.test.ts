/**
 * Stabilisation D: which presses inside a dialog keep their default (they focus a control) and which are held back
 * (they would blur the dialog to <body> or to an ancestor above it). Fake nodes: a tiny tree with `closest` and `contains`.
 */
import { describe, expect, it } from 'vitest'
import { pressTakesFocus } from '../../src/creation/shell/modal'

type N = { name: string; parent: N | null; focusable: boolean }
const node = (name: string, parent: N | null, focusable = false): N => ({ name, parent, focusable })
const closest = (n: N) => (_sel: string): N | null => {
  for (let c: N | null = n; c; c = c.parent) if (c.focusable) return c
  return null
}
const withClosest = (n: N) => ({ ...n, closest: closest(n) })
const boxOf = (box: N) => ({
  contains: (x: unknown) => {
    for (let c: N | null = x as N; c; c = c.parent) if (c === box) return true
    return false
  },
})

describe('pressTakesFocus', () => {
  const body = node('body', null, true) // an app container / body with a tabindex above the dialog
  const overlay = node('overlay', body)
  const box = node('box', overlay)

  it('a press on the title, the text or the backdrop is held back even when an ancestor ABOVE the dialog is focusable', () => {
    const title = node('title', box)
    expect(pressTakesFocus(withClosest(title), boxOf(box))).toBe(false)
    expect(pressTakesFocus(withClosest(overlay), boxOf(box))).toBe(false) // the backdrop
    expect(pressTakesFocus(withClosest(box), boxOf(box))).toBe(false) // the padding
  })

  it('a control inside the dialog keeps its press, and so does a child of a focusable custom parent (a widget with a tabindex)', () => {
    const input = node('input', box, true)
    expect(pressTakesFocus(withClosest(input), boxOf(box))).toBe(true)
    const list = node('list', box, true) // a listbox the dialog made focusable
    const row = node('row-text', node('row', list))
    expect(pressTakesFocus(withClosest(row), boxOf(box))).toBe(true)
  })

  it('a non-element target (the document, null) is held back', () => {
    expect(pressTakesFocus(null, boxOf(box))).toBe(false)
    expect(pressTakesFocus({}, boxOf(box))).toBe(false)
  })
})
