/**
 * catalogChecks: pure catalog checks (no fs, no process.exit), shared by
 * tools/validate-catalog.ts and the unit tests. The caller supplies what lives
 * on disk (the ids that have a public/assets/<id>.glb) so this stays pure.
 *
 * Checks:
 *  1. a device without a .glb is a WARNING: the placeholder box ships (CLAUDE.md)
 *  2. a port id used twice inside one device is an ERROR
 *  3. optional `routing` (council C8, P7; Task 33) is validated when present: `from` is an input / bidir
 *     port, or `control:<id>` of a control of the device; every `to` is an output / bidir port or the
 *     pseudo-target `transducer`; `channels` (L/R) runs parallel to `to`; `when.control` is a control of
 *     the device and `when.equals` fits its type; no unknown key (the zod Route would strip it silently)
 *  4. optional `acoustic` (council C12; Task 35) is validated when present: the shape is the zod `Acoustic` (a source
 *     on every value), `nominal` only as the coverage PAIR 90 x 60 with « valeur nominale »; a speaker (a device with a
 *     route to `transducer`) without `acoustic` is a WARNING
 *  5. mains (C7, Task 32): a device with a `power-in` port carries the toggle
 *     `power` (label « Alimentation », default on); `isMainsSource` sits only on an
 *     OUT port that carries `mains-power`, and every verified `mains-power` OUT port
 *     has it (Bêta proposals are not checked here: they are not in the catalog)
 *
 * The catalog may be passed typed (validate-catalog: it is parsed by zod first, and `Route` / `Acoustic` are strict, so a stray key
 * already fails there) or raw (the tests build deliberately malformed values). `routing` and `acoustic` are therefore read defensively
 * as `unknown`: a malformed value is reported with a JSON path instead of being trusted.
 */
import { Acoustic, ROUTE_KEYS as ROUTE_KEY_LIST } from './schemas'
import type { CatalogT } from './schemas'

export interface CheckIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

/** The only nominal coverage (C12): 90 x 60, said as « valeur nominale ». */
const NOMINAL_H_DEG = 90
const NOMINAL_V_DEG = 60
const NOMINAL_WORDING = 'valeur nominale'
const ACOUSTIC_VALUES = ['coverage_h_deg', 'coverage_v_deg', 'sensitivity_db', 'max_spl_db'] as const

type Port = CatalogT['devices'][number]['ports'][number]

/** A speaker is a device with a route to the pseudo-target `transducer` (Task 33 data); read defensively, a malformed routing is checkRouting's to report. */
const isSpeaker = (routing: unknown): boolean =>
  Array.isArray(routing) && routing.some((r) => isRecord(r) && Array.isArray(r.to) && r.to.includes(TRANSDUCER))

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
    else if (isSpeaker(loose.routing)) warning(`${at}.acoustic`, `${d.id} is a loudspeaker (a route feeds its transducer) but has no sourced acoustic data (coverage): nothing to draw or compute from`)
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

const ROUTE_KEYS = new Set(ROUTE_KEY_LIST)
const CONTROL_SOURCE = 'control:'
/** The pseudo-target of a loudspeaker route (P7): the drivers, not a port. */
const TRANSDUCER = 'transducer'

