/**
 * Wave 0 Task 0.4, reworked in Wave 0b: the TWO-STAGE promotion tool.
 *   stage 1  `promote <id>`            asset-spec skeleton + plan row `staged`; the catalogue and the proposals file are NOT touched
 *   stage 2  `promote <id> --commit`   after the GLB shipped: catalogue entry (promoted, documented ports only) or proposal update (beta-modelled)
 *   revert   `promote <id> --revert`   undoes the latest stage completely
 * Everything runs on a TEMPORARY copy of the real content (the real catalogue, the real proposals and the real 315-row plan, plus a few fixture
 * rows): the repo's files are never touched. Real rows are used wherever the outcome is the point (neumann-tlm-103, midas-m32, mackie-profx12v3,
 * yamaha-tf5).
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogWithProposals, catalogWithStaged } from '../../tools/catalogWithProposals'
import { checkCatalog } from '../../tools/catalogChecks'
import { loadPlan, savePlan, type PlanRow } from '../../tools/equipmentPlan'
import { appendDevice, formatDevice, promoteDevice, removeDevice, stagedDevices, type Paths } from '../../tools/promoteDevice'
import { checkSpecParity } from '../../tools/assets3d/loadSpecs'
import { AssetSpec, type AssetSpecT } from '../../tools/assets3d/specSchema'
import { Catalog } from '../../tools/schemas'

const fixture = (over: Partial<PlanRow>): PlanRow => ({
  id: 'x',
  status: 'new',
  category: 'microphone',
  manufacturer: 'Fabricant',
  product: 'Produit',
  sizeMm: { w: 50, d: 50, h: 160 },
  portsSummary: '1 XLR out',
  family: 'revolve',
  dataQuality: 'datasheet',
  sourceGrade: 'datasheet',
  tier: 1,
  wave: 1,
  sources: ['https://www.fabricant.example/datasheet.pdf'],
  notes: '',
  traits: [],
  sizeConfidence: 'ok',
  ...over,
})

const FIXTURES: PlanRow[] = [
  fixture({ id: 'fx-condenser', traits: ['condenser', 'phantom-powered'], sizeMm: { w: 52, d: 52, h: 160 } }),
  fixture({ id: 'fx-monitor', category: 'studio-monitor', family: 'curved-cabinet', traits: ['active'], sizeMm: { w: 182, d: 227, h: 287 }, sources: ['https://www.thomann.de/fx_monitor.htm'], dataQuality: 'dealer', sourceGrade: 'dealer' }),
  fixture({ id: 'fx-missing', category: 'amplifier', family: 'rack-box-v2', traits: ['power-amp'], sizeMm: {}, dataQuality: 'missing', sourceGrade: 'missing', sources: [] }),
  fixture({ id: 'fx-estimate-new', category: 'recorder', family: 'moulded-box', traits: ['battery'], sizeMm: { w: 150, h: 40 }, dataQuality: 'estimate', sizeConfidence: 'partial', sourceGrade: 'datasheet', sources: [] }),
  fixture({ id: 'fx-conflict', category: 'microphone', traits: ['dynamic'], dataQuality: 'estimate', sizeConfidence: 'conflict', sourceGrade: 'datasheet' }),
  fixture({ id: 'fx-cable', category: 'cable', family: 'cable-assembly-v2', traits: ['passive'] }),
  fixture({ id: 'fx-nosource', sources: [] }),
]

const MIC_OUT = { portId: 'out-xlr', face: 'io', xMm: 20, yMm: 10, confidence: 'guess', connector: 'xlr3-m', signal: 'mic-level', dir: 'out' } as const
const POWER_CTRL = { controlId: 'power', kind: 'switch', face: 'io', axis: 'x', xMm: 30, yMm: 20, sizeMm: { w: 10, h: 10, d: 3 } } as const
const DESK_CONTROLS = [POWER_CTRL, ...['mute-master', 'fader-master', 'balance-master'].map((id) => ({ controlId: id, kind: 'knob', face: 'top', axis: 'y', xMm: 100, yMm: 100, sizeMm: { w: 15, h: 15, d: 10 } }))]
const port = (portId: string, dir: 'in' | 'out' | 'bidir', connector: string, signal: string, extra: Record<string, unknown> = {}) => ({ portId, face: 'io', xMm: 10, yMm: 10, confidence: 'guess', connector, signal, dir, ...extra })

let dir: string
let paths: Paths
const read = (p: string): string => readFileSync(p, 'utf8')
const specPath = (id: string): string => join(paths.specDir, `${id}.json`)
const readSpec = (id: string): AssetSpecT => AssetSpec.parse(JSON.parse(read(specPath(id))))
const snapshot = (): Record<string, string | null> => ({
  plan: read(paths.plan),
  catalog: read(paths.catalog),
  proposals: read(paths.proposals),
  journal: existsSync(paths.journal) ? read(paths.journal) : null,
  specs: JSON.stringify(readdirSync(paths.specDir).sort()),
})
const stage1 = (id: string, o: { dryRun?: boolean } = {}) => promoteDevice(id, { paths, today: '2026-11-12', ...o })
const stage2 = (id: string, o: { dryRun?: boolean; beforeRename?: (p: string) => void } = {}) => promoteDevice(id, { paths, today: '2026-11-12', commit: true, ...o })
const revert = (id: string, o: { dryRun?: boolean; discardSpec?: boolean } = {}) => promoteDevice(id, { paths, today: '2026-11-12', revert: true, ...o })
const rowOf = (id: string): PlanRow => loadPlan(paths.plan).find((r) => r.id === id)!

/** What the person does between the stages: fill the spec (documented ports, controls, the flag and its source) and ship the GLB (manifest row + file). */
function fillSpec(id: string, ports: object[], controls: object[], documented = true): void {
  const spec = JSON.parse(read(specPath(id))) as Record<string, unknown>
  writeFileSync(specPath(id), JSON.stringify({ ...spec, ports, controls, ...(documented ? { portsDocumented: true, portsSource: 'https://www.fabricant.example/manual.pdf' } : {}) }, null, 2) + '\n')
}
function ship(id: string): void {
  const manifest = existsSync(paths.manifest) ? (JSON.parse(read(paths.manifest)) as { assets: unknown[] }) : { assets: [] }
  manifest.assets.push({ id, kind: 'device', status: 'ok' })
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(paths.assetsDir, `${id}.glb`), 'glb')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'promote-'))
  mkdirSync(join(dir, 'specs'))
  mkdirSync(join(dir, 'assets'))
  paths = {
    plan: join(dir, 'plan.json'),
    catalog: join(dir, 'catalog.json'),
    proposals: join(dir, 'proposals.json'),
    specDir: join(dir, 'specs'),
    manifest: join(dir, 'assets', 'ASSET_MANIFEST.json'),
    assetsDir: join(dir, 'assets'),
    journal: join(dir, 'journal.json'),
  }
  copyFileSync('content/catalog.json', paths.catalog)
  copyFileSync('content/proposals/catalog-proposals.json', paths.proposals)
  // the real plan carries the run's own state (staged / promoted / betaModelled flags set by the build waves): these tests start from the pristine rows
  const pristine = loadPlan().map((r) => {
    const { staged: _s, promoted: _p, betaModelled: _b, ...rest } = r
    return rest as PlanRow
  })
  savePlan([...pristine, ...FIXTURES], paths.plan, '2026-11-12')
})

