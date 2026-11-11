/**
 * behaviourTemplates: per-category port / control / routing / acoustic templates for a promoted device (Wave 0, Task 0.4).
 *
 * The templates are DERIVED from how the 25 verified devices of content/catalog.json are written, not invented:
 *  - microphone      shure-sm58, shure-sm57, ev-re20 (one out-xlr mic-level, no power); neumann-u87-ai (condenser: requiresPhantom)
 *  - preamp          focusrite-isa-one (mic in with providesPhantom gated by a phantom-48v toggle, line out, power)
 *  - interface       yamaha-rio3224-d2, avid-hd-io (mic ins isMicInput + providesPhantom, line outs, a Dante / USB port, power)
 *  - console         yamaha-ql1 (mic ins, main L/R, power, mute-master / fader-master / balance-master, routes in -> mains), axia-iq
 *  - speaker-active  genelec-8030c, qsc-k12-2, yamaha-dbr12 (line in, power-in, route in -> transducer, nominal acoustic with a source)
 *  - outboard        grace-m905 (line in / out, power) and the thru routes of qsc-k12-2
 *  - accessory       km-210-9, yellowtec-mika (no port)
 *  - power           multiprise-secteur (mains outlets flagged isMainsSource)
 * and from the spec's section 4.3 table for the kinds the 25 do not cover (DI, passive speaker, amplifier, wireless, headphones, recorder).
 *
 * Rules every template keeps (catalogChecks enforces them): a mains inlet is the port `power-in` and the device carries the toggle `power`
 * (label « Alimentation », default on); port ids are at most 19 characters and unique; a route starts at an input and ends at an output
 * or `transducer`. A template never invents a measured value: a nominal coverage says « valeur nominale ».
 *
 * Pure: no file access. tools/promoteDevice.ts reads the plan and writes the files.
 */
import type { PlanPort, PlanRow, TraitT } from './equipmentPlan'
import { PORT_ID_MAX } from './catalogChecks'
import type { CatalogT } from './schemas'

type Device = CatalogT['devices'][number]
export type CatalogPort = Device['ports'][number]
export type CatalogControl = NonNullable<Device['controls']>[number]
export type CatalogRoute = NonNullable<Device['routing']>[number]
export type CatalogAcoustic = NonNullable<Device['acoustic']>

export type Kind =
  | 'mic' | 'di' | 'preamp' | 'interface' | 'console' | 'speaker-active' | 'speaker-passive' | 'amp' | 'outboard'
  | 'wireless' | 'headphones' | 'recorder' | 'computer' | 'power' | 'accessory' | 'cable'

/** Plan / catalogue `category` -> template kind. Every category of the plan, of the proposals and of the catalogue is listed (a test holds it). */
export const CATEGORY_KIND: Readonly<Record<string, Kind>> = {
  microphone: 'mic',
  'di-box': 'di',
  splitter: 'di',
  'mic-preamp': 'preamp',
  'audio-interface': 'interface',
  stagebox: 'interface',
  console: 'console',
  'console-analog': 'console',
  'console-digital': 'console',
  'console-radio': 'console',
  'console-podcast': 'console',
  'powered-speaker': 'speaker-active',
  'studio-monitor': 'speaker-active',
  speaker: 'speaker-passive',
  amplifier: 'amp',
  outboard: 'outboard',
  broadcast: 'outboard',
  codec: 'outboard',
  'master-clock': 'outboard',
  'monitor-controller': 'outboard',
  'headphone-amp': 'outboard',
  'telephone-hybrid': 'outboard',
  'network-switch': 'outboard',
  intercom: 'outboard',
  patchbay: 'outboard',
  wireless: 'wireless',
  iem: 'wireless',
  headphones: 'headphones',
  recorder: 'recorder',
  measurement: 'recorder',
  computer: 'computer',
  controller: 'computer',
  power: 'power',
  'power-strip': 'power',
  accessory: 'accessory',
  signaling: 'accessory',
  'stand-arm': 'accessory',
  'mic-arm': 'accessory',
  'shock-mount': 'accessory',
  'pop-filter': 'accessory',
  furniture: 'accessory',
  cable: 'cable',
  interface: 'computer',
}

