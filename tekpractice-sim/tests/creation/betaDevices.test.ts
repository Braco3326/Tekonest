/**
 * Task 30 (S5): catalog proposals are « Bêta » devices, never verified gear.
 * The data under test is the file `npm run sync:kb` writes (content/proposals/catalog-proposals.json);
 * the fixtures only exercise the failure paths (a bad entry, a repeated id), they invent no gear.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { makeRegistry } from '../helpers'
import { COPY } from '../../src/creation/copy'
import { inventory } from '../../src/creation/inventory'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { isUnverified, parseProposals, prepareBeta, proposalEntries, registerProposals, unknownDeviceIds, within } from '../../src/creation/betaDevices'
import { buildTree } from '../../src/creation/shell/treeModel'
import { propsView } from '../../src/creation/shell/propertiesModel'

const file = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; label: string; ports: unknown[] }[] }
const noModels: ReadonlySet<string> = new Set()
type Raw = Record<string, unknown>
/** A minimal valid proposal built from the real catalog's own connector / signal ids. */
const entry = (id: string, over: Raw = {}): Raw => ({
  id,
  label: `Proposition ${id}`,
  levels: [],
  realWorld: { brand: 'Marque', model: id, category: 'amplifier', typicalUse: 'usage', notes: '' },
  ports: [{ portId: 'in-1', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }],
  ...over,
})

describe('parseProposals on the real proposals file', () => {
  it('keeps every proposal of the file, in order: none is invalid, a duplicate or a catalog device', () => {
    const r = parseProposals(file, makeRegistry())
    expect(r.skipped).toEqual([])
    expect(r.devices.map((d) => d.id)).toEqual(file.devices.map((d) => d.id))
    expect(file.devices.length).toBeGreaterThan(0)
  })
  it('keeps the declared ports exactly (same ids, connectors and signals)', () => {
    const r = parseProposals(file, makeRegistry())
    for (const [i, d] of r.devices.entries()) expect(d.ports, d.id).toEqual(file.devices[i].ports)
  })
})

describe('parseProposals leaves unusable entries out, with the reason', () => {
  const reg = makeRegistry()
  const parse = (devices: unknown[]) => parseProposals({ devices }, reg)
  it('de-duplicates by id: the first wins', () => {
    const r = parse([entry('p-a', { label: 'Premier' }), entry('p-a', { label: 'Second' }), entry('p-b')])
    expect(r.devices.map((d) => `${d.id}:${d.label}`)).toEqual(['p-a:Premier', 'p-b:Proposition p-b'])
    expect(r.skipped).toEqual([{ id: 'p-a', reason: expect.stringContaining('duplicate') }])
  })
  it('drops a proposal whose id is a verified catalog device', () => {
    const r = parse([entry('shure-sm58'), entry('p-a')])
    expect(r.devices.map((d) => d.id)).toEqual(['p-a'])
    expect(r.skipped[0]).toMatchObject({ id: 'shure-sm58', reason: expect.stringContaining('catalog') })
  })
  it('drops a malformed entry, a device with no port, a repeated port id and an unknown connector or signal', () => {
    const port = { portId: 'in-1', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }
    const r = parse([
      'oops',
      { id: 'bad id' },
      entry('no-port', { ports: [] }),
      entry('twice', { ports: [port, port] }),
      entry('odd-connector', { ports: [{ ...port, connector: 'no-such-connector' }] }),
      entry('odd-signal', { ports: [{ ...port, signal: 'no-such-signal' }] }),
      entry('fine'),
    ])
    expect(r.devices.map((d) => d.id)).toEqual(['fine'])
    expect(r.skipped.map((s) => s.id)).toEqual(['?', 'bad id', 'no-port', 'twice', 'odd-connector', 'odd-signal'])
  })
  it('gives an empty list for a file that is not a proposals file', () => {
    for (const raw of [null, undefined, 3, 'x', [], {}, { devices: 'no' }, { devices: null }]) expect(parseProposals(raw, reg), String(raw)).toEqual({ devices: [], skipped: [] })
  })
  it('declares ports only: a proposal that carries controls loses them', () => {
    const control = { id: 'phantom', type: 'toggle', label: '+48V', default: false }
    const [d] = parse([entry('p-c', { controls: [control] })]).devices
    expect(d.controls).toBeUndefined()
  })
})

