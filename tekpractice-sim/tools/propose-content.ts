/**
 * Proposals for Oscar (master prompt B3) — NEVER writes catalog.json or a live level.
 *  1. content/proposals/catalog-proposals.json: catalog-ready device entries built
 *     from sourced KB equipment records (validated with the catalog's Device schema).
 *     The result goes through mergeProposals (tools/proposalMerge.ts, Wave 0 Task 0.2): an id that was promoted
 *     (catalog.json, or a plan row flagged `promoted`) is never brought back, a beta-modelled entry is kept as it is,
 *     and each proposal carries the plan's size for its placeholder box.
 *  2. content/levels/drafts/<scenario>.json: level drafts from TEK Brain scenarios;
 *     each scenario edge is resolved to a real port pair with the engine's own
 *     dry-run (ConnectionGraph.canConnect), then validated with loadLevel.
 *
 *   npx tsx tools/propose-content.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadPlan } from './equipmentPlan'
import { buildProposalsFile, type KbDev, type KbFile, type ProposalsFile } from './proposalGenerate'
import { loadCatalog, loadLevel } from '../src/engine/CatalogLoader'
import { ConnectionGraph } from '../src/engine/ConnectionGraph'

const ROOT = resolve(__dirname, '..')
const KB = resolve(ROOT, '..', 'knowledge-base')
const today = new Date().toISOString().slice(0, 10)
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const catalogRaw = JSON.parse(readFileSync(join(ROOT, 'content', 'catalog.json'), 'utf8'))
const registry = loadCatalog(catalogRaw)
const connectorIds = new Set<string>((catalogRaw.connectorTypes as { id: string }[]).map((c) => c.id))
const signalIds = new Set<string>((catalogRaw.signalTypes as { id: string }[]).map((s) => s.id))

// ── 1. catalog proposals ──────────────────────────────────────────────────────
// The generation itself is pure (tools/proposalGenerate.ts): a test holds that the committed file is a fixed point of it.
const PROPOSALS_PATH = join(ROOT, 'content', 'proposals', 'catalog-proposals.json')
const kbFiles: KbFile[] = readdirSync(join(KB, 'equipment'))
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, devices: (JSON.parse(readFileSync(join(KB, 'equipment', file), 'utf8')) as { devices: KbDev[] }).devices }))
mkdirSync(join(ROOT, 'content', 'proposals'), { recursive: true })
let committedProposals: Partial<ProposalsFile> | undefined
try {
  committedProposals = JSON.parse(readFileSync(PROPOSALS_PATH, 'utf8')) as Partial<ProposalsFile>
} catch {
  /* first run: nothing to keep */
}
const built = buildProposalsFile(
  {
    kb: kbFiles,
    catalogDeviceIds: new Set((catalogRaw.devices as { id: string }[]).map((d) => d.id)),
    connectorIds,
    signalIds,
    today,
  },
  committedProposals,
  loadPlan(),
)
for (const d of built.dropped) console.log(`  guard: ${d.id} not proposed (${d.reason})`)
writeFileSync(PROPOSALS_PATH, built.text)
const merged = built.file
const skipped = merged.skipped

// ── 2. level drafts from TEK Brain scenarios ──────────────────────────────────
interface Scenario {
  id: string; name_fr: string; domain: string; brief: string; room_id: string | null; difficulty: number
  signal_flow: { nodes: { id: string; equipment_id: string | null; label: string }[]; edges: { from: string; to: string; signal?: string }[] }
  rule_ids: string[]
}
const kbRules = new Map<string, string | null>()
for (const f of readdirSync(join(KB, 'tek-brain', 'rules')))
  for (const r of (JSON.parse(readFileSync(join(KB, 'tek-brain', 'rules', f), 'utf8')) as { items: { id: string; catalog_rule: string | null }[] }).items)
    kbRules.set(r.id, r.catalog_rule)
