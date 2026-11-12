/**
 * behaviourTemplates: per-category and per-trait control / routing / acoustic templates for a promoted device (Wave 0, Task 0.4; Wave 0b).
 *
 * Wave 0b: a template never invents PORTS. The ports come from the connector set the datasheet documents (the asset spec's ports); the template adds
 * behaviour on top of them, chosen by category AND by the plan row's traits (condenser / ribbon / phantom-powered, handheld / bodypack / battery,
 * receiver, processor, passive / active, desk). See applyTemplate.
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
  if (k === 'speaker-active' && traits.includes('passive') && !traits.includes('active')) return 'speaker-passive'
  if (k === 'amp' && traits.includes('processor')) return 'outboard'
  return k
}

const MAINS_ALWAYS_NOTE: ReadonlySet<Kind> = new Set(['preamp', 'console', 'speaker-active', 'amp', 'outboard', 'interface'])
const AUDIO_IN = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'aes3', 'spdif', 'madi', 'aoip', 'usb-audio']
const AUDIO_OUT = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'speaker-level', 'headphone-level', 'aes3', 'spdif', 'madi', 'aoip', 'usb-audio']

/** Traits that mean the device runs on batteries: it has no mains inlet and no power toggle, whatever its category says. */
const BATTERY_TRAITS: readonly TraitT[] = ['battery', 'handheld', 'bodypack']
const isBatteryDevice = (traits: readonly TraitT[]): boolean => traits.some((t) => BATTERY_TRAITS.includes(t))


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
  const last = words.length > 1 && /^\d+$/.test(words[words.length - 1]!) ? words[words.length - 1]! : undefined
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
  /** Things a person must look at (a receiver with no mains inlet documented, a desk with no outputs): reported by the promotion tool, never silently fixed. */
  issues: string[]
}

const POWER: CatalogControl = { id: 'power', type: 'toggle', label: 'Alimentation', default: true }

const flagged = (p: CatalogPort, f: NonNullable<CatalogPort['flags']>[number]): boolean => (p.flags ?? []).includes(f)
const withFlag = (p: CatalogPort, ...fs: NonNullable<CatalogPort['flags']>): CatalogPort => {
  const merged = [...(p.flags ?? [])]
  for (const f of fs) if (!merged.includes(f)) merged.push(f)
  return { ...p, flags: merged }
}
const withoutFlag = (p: CatalogPort, f: NonNullable<CatalogPort['flags']>[number]): CatalogPort => ({ ...p, flags: (p.flags ?? []).filter((x) => x !== f) })

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
 * Whether a microphone-level output of a device with these traits requires phantom power from the chain: a phantom-powered device, or a condenser
 * that is not fed another way (an externally powered tube or lavalier is `active`, a battery one `battery`). A ribbon and a dynamic never do.
 */
export function requiresPhantomByTraits(traits: readonly TraitT[], kind: Kind): boolean {
  if (traits.includes('ribbon') || traits.includes('dynamic')) return false
  if (kind === 'di') return traits.includes('phantom-powered') || (traits.includes('active') && !traits.includes('battery'))
  return traits.includes('phantom-powered') || (traits.includes('condenser') && !traits.includes('active') && !traits.includes('battery'))
}

/**
 * The routes of a DESK (a console of any category): every audio input is routed to the main outputs. The main outputs are the documented ports whose
 * id starts with `out-main` (the QL1 pattern: out-main-l, out-main-r); a desk with none routes every input to all its non-headphone, non-speaker
 * audio outputs. So a promoted desk always passes signal when its spec lists at least one audio output (a desk with none is reported as an issue).
 */
function deskRouting(ins: readonly CatalogPort[], outs: readonly CatalogPort[]): CatalogRoute[] {
  const usable = outs.filter((q) => q.signal !== 'headphone-level' && q.signal !== 'speaker-level')
  const main = usable.filter((q) => q.portId.startsWith('out-main'))
  const to = (main.length ? main : usable).map((q) => q.portId)
  if (!to.length) return []
  return ins.filter((q) => q.signal === 'mic-level' || q.signal === 'line-level-pro' || q.signal === 'line-level-consumer' || q.signal === 'instrument-hiz').map((p) => ({ from: p.portId, to }))
}