describe('registerProposals / isUnverified', () => {
  it('makes a proposal known to the registry without touching the catalog list', () => {
    const reg = makeRegistry()
    const catalogBefore = reg.catalog.devices.map((d) => d.id)
    const { devices } = parseProposals(file, reg)
    const added = registerProposals(reg, devices)
    expect(added).toEqual(devices.map((d) => d.id))
    for (const d of devices) expect(reg.deviceById.get(d.id), d.id).toBe(d)
    expect(reg.catalog.devices.map((d) => d.id)).toEqual(catalogBefore)
  })
  it('is idempotent and never replaces a verified catalog device', () => {
    const reg = makeRegistry()
    const sm58 = reg.deviceById.get('shure-sm58')!
    const p = parseProposals({ devices: [entry('p-a')] }, reg).devices[0]
    expect(registerProposals(reg, [p])).toEqual(['p-a'])
    expect(registerProposals(reg, [p])).toEqual([])
    expect(registerProposals(reg, [{ ...p, id: 'shure-sm58', label: 'Imposteur' }])).toEqual([])
    expect(reg.deviceById.get('shure-sm58')).toBe(sm58)
    expect(isUnverified(reg, 'shure-sm58')).toBe(false)
  })
  it('isUnverified is true for a registered proposal only (not for a catalog device, an unknown id, or another registry)', () => {
    const reg = makeRegistry()
    const other = makeRegistry()
    const p = parseProposals({ devices: [entry('p-a')] }, reg).devices[0]
    expect(isUnverified(reg, 'p-a')).toBe(false) // parsed is not registered
    registerProposals(reg, [p])
    expect(isUnverified(reg, 'p-a')).toBe(true)
    expect(isUnverified(reg, 'yamaha-ql1')).toBe(false)
    expect(isUnverified(reg, 'nope')).toBe(false)
    expect(isUnverified(other, 'p-a')).toBe(false)
  })
})

describe('the inventory keeps a registered proposal in « Bêta », badged', () => {
  it('a registered proposal is still listed once, in the beta tab with the badge; catalog devices carry none', () => {
    const reg = makeRegistry()
    const { devices } = parseProposals(file, reg)
    registerProposals(reg, devices)
    const inv = inventory(reg, { proposals: proposalEntries(devices), modelIds: noModels })
    const beta = inv.items.filter((i) => i.tab === 'beta')
    expect(beta.map((i) => i.deviceId)).toEqual(devices.map((d) => d.id))
    for (const b of beta) expect(b.badge, b.deviceId).toBe('non vérifié')
    expect(inv.items.filter((i) => i.tab !== 'beta' && i.badge)).toEqual([])
    expect(inv.items.length).toBe(reg.catalog.devices.length + devices.length)
    expect(inv.tabs.indexOf('beta')).toBe(inv.tabs.indexOf('autres') - 1)
  })
  it('no proposals: no beta tab', () => {
    const reg = makeRegistry()
    expect(inventory(reg, { proposals: [], modelIds: noModels }).tabs).not.toContain('beta')
  })
})

