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
 *  - console         yamaha-ql1 (mic ins, main L/R, power, mute-master / fader-master / balance-master when documented, routes in -> mains), axia-iq
 *  - speaker-active  genelec-8030c, qsc-k12-2, yamaha-dbr12 (line in, power-in, route in -> transducer; NO acoustic numbers: data rule)
 *  - outboard        grace-m905 (line in / out, power) and the thru routes of qsc-k12-2
 *  - accessory       km-210-9, yellowtec-mika (no port)
 *  - power           multiprise-secteur (mains outlets flagged isMainsSource)
 * and from the spec's section 4.3 table for the kinds the 25 do not cover (DI, passive speaker, amplifier, wireless, headphones, recorder).
 *
 * Rules every template keeps (catalogChecks enforces them): a mains inlet is the port `power-in` and the device carries the toggle `power`
 * (label « Alimentation », default on); port ids are at most 19 characters and unique; a route starts at an input and ends at an output
 * or `transducer`.
 *
 * DATA RULE (founder, 2026-11-12): a template adds STRUCTURE only (power toggle, routes, classification flags). It never writes a number or a capability
 * that the model's own manufacturer sheet has not stated: no coverage angle (a promoted speaker carries no `acoustic`; the app says « valeur non vérifiée »),
 * no gain range, no fader range, no pad value, and no phantom need or supply derived from a trait (those are port flags the SPEC carries, because the
 * person who filled the spec read them on the sheet). A control that is a switch on the real device (phantom, pad, ground lift, master mute) is written
 * only when the spec lists it. Unknown stays unknown.
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
const AUDIO_IN = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'aes3', 'spdif', 'madi', 'aoip', 'aes50', 'usb-audio']
const AUDIO_OUT = ['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'speaker-level', 'headphone-level', 'aes3', 'spdif', 'madi', 'aoip', 'aes50', 'usb-audio']

/** Traits that mean the device runs on batteries: it has no mains inlet and no power toggle, whatever its category says. */
const BATTERY_TRAITS: readonly TraitT[] = ['battery', 'handheld', 'bodypack']
const isBatteryDevice = (traits: readonly TraitT[]): boolean => traits.some((t) => BATTERY_TRAITS.includes(t))


// ── port ids ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A quarter-inch connector is written « 1/4 in », « 1/4-inch », « 1-4 » or « 1/4 » in the sources: slugged blindly it becomes the token « 14 » and an
 * id like « out-14 » reads as OUTPUT NUMBER 14 (Waves 2 to 5 review, finding 19). It becomes the word « quarter » instead (« out-quarter-1 »).
 */
const QUARTER_INCH = /(^|[^0-9])1\s*[/-]\s*4(?:\s*[- ]?\s*(?:in|inch|"))?(?![0-9])/gi
const fold = (s: string): string =>
  s.replace(QUARTER_INCH, '$1quarter ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

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
export function expandPorts(plan: readonly PlanPort[]): { ports: CatalogPort[]; renamed: Record<string, string>; thru: Record<string, { of: string; processed: boolean }> } {
  const used = new Set<string>()
  const ports: CatalogPort[] = []
  const renamed: Record<string, string> = {}
  const thru: Record<string, { of: string; processed: boolean }> = {}
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
      if (p.thruOf !== undefined) thru[final] = { of: p.thruOf, processed: p.thruProcessed === true }
      ports.push({ portId: final, dir: p.dir, connector: p.connector, signal: p.signal, ...(p.flags?.length ? { flags: [...p.flags] } : {}) })
    }
  }
  // a thruOf names the GIVEN id of the input: it follows a rename
  for (const t of Object.values(thru)) t.of = renamed[t.of] ?? t.of
  return { ports, renamed, thru }
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

/**
 * The only master control a template may write for a desk, and only when its spec lists it (Wave 1b finding 8, data rule): a master MUTE is a switch with
 * no number. The main fader and the balance knob are NOT written: their option lists (dB steps, G100 .. D100) would be a range that no sheet of that
 * model states (a desk without them passes its signal at unity, which the signal path already does).
 */
const DESK_MASTER_TOGGLES: readonly CatalogControl[] = [{ id: 'mute-master', type: 'toggle', label: 'Mute master', default: false }]

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

/**
 * The routes of a DESK (a console of any category). Waves 2 to 5 review, finding 10: only what the spec documents.
 *  - the targets are the ANALOGUE line outputs documented as main (`out-main*`), else as mix or monitor (`out-mix*`, `out-mon*`): never an AES, Dante,
 *    USB, headphone or speaker output, never an « omni » output (an assignable output is not a documented destination of every input);
 *  - a channel input (mic, line, instrument) routes to those targets; a TALKBACK input routes nowhere (it goes to the mix buses, never to the mains);
 *  - a desk with no documented target routes nothing (reported as an issue).
 */
function deskRouting(ins: readonly CatalogPort[], outs: readonly CatalogPort[]): CatalogRoute[] {
  const analog = outs.filter((q) => q.signal === 'line-level-pro' || q.signal === 'line-level-consumer')
  const main = analog.filter((q) => /^out-main(-|$)/.test(q.portId))
  const other = analog.filter((q) => /^out-(mix|mon|monitor)(-|$)/.test(q.portId))
  const to = (main.length ? main : other).map((q) => q.portId)
  if (!to.length) return []
  return ins
    .filter((q) => (q.signal === 'mic-level' || q.signal === 'line-level-pro' || q.signal === 'line-level-consumer' || q.signal === 'instrument-hiz') && !TALKBACK.test(q.portId))
    .map((p) => ({ from: p.portId, to }))
}
const TALKBACK = /(^|-)(talkback|tb)(-|$)/

/** The signal families: an input is only ever routed to an output of its own family (an analogue input does not come out of a digital port: that needs a converter nobody documented). */
const ANALOG_SIGNALS = new Set(['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz'])
const DIGITAL_SIGNALS = new Set(['aes3', 'spdif', 'madi', 'aoip', 'aes50', 'usb-audio'])
const familyOf = (signal: string): string => (ANALOG_SIGNALS.has(signal) ? 'analog' : DIGITAL_SIGNALS.has(signal) ? 'digital' : signal)
/** The channel number a port id ends with (`in-mic-2` gives 2), if any. */
const channelOf = (id: string): string | undefined => /-(\d+)$/.exec(id)?.[1]

/**
 * The routes of a PREAMP or channel strip (finding 6): each mic / line / instrument input goes to the ANALOGUE line output of the same channel number
 * (`in-mic-2` and `in-line-2` to `out-line-2`), or to the only line output when there is one. Never to a digital output: a converter output is routed
 * only where a sheet documents the path (none does for the ports modelled so far), and never by position.
 */
function preampRouting(ins: readonly CatalogPort[], outs: readonly CatalogPort[]): CatalogRoute[] {
  const line = outs.filter((q) => q.signal === 'line-level-pro' || q.signal === 'line-level-consumer')
  const routes: CatalogRoute[] = []
  for (const p of ins.filter((q) => ANALOG_SIGNALS.has(q.signal))) {
    const n = channelOf(p.portId)
    let to = n === undefined ? [] : line.filter((q) => channelOf(q.portId) === n)
    // a single-channel strip (no channel number anywhere on its ports): every analogue line output is that channel's (XLR and TRS in parallel)
    if (!to.length && (line.length === 1 || (n === undefined && !line.some((q) => channelOf(q.portId) !== undefined)))) to = line
    if (to.length) routes.push({ from: p.portId, to: to.map((q) => q.portId) })
  }
  return routes
}

/**
 * The routes of other OUTBOARD gear (finding 6): an input goes to an output of the same signal (else of the same family), matched by channel number or,
 * failing that, by order inside that group; a processor with more outputs than inputs of that signal feeds every one of them (a speaker processor: 2 in,
 * 6 out). A codec has no through-route at all (see applyTemplate): its send inputs never feed its receive outputs.
 */
function outboardRouting(ins: readonly CatalogPort[], outs: readonly CatalogPort[]): CatalogRoute[] {
  const routes: CatalogRoute[] = []
  for (const p of ins) {
    const sameFamily = outs.filter((q) => familyOf(q.signal) === familyOf(p.signal) && q.portId !== p.portId)
    const exact = sameFamily.filter((q) => q.signal === p.signal)
    // analogue levels convert freely between them (a line input to a line output of another level); a digital format never turns into another one (AES3 to USB, Dante to AES3) without a documented converter
    const pool = exact.length ? exact : ANALOG_SIGNALS.has(p.signal) ? sameFamily : []
    if (!pool.length) continue
    const peers = ins.filter((q) => (exact.length ? q.signal === p.signal : familyOf(q.signal) === familyOf(p.signal)))
    let to: CatalogPort[]
    if (pool.length > peers.length) to = pool
    else {
      // the same name after the direction word (analog-l to analog-l), else the same channel number, else the same place in the group
      const bare = (id: string): string => id.replace(/^(in|out)-/, '')
      const byName = pool.find((q) => bare(q.portId) === bare(p.portId))
      const byChannel = channelOf(p.portId) === undefined ? undefined : pool.find((q) => channelOf(q.portId) === channelOf(p.portId))
      to = [byName ?? byChannel ?? pool[peers.indexOf(p) % pool.length]!]
    }
    routes.push({ from: p.portId, to: to.map((q) => q.portId) })
  }
  return routes
}

/**
 * Categories whose RJ45 port is network audio by nature (codecs, broadcast processors and consoles, switches, intercoms, digital desks, interfaces
 * and stage boxes). Every other device (speaker, amplifier, wireless receiver, speaker processor, computer, podcast or analogue desk) has an RJ45 that
 * is a control / firmware / LAN port.
 */
const NETWORK_AUDIO_CATEGORIES: ReadonlySet<string> = new Set([
  'codec', 'broadcast', 'network-switch', 'intercom', 'stagebox', 'audio-interface', 'interface', 'console', 'console-digital', 'console-radio',
])

/** The signal of a control / firmware / LAN Ethernet port (Wave 1b finding 9): it carries no audio, so R2 refuses to patch it to an `aoip` port. */
export const CONTROL_NETWORK_SIGNAL = 'ethernet-control'

/**
 * Whether the RJ45 `aoip` ports of a device are control ports: the device is not network audio by category and has no EtherCON / Dante primary port
 * (a device with a Dante port keeps its other RJ45 as audio too: it is a Dante device). The retyping only touches a port the spec gave as `aoip`; a spec
 * that already says `ethernet-control`, or a network-audio device, is left alone.
 */
function hasControlOnlyEthernet(category: string, ports: readonly CatalogPort[]): boolean {
  if (NETWORK_AUDIO_CATEGORIES.has(category)) return false
  // a port the spec NAMES as a Dante / AES67 port keeps its audio type, and so does the device (Waves 2 to 5 review, finding 8: the AD4D has two Dante and two control ports)
  return !ports.some((p) => p.connector === 'ethercon' || (p.flags ?? []).includes('isDantePrimary') || (p.connector === 'rj45' && p.signal === 'aoip' && NETWORK_AUDIO_PORT_ID.test(p.portId)))
}
const NETWORK_AUDIO_PORT_ID = /(^|-)(dante|aes67|ravenna|livewire)(-|$)/

/** A measurement / RTA / analyser input feeds the analyser, not the outputs: it is never routed (Wave 1b finding 4). By port id. */
const MEASUREMENT_PORT = /(^|-)(rta|meas|measure|measurement|analy[sz]er)(-|$)/
const isMeasurementInput = (p: CatalogPort): boolean => p.dir === 'in' && MEASUREMENT_PORT.test(p.portId)

/**
 * The routes of a TELEPHONE HYBRID (Wave 1b finding 5). The hybrid cancels what the studio sends from what the caller returns (that is what makes a
 * mix-minus on the phone line work), so a `send` input is NEVER routed to the caller / receive output: it goes to the other outputs (the datasheet's
 * stereo output carries the send on its left channel) and, on the telephone line, which is not a catalogue port. A caller / line input is routed to the
 * receive (caller, receive, studio, return) outputs only. Without any caller output documented, a line input goes to every non-send output.
 */
function hybridRouting(ins: readonly CatalogPort[], outs: readonly CatalogPort[]): CatalogRoute[] {
  const usable = outs.filter((q) => q.signal !== 'speaker-level' && q.signal !== 'headphone-level')
  const isReceive = (q: CatalogPort): boolean => /(^|-)(caller|receive|rx|studio|return)(-|$)/.test(q.portId)
  const isSend = (q: CatalogPort): boolean => /(^|-)send(-|\d|$)/.test(q.portId)
  const receive = usable.filter(isReceive)
  const others = usable.filter((q) => !isReceive(q))
  const routes: CatalogRoute[] = []
  for (const p of ins) {
    const to = isSend(p) ? others : receive.length ? receive : others
    if (to.length) routes.push({ from: p.portId, to: to.map((q) => q.portId) })
  }
  return routes
}

/**
 * The routes of a PATCHBAY. Two layers of wiring, both one jack to another, never a route from a port to itself:
 *  1. each jack's own wiring: `front-N` is joined to `rear-N`, both ways (the rear is what is wired in, the front is where you re-patch);
 *  2. the DEFAULT NORMALLING (Wave 1b finding 6): inside the rear, the TOP-row jack of a column is joined to the BOTTOM-row jack, top to bottom only
 *     (that is what the real "normal" mode is: the signal of the top jack reaches the bottom one while nothing is patched). Rows are named either
 *     `rear-top-N` / `rear-bottom-N` (or upper / lower), paired by N, or, when the spec lists plain `rear-N`, in order: rear-1 is the top and rear-2 the
 *     bottom jack of the first column, rear-3 and rear-4 of the second, and so on. A jack whose partner is not documented gets no normalling.
 * Jacks not named front / rear get no route, like the shipped StudioPatch. Every patchbay built from the template inherits both layers.
 */
function patchbayRouting(ports: readonly CatalogPort[]): CatalogRoute[] {
  const audio = ports.filter((p) => p.dir === 'bidir' && AUDIO_IN.includes(p.signal))
  const side = (kind: 'front' | 'rear') => audio.filter((p) => new RegExp(`^${kind}-[0-9]+$`).test(p.portId))
  const num = (p: CatalogPort): string => p.portId.replace(/^\D+-/, '')
  const rear = new Map(side('rear').map((p) => [num(p), p.portId]))
  const front = new Map(side('front').map((p) => [num(p), p.portId]))
  const out: CatalogRoute[] = []
  for (const [n, f] of front) if (rear.has(n)) out.push({ from: f, to: [rear.get(n)!] })
  for (const [n, r] of rear) if (front.has(n)) out.push({ from: r, to: [front.get(n)!] })
  const row = (names: string): Map<string, string> => {
    const re = new RegExp(`^rear-(?:${names})-([0-9]+)$`)
    return new Map(audio.flatMap((p): [string, string][] => { const m = re.exec(p.portId); return m ? [[m[1]!, p.portId]] : [] }))
  }
  const top = row('top|upper')
  const bottom = row('bottom|lower')
  if (top.size && bottom.size) {
    for (const [n, t] of top) if (bottom.has(n)) out.push({ from: t, to: [bottom.get(n)!] })
  } else {
    for (const [n, r] of rear) {
      const k = Number(n)
      if (k % 2 === 1 && rear.has(String(k + 1))) out.push({ from: r, to: [rear.get(String(k + 1))!] })
    }
  }
  return out
}

/**
 * The behaviour template for a device of `category`. `given` are the ports the DATASHEET documents (the asset spec's ports, each with connector,
 * signal, direction, flags): Wave 0b finding 1: a template never invents ports. It only adds behaviour on top of them:
 *  - a power toggle for every mains inlet (the first is the port `power-in`, the one the toggle gates);
 *  - the ribbon flag of a ribbon microphone (a trait) and the isMicInput classification of a mic input; a dynamic or ribbon microphone never carries
 *    requiresPhantom. The phantom need (requiresPhantom) and the phantom supply (providesPhantom) are the SPEC's port flags and nothing else (data rule);
 *  - the switches of its kind that the spec LISTS (DI ground lift and pad, preamp phantom switch, desk master mute): never a gain range, a fader range,
 *    a balance range or a pad value;
 *  - the routes (speaker -> transducer, amplifier in -> out, processor / preamp / DI in -> out, desk in -> main outs);
 *  - NO acoustic data: a speaker carries coverage numbers only when a sheet gives them, and no spec field carries them yet.
 * Traits decide where the category cannot: a hand-held or body-pack transmitter (traits handheld / bodypack / battery) has no mains inlet and no
 * power toggle, and documenting one is an error; a `processor` is routed like outboard gear even when filed under amplifier; a `passive` studio
 * monitor is a passive speaker.
 */
export function applyTemplate(
  category: string,
  row: Pick<PlanRow, 'traits'>,
  given: readonly PlanPort[],
  _today: string = new Date().toISOString().slice(0, 10),
  /** The ids of the controls the spec documents: a switch is written only when it is in this list. Undefined: none. */
  documentedControls?: readonly string[],
  /** What the spec says about the mains when no inlet or no switch is modelled (see the spec's `powerNote`). */
  extra: { powerNote?: string } = {},
): Template {
  const traits = row.traits ?? []
  const kind = kindOf(category, traits)
  const notes: string[] = []
  const issues: string[] = []
  const battery = isBatteryDevice(traits)
  const mainsGiven = given.filter(isMainsIn)
  if (battery && mainsGiven.length)
    throw new Error(`a battery device (traits ${traits.filter((t) => BATTERY_TRAITS.includes(t)).join(', ')}) cannot list a mains inlet (${mainsGiven.map((p) => p.id ?? p.role).join(', ')}): fix the documented ports`)
  const { ports: expandedRaw, renamed, thru } = expandPorts(given)
  // Wave 1b finding 9: a control / firmware / LAN Ethernet port is not audio over IP; finding 1: a master clock's reference input is optional, so it is no slave input
  const controlEthernet = hasControlOnlyEthernet(category, expandedRaw)
  const expanded = expandedRaw.map((p) => {
    let q = p
    if (controlEthernet && q.connector === 'rj45' && q.signal === 'aoip') q = { ...q, signal: CONTROL_NETWORK_SIGNAL }
    if (category === 'master-clock' && flagged(q, 'isClockSlave')) q = withoutFlag(q, 'isClockSlave')
    return q
  })

  let ports = expanded.map((p) => {
    // isMainsSource: only a mains-power OUT port has it, and every such port must (catalogChecks, C7); a proposal's stray flag elsewhere is dropped
    if (p.dir === 'out' && p.signal === 'mains-power') return withFlag(p, 'isMainsSource')
    if (flagged(p, 'isMainsSource')) return withoutFlag(p, 'isMainsSource')
    const micIn = p.dir === 'in' && p.signal === 'mic-level'
    if ((kind === 'mic' || kind === 'di') && p.dir === 'out' && p.signal === 'mic-level') {
      let q = p
      // data rule: the phantom need is the spec's flag; the traits only REMOVE a flag that cannot be true (a dynamic or a ribbon never needs phantom)
      if (traits.includes('ribbon') || traits.includes('dynamic')) q = withoutFlag(q, 'requiresPhantom')
      if (traits.includes('ribbon') && !flagged(q, 'isRibbon')) q = withFlag(q, 'isRibbon')
      return q
    }
    if (micIn && (kind === 'interface' || kind === 'console' || kind === 'preamp')) return withFlag(p, 'isMicInput') // providesPhantom is the spec's flag (data rule)
    return p
  })
  ports = ports.map(dropEmptyFlags)

  const controls: CatalogControl[] = []
  if (ports.some((p) => p.portId === 'power-in')) controls.push({ ...POWER })
  else if (!battery && (MAINS_ALWAYS_NOTE.has(kind) || traits.includes('receiver') || traits.includes('rack')) && !traits.includes('passive') && ports.length)
    issues.push(`no mains inlet is documented for this ${kind}: it will have no power control (list the mains inlet if the datasheet has one)`)
  // finding 5: a mains device with no modelled inlet is treated as always powered by the signal path: the entry says so, in French, where the person sees it
  const unmodelledPower = issues.some((i) => i.startsWith('no mains inlet'))
  if (extra.powerNote) notes.push(extra.powerNote)
  else if (unmodelledPower) notes.push('alimentation non modélisée (source non lue)')
  const wanted = documentedControls ?? []
  const micPorts = ports.filter((p) => p.dir === 'in' && p.signal === 'mic-level' && flagged(p, 'providesPhantom')).map((p) => p.portId)
  if (kind === 'di') {
    if (wanted.includes('ground-lift')) controls.push({ id: 'ground-lift', type: 'toggle', label: 'Ground lift', default: false })
    if (wanted.includes('pad')) controls.push({ id: 'pad', type: 'toggle', label: 'Pad', default: false }) // a switch, no dB value: the value is unknown unless a sheet says
  } else if (kind === 'preamp') {
    if (wanted.includes('phantom-48v') && micPorts.length) controls.push({ id: 'phantom-48v', type: 'toggle', label: '+48V phantom', default: false, enables: { flag: 'providesPhantom', ports: micPorts } })
  } else if (kind === 'console') {
    // Wave 1b finding 8 and the data rule: a desk gets only the master switches its spec DOCUMENTS (no fader range, no balance range)
    for (const c of DESK_MASTER_TOGGLES) if (wanted.includes(c.id)) controls.push({ ...c })
  }

  // routes, from the final ports (a route that has no end is not written)
  let routing: CatalogRoute[] = []
  // inputs that feed an analyser (RTA / measurement mic) are not signal inputs; the control-network signal is not an audio signal at all
  const ins = audioIns(ports).filter((p) => !isMeasurementInput(p))
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
  } else if (category === 'patchbay') {
    routing = patchbayRouting(ports)
  } else if (category === 'telephone-hybrid') {
    routing = hybridRouting(ins, outs)
  } else if (category === 'codec' || category === 'monitor-controller') {
    // a codec has no documented through-route (its send inputs never feed its receive outputs), and a monitor controller's sheet gives no default speaker pair: unrouted is honest (finding 6 and 10)
  } else if (kind === 'preamp') {
    routing = preampRouting(ins, outs)
  } else if (kind === 'outboard' && category !== 'headphone-amp') {
    routing = outboardRouting(ins, outs.filter((q) => q.signal !== 'speaker-level' && q.signal !== 'headphone-level'))
  } else if (kind === 'outboard' || kind === 'di') {
    // a headphone amplifier's job is its headphone outputs (Wave 1b finding 15); no other outboard device is routed to a headphone output
    const o = outs.filter((q) => q.signal !== 'speaker-level' && (category === 'headphone-amp' || q.signal !== 'headphone-level'))
    if (o.length)
      ins.forEach((p, i) => {
        // a processor with more outputs than inputs (a speaker processor: 2 in, 6 out) feeds every output from each input
        const to = (o.length > ins.length ? o : [o[i % o.length]!]).filter((q) => q.portId !== p.portId) // never a route back to its own port
        if (to.length) routing.push({ from: p.portId, to: to.map((q) => q.portId), ...(kind === 'di' && !traits.includes('active') ? { passive: true } : {}) })
      })
  }

  // finding 7: a thru / link / loop output the spec declares repeats the signal of its input. The route is passive (it works with the device off) unless the repeated
  // signal is processed; a parallel pair of bidir sockets repeats both ways. That a thru works unpowered is the plan's assumption (P7), said in the notes.
  let passiveThru = false
  for (const [outId, t] of Object.entries(thru)) {
    const out = ports.find((q) => q.portId === outId)
    const from = ports.find((q) => q.portId === t.of)
    if (!out || !from || out.dir === 'in' || from.dir === 'out') continue
    const add = (a: string, b: string): void => {
      if (routing.some((r) => r.from === a && r.to.includes(b))) return
      routing.push({ from: a, to: [b], ...(t.processed ? {} : { passive: true }) })
      if (!t.processed) passiveThru = true
    }
    add(from.portId, out.portId)
    if (out.dir === 'bidir' && from.dir === 'bidir') add(out.portId, from.portId)
  }
  if (passiveThru) notes.push('thru, link and loop outputs pass the signal of their input even with the device off: hypothèse pédagogique du plan (P7), non sourcée')

  const tpl: Template = { kind, ports, controls, renamed, notes, issues }
  if (routing.length) tpl.routing = routing
  if (kind === 'speaker-active' || kind === 'speaker-passive') notes.push('no coverage angle recorded: no acoustic data (valeur non vérifiée) until a manufacturer sheet gives it')
  return tpl
}