const DOMAIN: Record<string, 'live' | 'radio' | 'duplex' | 'post'> = {
  'broadcast-radio': 'radio', 'post-immersive': 'post', 'studio-recording': 'post', 'orchestra-classical': 'post',
}
const draftsDir = join(ROOT, 'content', 'levels', 'drafts')
mkdirSync(draftsDir, { recursive: true })
const index: { id: string; title: string; connections: number; unmapped: number }[] = []
for (const f of readdirSync(join(KB, 'tek-brain', 'scenarios'))) {
  for (const s of (JSON.parse(readFileSync(join(KB, 'tek-brain', 'scenarios', f), 'utf8')) as { items: Scenario[] }).items) {
    const devices = s.signal_flow.nodes
      .filter((n) => n.equipment_id && registry.deviceById.has(n.equipment_id))
      .map((n) => ({ instanceId: slug(n.id), deviceId: n.equipment_id! }))
    const unmapped = s.signal_flow.nodes.filter((n) => !n.equipment_id || !registry.deviceById.has(n.equipment_id)).map((n) => n.label)
    if (devices.length < 2) continue
    const graph = new ConnectionGraph(registry, devices)
    const requiredChain: { from: { instance: string; port: string }; to: { instance: string; port: string } }[] = []
    const unresolved: string[] = []
    for (const e of s.signal_flow.edges) {
      const a = devices.find((d) => d.instanceId === slug(e.from))
      const b = devices.find((d) => d.instanceId === slug(e.to))
      if (!a || !b) continue
      const outs = registry.deviceById.get(a.deviceId)!.ports.filter((p) => p.dir !== 'in')
      const ins = registry.deviceById.get(b.deviceId)!.ports.filter((p) => p.dir !== 'out')
      const pairs = outs.flatMap((o) => ins.map((i) => ({ o, i }))).sort(
        (x, y) => Number(y.o.signal === e.signal) - Number(x.o.signal === e.signal),
      )
      const hit = pairs.find(({ o, i }) => graph.canConnect({ instance: a.instanceId, port: o.portId }, { instance: b.instanceId, port: i.portId }).ok)
      if (!hit) {
        unresolved.push(`${e.from} → ${e.to} (${e.signal ?? '?'})`)
        continue
      }
      const conn = { from: { instance: a.instanceId, port: hit.o.portId }, to: { instance: b.instanceId, port: hit.i.portId } }
      graph.connect(conn.from, conn.to)
      requiredChain.push(conn)
    }
    if (!requiredChain.length) continue
    const logicChecks = [...new Set(s.rule_ids.map((r) => kbRules.get(r)).filter((r): r is string => !!r && /^R[4-8]$/.test(r)))]
    const draft = {
      id: `draft-${s.id}`,
      version: 1,
      domain: DOMAIN[s.domain] ?? 'live',
      title: `[BROUILLON] ${s.name_fr}`,
      brief: s.brief,
      devices,
      requiredChain,
      logicChecks,
      successMessage: 'Chaîne câblée — à relire par Oscar avant publication.',
      draft: {
        status: "draft — needs Oscar's review",
        generated: today,
        from_scenario: `knowledge-base/tek-brain/scenarios/${f}#${s.id}`,
        room_id: s.room_id,
        difficulty: s.difficulty,
        unmapped_nodes: unmapped,
        unresolved_edges: unresolved,
      },
    }
    loadLevel(draft) // zod fail-fast: a draft that does not parse is a tool bug
    writeFileSync(join(draftsDir, `${s.id}.json`), JSON.stringify(draft, null, 1) + '\n')
    index.push({ id: s.id, title: s.name_fr, connections: requiredChain.length, unmapped: unmapped.length })
  }
}
writeFileSync(join(draftsDir, 'index.json'), JSON.stringify({ generated: today, drafts: index }, null, 1) + '\n')
console.log(`catalog proposals: ${merged.devices.length} devices (${skipped.length} skipped) · level drafts: ${index.length}`)
