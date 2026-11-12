/**
 * Wave 0b finding 10: `npm run sync:kb` must be a FIXED POINT on the committed proposals file. The guard test (proposeContentGuard) fed the committed file
 * back to mergeProposals, which proves nothing about the generation: the twelve connectors of Wave 0.3 had never been through it, so a sync would have added
 * ports and new proposals and rewritten the file. Here the generator runs on the REAL knowledge base, the real catalogue and the real plan, and its output
 * is compared with the committed file byte for byte.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'
import { buildProposalsFile, generateProposals, type GenerateInput, type KbDev, type ProposalsFile } from '../../tools/proposalGenerate'

const KB = join('..', 'knowledge-base', 'equipment')
const catalog = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[]; connectorTypes: { id: string }[]; signalTypes: { id: string }[] }
const committedText = readFileSync('content/proposals/catalog-proposals.json', 'utf8')
const committed = JSON.parse(committedText) as ProposalsFile
const plan = loadPlan()

const kb = readdirSync(KB)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, devices: (JSON.parse(readFileSync(join(KB, file), 'utf8')) as { devices: KbDev[] }).devices }))

const input = (today: string, connectors = catalog.connectorTypes): GenerateInput => ({
  kb,
  catalogDeviceIds: new Set(catalog.devices.map((d) => d.id)),
  connectorIds: new Set(connectors.map((c) => c.id)),
  signalIds: new Set(catalog.signalTypes.map((s) => s.id)),
  today,
})

/** The twelve connector types Wave 0.3 added (the ports and proposals they bring were missing from the committed file). */
const WAVE_0_3 = ['dc-barrel', 'midi-din5', 'xlr4', 'bnc-antenna-50ohm', 'mini-xlr-ta4', 'euroblock', 'speakon-nl8', 'binding-post', 'opticalcon', 'sc-fibre', 'lemo', 'hirose']

describe('sync:kb on the real inputs', () => {
  it('the committed proposals file is exactly what the generator writes: a sync changes nothing, byte for byte', () => {
    const built = buildProposalsFile(input(committed.generated), committed, plan)
    expect(built.text).toBe(committedText)
  })

  it('and it does so on any other day: the date of a note and the `generated` date do not make a sync rewrite the file', () => {
    for (const day of ['2027-01-01', '2030-12-31']) expect(buildProposalsFile(input(day), committed, plan).text, day).toBe(committedText)
  })

  it('without the committed file the generator rebuilds the same devices up to the date of their note (nothing in the file is hand-made today), so the file is reproducible from the KB', () => {
    const fresh = buildProposalsFile(input(committed.generated), undefined, plan)
    const undated = (v: unknown): unknown => JSON.parse(JSON.stringify(v).replace(/PROPOSITION \(\d{4}-\d{2}-\d{2}\)/g, 'PROPOSITION (date)'))
    expect(undated(fresh.file.devices)).toEqual(undated(committed.devices))
    expect(fresh.file.skipped).toEqual(committed.skipped)
  })

  it('the file carries the ports and the new proposals that use the twelve Wave 0.3 connectors (the generation with the old connector set has fewer)', () => {
    const connectorsOfWave = new Set(WAVE_0_3)
    const inFile = committed.devices.flatMap((d) => (d.ports as { connector: string }[]).filter((p) => connectorsOfWave.has(p.connector)))
    expect(inFile.length).toBeGreaterThan(10)
    const old = catalog.connectorTypes.filter((c) => !connectorsOfWave.has(c.id))
    const before = generateProposals(input('2026-10-22', old))
    const now = generateProposals(input('2026-10-22'))
    const count = (r: { proposals: Record<string, unknown>[] }): number => r.proposals.reduce((n, p) => n + (p.ports as unknown[]).length, 0)
    expect(now.proposals.length).toBeGreaterThan(before.proposals.length)
    expect(count(now)).toBeGreaterThan(count(before))
    // the three proposals that exist only thanks to the new connectors
    const ids = new Set(committed.devices.map((d) => d.id))
    for (const id of ['clear-com-rs-701', 'l-acoustics-k2', 'dpa-4088']) expect(ids.has(id), id).toBe(true)
  })

  it('the guard still holds on the real plan: no promoted id and no catalogue id in the file, every non-promoted Bêta plan row in it', () => {
    const ids = new Set(committed.devices.map((d) => d.id))
    for (const r of plan.filter((x) => x.promoted)) expect(ids.has(r.id), r.id).toBe(false)
    for (const d of catalog.devices) expect(ids.has(d.id), d.id).toBe(false)
    for (const r of plan.filter((x) => x.status === 'beta' && !x.promoted)) expect(ids.has(r.id), r.id).toBe(true)
  })

  it('every port of every proposal is on a connector and a signal the catalogue knows (a sync never writes an id the loader rejects)', () => {
    const connectors = new Set(catalog.connectorTypes.map((c) => c.id))
    const signals = new Set(catalog.signalTypes.map((s) => s.id))
    for (const d of committed.devices)
      for (const p of d.ports as { connector: string; signal: string }[]) {
        expect(connectors.has(p.connector), `${d.id}: ${p.connector}`).toBe(true)
        expect(signals.has(p.signal), `${d.id}: ${p.signal}`).toBe(true)
      }
  })
})