function checkRouting(
  at: string,
  device: CatalogT['devices'][number],
  routing: unknown,
  error: (path: string, message: string) => void,
): void {
  if (!Array.isArray(routing)) return error(`${at}.routing`, 'routing must be an array of routes')
  const port = (id: unknown): Port | undefined => device.ports.find((p) => p.portId === id)
  const control = (id: unknown) => (device.controls ?? []).find((c) => c.id === id)

  routing.forEach((route: unknown, i) => {
    const r = `${at}.routing[${i}]`
    if (!isRecord(route)) return error(r, 'a route must be an object')
    // The zod Route strips unknown keys, so a typo (or the old `source` / `enabledBy` shape) would vanish silently.
    for (const key of Object.keys(route))
      if (!ROUTE_KEYS.has(key)) error(r, `unknown key "${key}" (a route has ${[...ROUTE_KEYS].join(', ')})`)

    if (typeof route.from !== 'string' || route.from === '') {
      error(`${r}.from`, 'a route needs "from": an input port id, or "control:<controlId>"')
    } else if (route.from.startsWith(CONTROL_SOURCE)) {
      const id = route.from.slice(CONTROL_SOURCE.length)
      if (!control(id)) error(`${r}.from`, `"${id}" is not a control of ${device.id}`)
    } else {
      const from = port(route.from)
      if (!from) error(`${r}.from`, `unknown port "${route.from}"`)
      else if (from.dir === 'out') error(`${r}.from`, `"${from.portId}" is an output: a route starts at an input or bidir port`)
    }

    const targets = Array.isArray(route.to) ? route.to : []
    if (targets.length === 0) {
      error(`${r}.to`, 'a route needs a non-empty "to" list of output ports')
    } else {
      for (const t of targets) {
        if (t === TRANSDUCER) continue
        const to = port(t)
        if (!to) error(`${r}.to`, `unknown port "${String(t)}"`)
        else if (to.dir === 'in') error(`${r}.to`, `"${to.portId}" is an input: a route ends at an output or bidir port`)
      }
    }

    if (route.channels !== undefined) {
      if (!Array.isArray(route.channels) || route.channels.some((c) => c !== 'L' && c !== 'R'))
        error(`${r}.channels`, 'channels must be a list of "L" / "R"')
      else if (targets.length > 0 && route.channels.length !== targets.length)
        error(`${r}.channels`, `${route.channels.length} channel(s) for ${targets.length} target(s): channels runs parallel to "to"`)
    }

    if (route.passive !== undefined && typeof route.passive !== 'boolean') error(`${r}.passive`, 'passive must be a boolean')

    // `when` is read by signalPath.ts on SOURCE routes only (from "control:<id>"); on a pass-through route it would be silently ignored, and a passive route never reads one.
    if (route.when !== undefined && !(typeof route.from === 'string' && route.from.startsWith(CONTROL_SOURCE)))
      error(`${r}.when`, 'when is honoured on a source route only (from "control:<id>"): signalPath never checks it on a route from a port, so it would be silently ignored')
    if (route.passive === true && route.when !== undefined) error(`${r}.passive`, 'passive and when together make no sense: a passive pass-through never reads a condition')

    if (route.when !== undefined) {
      const w = route.when
      if (!isRecord(w)) return error(`${r}.when`, 'when must be { control, equals }')
      const ctl = control(w.control)
      if (!ctl) return error(`${r}.when.control`, `"${String(w.control)}" is not a control of ${device.id}`)
      if (ctl.type === 'toggle' && typeof w.equals !== 'boolean')
        error(`${r}.when.equals`, `"${ctl.id}" is a toggle: equals must be true or false`)
      else if (ctl.type === 'enum' && (typeof w.equals !== 'string' || !ctl.options.includes(w.equals)))
        error(`${r}.when.equals`, `"${ctl.id}" is an enum: equals must be one of [${ctl.options.join(', ')}]`)
    }
  })
}

/**
 * `acoustic` (C12, Task 35): the SHAPE is the zod `Acoustic` (a source on every value, both coverage angles, no unknown key); what
 * zod cannot see is checked here. `nominal` is the PAIR 90 x 60 (coverage_h_deg = 90 AND coverage_v_deg = 60), only on a coverage angle,
 * and its ref says « valeur nominale ». The rules run only when the shape is right, so a malformed value gets one error, not two.
 */
function checkAcoustic(at: string, acoustic: unknown, error: (path: string, message: string) => void): void {
  const a = `${at}.acoustic`
  const parsed = Acoustic.safeParse(acoustic)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) error([a, ...issue.path].join('.'), issue.message)
    return
  }
  const ac = parsed.data
  const angles = { coverage_h_deg: NOMINAL_H_DEG, coverage_v_deg: NOMINAL_V_DEG } as const
  const pairIsNominal = ac.coverage_h_deg.value === NOMINAL_H_DEG && ac.coverage_v_deg.value === NOMINAL_V_DEG
  for (const key of ACOUSTIC_VALUES) {
    const v = ac[key]
    if (v === undefined || v.source.kind !== 'nominal') continue
    const p = `${a}.${key}`
    if (!(key in angles)) error(`${p}.source.kind`, `kind "nominal" exists only for the coverage angles (the pair ${NOMINAL_H_DEG} x ${NOMINAL_V_DEG}): ${key} needs a datasheet or kb source, or no value`)
    else if (!pairIsNominal || v.value !== angles[key as keyof typeof angles])
      error(`${p}.source.kind`, `kind "nominal" is allowed only for the coverage pair ${NOMINAL_H_DEG} x ${NOMINAL_V_DEG} (coverage_h_deg = ${NOMINAL_H_DEG} and coverage_v_deg = ${NOMINAL_V_DEG}); got ${ac.coverage_h_deg.value} x ${ac.coverage_v_deg.value}`)
    if (!v.source.ref.includes(NOMINAL_WORDING)) error(`${p}.source.ref`, `a nominal value says « ${NOMINAL_WORDING} » in its ref`)
  }
}