/** The kind of a category (an unknown category is an error: a new category must be listed on purpose), with the plan's traits applied. */
export function kindOf(category: string, traits: readonly TraitT[] = []): Kind {
  const k = CATEGORY_KIND[category]
  if (!k) throw new Error(`no behaviour template for category "${category}": add it to CATEGORY_KIND`)
  if (k === 'speaker-passive' && traits.includes('active')) return 'speaker-active'
  if (k === 'amp' && traits.includes('processor')) return 'outboard'
  return k
}

/** Kinds that always have a mains inlet (a device with a plug in the wall). The others get one only when the documented ports list it. */
const MAINS_ALWAYS: ReadonlySet<Kind> = new Set(['preamp', 'console', 'speaker-active', 'amp', 'outboard', 'interface', 'wireless'])

const MAINS_PORT: PlanPort = { id: 'power-in', role: 'power', dir: 'in', connector: 'iec-c14', signal: 'mains-power' }
const AUDIO_IN = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'aes3', 'spdif', 'madi', 'aoip', 'usb-audio']
const AUDIO_OUT = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'speaker-level', 'headphone-level', 'aes3', 'spdif', 'madi', 'aoip', 'usb-audio']

/** Default ports when the plan documents none (a template guess, said so in the notes). */
const DEFAULT_PORTS: Readonly<Record<Kind, readonly PlanPort[]>> = {
  mic: [{ id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }],
  di: [
    { id: 'in-instrument', role: 'instrument', dir: 'in', connector: 'trs-quarter', signal: 'instrument-hiz' },
    { id: 'thru-out', role: 'thru', dir: 'out', connector: 'ts-quarter', signal: 'instrument-hiz' },
    { id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' },
  ],
  preamp: [
    { id: 'in-mic', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
    { id: 'out-line', role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
  ],
  interface: [
    { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 2 },
    { role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro', count: 2 },
    { id: 'usb', role: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' },
  ],
  console: [
    { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 2 },
    { id: 'out-main-l', role: 'main-l', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
    { id: 'out-main-r', role: 'main-r', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
  ],
  'speaker-active': [{ id: 'in-analog', role: 'analog', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }],
  'speaker-passive': [{ id: 'in-speaker', role: 'speaker', dir: 'in', connector: 'speakon-nl4', signal: 'speaker-level' }],
  amp: [
    { role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro', count: 2 },
    { role: 'spk', dir: 'out', connector: 'speakon-nl4', signal: 'speaker-level', count: 2 },
  ],
  outboard: [
    { role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro', count: 2 },
    { role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro', count: 2 },
  ],
  wireless: [{ id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }],
  headphones: [{ id: 'in-35mm', role: '35mm', dir: 'in', connector: 'trs-35mm', signal: 'headphone-level' }],
  recorder: [
    { id: 'in-mic', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', flags: ['isMicInput'] },
    { id: 'out-phones', role: 'phones', dir: 'out', connector: 'trs-35mm', signal: 'headphone-level' },
    { id: 'usb', role: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' },
  ],
  computer: [{ id: 'usb', role: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' }],
  power: [{ role: 'out', dir: 'out', connector: 'iec-c13', signal: 'mains-power', count: 4, flags: ['isMainsSource'] }],
  accessory: [],
  cable: [],
}

// ── port ids ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Words that carry no meaning in a port id (the direction prefix already says input / output) and go first when an id is too long. */
const FILLER = new Set([
  'per', 'of', 'the', 'and', 'for', 'with', 'to', 'a', 'an', 'when', 'on', 'off', 'closest', 'see', 'notes', 'id', 'listed',
  'input', 'inputs', 'output', 'outputs', 'channel', 'channels',
])

/**
 * A deterministic short id (at most 19 characters, lower case, hyphens) from a long one. The direction word (in / out) and the trailing number stay;
 * a leading « bidir » goes (a bidirectional port has no direction word in the catalogue); filler words go first; then words are dropped from the
 * END of the middle until it fits, and a last word still too long is cut. « in-balanced-input-per-channel-1 » gives « in-balanced-1 »,
 * « in-mic-line-inputs-1-24-1 » gives « in-mic-line-1-24-1 ». Pure function of its input (same text, same id, every run).
 */
export function shortPortId(raw: string): string {
  const slug = fold(raw) || 'port'
  if (slug.length <= PORT_ID_MAX) return slug
  let words = slug.split('-')
  if (words[0] === 'bidir' && words.length > 1) words = words.slice(1)
  const first = words[0]!
  const keepFirst = first === 'in' || first === 'out' || first === 'thru'
  const last = words.length > 1 && /^d+$/.test(words[words.length - 1]!) ? words[words.length - 1]! : undefined
  const head = keepFirst ? [first] : []
  const tail = last ? [last] : []
  const mid = words.slice(keepFirst ? 1 : 0, last ? -1 : undefined)
  const join = (m: string[]): string => [...head, ...m, ...tail].join('-')
  let m = mid.filter((w) => !FILLER.has(w))
  if (!m.length) m = mid.slice(0, 1)
  while (m.length > 1 && join(m).length > PORT_ID_MAX) m = m.slice(0, -1)
  if (join(m).length <= PORT_ID_MAX) return join(m)
  // one word is still too long: cut it so that the direction and the number stay
  const room = PORT_ID_MAX - [...head, ...tail].join('-').length - (head.length + tail.length > 0 ? 1 : 0) - (head.length && tail.length ? 1 : 0)
  const cut = (m[0] ?? '').slice(0, Math.max(1, room))
  return join([cut]).slice(0, PORT_ID_MAX).replace(/-+$/, '')
}

/** Make `id` unique among `used` by a numeric suffix that keeps it within the limit. */
function unique(id: string, used: Set<string>): string {
  let out = id
  for (let n = 2; used.has(out); n++) {
    const suffix = `-${n}`
    out = id.slice(0, PORT_ID_MAX - suffix.length).replace(/-+$/, '') + suffix
  }
  used.add(out)
  return out
}

const isMainsIn = (p: { dir: string; signal: string }): boolean => p.dir === 'in' && p.signal === 'mains-power'

/** Expand plan ports (count runs, id rules, mains inlets) into catalogue ports with short unique ids, in order. Old id -> new id for explicit ids. */
export function expandPorts(plan: readonly PlanPort[]): { ports: CatalogPort[]; renamed: Record<string, string> } {
  const used = new Set<string>()
  const ports: CatalogPort[] = []
  const renamed: Record<string, string> = {}
  let mains = 0
  for (const p of plan) {
    const n = p.count ?? 1
    for (let i = 1; i <= n; i++) {
      let id: string
      if (isMainsIn(p)) id = ++mains === 1 ? 'power-in' : `power-in-${mains}`
      else if (p.id !== undefined && n === 1) id = shortPortId(p.id)
      else if (p.id !== undefined) id = shortPortId(`${p.id}-${i}`)
      else {
        const prefix = p.dir === 'bidir' ? '' : `${p.dir}-`
        id = shortPortId(`${prefix}${p.role}${n > 1 ? `-${i}` : ''}`)
      }
      const final = unique(id, used)
      if (p.id !== undefined && n === 1 && final !== p.id) renamed[p.id] = final
      ports.push({ portId: final, dir: p.dir, connector: p.connector, signal: p.signal, ...(p.flags?.length ? { flags: [...p.flags] } : {}) })
    }
  }
  return { ports, renamed }
}

// ── the template ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Template {
  kind: Kind
  ports: CatalogPort[]
  controls: CatalogControl[]
  routing?: CatalogRoute[]
  acoustic?: CatalogAcoustic
  /** Old (given) port id -> the short id it received. */
  renamed: Record<string, string>
  /** What the template added or assumed, for the entry's notes and the tool's report. */
  notes: string[]
}

const POWER: CatalogControl = { id: 'power', type: 'toggle', label: 'Alimentation', default: true }

const flagged = (p: CatalogPort, f: NonNullable<CatalogPort['flags']>[number]): boolean => (p.flags ?? []).includes(f)
const withFlag = (p: CatalogPort, ...fs: NonNullable<CatalogPort['flags']>): CatalogPort => {
  const merged = [...(p.flags ?? [])]
  for (const f of fs) if (!merged.includes(f)) merged.push(f)
  return { ...p, flags: merged }
}

/** A port whose flag list ended up empty carries no `flags` key at all (the catalogue style). */
function dropEmptyFlags(p: CatalogPort): CatalogPort {
  if (p.flags && p.flags.length === 0) {
    const rest: CatalogPort = { ...p }
    delete rest.flags
    return rest
  }
  return p
}

/** Inputs / outputs that carry audio (not mains, clock, gpio, dmx, phantom). */
const audioIns = (ps: readonly CatalogPort[]): CatalogPort[] => ps.filter((p) => p.dir !== 'out' && AUDIO_IN.includes(p.signal))
const audioOuts = (ps: readonly CatalogPort[]): CatalogPort[] => ps.filter((p) => p.dir !== 'in' && AUDIO_OUT.includes(p.signal))

const nominalAcoustic = (today: string): CatalogAcoustic => {
  const source = { kind: 'nominal' as const, ref: 'valeur nominale (pas de donnée constructeur retenue dans le plan)', retrieved: today }
  return { coverage_h_deg: { value: 90, source }, coverage_v_deg: { value: 60, source } }
}

/**
 * The template for a device of `category`: `given` are the ports the datasheet / the Bêta proposal document (an empty list = the kind's default
 * ports); the template completes them (mains inlet, flags), adds the controls of its kind and builds the routes from the final ports.
 */
export function applyTemplate(category: string, row: Pick<PlanRow, 'traits' | 'portsSummary'>, given: readonly PlanPort[], today: string = new Date().toISOString().slice(0, 10)): Template {
  const traits = row.traits ?? []
  const kind = kindOf(category, traits)
  const notes: string[] = []
  const base: PlanPort[] = given.length ? [...given] : [...DEFAULT_PORTS[kind]]
  if (!given.length && DEFAULT_PORTS[kind].length) notes.push(`ports of the ${kind} template (the plan documents none): to be checked against the datasheet`)
  const hasMains = base.some(isMainsIn)
  if (!hasMains && MAINS_ALWAYS.has(kind) && !traits.includes('passive')) {
    base.push({ ...MAINS_PORT })
    notes.push('mains inlet added (power-in, IEC C14) with its power toggle')
  }
  const { ports: expanded, renamed } = expandPorts(base)

  // flags by kind (derived from QL1 / Rio3224 / ISA One / U87)
  let ports = expanded.map((p) => {
    // isMainsSource: only a mains-power OUT port has it, and every such port must (catalogChecks, C7); a proposal's stray flag elsewhere is dropped
    if (p.dir === 'out' && p.signal === 'mains-power') return withFlag(p, 'isMainsSource')
    if (flagged(p, 'isMainsSource')) return { ...p, flags: (p.flags ?? []).filter((f) => f !== 'isMainsSource') }
    const micIn = p.dir === 'in' && p.signal === 'mic-level'
    if (kind === 'mic' && p.dir === 'out' && p.signal === 'mic-level') {
      let q = p
      if (traits.includes('condenser') && !flagged(q, 'requiresPhantom')) q = withFlag(q, 'requiresPhantom')
      if (traits.includes('ribbon') && !flagged(q, 'isRibbon')) q = withFlag(q, 'isRibbon')
      if (traits.includes('ribbon')) q = { ...q, flags: (q.flags ?? []).filter((f) => f !== 'requiresPhantom') } // a ribbon never requires phantom
      return q
    }
    if (kind === 'di' && traits.includes('active') && p.dir === 'out' && p.signal === 'mic-level') return withFlag(p, 'requiresPhantom')
    if (micIn && (kind === 'interface' || kind === 'console' || kind === 'preamp')) return withFlag(p, 'isMicInput', 'providesPhantom')
    return p
  })
  ports = ports.map(dropEmptyFlags)

  const controls: CatalogControl[] = []
  if (ports.some((p) => p.portId === 'power-in')) controls.push({ ...POWER })
  const micPorts = ports.filter((p) => p.dir === 'in' && p.signal === 'mic-level' && flagged(p, 'providesPhantom')).map((p) => p.portId)
  if (kind === 'di') {
    controls.push({ id: 'ground-lift', type: 'toggle', label: 'Ground lift', default: false }, { id: 'pad', type: 'toggle', label: 'Pad', default: false })
  } else if (kind === 'preamp') {
    if (micPorts.length) controls.push({ id: 'phantom-48v', type: 'toggle', label: '+48V phantom', default: false, enables: { flag: 'providesPhantom', ports: micPorts } })
    controls.push({ id: 'gain', type: 'enum', label: 'Gain (dB)', options: ['0', '20', '40', '60'], defaultOption: '20' })
  } else if (kind === 'console') {
    controls.push(
      { id: 'mute-master', type: 'toggle', label: 'Mute master', default: false },
      { id: 'fader-master', type: 'enum', label: 'Fader master', options: ['-inf', '-30', '-20', '-10', '-6', '-3', '0', '+6', '+10'], defaultOption: '0' },
      { id: 'balance-master', type: 'enum', label: 'Balance', options: ['G100', 'G50', 'C', 'D50', 'D100'], defaultOption: 'C' },
    )
  }

  // routes, from the final ports (a route that has no end is not written)
  const routing: CatalogRoute[] = []
  const ins = audioIns(ports)
  const outs = audioOuts(ports)
  if (kind === 'speaker-active') {
    for (const p of ins.filter((q) => q.signal !== 'mic-level' && q.signal !== 'speaker-level')) routing.push({ from: p.portId, to: ['transducer'] })
  } else if (kind === 'speaker-passive') {
    for (const p of ports.filter((q) => q.dir !== 'out' && q.signal === 'speaker-level')) routing.push({ from: p.portId, to: ['transducer'] })
  } else if (kind === 'amp') {
    const spk = outs.filter((q) => q.signal === 'speaker-level')
    const lines = ins.filter((q) => q.signal === 'line-level-pro' || q.signal === 'line-level-consumer')
    lines.forEach((p, i) => {
      const target = spk.length === lines.length ? [spk[i]!.portId] : spk.map((q) => q.portId)
      if (target.length) routing.push({ from: p.portId, to: target })
    })
  } else if (kind === 'console') {
    const mains = outs.filter((q) => q.portId.startsWith('out-main'))
    if (mains.length)
      for (const p of ins.filter((q) => q.signal === 'mic-level' || q.signal === 'line-level-pro')) routing.push({ from: p.portId, to: mains.map((q) => q.portId) })
  } else if (kind === 'outboard' || kind === 'preamp' || kind === 'di') {
    const o = outs.filter((q) => q.signal !== 'speaker-level' && q.signal !== 'headphone-level')
    if (o.length)
      ins.forEach((p, i) => {
        const to = o[i % o.length]!
        routing.push({ from: p.portId, to: [to.portId], ...(kind === 'di' && !traits.includes('active') ? { passive: true } : {}) })
      })
  }

  const tpl: Template = { kind, ports, controls, renamed, notes }
  if (routing.length) tpl.routing = routing
  if (kind === 'speaker-active' || kind === 'speaker-passive') {
    tpl.acoustic = nominalAcoustic(today)
    notes.push('nominal coverage 90 x 60 (valeur nominale): no manufacturer coverage recorded in the plan')
  }
  return tpl
}
