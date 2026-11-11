/**
 * Task 0.4 (Wave 0): the promotion tool. Everything runs on a TEMPORARY copy of the repo's content (the real catalogue, a small proposals file and a
 * three-plus-row plan): the real files are never touched. Three promoted fixtures come from different categories: a condenser microphone, a rack
 * stage box (a Bêta proposal with long knowledge-base port ids and a powerCON inlet), an active monitor.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogWithProposals } from '../../tools/catalogWithProposals'
import { checkCatalog } from '../../tools/catalogChecks'
import { loadPlan, savePlan, type PlanRow } from '../../tools/equipmentPlan'
import { appendDevice, formatDevice, promoteDevice, type Paths } from '../../tools/promoteDevice'
import { checkSpecParity } from '../../tools/assets3d/loadSpecs'
import { AssetSpec } from '../../tools/assets3d/specSchema'
import { Catalog } from '../../tools/schemas'

const base = (over: Partial<PlanRow>): PlanRow => ({
  id: 'x',
  status: 'new',
  category: 'microphone',
  manufacturer: 'Fabricant',
  product: 'Produit',
  sizeMm: { w: 50, d: 50, h: 160 },
  portsSummary: '',
  family: 'revolve',
  dataQuality: 'datasheet',
  sourceGrade: 'datasheet',
  tier: 1,
  wave: 1,
  sources: ['https://example.com/datasheet.pdf'],
  notes: '',
  traits: [],
  sizeConfidence: 'ok',
  ...over,
})

const ROWS: PlanRow[] = [
  base({ id: 'fx-condenser', category: 'microphone', manufacturer: 'Acme', product: 'C1', traits: ['condenser'], sizeMm: { w: 52, d: 52, h: 160 } }),
  base({ id: 'fx-stagebox', status: 'beta', category: 'stagebox', manufacturer: 'Acme', product: 'SB16', family: 'rack-box-v2', sizeMm: { w: 483, d: 220, h: 137 }, dataQuality: 'dealer', sourceGrade: 'dealer' }),
  base({ id: 'fx-monitor', category: 'studio-monitor', manufacturer: 'Acme', product: 'M5', family: 'curved-cabinet', sizeMm: { w: 185, d: 160, h: 300 }, dataQuality: 'dealer', sourceGrade: 'dealer' }),
  base({ id: 'fx-missing', category: 'amplifier', family: 'rack-box-v2', sizeMm: {}, dataQuality: 'missing', sourceGrade: 'missing', sources: [] }),
  base({ id: 'fx-estimate-new', category: 'recorder', family: 'moulded-box', sizeMm: { w: 150, h: 40 }, dataQuality: 'estimate', sizeConfidence: 'partial', sourceGrade: 'datasheet', sources: [] }),
  base({ id: 'fx-estimate-beta', status: 'beta', category: 'audio-interface', family: 'rack-box-v2', sizeMm: { w: 482.6, h: 44.5 }, dataQuality: 'estimate', sizeConfidence: 'partial', sourceGrade: 'dealer' }),
  base({ id: 'fx-cable', category: 'cable', family: 'cable-assembly-v2' }),
  base({ id: 'fx-nosource', category: 'microphone', sources: [] }),
]

const PROPOSALS = {
  generated: '2026-10-22',
  status: "proposal — needs Oscar's review",
  skipped: [],
  devices: [
    {
      id: 'fx-stagebox',
      label: 'Acme SB16',
      levels: [],
      realWorld: { brand: 'Acme', model: 'SB16', category: 'stagebox', typicalUse: 'Stage box', notes: 'PROPOSITION' },
      ports: [
        { portId: 'in-mic-preamp-input-balanced-per-channel-1', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
        { portId: 'in-mic-preamp-input-balanced-per-channel-2', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
        { portId: 'out-line-output-balanced-per-channel-1', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
        { portId: 'in-mains-in-powercon-32-a-closest-id-see-notes', dir: 'in', connector: 'powercon-blue', signal: 'mains-power' },
        { portId: 'dante-primary', dir: 'bidir', connector: 'ethercon', signal: 'aoip', flags: ['isDantePrimary'] },
      ],
    },
    {
      id: 'fx-estimate-beta',
      label: 'Acme IF2',
      levels: [],
      realWorld: { brand: 'Acme', model: 'IF2', category: 'audio-interface', typicalUse: 'Interface', notes: 'PROPOSITION' },
      ports: [
        { portId: 'in-the-microphone-balanced-input-per-channel-with-a-very-long-name-1', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
        { portId: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' },
      ],
    },
    {
      id: 'fx-other',
      label: 'Autre',
      levels: [],
      realWorld: { brand: 'A', model: 'B', category: 'amplifier', typicalUse: 'u', notes: '' },
      ports: [{ portId: 'in-1', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }],
    },
  ],
}

let dir: string
let paths: Paths
const read = (p: string): string => readFileSync(p, 'utf8')
const snapshot = (): Record<string, string> => ({
  plan: read(paths.plan),
  catalog: read(paths.catalog),
  proposals: read(paths.proposals),
  specs: JSON.stringify(readdirSync(paths.specDir).sort()),
})
const promote = (id: string, over: { dryRun?: boolean } = {}) => promoteDevice(id, { paths, today: '2026-11-11', ...over })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'promote-'))
  mkdirSync(join(dir, 'specs'))
  paths = { plan: join(dir, 'plan.json'), catalog: join(dir, 'catalog.json'), proposals: join(dir, 'proposals.json'), specDir: join(dir, 'specs') }
  copyFileSync('content/catalog.json', paths.catalog)
  writeFileSync(paths.proposals, JSON.stringify(PROPOSALS, null, 1) + '\n')
  savePlan(ROWS, paths.plan, '2026-11-11')
})

describe('promoted outcome (datasheet or dealer size)', () => {
  it('a condenser microphone: one mic-level out requiring phantom, no power control; catalogue valid; the spec matches it', () => {
    const r = promote('fx-condenser')
    expect(r.outcome).toBe('promoted')
    const cat = Catalog.parse(JSON.parse(read(paths.catalog)))
    const d = cat.devices.find((x) => x.id === 'fx-condenser')!
    expect(d.ports).toEqual([{ portId: 'out-xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level', flags: ['requiresPhantom'] }])
    expect(d.controls).toBeUndefined()
    expect(d.realWorld).toMatchObject({ brand: 'Acme', model: 'C1', category: 'microphone' })
    expect(checkCatalog(cat, { modelIds: new Set(cat.devices.map((x) => x.id)) }).filter((i) => i.level === 'error')).toEqual([])
    const spec = AssetSpec.parse(JSON.parse(read(join(paths.specDir, 'fx-condenser.json'))))
    expect(spec.realSizeMm).toEqual({ w: 52, h: 160, d: 52 })
    expect(checkSpecParity(spec, cat)).toEqual([])
    expect(spec.ports.every((p) => p.confidence === 'guess')).toBe(true)
  })

  it('a rack stage box from a Bêta proposal: short unique port ids (<= 19), every mains port is power-in with the power toggle, the old ids are kept as portAliases', () => {
    const r = promote('fx-stagebox')
    expect(r.outcome).toBe('promoted')
    const cat = Catalog.parse(JSON.parse(read(paths.catalog)))
    const d = cat.devices.find((x) => x.id === 'fx-stagebox')!
    const ids = d.ports.map((p) => p.portId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.length, id).toBeLessThanOrEqual(19)
    expect(d.ports.find((p) => p.signal === 'mains-power')).toMatchObject({ portId: 'power-in', connector: 'powercon-blue' })
    expect(d.controls).toContainEqual({ id: 'power', type: 'toggle', label: 'Alimentation', default: true })
    expect(d.ports.filter((p) => p.signal === 'mic-level').every((p) => p.flags?.includes('isMicInput') && p.flags.includes('providesPhantom'))).toBe(true)
    expect(d.portAliases).toBeDefined()
    expect(d.portAliases!['in-mic-preamp-input-balanced-per-channel-1']).toBe(ids[0])
    expect(d.portAliases!['in-mains-in-powercon-32-a-closest-id-see-notes']).toBe('power-in')
    expect(Object.values(d.portAliases!).every((v) => ids.includes(v))).toBe(true)
    expect(checkCatalog(cat, { modelIds: new Set(cat.devices.map((x) => x.id)) }).filter((i) => i.level === 'error')).toEqual([])
    const spec = AssetSpec.parse(JSON.parse(read(join(paths.specDir, 'fx-stagebox.json'))))
    expect(checkSpecParity(spec, cat)).toEqual([])
    expect(spec.realSizeMm).toEqual({ w: 483, h: 137, d: 220 })
  })

  it('an active monitor: routes in to the transducer, nominal acoustic with a source, power', () => {
    promote('fx-monitor')
    const d = Catalog.parse(JSON.parse(read(paths.catalog))).devices.find((x) => x.id === 'fx-monitor')!
    expect(d.routing).toEqual([{ from: 'in-analog', to: ['transducer'] }])
    expect(d.acoustic!.coverage_h_deg.source.kind).toBe('nominal')
    expect(d.acoustic!.coverage_h_deg.source.retrieved).toBe('2026-11-11')
    expect(d.ports.map((p) => p.portId)).toEqual(['in-analog', 'power-in'])
  })

  it('the promoted id leaves the proposals file (the other proposals stay), and the plan row is flagged', () => {
    promote('fx-stagebox')
    const props = JSON.parse(read(paths.proposals)) as { devices: { id: string }[] }
    expect(props.devices.map((d) => d.id)).toEqual(['fx-estimate-beta', 'fx-other'])
    expect(loadPlan(paths.plan).find((r) => r.id === 'fx-stagebox')!.promoted).toBe(true)
  })

  it('the 25 existing devices are untouched: the catalogue text before the insertion is byte-identical and the old devices parse deep-equal', () => {
    const before = read(paths.catalog)
    promote('fx-condenser')
    promote('fx-monitor')
    const after = read(paths.catalog)
    const cut = before.indexOf('\n    }\n  ],\n\n  "rules"')
    expect(after.startsWith(before.slice(0, cut))).toBe(true)
    expect(after.endsWith(before.slice(cut + '\n    }'.length))).toBe(true)
    const b = JSON.parse(before) as { devices: unknown[] }
    const a = JSON.parse(after) as { devices: unknown[] }
    expect(a.devices.slice(0, b.devices.length)).toEqual(b.devices)
    expect(a.devices).toHaveLength(b.devices.length + 2)
    expect({ ...a, devices: undefined }).toEqual({ ...b, devices: undefined })
  })

  it('promoting twice is a no-op: same outcome, no change, no file touched', () => {
    promote('fx-monitor')
    const snap = snapshot()
    const again = promote('fx-monitor')
    expect(again).toMatchObject({ outcome: 'promoted', changes: [] })
    expect(snapshot()).toEqual(snap)
  })

  it('a hand-filled spec is never overwritten', () => {
    writeFileSync(join(paths.specDir, 'fx-condenser.json'), '{"hand":"made"}\n')
    promote('fx-condenser')
    expect(read(join(paths.specDir, 'fx-condenser.json'))).toBe('{"hand":"made"}\n')
  })
})

describe('refusals write nothing', () => {
  it('a missing row is blocked with the reason, and no file changes', () => {
    const snap = snapshot()
    const r = promote('fx-missing')
    expect(r.outcome).toBe('blocked')
    expect(r.reason).toMatch(/missing/)
    expect(r.changes).toEqual([])
    expect(snapshot()).toEqual(snap)
  })
  it('a promotable row with no source URL is blocked; a cable row with no documented ports is blocked', () => {
    const snap = snapshot()
    expect(promote('fx-nosource')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/source/) })
    expect(promote('fx-cable')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/ports/) })
    expect(snapshot()).toEqual(snap)
  })
  it('an unknown id throws; an id already in the catalogue but not flagged promoted throws (id collision), writing nothing', () => {
    expect(() => promote('nope')).toThrow(/not a row/)
    const rows = loadPlan(paths.plan)
    savePlan([...rows, base({ id: 'shure-sm58' })], paths.plan)
    const snap = snapshot()
    expect(() => promote('shure-sm58')).toThrow(/collision/)
    expect(snapshot()).toEqual(snap)
  })
  it('a new row whose id is already a proposal throws (one id, one place)', () => {
    savePlan([...loadPlan(paths.plan), base({ id: 'fx-other', status: 'new' })], paths.plan)
    expect(() => promote('fx-other')).toThrow(/collision/)
  })
  it('dry-run changes no file and reports what it would do', () => {
    const snap = snapshot()
    for (const id of ['fx-condenser', 'fx-stagebox', 'fx-estimate-beta', 'fx-estimate-new']) {
      const r = promote(id, { dryRun: true })
      expect(r.changes.length, id).toBeGreaterThan(0)
    }
    expect(snapshot()).toEqual(snap)
  })
})

describe('beta-modelled outcome (estimated size): the device stays a proposal', () => {
  it('an estimate row becomes beta-modelled, never promoted: the catalogue is byte-identical', () => {
    const catalogBefore = read(paths.catalog)
    expect(promote('fx-estimate-beta').outcome).toBe('beta-modelled')
    expect(promote('fx-estimate-new').outcome).toBe('beta-modelled')
    expect(read(paths.catalog)).toBe(catalogBefore)
    const rows = loadPlan(paths.plan)
    for (const id of ['fx-estimate-beta', 'fx-estimate-new']) {
      expect(rows.find((r) => r.id === id)).toMatchObject({ betaModelled: true })
      expect(rows.find((r) => r.id === id)!.promoted).toBeUndefined()
    }
  })

  it('a Bêta proposal keeps its ports (saved projects keep their cables) and gains the plan size; a new row gets a proposal built from the template', () => {
    promote('fx-estimate-beta')
    promote('fx-estimate-new')
    const props = (JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string }[]; sizeMm?: unknown; controls?: unknown }[] }).devices
    const beta = props.find((d) => d.id === 'fx-estimate-beta')!
    expect(beta.ports.map((p) => p.portId)).toEqual(PROPOSALS.devices[1]!.ports.map((p) => p.portId))
    expect(beta.sizeMm).toEqual({ w: 482.6, h: 44.5 })
    const created = props.find((d) => d.id === 'fx-estimate-new')!
    expect(created.ports.length).toBeGreaterThan(0)
    expect(created.controls).toBeUndefined()
    expect(created.sizeMm).toEqual({ w: 150, h: 40 })
    expect(props.map((d) => d.id)).toContain('fx-other')
  })

  it('the spec has a COMPLETE size (the missing axes from the category, said so in its sources), guess ports, no controls, and matches the proposal', () => {
    promote('fx-estimate-beta')
    const spec = AssetSpec.parse(JSON.parse(read(join(paths.specDir, 'fx-estimate-beta.json'))))
    expect(spec.realSizeMm).toEqual({ w: 482.6, h: 44.5, d: 300 })
    expect(spec.realSizeMm.d).toBeGreaterThan(0)
    expect(spec.controls).toEqual([])
    expect(spec.ports.every((p) => p.confidence === 'guess')).toBe(true)
    expect(JSON.stringify(spec.sources)).toMatch(/ESTIMATED/)
    const cat = catalogWithProposals(Catalog.parse(JSON.parse(read(paths.catalog))), JSON.parse(read(paths.proposals)))
    expect(checkSpecParity(spec, cat)).toEqual([])
  })

  it('never a 0 x 0 x 0 size reaches a spec (Review Focus 3): a row with no axis at all is blocked, not guessed', () => {
    const r = promote('fx-missing')
    expect(r.outcome).toBe('blocked')
    expect(readdirSync(paths.specDir)).toEqual([])
  })

  it('promoting a beta-modelled row again is a no-op', () => {
    promote('fx-estimate-new')
    const snap = snapshot()
    expect(promote('fx-estimate-new')).toMatchObject({ outcome: 'beta-modelled', changes: [] })
    expect(snapshot()).toEqual(snap)
  })
})

describe('catalogWithProposals (the asset pipeline sees the proposals)', () => {
  const cat = () => Catalog.parse(JSON.parse(read('content/catalog.json')))
  it('adds usable proposals, never replaces a catalogue device, drops controls / routing / mains-source flags as the app does', () => {
    const merged = catalogWithProposals(cat(), {
      devices: [
        { id: 'shure-sm58', label: 'Imposteur', levels: [], realWorld: { brand: 'a', model: 'b', category: 'microphone', typicalUse: 'u', notes: '' }, ports: [{ portId: 'x', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }] },
        {
          id: 'p-new',
          label: 'Nouveau',
          levels: [],
          realWorld: { brand: 'a', model: 'b', category: 'amplifier', typicalUse: 'u', notes: '' },
          ports: [{ portId: 'o', dir: 'out', connector: 'iec-c13', signal: 'mains-power', flags: ['isMainsSource'] }],
          controls: [{ id: 'power', type: 'toggle', label: 'x', default: true }],
          routing: [{ from: 'o', to: ['transducer'] }],
        },
        'oops',
      ],
    })
    expect(merged.devices).toHaveLength(26)
    expect(merged.devices.find((d) => d.id === 'shure-sm58')!.label).toBe('Shure SM58')
    const p = merged.devices.find((d) => d.id === 'p-new')!
    expect(p.controls).toBeUndefined()
    expect(p.routing).toBeUndefined()
    expect(p.ports[0]).toEqual({ portId: 'o', dir: 'out', connector: 'iec-c13', signal: 'mains-power' })
    expect(catalogWithProposals(cat(), null)).toEqual(cat())
  })
})

describe('formatDevice / appendDevice', () => {
  it('appends a device that round-trips through JSON.parse and keeps everything before it byte-identical', () => {
    const text = read('content/catalog.json')
    const device = Catalog.parse(JSON.parse(text)).devices.find((d) => d.id === 'qsc-k12-2')!
    const copy = { ...structuredClone(device), id: 'qsc-k12-2-copy' }
    const next = appendDevice(text, copy)
    const parsed = JSON.parse(next) as { devices: { id: string }[] }
    expect(parsed.devices.at(-1)).toEqual(copy)
    expect(JSON.parse(formatDevice(copy))).toEqual(copy)
    expect(formatDevice(copy)).toContain('"portId": "in-line-a"')
  })
  it('refuses a file whose devices array end it cannot find', () => {
    expect(() => appendDevice('{ "devices": [] }', Catalog.parse(JSON.parse(read('content/catalog.json'))).devices[0]!)).toThrow(/end of the devices array/)
  })
})
