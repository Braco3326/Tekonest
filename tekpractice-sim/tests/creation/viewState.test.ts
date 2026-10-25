import { describe, expect, it } from 'vitest'
import { loadViewPrefs, saveViewPrefs, VIEW_PREFS_KEY, ViewState } from '../../src/creation/viewState'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage & { m: Map<string, string> }
}

describe('view prefs (Task 19): the ear height survives a reload, never in the rig or the history', () => {
  it('saves and loads the ear height under its own key', () => {
    const s = memory()
    saveViewPrefs(s, { earHeight: 1.7 })
    expect(VIEW_PREFS_KEY).toBe('audio-sim/creation-view.v1')
    expect(JSON.parse(s.m.get(VIEW_PREFS_KEY)!)).toEqual({ version: 1, earHeight: 1.7 })
    expect(loadViewPrefs(s)).toEqual({ earHeight: 1.7 })
  })
  it('defaults (seated 1.2 m) when absent, unreadable, of another version or out of range', () => {
    expect(loadViewPrefs(null)).toEqual({})
    expect(loadViewPrefs(memory())).toEqual({})
    expect(loadViewPrefs(memory({ [VIEW_PREFS_KEY]: '{oops' }))).toEqual({})
    expect(loadViewPrefs(memory({ [VIEW_PREFS_KEY]: '{"version":2,"earHeight":1.7}' }))).toEqual({})
    expect(loadViewPrefs(memory({ [VIEW_PREFS_KEY]: '{"version":1,"earHeight":3}' }))).toEqual({})
  })
  it('never writes over data it cannot read (review Fix 2): absent → written, valid v1 → updated, garbage / other version → untouched', () => {
    const absent = memory()
    expect(saveViewPrefs(absent, { earHeight: 1.7 })).toBe('written')
    expect(loadViewPrefs(absent)).toEqual({ earHeight: 1.7 })
    const valid = memory({ [VIEW_PREFS_KEY]: '{"version":1,"earHeight":1.2}' })
    expect(saveViewPrefs(valid, { earHeight: 1.7 })).toBe('written')
    expect(JSON.parse(valid.m.get(VIEW_PREFS_KEY)!)).toEqual({ version: 1, earHeight: 1.7 })
    for (const raw of ['{oops', '{"version":2,"earHeight":1.7}', '{"version":1,"earHeight":3}', '[]', 'null']) {
      const s = memory({ [VIEW_PREFS_KEY]: raw })
      expect(saveViewPrefs(s, { earHeight: 1.7 }), raw).toBe('kept')
      expect(s.m.get(VIEW_PREFS_KEY), raw).toBe(raw)
    }
  })
  it('blocked storage never throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadViewPrefs(blocked)).toEqual({})
    expect(() => saveViewPrefs(blocked, { earHeight: 1.2 })).not.toThrow()
    expect(() => saveViewPrefs(null, { earHeight: 1.2 })).not.toThrow()
  })
})

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
