/**
 * Proposals for Oscar (master prompt B3) — NEVER writes catalog.json or a live level.
 *  1. content/proposals/catalog-proposals.json: catalog-ready device entries built
 *     from sourced KB equipment records (validated with the catalog's Device schema).
 *  2. content/levels/drafts/<scenario>.json: level drafts from TEK Brain scenarios;
 *     each scenario edge is resolved to a real port pair with the engine's own
 *     dry-run (ConnectionGraph.canConnect), then validated with loadLevel.
 *
 *   npx tsx tools/propose-content.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Device } from './schemas'
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
const CATEGORY: Record<string, string> = {
  microphones: 'microphone', 'wireless-systems': 'wireless', consoles: 'console', 'stageboxes-networking': 'stagebox',
  'interfaces-converters-clocks': 'audio-interface', 'processors-outboard': 'outboard', 'di-splitters': 'di-box',
  loudspeakers: 'speaker', 'studio-monitors': 'studio-monitor', 'amplifiers-processors': 'amplifier',
  'headphones-iem': 'headphones', 'recorders-playback': 'recorder', 'broadcast-radio': 'broadcast',
  'cables-connectors': 'cable', patchbays: 'patchbay', 'measurement-tools': 'measurement',
  'accessories-mounting': 'accessory', software: 'computer', 'power-distribution': 'power',
  'show-control-interfaces': 'interface',
}
const SUBTYPE_CATEGORY: Record<string, string> = {
  'mic-preamp': 'mic-preamp', 'active-powered': 'powered-speaker', 'master-clock': 'master-clock',
  'monitor-controller': 'monitor-controller', 'ip-codec': 'codec',
}

interface KbConn { connector?: string; role?: string; dir?: string; signal?: string; count?: number }
interface KbDev {
  id: string; brand: string; model: string; category: string; sub_type: string; typical_uses?: string[]
  why_it_is_a_classic?: string; key_specs?: Record<string, unknown>; connectors?: (KbConn | string)[]
  tekpractice?: { in_catalog?: boolean; sim_value?: string; sim_value_reason?: string }
}

const proposals: unknown[] = []
const skipped: { id: string; reason: string }[] = []
for (const file of readdirSync(join(KB, 'equipment')).filter((f) => f.endsWith('.json'))) {
  for (const d of (JSON.parse(readFileSync(join(KB, 'equipment', file), 'utf8')) as { devices: KbDev[] }).devices) {
    if (registry.deviceById.has(d.id) || d.tekpractice?.in_catalog) continue
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
    if (ok.success) proposals.push(ok.data)
    else skipped.push({ id: d.id, reason: `Device schema: ${ok.error.issues[0]?.path.join('.')} ${ok.error.issues[0]?.message}` })
  }
}
mkdirSync(join(ROOT, 'content', 'proposals'), { recursive: true })
writeFileSync(
  join(ROOT, 'content', 'proposals', 'catalog-proposals.json'),
  JSON.stringify(
    { generated: today, status: "proposal — needs Oscar's review; catalog.json is the source of truth and is NOT modified", devices: proposals, skipped },
    null,
    1,
  ) + '\n',
)

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
console.log(`catalog proposals: ${proposals.length} devices (${skipped.length} skipped) · level drafts: ${index.length}`)