describe('stage 1: only the spec skeleton and the staged flag', () => {
  it('writes the skeleton and marks the row staged; the catalogue, the proposals file and the journal are byte-identical (finding 6: nothing half-promoted)', () => {
    const before = snapshot()
    const r = stage1('midas-m32')
    expect(r.outcome).toBe('staged')
    const after = snapshot()
    expect(after.catalog).toBe(before.catalog)
    expect(after.proposals).toBe(before.proposals)
    expect(after.journal).toBeNull()
    expect(rowOf('midas-m32').staged).toBe(true)
    expect(rowOf('midas-m32').promoted).toBeUndefined()
    expect(existsSync(specPath('midas-m32'))).toBe(true)
  })

  it('the skeleton carries the plan size, no ports and no controls (nothing is invented), a to-do note, and honest source kinds', () => {
    stage1('neumann-tlm-103')
    const spec = readSpec('neumann-tlm-103')
    expect(spec.realSizeMm).toEqual({ w: 60, h: 132, d: 60 })
    expect(spec.ports).toEqual([])
    expect(spec.controls).toEqual([])
    expect(spec.portsDocumented).toBeUndefined()
    expect(spec.portsTodo).toMatch(/Plan ports summary|Ports of the Bêta proposal/)
    expect(spec.sources.map((s) => s.kind)).toEqual(['datasheet']) // a neumann.com page
    stage1('fx-monitor')
    expect(readSpec('fx-monitor').sources.map((s) => s.kind)).toEqual(['dealer']) // a retailer page is never a « datasheet »
  })

  it('a Bêta row lists its proposal ports in the to-do note as text, not as ports', () => {
    stage1('mackie-profx12v3')
    const spec = readSpec('mackie-profx12v3')
    const proposals = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string }[] }[] }
    const first = proposals.devices.find((d) => d.id === 'mackie-profx12v3')!.ports[0]!.portId
    expect(spec.ports).toEqual([])
    expect(spec.portsTodo).toContain(first)
    expect(spec.portsTodo).toMatch(/NOT copied as ports/)
  })

  it('a Bêta row keeps its proposal, and the proposal keeps its size, until stage 2 (finding 9: no device without a size)', () => {
    const proposals = JSON.parse(read(paths.proposals)) as { devices: { id: string; sizeMm?: unknown }[] }
    const before = proposals.devices.find((d) => d.id === 'mackie-profx12v3')!
    expect(before.sizeMm).toEqual({ w: 330, d: 376, h: 102 })
    stage1('mackie-profx12v3')
    const after = (JSON.parse(read(paths.proposals)) as typeof proposals).devices.find((d) => d.id === 'mackie-profx12v3')!
    expect(after).toEqual(before)
  })

  it('is idempotent: a second run is a no-op and touches no file; a dry run changes nothing and reports what it would do', () => {
    const dry = stage1('midas-m32', { dryRun: true })
    expect(dry.changes.length).toBeGreaterThan(0)
    expect(existsSync(specPath('midas-m32'))).toBe(false)
    stage1('midas-m32')
    const snap = snapshot()
    expect(stage1('midas-m32')).toMatchObject({ outcome: 'staged', changes: [] })
    expect(snapshot()).toEqual(snap)
  })

  it('a hand-filled spec is never overwritten', () => {
    writeFileSync(specPath('fx-condenser'), '{"hand":"made"}\n')
    stage1('fx-condenser')
    expect(read(specPath('fx-condenser'))).toBe('{"hand":"made"}\n')
    expect(rowOf('fx-condenser').staged).toBe(true)
  })

  it('refusals write nothing: a missing row, a promotable row with no source, an unknown id, an id already in the catalogue', () => {
    const snap = snapshot()
    expect(stage1('fx-missing')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/missing/) })
    expect(stage1('fx-nosource')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/source/) })
    expect(() => stage1('nope')).toThrow(/not a row/)
    savePlan([...loadPlan(paths.plan), fixture({ id: 'shure-sm58' })], paths.plan)
    const snap2 = snapshot()
    expect(() => stage1('shure-sm58')).toThrow(/collision/)
    expect(snapshot()).toEqual(snap2)
    expect(snap.catalog).toBe(snap2.catalog)
  })

  it('a new row whose id is already a proposal throws (one id, one place)', () => {
    const rows = loadPlan(paths.plan).map((r) => (r.id === 'fx-condenser' ? { ...r, id: 'fx-collide' } : r))
    savePlan(rows, paths.plan)
    const p = JSON.parse(read(paths.proposals)) as { devices: Record<string, unknown>[] }
    p.devices.push({ ...p.devices[0]!, id: 'fx-collide' })
    writeFileSync(paths.proposals, JSON.stringify(p, null, 1) + '\n')
    const snap = snapshot()
    expect(() => stage1('fx-collide')).toThrow(/collision/)
    expect(snapshot()).toEqual(snap)
  })
})

