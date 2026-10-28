import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { PortRef } from '../../src/engine/types'
import { COPY } from '../../src/creation/copy'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { rejectionOf, ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'
import { candidates, ConnectSession, filterCandidates, groupByDevice } from '../../src/creation/shell/connectModel'

const registry = loadCatalog(catalogJson)
const ruleText = ruleTextFor(registry.catalog.rules as readonly RuleRow[])

const SM58: PortRef = { instance: 'sm58', port: 'out-xlr' }
const MIC1: PortRef = { instance: 'ql1', port: 'in-mic-1' }
const QL_L: PortRef = { instance: 'ql1', port: 'out-main-l' }
const QL_R: PortRef = { instance: 'ql1', port: 'out-main-r' }
const G_IN: PortRef = { instance: 'k12-g', port: 'in-line-a' }
const G_POWER: PortRef = { instance: 'k12-g', port: 'power-in' }
const key = (r: PortRef): string => `${r.instance}.${r.port}`

/** The reference rig's four devices, no cable (the template's mic cable is added by the tests that need it). */
function rig() {
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1', position: [0, 0, 0] })
  history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58', position: [1, 0, 0] })
  history.do({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g', position: [2, 0, 0] })
  history.do({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-d', position: [3, 0, 0] })
  history.clear()
  return { store, history }
}

describe('candidates (Task 28): every free port of every OTHER instance, split by canConnect', () => {
  it('from sm58 out-xlr: ql1 in-mic-1 and in-mic-2 are ok, a mains inlet never is', () => {
    const { store } = rig()
    const c = candidates(store, registry, SM58)
    const ok = c.ok.map((e) => key(e.ref))
    expect(ok).toContain('ql1.in-mic-1')
    expect(ok).toContain('ql1.in-mic-2')
    expect(ok).not.toContain('k12-g.power-in')
    const power = c.rejected.find((e) => key(e.ref) === 'k12-g.power-in')
    expect(power).toBeDefined()
    // the reason is the rule's title, through the one helper the status list uses
    expect(power!.reason).toBe(rejectionOf(store.canConnect(SM58, G_POWER) as never, [SM58, G_POWER], ruleText).title)
    expect(power!.reason).toBe(COPY.rule!.R1Title)
  })

  it('never lists the origin device\'s own ports, nor an occupied port; ok and rejected never overlap', () => {
    const { store, history } = rig()
    history.do({ type: 'CONNECT', a: SM58, b: MIC1 })
    const c = candidates(store, registry, QL_L)
    const all = [...c.ok, ...c.rejected].map((e) => key(e.ref))
    expect(all.some((k) => k.startsWith('ql1.'))).toBe(false)
    expect(all).not.toContain('sm58.out-xlr') // occupied
    expect(new Set(all).size).toBe(all.length)
    expect(c.ok.map((e) => key(e.ref))).toEqual(['k12-g.in-line-a', 'k12-d.in-line-a'])
    // an output goes to an input of the same level; out -> out and mains are listed as rejected
    expect(c.rejected.map((e) => key(e.ref))).toContain('k12-g.thru-out-a')
    expect(c.rejected.find((e) => key(e.ref) === 'k12-g.thru-out-a')!.reason).toBe(COPY.rule!.R3Title)
  })

  it('a second cable: once k12-g in-line-a is taken it leaves the list', () => {
    const { store, history } = rig()
    history.do({ type: 'CONNECT', a: QL_L, b: G_IN })
    const c = candidates(store, registry, QL_R)
    expect(c.ok.map((e) => key(e.ref))).toEqual(['k12-d.in-line-a'])
  })

  it('an occupied or unknown origin has no candidate at all', () => {
    const { store, history } = rig()
    history.do({ type: 'CONNECT', a: SM58, b: MIC1 })
    expect(candidates(store, registry, SM58)).toEqual({ ok: [], rejected: [] })
    expect(candidates(store, registry, { instance: 'nope', port: 'x' })).toEqual({ ok: [], rejected: [] })
    expect(candidates(store, registry, { instance: 'sm58', port: 'nope' })).toEqual({ ok: [], rejected: [] })
  })

  it('every entry reads in French: device (id), port, connector and signal type', () => {
    const { store } = rig()
    const e = candidates(store, registry, SM58).ok.find((x) => key(x.ref) === 'ql1.in-mic-2')!
    expect(e.device).toBe('QL1 (ql1)')
    expect(e.port).toBe('in-mic-2 · XLR3 femelle · Niveau micro')
    expect(e.label).toBe('QL1 (ql1) · in-mic-2 · XLR3 femelle · Niveau micro')
  })

  it('is stable: rig order, then the catalog\'s port order', () => {
    const { store } = rig()
    expect(candidates(store, registry, SM58).ok.map((e) => key(e.ref))).toEqual([
      'ql1.in-mic-1',
      'ql1.in-mic-2',
    ])
    expect(candidates(store, registry, SM58).rejected.map((e) => key(e.ref)).slice(0, 4)).toEqual([
      'ql1.out-main-l',
      'ql1.out-main-r',
      'ql1.out-mix-1',
      'ql1.dante-primary',
    ])
  })

  it('does not change the store (a pure dry run)', () => {
    const { store } = rig()
    const before = JSON.stringify(store.design())
    candidates(store, registry, SM58)
    expect(JSON.stringify(store.design())).toBe(before)
  })
})

describe('filterCandidates: the type-ahead', () => {
  const { store } = rig()
  const list = candidates(store, registry, QL_L).ok
  it('an empty query keeps everything', () => {
    expect(filterCandidates(list, '  ')).toEqual(list)
  })
  it('matches the device id, the port or the signal, case and accents ignored', () => {
    expect(filterCandidates(list, 'K12-G').map((e) => key(e.ref))).toEqual(['k12-g.in-line-a'])
    expect(filterCandidates(list, 'LIGNE').length).toBe(list.length)
    expect(filterCandidates(list, 'xlr3 femelle').length).toBe(list.length)
  })
  it('every word must match (« k12-d in-line »)', () => {
    expect(filterCandidates(list, 'k12-d in-line').map((e) => key(e.ref))).toEqual(['k12-d.in-line-a'])
    expect(filterCandidates(list, 'k12-d dante')).toEqual([])
  })
  it('groups by device in order', () => {
    const g = groupByDevice(list)
    expect(g.map((x) => x.instance)).toEqual(['k12-g', 'k12-d'])
    expect(g[0].device).toBe('K12.2 (k12-g)')
    expect(g[0].items.map((e) => e.ref.port)).toEqual(['in-line-a'])
  })
})

function session(over: { from?: PortRef; setup?: (r: ReturnType<typeof rig>) => void } = {}) {
  const r = rig()
  over.setup?.(r)
  const beforeDispatch = vi.fn()
  const rejectionTitle = vi.fn((e: { code: string; ruleId?: string }) => `titre:${e.ruleId ?? e.code}`)
  const s = new ConnectSession({
    store: r.store,
    history: r.history,
    registry,
    from: over.from ?? QL_L,
    portName: (p) => `${p.instance} · ${p.port}`,
    rejectionTitle,
    beforeDispatch,
  })
  return { ...r, s, beforeDispatch, rejectionTitle }
}

describe('ConnectSession: the dialog\'s state, without the DOM', () => {
  it('starts on the first ok candidate and moves with the arrows, clamped', () => {
    const { s } = session()
    expect(s.active && key(s.active.ref)).toBe('k12-g.in-line-a')
    s.move(1)
    expect(key(s.active!.ref)).toBe('k12-d.in-line-a')
    s.move(1)
    expect(key(s.active!.ref)).toBe('k12-d.in-line-a')
    s.move(-5)
    expect(key(s.active!.ref)).toBe('k12-g.in-line-a')
  })

  it('typing filters and re-aims the active option at the first match; no match = nothing active', () => {
    const { s } = session()
    s.setQuery('k12-d')
    expect(s.visible.map((e) => key(e.ref))).toEqual(['k12-d.in-line-a'])
    expect(key(s.active!.ref)).toBe('k12-d.in-line-a')
    s.setQuery('zzz')
    expect(s.visible).toEqual([])
    expect(s.active).toBeNull()
  })

  it('« k12-g » then Enter on in-line-a connects ONE cable through history (one undo entry)', () => {
    const { s, store, history, beforeDispatch } = session()
    s.setQuery('k12-g')
    const base = history.sizes.undo
    const r = s.activate({ repeat: false })
    expect(r).toMatchObject({ kind: 'connected', to: G_IN })
    expect(store.design().rig.connections).toEqual([{ a: QL_L, b: G_IN }])
    expect(history.sizes.undo).toBe(base + 1)
    expect(beforeDispatch).toHaveBeenCalledTimes(1)
    expect(history.undo()).toBe(true)
    expect(store.design().rig.connections).toEqual([])
  })

  it('a held key (repeat) connects nothing, an even number of keydowns still makes ONE cable', () => {
    const { s, store } = session()
    const results = [false, true, true, true].map((repeat) => s.activate({ repeat }))
    expect(results.map((r) => r.kind)).toEqual(['connected', 'ignored', 'ignored', 'ignored'])
    expect(store.design().rig.connections).toHaveLength(1)
  })

  it('an Enter whose first keydown is a repeat (held from the button that opened the dialog) connects nothing', () => {
    const { s, store } = session()
    expect(s.activate({ repeat: true }).kind).toBe('ignored')
    expect(store.design().rig.connections).toHaveLength(0)
  })

  it('a second activation after a connect is ignored (the session is spent)', () => {
    const { s, store } = session()
    expect(s.activate({ repeat: false }).kind).toBe('connected')
    expect(s.activate({ repeat: false }).kind).toBe('ignored')
    expect(store.design().rig.connections).toHaveLength(1)
  })

  it('a store change under the dialog makes it stale: nothing is dispatched afterwards', () => {
    const { s, store, history } = session()
    expect(s.onStoreChange()).toBe(true) // another command changed the rig (an undo, a place change)
    expect(s.stale).toBe(true)
    const base = history.sizes.undo
    expect(s.activate({ repeat: false }).kind).toBe('ignored')
    expect(store.design().rig.connections).toHaveLength(0)
    expect(history.sizes.undo).toBe(base)
  })

  it('its own dispatch does not stale it (the store notifies during history.do)', () => {
    const { s, store } = session()
    const told: boolean[] = []
    store.subscribe(() => told.push(s.onStoreChange()))
    expect(s.activate({ repeat: false }).kind).toBe('connected')
    expect(store.design().rig.connections).toHaveLength(1)
    expect(told).toEqual([false]) // notified once, during the dispatch, and not told to close
    expect(s.stale).toBe(false)
  })

  it('a target whose device left the rig is never dispatched, even if the session was not told', () => {
    const { s, store, history } = session()
    history.do({ type: 'REMOVE', instanceId: 'k12-g' })
    const base = history.sizes.undo
    const r = s.activate({ repeat: false })
    expect(r.kind).toBe('ignored')
    expect(store.design().rig.connections).toHaveLength(0)
    expect(history.sizes.undo).toBe(base)
  })

  it('a refusal is a message, never an exception: the cable is not made, the title comes from the one helper', () => {
    const { s, store, rejectionTitle } = session()
    // Make the refusal real: the target is taken by another cable after the list was built (no store notice reached the session).
    store.dispatch({ type: 'CONNECT', a: QL_R, b: G_IN })
    rejectionTitle.mockClear()
    const r = s.activate({ repeat: false })
    expect(r).toMatchObject({ kind: 'refused' })
    expect((r as { message: string }).message).toMatch(/^titre:/)
    expect(rejectionTitle).toHaveBeenCalled()
    expect(store.design().rig.connections).toHaveLength(1)
  })

  it('nothing to activate when the filter matched nothing', () => {
    const { s, store } = session()
    s.setQuery('zzz')
    expect(s.activate({ repeat: false }).kind).toBe('ignored')
    expect(store.design().rig.connections).toHaveLength(0)
  })

  it('also lists the rejected group, filtered by the same query', () => {
    const { s } = session()
    expect(s.rejectedVisible.length).toBeGreaterThan(0)
    s.setQuery('k12-g power')
    expect(s.rejectedVisible.map((e) => key(e.ref))).toEqual(['k12-g.power-in'])
    expect(s.visible).toEqual([])
  })
})
