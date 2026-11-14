/**
 * proposalGenerate: the pure core of `npm run sync:kb`'s catalogue proposals (tools/propose-content.ts), Wave 0b finding 10.
 *
 * propose-content.ts used to read the knowledge base, build the entries and write the file in one script, so nothing could test « the committed
 * proposals file is what a sync would write today ». Now the generation is a pure function of its inputs (the KB device records, the catalogue's
 * ids, connector and signal types, the plan, the committed file) and `buildProposalsFile` returns the exact text the script writes:
 *  - the entries come from the KB records with the catalogue's connector and signal ids (a connector type added to the catalogue later, such as the
 *    twelve of Wave 0.3, brings its ports and new proposals the next time the generator runs);
 *  - mergeProposals applies the promotion guard (no resurrection, beta-modelled entries kept, plan sizes);
 *  - an entry that differs from the committed one only by the date in its notes keeps the committed one, and the file keeps its `generated` date
 *    when nothing else changed, so running the sync on another day changes nothing (a fixed point).
 */
import { Device } from './schemas'
import type { PlanRow } from './equipmentPlan'
import { mergeProposals, type Proposal } from './proposalMerge'

export const PROPOSALS_STATUS = "proposal — needs Oscar's review; shown in the TekPractice Bêta tab badged « non vérifié » (approximate behaviour), never as verified gear; catalog.json is the source of truth and is NOT modified"

export const CATEGORY: Record<string, string> = {
  microphones: 'microphone', 'wireless-systems': 'wireless', consoles: 'console', 'stageboxes-networking': 'stagebox',
  'interfaces-converters-clocks': 'audio-interface', 'processors-outboard': 'outboard', 'di-splitters': 'di-box',
  loudspeakers: 'speaker', 'studio-monitors': 'studio-monitor', 'amplifiers-processors': 'amplifier',
  'headphones-iem': 'headphones', 'recorders-playback': 'recorder', 'broadcast-radio': 'broadcast',
  'cables-connectors': 'cable', patchbays: 'patchbay', 'measurement-tools': 'measurement',
  'accessories-mounting': 'accessory', software: 'computer', 'power-distribution': 'power',
  'show-control-interfaces': 'interface',
}
export const SUBTYPE_CATEGORY: Record<string, string> = {
  'mic-preamp': 'mic-preamp', 'active-powered': 'powered-speaker', 'master-clock': 'master-clock',
  'monitor-controller': 'monitor-controller', 'ip-codec': 'codec',
}

export interface KbConn { connector?: string; role?: string; dir?: string; signal?: string; count?: number }
export interface KbDev {
  id: string; brand: string; model: string; category: string; sub_type: string; typical_uses?: string[]
  why_it_is_a_classic?: string; key_specs?: Record<string, unknown>; connectors?: (KbConn | string)[]
  tekpractice?: { in_catalog?: boolean; sim_value?: string; sim_value_reason?: string }
}
export interface KbFile {
  /** The file name under knowledge-base/equipment (the note of an entry names it). */
  file: string
  devices: KbDev[]
}

export interface GenerateInput {
  kb: readonly KbFile[]
  /** Ids of the catalogue's devices (a KB record that is one of them is not proposed). */
  catalogDeviceIds: ReadonlySet<string>
  connectorIds: ReadonlySet<string>
  signalIds: ReadonlySet<string>
  today: string
}

export interface Skipped {
  id: string
  reason: string
}