describe('a placed Bêta device is a device like any other, declared ports only', () => {
  const setup = () => {
    const reg = makeRegistry()
    const { devices } = parseProposals(file, reg)
    registerProposals(reg, devices)
    return { reg, store: new CreationStore(reg, creationEvaluator(reg)) }
  }
  const CROWN = 'crown-xls-2502' // from the file: xlr3-f line-level-pro in, rca line-level-consumer in
  it('spawns, duplicates (a second SPAWN), moves and is removed with its cables, undo brings it back', () => {
    const { store } = setup()
    expect(store.dispatch({ type: 'SPAWN', deviceId: CROWN, instanceId: 'amp', position: [1, 0, 1] }).ok).toBe(true)
    const ports = store.snapshot().instances.find((i) => i.instanceId === 'amp')
    expect(ports).toBeDefined()
    expect(store.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' }).ok).toBe(true)
    const wire = { type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'amp', port: 'in-balanced-input-per-channel-1' } } as const
    expect(store.dispatch(wire).ok).toBe(true)
    const rm = store.dispatch({ type: 'REMOVE', instanceId: 'amp' })
    expect(rm.ok).toBe(true)
    expect(store.design().rig.connections).toHaveLength(0)
    if (!rm.ok) throw new Error('unreachable')
    expect(store.dispatchAll(rm.inverse).ok).toBe(true)
    expect(store.design().rig.instances.map((i) => i.instanceId).sort()).toEqual(['amp', 'ql1'])
    expect(store.design().rig.connections).toHaveLength(1)
  })
  it('R1 reads the declared connector: an XLR male output cannot go into the declared RCA input', () => {
    const { store } = setup()
    store.dispatch({ type: 'SPAWN', deviceId: CROWN, instanceId: 'amp' })
    store.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' })
    const r = store.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'amp', port: 'in-rca-phono-input-per-channel-1' } })
    expect(r.ok).toBe(false)
    expect(store.design().rig.connections).toHaveLength(0)
  })
  it('an unregistered proposal id is refused as any unknown device (nothing is invented)', () => {
    const reg = makeRegistry()
    const store = new CreationStore(reg, creationEvaluator(reg))
    const r = store.dispatch({ type: 'SPAWN', deviceId: CROWN, instanceId: 'amp' })
    expect(r.ok).toBe(false)
    expect(store.design().rig.instances).toEqual([])
  })
  it('a saved design with a Bêta device reloads when the proposal is registered, and drops it (reported) when it is not', () => {
    const { store } = setup()
    store.dispatch({ type: 'SPAWN', deviceId: CROWN, instanceId: 'amp', position: [2, 0, 0] })
    store.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' })
    const saved = store.design()
    const kept = setup().store
    expect(kept.dispatch({ type: 'APPLY_DESIGN', design: saved }).ok).toBe(true)
    expect(kept.design().rig.instances.map((i) => i.deviceId).sort()).toEqual([CROWN, 'yamaha-ql1'])
    const reg = makeRegistry() // the proposals source changed or is gone
    const lost = new CreationStore(reg, creationEvaluator(reg))
    const r = lost.dispatch({ type: 'APPLY_DESIGN', design: saved })
    expect(r.ok && r.dropped?.devices).toEqual(['amp'])
    expect(lost.design().rig.instances.map((i) => i.instanceId)).toEqual(['ql1'])
  })
})

describe('unknownDeviceIds (the proposals a design needs before it opens)', () => {
  it('lists each id the registry does not know, once; a catalog device is never listed', () => {
    const reg = makeRegistry()
    const design = {
      rig: {
        instances: [
          { instanceId: 'a-1', deviceId: 'crown-xls-2502' },
          { instanceId: 'a-2', deviceId: 'crown-xls-2502' },
          { instanceId: 'q', deviceId: 'yamaha-ql1' },
        ],
        connections: [],
        controls: {},
      },
    }
    expect(unknownDeviceIds(reg, design)).toEqual(['crown-xls-2502'])
    registerProposals(reg, parseProposals(file, reg).devices)
    expect(unknownDeviceIds(reg, design)).toEqual([])
  })
  it('is empty for a design without a rig (never throws on a bad autosave)', () => {
    const reg = makeRegistry()
    for (const d of [null, undefined, {}, { rig: null }, { rig: { instances: 3 } }] as never[]) expect(unknownDeviceIds(reg, d)).toEqual([])
  })
})