describe('stage 2 refuses until the model shipped', () => {
  it('an unstaged row, a row with no manifest row, and a row with a manifest row but no GLB are blocked and write nothing', () => {
    expect(stage2('midas-m32')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/not staged/) })
    stage1('midas-m32')
    fillSpec('midas-m32', [port('out-main-l', 'out', 'xlr3-m', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')], [])
    const snap = snapshot()
    expect(stage2('midas-m32')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/manifest/) })
    writeFileSync(paths.manifest, JSON.stringify({ assets: [{ id: 'midas-m32', kind: 'device' }] }))
    expect(stage2('midas-m32')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/glb/i) })
    expect(snapshot()).toEqual(snap)
  })
})

describe('stage 2, promoted outcome: documented ports only', () => {
  it('a real promotable microphone (neumann-tlm-103): the catalogue port is the documented one, phantom required by its traits, no power control; the spec matches', () => {
    stage1('neumann-tlm-103')
    fillSpec('neumann-tlm-103', [MIC_OUT], [])
    ship('neumann-tlm-103')
    const r = stage2('neumann-tlm-103')
    expect(r.outcome).toBe('promoted')
    const cat = Catalog.parse(JSON.parse(read(paths.catalog)))
    const d = cat.devices.find((x) => x.id === 'neumann-tlm-103')!
    expect(d.ports).toEqual([{ portId: 'out-xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level', flags: ['requiresPhantom'] }])
    expect(d.controls).toBeUndefined()
    expect(d.realWorld).toMatchObject({ brand: 'Neumann', model: 'TLM 103', category: 'microphone' })
    expect(d.realWorld.notes).toContain('documented in the asset spec')
    expect(checkCatalog(cat, { modelIds: new Set(cat.devices.map((x) => x.id)) }).filter((i) => i.level === 'error')).toEqual([])
    expect(checkSpecParity(readSpec('neumann-tlm-103'), cat)).toEqual([])
    expect(readSpec('neumann-tlm-103').realSizeMm).toEqual({ w: 60, h: 132, d: 60 }) // finding 9: the spec carries the size
    expect(rowOf('neumann-tlm-103')).toMatchObject({ promoted: true })
    expect(rowOf('neumann-tlm-103').staged).toBeUndefined()
  })

  it('a real promotable desk (midas-m32): routing is generated from the documented out-main outputs, the QL1 controls come with it (finding 8)', () => {
    stage1('midas-m32')
    fillSpec(
      'midas-m32',
      [port('in-mic-1', 'in', 'xlr3-f', 'mic-level'), port('in-mic-2', 'in', 'xlr3-f', 'mic-level'), port('out-main-l', 'out', 'xlr3-m', 'line-level-pro'), port('out-main-r', 'out', 'xlr3-m', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')],
      [POWER_CTRL, ...['mute-master', 'fader-master', 'balance-master'].map((id) => ({ controlId: id, kind: 'knob', face: 'top', axis: 'y', xMm: 100, yMm: 100, sizeMm: { w: 15, h: 15, d: 10 } }))],
    )
    ship('midas-m32')
    expect(stage2('midas-m32').outcome).toBe('promoted')
    const d = Catalog.parse(JSON.parse(read(paths.catalog))).devices.find((x) => x.id === 'midas-m32')!
    expect(d.routing).toEqual([
      { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
    ])
    expect(d.controls!.map((c) => c.id)).toEqual(['power', 'mute-master', 'fader-master', 'balance-master'])
  })

  it('an active monitor: routes in to the transducer, nominal acoustic with a source, power', () => {
    stage1('fx-monitor')
    fillSpec('fx-monitor', [port('in-analog', 'in', 'xlr3-f', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')], [POWER_CTRL])
    ship('fx-monitor')
    stage2('fx-monitor')
    const d = Catalog.parse(JSON.parse(read(paths.catalog))).devices.find((x) => x.id === 'fx-monitor')!
    expect(d.routing).toEqual([{ from: 'in-analog', to: ['transducer'] }])
    expect(d.acoustic!.coverage_h_deg.source.kind).toBe('nominal')
    expect(d.acoustic!.coverage_h_deg.source.retrieved).toBe('2026-11-12')
  })

  it('a Bêta row (mackie-profx12v3): the proposal leaves the file with the catalogue entry, the old long port ids become portAliases, the journal remembers the proposal', () => {
    const proposals = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string; dir: string; connector: string; signal: string }[] }[] }
    const proposal = proposals.devices.find((d) => d.id === 'mackie-profx12v3')!
    const old = proposal.ports.find((p) => p.dir === 'in' && p.signal === 'mic-level')!
    stage1('mackie-profx12v3')
    fillSpec('mackie-profx12v3', [port('in-mic-1', 'in', old.connector, 'mic-level'), port('out-main-l', 'out', 'xlr3-m', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')], [POWER_CTRL, ...['mute-master', 'fader-master', 'balance-master'].map((id) => ({ controlId: id, kind: 'knob', face: 'top', axis: 'y', xMm: 100, yMm: 100, sizeMm: { w: 15, h: 15, d: 10 } }))])
    ship('mackie-profx12v3')
    const r = stage2('mackie-profx12v3')
    expect(r.outcome).toBe('promoted')
    const after = JSON.parse(read(paths.proposals)) as { devices: { id: string }[] }
    expect(after.devices.map((d) => d.id)).not.toContain('mackie-profx12v3')
    expect(after.devices.length).toBe(proposals.devices.length - 1)
    const d = Catalog.parse(JSON.parse(read(paths.catalog))).devices.find((x) => x.id === 'mackie-profx12v3')!
    expect(d.portAliases?.[old.portId]).toBe('in-mic-1')
    const journal = JSON.parse(read(paths.journal)) as { entries: Record<string, { proposalBefore: { id: string } | null }> }
    expect(journal.entries['mackie-profx12v3']!.proposalBefore!.id).toBe('mackie-profx12v3')
  })

  it('without portsDocumented a promotable row is beta-modelled, never promoted (finding 1: no category-template ports in the verified catalogue)', () => {
    stage1('neumann-tlm-103')
    fillSpec('neumann-tlm-103', [MIC_OUT], [], false)
    ship('neumann-tlm-103')
    const catalogBefore = read(paths.catalog)
    const r = stage2('neumann-tlm-103')
    expect(r.outcome).toBe('beta-modelled')
    expect(r.reason).toMatch(/portsDocumented/)
    expect(read(paths.catalog)).toBe(catalogBefore)
    const props = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string }[]; sizeMm?: unknown }[] }
    const entry = props.devices.find((d) => d.id === 'neumann-tlm-103')!
    expect(entry.ports.map((p) => p.portId)).toEqual(['out-xlr'])
    expect(entry.sizeMm).toEqual({ w: 60, d: 60, h: 132 })
  })

  it('a spec whose port ids the template would rename is refused with the id to use (the mains inlet is power-in)', () => {
    stage1('fx-monitor')
    fillSpec('fx-monitor', [port('in-analog', 'in', 'xlr3-f', 'line-level-pro'), port('mains', 'in', 'iec-c14', 'mains-power')], [POWER_CTRL])
    ship('fx-monitor')
    expect(() => stage2('fx-monitor')).toThrow(/rename "mains" to "power-in"/)
  })

  it('a spec that lacks the controls the template writes is blocked, naming what is missing', () => {
    stage1('fx-monitor')
    fillSpec('fx-monitor', [port('in-analog', 'in', 'xlr3-f', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')], [])
    ship('fx-monitor')
    const snap = snapshot()
    expect(stage2('fx-monitor')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/control "power"/) })
    expect(snapshot()).toEqual(snap)
  })

  it('the 25 existing devices are untouched: the catalogue text before the insertion is byte-identical and the old devices parse deep-equal', () => {
    const before = read(paths.catalog)
    for (const id of ['neumann-tlm-103', 'fx-monitor']) {
      stage1(id)
      fillSpec(id, id === 'fx-monitor' ? [port('in-analog', 'in', 'xlr3-f', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')] : [MIC_OUT], id === 'fx-monitor' ? [POWER_CTRL] : [])
      ship(id)
      stage2(id)
    }
    const after = read(paths.catalog)
    const cut = before.indexOf('\n    }\n  ],\n\n  "rules"')
    expect(after.startsWith(before.slice(0, cut))).toBe(true)
    expect(after.endsWith(before.slice(cut + '\n    }'.length))).toBe(true)
    const b = JSON.parse(before) as { devices: unknown[] }
    const a = JSON.parse(after) as { devices: unknown[] }
    expect(a.devices.slice(0, b.devices.length)).toEqual(b.devices)
    expect(a.devices).toHaveLength(b.devices.length + 2)
  })

  it('is idempotent: a second --commit is a no-op that touches no file', () => {
    stage1('neumann-tlm-103')
    fillSpec('neumann-tlm-103', [MIC_OUT], [])
    ship('neumann-tlm-103')
    stage2('neumann-tlm-103')
    const snap = snapshot()
    expect(stage2('neumann-tlm-103')).toMatchObject({ outcome: 'promoted', changes: [] })
    expect(snapshot()).toEqual(snap)
  })

  it('dry-run of stage 2 changes no file', () => {
    stage1('neumann-tlm-103')
    fillSpec('neumann-tlm-103', [MIC_OUT], [])
    ship('neumann-tlm-103')
    const snap = snapshot()
    expect(stage2('neumann-tlm-103', { dryRun: true }).changes.length).toBeGreaterThan(0)
    expect(snapshot()).toEqual(snap)
  })
})

describe('stage 2, beta-modelled outcome (finding 7: an unsure size is never promoted)', () => {
  it('real row yamaha-tf5 (axis order assumed): with fully documented ports it is still beta-modelled, its proposal stays with the size and the model', () => {
    expect(rowOf('yamaha-tf5').dataQuality).toBe('estimate')
    stage1('yamaha-tf5')
    const proposals = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string; dir: string; connector: string; signal: string }[] }[] }
    const keep = proposals.devices.find((d) => d.id === 'yamaha-tf5')!.ports
    fillSpec('yamaha-tf5', keep.map((p) => port(p.portId, p.dir as 'in', p.connector, p.signal)), [])
    ship('yamaha-tf5')
    const catalogBefore = read(paths.catalog)
    const r = stage2('yamaha-tf5')
    expect(r.outcome).toBe('beta-modelled')
    expect(r.reason).toMatch(/estimate/)
    expect(read(paths.catalog)).toBe(catalogBefore)
    const after = (JSON.parse(read(paths.proposals)) as { devices: { id: string; sizeMm?: unknown; ports: unknown[] }[] }).devices.find((d) => d.id === 'yamaha-tf5')!
    expect(after.sizeMm).toEqual({ w: 866, d: 599, h: 225 })
    expect(after.ports).toHaveLength(keep.length)
    expect(rowOf('yamaha-tf5')).toMatchObject({ betaModelled: true })
  })

  it('a conflicting size (fixture) is beta-modelled too, and the spec size note says the sources disagree', () => {
    stage1('fx-conflict')
    expect(JSON.stringify(readSpec('fx-conflict').sources)).toMatch(/sources disagree/)
    fillSpec('fx-conflict', [{ ...MIC_OUT, flags: [] }], [])
    ship('fx-conflict')
    expect(stage2('fx-conflict').outcome).toBe('beta-modelled')
  })

  it('a Bêta row must keep its proposal ports exactly (saved projects keep their cables): a spec with other ports is blocked', () => {
    stage1('yamaha-tf5')
    fillSpec('yamaha-tf5', [port('in-1', 'in', 'xlr3-f', 'mic-level')], [])
    ship('yamaha-tf5')
    const snap = snapshot()
    expect(stage2('yamaha-tf5')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/proposal ports/) })
    expect(snapshot()).toEqual(snap)
  })

  it('a new row becomes a proposal built from the spec ports (patch-only: no controls, no mains source), complete size in the spec, catalogue untouched; no ports in the spec blocks', () => {
    stage1('fx-estimate-new')
    ship('fx-estimate-new')
    expect(stage2('fx-estimate-new')).toMatchObject({ outcome: 'blocked', reason: expect.stringMatching(/lists no ports/) })
    fillSpec('fx-estimate-new', [port('in-mic', 'in', 'xlr3-f', 'mic-level'), port('usb', 'bidir', 'usb-c', 'usb-audio')], [], false)
    const catalogBefore = read(paths.catalog)
    expect(stage2('fx-estimate-new').outcome).toBe('beta-modelled')
    expect(read(paths.catalog)).toBe(catalogBefore)
    const created = (JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string }[]; controls?: unknown; sizeMm?: unknown }[] }).devices.find((d) => d.id === 'fx-estimate-new')!
    expect(created.ports.map((p) => p.portId)).toEqual(['in-mic', 'usb'])
    expect(created.controls).toBeUndefined()
    expect(created.sizeMm).toEqual({ w: 150, h: 40 })
    const spec = readSpec('fx-estimate-new')
    expect(spec.realSizeMm.d).toBeGreaterThan(0)
    expect(JSON.stringify(spec.sources)).toBe('[]') // no source URL in this fixture row
  })

  it('never a 0 x 0 x 0 size reaches a spec (Review Focus 3): a row with no axis at all is blocked at stage 1', () => {
    expect(stage1('fx-missing').outcome).toBe('blocked')
    expect(readdirSync(paths.specDir)).toEqual([])
  })
})

