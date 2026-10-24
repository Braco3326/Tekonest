import { describe, expect, it } from 'vitest'
import { ViewState } from '../../src/creation/viewState'

describe('ViewState (never undoable)', () => {
  it('has the defaults: nothing selected, panels open, seated ear height', () => {
    expect(new ViewState().get()).toEqual({ selection: null, hidden: [], treeOpen: true, propsOpen: true, earHeight: 1.2 })
  })
  it('set merges a patch and notifies subscribers', () => {
    const v = new ViewState()
    let n = 0
    v.subscribe(() => n++)
    v.set({ selection: 'ql1', earHeight: 1.7 })
    expect(v.get()).toMatchObject({ selection: 'ql1', earHeight: 1.7, treeOpen: true })
    expect(n).toBe(1)
  })
  it('a patch that changes nothing does not notify', () => {
    const v = new ViewState()
    let n = 0
    v.subscribe(() => n++)
    v.set({ selection: null, hidden: [] })
    expect(n).toBe(0)
  })
  it('get() is a copy: mutating it never changes the state', () => {
    const v = new ViewState()
    ;(v.get() as { hidden: string[] }).hidden.push('x')
    expect(v.get().hidden).toEqual([])
  })
  it('unsubscribe stops notifications', () => {
    const v = new ViewState()
    let n = 0
    const off = v.subscribe(() => n++)
    off()
    v.set({ treeOpen: false })
    expect(n).toBe(0)
  })
})