const slug = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The entries the knowledge base produces (validated with the catalogue's Device schema), and the records it could not turn into one. */
export function generateProposals(input: GenerateInput): { proposals: Proposal[]; skipped: Skipped[] } {
  const { kb, catalogDeviceIds, connectorIds, signalIds, today } = input
  const proposals: Proposal[] = []
  const skipped: Skipped[] = []
  for (const { file, devices } of kb) {
    for (const d of devices) {
      if (catalogDeviceIds.has(d.id) || d.tekpractice?.in_catalog) continue
      if (d.tekpractice?.sim_value !== 'high') continue
      const phantom = String(d.key_specs?.phantom_power ?? '')
      const needsPhantom = /48/.test(phantom) && !/not|non|no /i.test(phantom)
      const ports: unknown[] = []
      const used = new Set<string>()
      for (const raw of d.connectors ?? []) {
        if (typeof raw === 'string') continue
        const { connector, signal } = raw
        const dir = raw.dir === 'in' || raw.dir === 'out' || raw.dir === 'bidir' ? raw.dir : null
        if (!connector || !signal || !dir || !connectorIds.has(connector) || !signalIds.has(signal)) continue
        const n = Math.min(raw.count ?? 1, 2) // catalog convention: model 2 of N identical ports
        for (let i = 1; i <= n; i++) {
          let portId = slug(`${dir}-${raw.role ?? signal}${n > 1 ? `-${i}` : ''}`) || `${dir}-${i}`
          while (used.has(portId)) portId += '-b'
          used.add(portId)
          const flags = dir === 'out' && signal === 'mic-level' && needsPhantom ? ['requiresPhantom'] : undefined
          ports.push({ portId, dir, connector, signal, ...(flags ? { flags } : {}) })
        }
      }
      if (!ports.length) {
        skipped.push({ id: d.id, reason: 'no KB connector maps to existing catalog connector/signal ids' })
        continue
      }
      const entry = {
        id: d.id,
        label: `${d.brand} ${d.model}`,
        levels: [],
        realWorld: {
          brand: d.brand,
          model: d.model,
          category: SUBTYPE_CATEGORY[d.sub_type] ?? CATEGORY[d.category] ?? d.category,
          typicalUse: d.typical_uses?.[0] ?? d.why_it_is_a_classic ?? d.model,
          notes: `PROPOSITION (${today}) générée depuis knowledge-base/equipment/${file} — ports issus des connecteurs sourcés ; flags (phantom, horloge, monitor, Dante) à vérifier par Oscar. ${d.tekpractice?.sim_value_reason ?? ''}`.trim(),
        },
        ports,
      }
      const ok = Device.safeParse(entry)
      if (ok.success) proposals.push(ok.data as unknown as Proposal)
      else skipped.push({ id: d.id, reason: `Device schema: ${ok.error.issues[0]?.path.join('.')} ${ok.error.issues[0]?.message}` })
    }
  }
  return { proposals, skipped }
}

/** The proposal with the date of its note blanked, to compare two generations made on different days. */
const undated = (p: Proposal): string => JSON.stringify(p).replace(/PROPOSITION \(\d{4}-\d{2}-\d{2}\)/, 'PROPOSITION (date)')

export interface ProposalsFile {
  generated: string
  status: string
  devices: Proposal[]
  skipped: Skipped[]
}

/**
 * The proposals file a sync writes: the generation, through the promotion guard, with the committed entries kept where only their date differs, and
 * the committed `generated` date kept when nothing else changed. `committed` is the parsed committed file (undefined on a first run).
 */
export function buildProposalsFile(
  input: GenerateInput,
  committed: Partial<ProposalsFile> | undefined,
  plan: readonly PlanRow[],
): { file: ProposalsFile; text: string; dropped: { id: string; reason: string }[] } {
  const { proposals, skipped } = generateProposals(input)
  const existing = committed?.devices ?? []
  const merged = mergeProposals(proposals, existing, plan, input.catalogDeviceIds)
  const byId = new Map(existing.map((e) => [e.id, e]))
  const devices = merged.devices.map((d) => {
    const old = byId.get(d.id)
    return old && undated(old) === undated(d) ? old : d
  })
  const unchanged = JSON.stringify(devices) === JSON.stringify(existing) && JSON.stringify(skipped) === JSON.stringify(committed?.skipped ?? [])
  const file: ProposalsFile = { generated: unchanged && committed?.generated ? committed.generated : input.today, status: PROPOSALS_STATUS, devices, skipped }
  return { file, text: JSON.stringify(file, null, 1) + '\n', dropped: merged.dropped }
}