describe('atomic writes (finding 6)', () => {
  it('a failure while the last file of stage 2 is replaced restores every file already replaced, and leaves no temporary file behind', () => {
    stage1('neumann-tlm-103')
    fillSpec('neumann-tlm-103', [MIC_OUT], [])
    ship('neumann-tlm-103')
    const snap = snapshot()
    expect(() =>
      stage2('neumann-tlm-103', {
        beforeRename: (p) => {
          if (p === paths.plan) throw new Error('disk full')
        },
      }),
    ).toThrow(/disk full/)
    expect(snapshot()).toEqual(snap)
    expect(readdirSync(dir).filter((f) => f.includes('.tmp-'))).toEqual([])
    expect(readdirSync(paths.specDir).filter((f) => f.includes('.tmp-'))).toEqual([])
    // and the retry works
    expect(stage2('neumann-tlm-103').outcome).toBe('promoted')
  })
  it('a failure during stage 1 leaves neither a spec nor a staged flag', () => {
    const snap = snapshot()
    expect(() =>
      promoteDevice('midas-m32', {
        paths,
        beforeRename: (p) => {
          if (p === paths.plan) throw new Error('disk full')
        },
      }),
    ).toThrow(/disk full/)
    expect(snapshot()).toEqual(snap)
    expect(rowOf('midas-m32').staged).toBeUndefined()
  })
})

