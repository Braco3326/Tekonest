/**
 * catalogChecks: pure catalog checks (no fs, no process.exit), shared by
 * tools/validate-catalog.ts and the unit tests. The caller supplies what lives
 * on disk (the ids that have a public/assets/<id>.glb) so this stays pure.
 *
 * Checks:
 *  1. a device without a .glb is a WARNING: the placeholder box ships (CLAUDE.md)
 *  2. a port id used twice inside one device is an ERROR
 *  3. optional `routing` (council C8) is validated when present: ports exist,
 *     directions are right, `enabledBy` is a control of the device
 *  4. optional `acoustic` (council C12) is validated when present: every
 *     value carries a source, `nominal` only for 90 / 60
 *  5. mains (C7, Task 32): a device with a `power-in` port carries the toggle
 *     `power` (label « Alimentation », default on); `isMainsSource` sits only on an
 *     OUT port that carries `mains-power`, and every verified `mains-power` OUT port
 *     has it (Bêta proposals are not checked here: they are not in the catalog)
 *
 * `routing` and `acoustic` are not in the zod Device yet, so they are read
 * defensively as `unknown` from the raw device object.
 */
import type { CatalogT } from './schemas'

export interface CheckIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

const SOURCE_KINDS = ['datasheet', 'kb', 'nominal'] as const
const NOMINAL_VALUES = [90, 60]
const ACOUSTIC_VALUES = ['coverage_h_deg', 'coverage_v_deg', 'sensitivity_db', 'max_spl_db'] as const

type Port = CatalogT['devices'][number]['ports'][number]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function checkCatalog(catalog: CatalogT, opts: { modelIds: ReadonlySet<string> }): CheckIssue[] {
  const issues: CheckIssue[] = []
  const error = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warning = (path: string, message: string) => issues.push({ level: 'warning', path, message })

  for (const d of catalog.devices) {
    const at = `devices["${d.id}"]`
    if (!opts.modelIds.has(d.id))
      warning(at, `no public/assets/${d.id}.glb: the placeholder box ships`)

    const seen = new Set<string>()
    for (const p of d.ports) {
      if (seen.has(p.portId)) error(`${at}.ports["${p.portId}"]`, `duplicate port id "${p.portId}" in ${d.id}`)
      seen.add(p.portId)
    }

    checkMains(at, d, error)

    const loose = d as Record<string, unknown>
    if (loose.routing !== undefined) checkRouting(at, d, loose.routing, error)
    if (loose.acoustic !== undefined) checkAcoustic(at, loose.acoustic, error)
  }
  return issues
}

/** The label of the `power` toggle every device with a `power-in` carries (Task 32; French UI data, like the other labels). */
const POWER_LABEL = 'Alimentation'

function checkMains(at: string, device: CatalogT['devices'][number], error: (path: string, message: string) => void): void {
  if (device.ports.some((p) => p.portId === 'power-in')) {
    const power = (device.controls ?? []).find((c) => c.id === 'power')
    if (!power) error(`${at}.controls`, `${device.id} has a power-in port: it needs a toggle control "power" (label "${POWER_LABEL}", default on)`)
    else if (power.type !== 'toggle' || power.label !== POWER_LABEL || power.default !== true)
      error(`${at}.controls["power"]`, `"power" must be a toggle labelled "${POWER_LABEL}" that is on by default`)
  }
  for (const p of device.ports) {
    const flagged = (p.flags ?? []).includes('isMainsSource')
    const mainsOut = p.dir === 'out' && p.signal === 'mains-power'
    if (flagged && !mainsOut) error(`${at}.ports["${p.portId}"]`, 'isMainsSource belongs only to an output port that carries mains-power')
    else if (mainsOut && !flagged) error(`${at}.ports["${p.portId}"]`, 'a verified mains-power output must be flagged isMainsSource')
  }
}

function checkRouting(
  at: string,
  device: CatalogT['devices'][number],
  routing: unknown,
  error: (path: string, message: string) => void,
): void {
  if (!Array.isArray(routing)) return error(`${at}.routing`, 'routing must be an array of routes')
  const port = (id: unknown): Port | undefined => device.ports.find((p) => p.portId === id)
  const controlIds = new Set((device.controls ?? []).map((c) => c.id))

  routing.forEach((route: unknown, i) => {
    const r = `${at}.routing[${i}]`
    if (!isRecord(route)) return error(r, 'a route must be an object')
    const hasFrom = typeof route.from === 'string'
    const hasSource = typeof route.source === 'string'
    if (hasFrom === hasSource) return error(r, 'a route needs exactly one of "from" (a port) or "source" (an internal source)')

    if (hasFrom) {
      const from = port(route.from)
      if (!from) error(`${r}.from`, `unknown port "${String(route.from)}"`)
      else if (from.dir === 'out') error(`${r}.from`, `"${from.portId}" is an output: a route starts at an input or bidir port`)
    }

    if (!Array.isArray(route.to) || route.to.length === 0) {
      error(`${r}.to`, 'a route needs a non-empty "to" list of output ports')
    } else {
      for (const t of route.to) {
        const to = port(t)
        if (!to) error(`${r}.to`, `unknown port "${String(t)}"`)
        else if (to.dir === 'in') error(`${r}.to`, `"${to.portId}" is an input: a route ends at an output or bidir port`)
      }
    }

    if (route.enabledBy !== undefined && (typeof route.enabledBy !== 'string' || !controlIds.has(route.enabledBy)))
      error(`${r}.enabledBy`, `"${String(route.enabledBy)}" is not a control of ${device.id}`)
  })
}

function checkAcoustic(at: string, acoustic: unknown, error: (path: string, message: string) => void): void {
  const a = `${at}.acoustic`
  if (!isRecord(acoustic)) return error(a, 'acoustic must be an object')
  if (acoustic.transducer !== undefined && typeof acoustic.transducer !== 'boolean')
    error(`${a}.transducer`, 'transducer must be a boolean')

  for (const key of ACOUSTIC_VALUES) {
    const v = acoustic[key]
    if (v === undefined) continue
    const p = `${a}.${key}`
    if (!isRecord(v)) {
      error(p, 'must be { value, source }')
      continue
    }
    if (typeof v.value !== 'number' || !Number.isFinite(v.value)) error(`${p}.value`, 'value must be a finite number')
    const s = v.source
    if (!isRecord(s)) {
      error(`${p}.source`, 'every acoustic value needs a source { kind, ref, retrieved }')
      continue
    }
    if (!SOURCE_KINDS.includes(s.kind as (typeof SOURCE_KINDS)[number]))
      error(`${p}.source.kind`, `kind must be one of ${SOURCE_KINDS.join(' | ')}`)
    else if (s.kind === 'nominal' && !NOMINAL_VALUES.includes(v.value as number))
      error(`${p}.source.kind`, `kind "nominal" is allowed only for ${NOMINAL_VALUES.join(' or ')}`)
    if (typeof s.ref !== 'string' || s.ref === '') error(`${p}.source.ref`, 'ref must be a non-empty string')
    if (typeof s.retrieved !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.retrieved))
      error(`${p}.source.retrieved`, 'retrieved must be a YYYY-MM-DD date')
  }
}