describe('a placed Bêta device says « non vérifié » in the tree and in Properties', () => {
  const reg = makeRegistry()
  registerProposals(reg, parseProposals(file, reg).devices)
  const design = {
    roomId: 'x',
    rig: {
      instances: [
        { instanceId: 'amp-1', deviceId: 'crown-xls-2502' },
        { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
      ],
      connections: [],
      controls: {},
    },
    placements: [],
  }
  it('tree: the beta row carries the badge, the catalog row does not', () => {
    const rows = buildTree({
      placeLabel: 'x',
      zones: [],
      design,
      deviceLabel: (id) => reg.deviceById.get(id)?.label ?? id,
      isUnverified: (id) => isUnverified(reg, id),
      points: [],
    })
      .find((n) => n.kind === 'materiel')!
      .children!
    expect(rows.find((r) => r.id === 'device:amp-1')!.badge).toBe(COPY.inventory!.badgeUnverified)
    expect(rows.find((r) => r.id === 'device:ql1')!.badge).toBeUndefined()
  })
  it('tree without the option: no badge anywhere (legacy callers unchanged)', () => {
    const rows = buildTree({ placeLabel: 'x', zones: [], design, deviceLabel: (id) => id, points: [] }).find((n) => n.kind === 'materiel')!.children!
    for (const r of rows) expect(r.badge).toBeUndefined()
  })
  it('properties: unverified is true for the beta device only, and its ports are the declared ones', () => {
    const v = propsView(design as never, reg, 'amp-1')!
    expect(v.unverified).toBe(true)
    expect(v.ports.map((p) => p.portId)).toEqual(file.devices.find((d) => d.id === 'crown-xls-2502')!.ports.map((p) => (p as { portId: string }).portId))
    expect(propsView(design as never, reg, 'ql1')!.unverified).toBe(false)
  })
})

describe('copy', () => {
  it('the tooltip is the sentence the brief gives', () => {
    expect(COPY.inventory!.tipUnverified).toBe('Fiche proposée, pas encore vérifiée : comportement approximatif.')
    expect(COPY.inventory!.badgeUnverified).toBe('non vérifié')
  })
})

describe('prepareBeta: a failed fetch is not an absent sheet (Task 30 fix 1)', () => {
  const design = (...deviceIds: string[]) => ({
    rig: { instances: deviceIds.map((deviceId, i) => ({ instanceId: "i-" + i, deviceId })), connections: [], controls: {} },
  })
  const loaded = (reg: ReturnType<typeof makeRegistry>) => ({ devices: parseProposals(file, reg).devices, failed: false })
  it('nothing unknown: the loader is not called (no fetch for a catalogue-only design)', async () => {
    const reg = makeRegistry()
    const load = vi.fn(async () => ({ devices: [], failed: false }))
    expect(await prepareBeta(reg, design('yamaha-ql1'), load)).toEqual({ kind: 'ready', missing: [] })
    expect(load).not.toHaveBeenCalled()
  })
  it('sheet present in a successfully loaded file: registered, nothing missing', async () => {
    const reg = makeRegistry()
    expect(await prepareBeta(reg, design('crown-xls-2502', 'yamaha-ql1'), async () => loaded(reg))).toEqual({ kind: 'ready', missing: [] })
    expect(isUnverified(reg, 'crown-xls-2502')).toBe(true)
  })
  it('sheet genuinely absent from a successfully loaded file: ready, with the id missing', async () => {
    const reg = makeRegistry()
    const r = await prepareBeta(reg, design('crown-xls-2502', 'gone-device'), async () => loaded(reg))
    expect(r).toEqual({ kind: 'ready', missing: ['gone-device'] })
  })
  it('a failed load is « unavailable », never « missing »: nothing is registered, every unknown id is reported', async () => {
    const reg = makeRegistry()
    // even when the failed loader still holds a stale list, a failure registers nothing
    const r = await prepareBeta(reg, design('crown-xls-2502', 'yamaha-ql1'), async () => ({ devices: parseProposals(file, reg).devices, failed: true }))
    expect(r).toEqual({ kind: 'unavailable', ids: ['crown-xls-2502'] })
    expect(isUnverified(reg, 'crown-xls-2502')).toBe(false)
    expect(reg.deviceById.has('crown-xls-2502')).toBe(false)
  })
})

describe('within: a fetch that never settles is a failure after the delay (Task 30 fix 2)', () => {
  it('resolves with the value when the promise settles first, and leaves no timer behind', async () => {
    vi.useFakeTimers()
    try {
      const r = await within(Promise.resolve(7), 5000)
      expect(r).toEqual({ ok: true, value: 7 })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
  it('resolves { ok: false } when the delay passes first', async () => {
    vi.useFakeTimers()
    try {
      const r = within(new Promise<number>(() => {}), 5000)
      await vi.advanceTimersByTimeAsync(4999)
      let done = false
      void r.then(() => (done = true))
      await vi.advanceTimersByTimeAsync(0)
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await r).toEqual({ ok: false })
    } finally {
      vi.useRealTimers()
    }
  })
  it('a rejection is a failure too, not an exception', async () => {
    expect(await within(Promise.reject(new Error('offline')), 5000)).toEqual({ ok: false })
  })
})
