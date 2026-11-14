/**
 * Wave 0b finding 10: `npm run sync:kb` must be a FIXED POINT on the committed proposals file. The guard test (proposeContentGuard) fed the committed file
 * back to mergeProposals, which proves nothing about the generation: the twelve connectors of Wave 0.3 had never been through it, so a sync would have added
 * ports and new proposals and rewritten the file. Here the generator runs on the REAL knowledge base, the real catalogue and the real plan, and its output
 * is compared with the committed file byte for byte.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { loadPlan } from '../../tools/equipmentPlan'
import { promoteDevice } from '../../tools/promoteDevice'
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
    // Wave 1 stage 2: a beta-modelled plan row of status « new » has no KB entry; its proposal is built from its asset spec (promoteDevice), so the generator
    // cannot rebuild it. Waves 2 to 5: dpa-4060 is such a row whose KB entry was skipped for want of the mini-XLR connector and is now generated from the KB
    // as well; the spec-built proposal in the file wins (mergeProposals keeps a beta-modelled one untouched), so both sides leave the spec-built ids out.
    // Everything else (every Bêta row and every other KB device) is rebuilt identically.
    const fromSpec = new Set(plan.filter((r) => r.status === 'new' && r.betaModelled).map((r) => r.id))
    expect(committed.devices.filter((d) => fromSpec.has(d.id as string)).length, 'the specs-built proposals are in the file').toBe(fromSpec.size)
    // Review fix 20: NO merge is applied on the generated side any more (it hid flag drift). The generated and the committed proposals are compared as they are; the
    // ONLY differences allowed are the ones promoteDevice writes on a beta-modelled proposal from its spec, each checked against that rule below:
    // a flag the KB does not have, only a non-capability one unless the spec documents the ports or the port names its page (flagsSource), and a signal retyped to
    // aes50 / usb-control. The committed side is also the exact fixed point of `promote --regen` (next test).
    const generated = new Map(fresh.file.devices.map((d) => [d.id as string, d]))
    type P = { portId: string; signal: string; flags?: string[] }
    const diffs: string[] = []
    for (const d of committed.devices.filter((x) => !fromSpec.has(x.id as string))) {
      const g = generated.get(d.id as string)
      if (!g) {
        diffs.push(`${d.id as string}: not generated`)
        continue
      }
      const spec = existsSync(`content/asset-specs/${d.id as string}.json`) ? (JSON.parse(readFileSync(`content/asset-specs/${d.id as string}.json`, 'utf8')) as { portsDocumented?: boolean; ports: { portId: string; flagsSource?: string }[] }) : undefined
      expect(undated({ ...d, ports: undefined }), `${d.id as string} (everything but the ports)`).toEqual(undated({ ...g, ports: undefined }))
      const gp = g.ports as P[]
      for (const p of d.ports as P[]) {
        const q = gp.find((x) => x.portId === p.portId)
        if (!q) {
          diffs.push(`${d.id as string}.${p.portId}: not generated`)
          continue
        }
        if (p.signal !== q.signal && !(p.signal === 'aes50' || p.signal === 'usb-control')) diffs.push(`${d.id as string}.${p.portId}: signal ${q.signal} -> ${p.signal}`)
        for (const f of p.flags ?? []) {
          if ((q.flags ?? []).includes(f)) continue
          const capability = f === 'providesPhantom' || f === 'requiresPhantom'
          const cited = spec?.portsDocumented === true || spec?.ports.find((x) => x.portId === p.portId)?.flagsSource !== undefined
          if (capability && !cited) diffs.push(`${d.id as string}.${p.portId}: the capability flag ${f} is not in the KB and not cited by its spec`)
        }
        for (const f of q.flags ?? []) if (!(p.flags ?? []).includes(f)) diffs.push(`${d.id as string}.${p.portId}: the KB flag ${f} is missing from the file`)
      }
      // a kept beta-modelled proposal does not take ports the KB gained later (saved cables keep their ids): every port it has is a generated one, the generated side may have more
      expect((d.ports as P[]).every((x) => gp.some((y) => y.portId === x.portId)), d.id + " ports are generated ports").toBe(true)
    }
    expect(diffs).toEqual([])
    expect(fresh.file.skipped).toEqual(committed.skipped)
  })

  it('review fix 20: every beta-modelled proposal is the exact fixed point of `promote --regen` (no flag drift hides behind a merge in the test)', () => {
    for (const r of plan.filter((x) => x.betaModelled)) {
      const res = promoteDevice(r.id, { regen: true, dryRun: true })
      expect(res.changes, `${r.id}: ${res.reason ?? ''}`).toEqual([])
    }
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