/**
 * The behaviour template for a device of `category`. `given` are the ports the DATASHEET documents (the asset spec's ports, each with connector,
 * signal, direction, flags): Wave 0b finding 1: a template never invents ports. It only adds behaviour on top of them:
 *  - a power toggle for every mains inlet (the first is the port `power-in`, the one the toggle gates);
 *  - the phantom requirement and the ribbon flag for microphones, by traits (see requiresPhantomByTraits);
 *  - the controls of its kind (DI ground lift and pad, preamp phantom switch and gain, console master mute / fader / balance);
 *  - the routes (speaker -> transducer, amplifier in -> out, processor / preamp / DI in -> out, desk in -> main outs);
 *  - a nominal acoustic for speakers.
 * Traits decide where the category cannot: a hand-held or body-pack transmitter (traits handheld / bodypack / battery) has no mains inlet and no
 * power toggle, and documenting one is an error; a `processor` is routed like outboard gear even when filed under amplifier; a `passive` studio
 * monitor is a passive speaker.
 */
export function applyTemplate(category: string, row: Pick<PlanRow, 'traits'>, given: readonly PlanPort[], today: string = new Date().toISOString().slice(0, 10)): Template {
  const traits = row.traits ?? []
  const kind = kindOf(category, traits)
  const notes: string[] = []
  const issues: string[] = []
  const battery = isBatteryDevice(traits)
  const mainsGiven = given.filter(isMainsIn)
  if (battery && mainsGiven.length)
    throw new Error(`a battery device (traits ${traits.filter((t) => BATTERY_TRAITS.includes(t)).join(', ')}) cannot list a mains inlet (${mainsGiven.map((p) => p.id ?? p.role).join(', ')}): fix the documented ports`)
  const { ports: expanded, renamed } = expandPorts(given)

  let ports = expanded.map((p) => {
    // isMainsSource: only a mains-power OUT port has it, and every such port must (catalogChecks, C7); a proposal's stray flag elsewhere is dropped
    if (p.dir === 'out' && p.signal === 'mains-power') return withFlag(p, 'isMainsSource')
    if (flagged(p, 'isMainsSource')) return withoutFlag(p, 'isMainsSource')
    const micIn = p.dir === 'in' && p.signal === 'mic-level'
    if ((kind === 'mic' || kind === 'di') && p.dir === 'out' && p.signal === 'mic-level') {
      let q = p
      if (requiresPhantomByTraits(traits, kind)) q = withFlag(q, 'requiresPhantom')
      else if (traits.includes('ribbon') || traits.includes('dynamic')) q = withoutFlag(q, 'requiresPhantom')
      if (traits.includes('ribbon') && !flagged(q, 'isRibbon')) q = withFlag(q, 'isRibbon')
      return q
    }
    if (kind !== 'mic' && kind !== 'di' && p.dir === 'out' && p.signal === 'mic-level' && traits.includes('phantom-powered')) return withFlag(p, 'requiresPhantom')
    if (micIn && (kind === 'interface' || kind === 'console' || kind === 'preamp')) return withFlag(p, 'isMicInput', 'providesPhantom')
    return p
  })
  ports = ports.map(dropEmptyFlags)

  const controls: CatalogControl[] = []
  if (ports.some((p) => p.portId === 'power-in')) controls.push({ ...POWER })
  else if (!battery && (MAINS_ALWAYS_NOTE.has(kind) || traits.includes('receiver') || traits.includes('rack')) && !traits.includes('passive') && ports.length)
    issues.push(`no mains inlet is documented for this ${kind}: it will have no power control (list the mains inlet if the datasheet has one)`)
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
  let routing: CatalogRoute[] = []
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
    routing = deskRouting(ins, outs)
    if (!routing.length) issues.push('a desk with no audio input routed to an audio output: list its output ports (main outputs named out-main-l, out-main-r) so that it passes signal')
  } else if (kind === 'outboard' || kind === 'preamp' || kind === 'di') {
    const o = outs.filter((q) => q.signal !== 'speaker-level' && q.signal !== 'headphone-level')
    if (o.length)
      ins.forEach((p, i) => {
        // a processor with more outputs than inputs (a speaker processor: 2 in, 6 out) feeds every output from each input
        const to = o.length > ins.length ? o : [o[i % o.length]!]
        routing.push({ from: p.portId, to: to.map((q) => q.portId), ...(kind === 'di' && !traits.includes('active') ? { passive: true } : {}) })
      })
  }

  const tpl: Template = { kind, ports, controls, renamed, notes, issues }
  if (routing.length) tpl.routing = routing
  if (kind === 'speaker-active' || kind === 'speaker-passive') {
    tpl.acoustic = nominalAcoustic(today)
    notes.push('nominal coverage 90 x 60 (valeur nominale): no manufacturer coverage recorded in the plan')
  }
  return tpl
}