describe('--revert undoes the latest stage completely', () => {
  it('stage 1: the untouched skeleton goes and the row is no longer staged (every file as before)', () => {
    const snap = snapshot()
    stage1('midas-m32')
    expect(revert('midas-m32').outcome).toBe('reverted')
    expect(snapshot()).toEqual(snap)
  })
  it('stage 1 with a hand-filled spec: the spec is kept (unless --discard-spec) and the row is no longer staged', () => {
    stage1('midas-m32')
    fillSpec('midas-m32', [port('out-main-l', 'out', 'xlr3-m', 'line-level-pro')], [])
    const r = revert('midas-m32')
    expect(r.changes.join(' ')).toMatch(/hand edits and is kept/)
    expect(existsSync(specPath('midas-m32'))).toBe(true)
    expect(rowOf('midas-m32').staged).toBeUndefined()
    stage1('midas-m32')
    revert('midas-m32', { discardSpec: true })
    expect(existsSync(specPath('midas-m32'))).toBe(false)
  })
  it('stage 2, promoted from a Bêta row: the catalogue is byte-identical to before the commit, the proposal is back at its place, the row is staged again', () => {
    stage1('mackie-profx12v3')
    const proposals = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string; connector: string }[] }[] }
    const old = proposals.devices.find((d) => d.id === 'mackie-profx12v3')!.ports[0]!
    fillSpec('mackie-profx12v3', [port('in-1', 'in', old.connector, 'mic-level'), port('power-in', 'in', 'iec-c14', 'mains-power')], DESK_CONTROLS)
    ship('mackie-profx12v3')
    const beforeCommit = snapshot()
    expect(stage2('mackie-profx12v3').outcome).toBe('promoted')
    expect(revert('mackie-profx12v3').outcome).toBe('reverted')
    const after = snapshot()
    expect(after.catalog).toBe(beforeCommit.catalog)
    expect(JSON.parse(after.proposals!)).toEqual(JSON.parse(beforeCommit.proposals!))
    expect((JSON.parse(after.proposals!) as { devices: { id: string }[] }).devices.map((d) => d.id)).toEqual((JSON.parse(beforeCommit.proposals!) as { devices: { id: string }[] }).devices.map((d) => d.id))
    expect(rowOf('mackie-profx12v3')).toMatchObject({ staged: true })
    expect(rowOf('mackie-profx12v3').promoted).toBeUndefined()
    // and the whole cycle can be run again
    expect(stage2('mackie-profx12v3').outcome).toBe('promoted')
  })
  it('stage 2, beta-modelled: a new row\'s proposal goes, a Bêta row\'s proposal comes back as it was', () => {
    stage1('fx-estimate-new')
    fillSpec('fx-estimate-new', [port('in-mic', 'in', 'xlr3-f', 'mic-level')], [], false)
    ship('fx-estimate-new')
    const beforeNew = snapshot()
    stage2('fx-estimate-new')
    revert('fx-estimate-new')
    expect(JSON.parse(snapshot().proposals!)).toEqual(JSON.parse(beforeNew.proposals!))

    stage1('yamaha-tf5')
    const keep = (JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string; dir: string; connector: string; signal: string }[] }[] }).devices.find((d) => d.id === 'yamaha-tf5')!.ports
    fillSpec('yamaha-tf5', keep.map((p) => port(p.portId, p.dir as 'in', p.connector, p.signal)), [])
    ship('yamaha-tf5')
    const beforeBeta = snapshot()
    stage2('yamaha-tf5')
    revert('yamaha-tf5')
    expect(JSON.parse(snapshot().proposals!)).toEqual(JSON.parse(beforeBeta.proposals!))
    expect(rowOf('yamaha-tf5')).toMatchObject({ staged: true })
  })
  it('nothing to revert is a no-op; --dry-run changes nothing', () => {
    expect(revert('midas-m32')).toMatchObject({ outcome: 'reverted', changes: [] })
    stage1('midas-m32')
    const snap = snapshot()
    expect(revert('midas-m32', { dryRun: true }).changes.length).toBeGreaterThan(0)
    expect(snapshot()).toEqual(snap)
  })
})

describe('the pipeline sees a staged device as the catalogue it will become', () => {
  it('between the stages, a promoted-to-be device has a catalogue view the spec matches (parity), and it replaces the Bêta proposal of the same id', () => {
    stage1('mackie-profx12v3')
    const props = JSON.parse(read(paths.proposals)) as { devices: { id: string; ports: { portId: string; connector: string }[] }[] }
    const old = props.devices.find((d) => d.id === 'mackie-profx12v3')!.ports[0]!
    fillSpec('mackie-profx12v3', [port('in-1', 'in', old.connector, 'mic-level'), port('power-in', 'in', 'iec-c14', 'mains-power')], DESK_CONTROLS)
    const base = Catalog.parse(JSON.parse(read(paths.catalog)))
    const withProposals = catalogWithProposals(base, props)
    expect(withProposals.devices.find((d) => d.id === 'mackie-profx12v3')!.ports.map((p) => p.portId)).not.toContain('in-1')
    const staged = stagedDevices(paths, '2026-11-12').devices
    expect(staged.map((d) => d.id)).toEqual(['mackie-profx12v3'])
    const view = catalogWithStaged(withProposals, staged, new Set(base.devices.map((d) => d.id)))
    expect(view.devices.filter((d) => d.id === 'mackie-profx12v3')).toHaveLength(1)
    expect(checkSpecParity(readSpec('mackie-profx12v3'), view)).toEqual([])
  })
  it('a Bêta row that would stay a proposal adds nothing (its proposal is what the pipeline checks); an unfinished spec adds nothing; the real catalogue is never replaced', () => {
    stage1('yamaha-tf5')
    stage1('midas-m32')
    expect(stagedDevices(paths).devices).toEqual([])
    const base = Catalog.parse(JSON.parse(read(paths.catalog)))
    const fake = { ...base.devices[0]! }
    expect(catalogWithStaged(base, [{ ...fake, label: 'Imposteur' }], new Set(base.devices.map((d) => d.id))).devices[0]!.label).toBe(base.devices[0]!.label)
  })
})

describe('catalogue text: appendDevice / removeDevice / formatDevice', () => {
  const cat = () => Catalog.parse(JSON.parse(read('content/catalog.json')))
  it('appends a device that round-trips through JSON.parse and keeps everything before it byte-identical; removeDevice is the exact inverse', () => {
    const text = read('content/catalog.json')
    const device = cat().devices.find((d) => d.id === 'qsc-k12-2')!
    const copy = { ...structuredClone(device), id: 'qsc-k12-2-copy' }
    const next = appendDevice(text, copy)
    const parsed = JSON.parse(next) as { devices: { id: string }[] }
    expect(parsed.devices.at(-1)).toEqual(copy)
    expect(JSON.parse(formatDevice(copy))).toEqual(copy)
    expect(formatDevice(copy)).toContain('"portId": "in-line-a"')
    expect(removeDevice(next, 'qsc-k12-2-copy')).toBe(text)
    const two = appendDevice(next, { ...structuredClone(device), id: 'qsc-k12-2-copy-b' })
    expect(removeDevice(two, 'qsc-k12-2-copy')).toBe(appendDevice(text, { ...structuredClone(device), id: 'qsc-k12-2-copy-b' }))
  })
  it('refuses a file whose devices array end it cannot find, and an id it cannot find', () => {
    expect(() => appendDevice('{ "devices": [] }', cat().devices[0]!)).toThrow(/end of the devices array/)
    expect(() => removeDevice(read('content/catalog.json'), 'no-such-device')).toThrow(/not found/)
  })
})

describe('the spec fields of the documented set', () => {
  const base = (): Record<string, unknown> => ({ id: 'x', kind: 'device', tier: 'standard', realSizeMm: { w: 1, h: 1, d: 1 }, ports: [], controls: [], sources: [] })
  it('portsDocumented needs portsSource and a connector, signal and direction on every port', () => {
    expect(AssetSpec.safeParse({ ...base(), portsDocumented: true }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...base(), portsDocumented: true, portsSource: 'https://example.com/m.pdf' }).success).toBe(true) // an empty documented set (a stand)
    expect(AssetSpec.safeParse({ ...base(), portsDocumented: true, portsSource: 'https://example.com/m.pdf', ports: [{ portId: 'a', face: 'io', xMm: 0, yMm: 0, confidence: 'guess' }] }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...base(), portsDocumented: true, portsSource: 'see the manual' }).success).toBe(false)
    expect(AssetSpec.safeParse({ ...base(), sources: [{ kind: 'dealer', url: 'https://x.example/', note: 'n' }, { kind: 'reference', url: 'https://x.example/', note: 'n' }] }).success).toBe(true)
  })
})
