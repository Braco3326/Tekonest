/**
 * Pure, data-driven signal flow (Task 34; council C7, C8, C9). Reads the catalog `routing[]` and a `DesignState` (plus the rule
 * events) and answers: can the rig play (`playbackReady`), which speakers are fed with what, why not, and is the mic OK.
 * Never imports Babylon, the DOM, the store or the engine's graph: the caller hands in plain data, so the answer is recomputed
 * from the live design on every change (no cache here to go stale).
 *
 * The gate (C9): an ENABLED source (a route `from: 'control:<id>'` whose `when` holds) on a POWERED host, a path over the routes
 * and the cables to the input of a POWERED transducer, with no error event on a port of the path. Mute, fader and balance
 * silence a feed (they are carried on it) but never gate it. « Micro OK » is separate from playback.
 *
 * « Powered » (C7) = the `power` control is not off AND (no `power-in` port, OR the `power-in` is cabled to a MAINS SOURCE).
 * « Mains source » is decided by `isMainsSourceRef` only (Task 32): false for an unknown instance and for ANY unverified (Bêta)
 * device, even if a flag is set on its port. A Bêta device carries no `routing[]` and is not a catalog device, so no path starts
 * at, passes through or ends at it: this module reads the routes and ports of VERIFIED catalog devices only.
 */
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import type { ControlValue, PortRef, TeachingEvent } from '../engine/types'
import type { DesignState } from '../trials/trial'
import { isMainsSourceRef } from '../creation/mains'
import { COPY } from '../creation/copy'

export type ReasonCode = 'NO_SOURCE' | 'SOURCE_OFF' | 'HOST_UNPOWERED' | 'NO_PATH' | 'SPEAKER_UNPOWERED' | 'RULE_ERROR' | 'NO_MIC'
export interface Reason {
  code: ReasonCode
  /** French draft (COPY.playback, à valider: tekuxwriter). */
  text_fr: string
  subjects: PortRef[]
}
export interface SpeakerFeed {
  instanceId: string
  channels: ('L' | 'R')[]
  /** The host console's master fader in dB; `'-inf'` is `-Infinity`. */
  gainDb: number
  muted: boolean
  /** The host console's balance option (catalog enum, e.g. 'C', 'G50'). */
  balance: string
  /** Ports crossed: host output, speaker input; each pass-through adds its input then its output. */
  path: PortRef[]
}
export interface PathResult {
  playbackReady: boolean
  speakers: SpeakerFeed[]
  reasons: Reason[]
  micOk: boolean
  /** Why there is no Micro OK (empty when `micOk`). */
  micReasons: Reason[]
}

type Route = NonNullable<DeviceT['routing']>[number]
type Channel = 'L' | 'R'

const key = (r: PortRef): string => `${r.instance}\u0000${r.port}`
const ref = (instance: string, port: string): PortRef => ({ instance, port })

const REASON_KEY: Readonly<Record<ReasonCode, string>> = {
  NO_SOURCE: 'noSource',
  SOURCE_OFF: 'sourceOff',
  HOST_UNPOWERED: 'hostUnpowered',
  NO_PATH: 'noPath',
  SPEAKER_UNPOWERED: 'speakerUnpowered',
  RULE_ERROR: 'ruleError',
  NO_MIC: 'noMic',
}
const reason = (code: ReasonCode, subjects: PortRef[] = []): Reason => ({ code, text_fr: COPY.playback![REASON_KEY[code]]!, subjects })

/** Merge reasons of the same code (subjects concatenated, no duplicate port): one row per cause. */
function merged(rs: Reason[]): Reason[] {
  const out = new Map<ReasonCode, Reason>()
  for (const r of rs) {
    const at = out.get(r.code)
    if (!at) out.set(r.code, { ...r, subjects: [...r.subjects] })
    else for (const s of r.subjects) if (!at.subjects.some((x) => key(x) === key(s))) at.subjects.push(s)
  }
  return [...out.values()]
}

/**
 * The device of an instance, only if it is a VERIFIED catalog device. A registered Bêta proposal lives in `registry.deviceById`
 * but not in `registry.catalog.devices`: to this module it is unknown, whatever routing or flags the object might hold.
 */
function deviceOf(design: DesignState, registry: Registry, instanceId: string): DeviceT | undefined {
  const deviceId = design.rig.instances.find((i) => i.instanceId === instanceId)?.deviceId
  if (deviceId === undefined || !registry.catalog.devices.some((d) => d.id === deviceId)) return undefined
  return registry.deviceById.get(deviceId)
}

/** The other end of the cable that touches `r`, or null. */
function peerOf(design: DesignState, r: PortRef): PortRef | null {
  for (const c of design.rig.connections) {
    if (c.a.instance === r.instance && c.a.port === r.port) return c.b
    if (c.b.instance === r.instance && c.b.port === r.port) return c.a
  }
  return null
}

/** The value of a control: the design's, else the catalog default (toggle `default`, enum `defaultOption`), else undefined. */
function controlValue(design: DesignState, dev: DeviceT, instanceId: string, controlId: string): ControlValue | undefined {
  const set = design.rig.controls[instanceId]?.[controlId]
  if (set !== undefined) return set
  const c = dev.controls?.find((x) => x.id === controlId)
  return c === undefined ? undefined : c.type === 'toggle' ? c.default : c.defaultOption
}

/** C7: `power` not off AND (no `power-in`, or `power-in` cabled to a mains source). False for an unknown or unverified instance. */
export function isPowered(design: DesignState, registry: Registry, instanceId: string): boolean {
  const dev = deviceOf(design, registry, instanceId)
  if (!dev) return false
  if (controlValue(design, dev, instanceId, 'power') === false) return false
  if (!dev.ports.some((p) => p.portId === 'power-in')) return true // a passive device (mic) or itself a mains source
  const peer = peerOf(design, ref(instanceId, 'power-in'))
  return peer !== null && isMainsSourceRef(registry, design.rig.instances, peer)
}

const errorPortsOf = (events: readonly TeachingEvent[]): Set<string> =>
  new Set(events.filter((e) => e.severity === 'error').flatMap((e) => e.subjects.map(key)))

interface Source {
  instanceId: string
  dev: DeviceT
  route: Route
}

function feedOf(design: DesignState, host: Source, instanceId: string, channels: Set<Channel>, path: PortRef[]): SpeakerFeed {
  const v = (id: string) => controlValue(design, host.dev, host.instanceId, id)
  const fader = v('fader-master')
  const gain = fader === undefined || typeof fader === 'boolean' ? 0 : fader === '-inf' ? -Infinity : Number(fader)
  const balance = v('balance-master')
  return {
    instanceId,
    channels: (['L', 'R'] as const).filter((c) => channels.has(c)),
    gainDb: Number.isNaN(gain) ? 0 : gain,
    muted: v('mute-master') === true,
    balance: typeof balance === 'string' ? balance : 'C',
    path,
  }
}

export function signalPath(design: DesignState, registry: Registry, events: readonly TeachingEvent[]): PathResult {
  const errorPorts = errorPortsOf(events)
  const mic = micCheck(design, registry, errorPorts)
  const base = { micOk: mic.micOk, micReasons: mic.micReasons }
  const fail = (...reasons: Reason[]): PathResult => ({ playbackReady: false, speakers: [], reasons, ...base })

  // Sources: routes read from a control of a verified device (e.g. the QL1 'control:playback-usb').
  const sources: Source[] = design.rig.instances.flatMap((i) => {
    const dev = deviceOf(design, registry, i.instanceId)
    return (dev?.routing ?? []).filter((r) => r.from.startsWith('control:')).map((route) => ({ instanceId: i.instanceId, dev: dev!, route }))
  })
  if (!sources.length) return fail(reason('NO_SOURCE'))
  const enabled = sources.filter(({ instanceId, dev, route }) => !route.when || controlValue(design, dev, instanceId, route.when.control) === route.when.equals)
  if (!enabled.length) return fail(reason('SOURCE_OFF', sources.map((s) => ref(s.instanceId, s.route.from))))
  const live = enabled.filter((s) => isPowered(design, registry, s.instanceId))
  if (!live.length) return fail(reason('HOST_UNPOWERED', enabled.map((s) => ref(s.instanceId, 'power-in'))))

  // Breadth-first walk over (output port, channel): the output's cable peer is an input; the device's routes from that input lead
  // to its outputs (walk on) or to its transducer (a speaker is fed).
  interface Step {
    out: PortRef
    channel: Channel | null
    path: PortRef[]
    host: Source
  }
  const queue: Step[] = []
  for (const host of live) host.route.to.forEach((to, k) => queue.push({ out: ref(host.instanceId, to), channel: host.route.channels?.[k] ?? null, path: [], host }))
  const feeds = new Map<string, { host: Source; channels: Set<Channel>; path: PortRef[] }>()
  const unpowered = new Map<string, PortRef>()
  const blocked: PortRef[] = []
  const block = (p: PortRef): void => {
    if (!blocked.some((x) => key(x) === key(p))) blocked.push(p)
  }
  const seen = new Set<string>()
  while (queue.length) {
    const { out, channel, path, host } = queue.shift()!
    const tag = `${key(out)}|${channel}`
    if (seen.has(tag)) continue
    seen.add(tag)
    if (errorPorts.has(key(out))) {
      block(out)
      continue
    }
    const inp = peerOf(design, out)
    if (!inp) continue
    if (errorPorts.has(key(inp))) {
      block(inp)
      continue
    }
    const dev = deviceOf(design, registry, inp.instance)
    if (!dev) continue // an unknown or unverified (Bêta) device: no routes, the path ends here
    const powered = isPowered(design, registry, inp.instance)
    const through = [...path, out, inp]
    for (const r of (dev.routing ?? []).filter((x) => x.from === inp.port)) {
      // `passive` = the route works unpowered. That is the PLAN's pedagogical assumption (P7, log L26), NOT a knowledge-base fact:
      // the data only names the output (K12.2 "loop-thru outputs"), that it passes signal with the speaker off is the plan's choice.
      if (!r.passive && !powered) {
        if (r.to.includes('transducer')) unpowered.set(inp.instance, ref(inp.instance, 'power-in'))
        continue
      }
      for (const [k, to] of r.to.entries()) {
        if (to === 'transducer') {
          const at = feeds.get(inp.instance)
          // no channel on the route = a mono source: both sides
          const cs: Channel[] = channel === null ? ['L', 'R'] : [channel]
          if (at) cs.forEach((c) => at.channels.add(c))
          else feeds.set(inp.instance, { host, channels: new Set(cs), path: through })
        } else queue.push({ out: ref(inp.instance, to), channel: r.channels?.[k] ?? channel, path: through, host })
      }
    }
  }

  const speakers = [...feeds.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, f]) => feedOf(design, f.host, id, f.channels, f.path))
  const reasons: Reason[] = []
  if (blocked.length) reasons.push(reason('RULE_ERROR', blocked))
  for (const [id, port] of [...unpowered.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    if (!feeds.has(id)) reasons.push(reason('SPEAKER_UNPOWERED', [port]))
  if (!speakers.length && !reasons.length) reasons.push(reason('NO_PATH', live.flatMap((h) => h.route.to.map((to) => ref(h.instanceId, to)))))
  return { playbackReady: speakers.length > 0, speakers, reasons, ...base }
}

/**
 * Micro OK: a VERIFIED mic (a catalog device with a `mic-level` output) cabled to an `isMicInput` port of a powered, verified
 * console, with no error event on either port. A Bêta device is not a catalog device, so it is never a mic nor a mic input.
 */
function micCheck(design: DesignState, registry: Registry, errorPorts: Set<string>): { micOk: boolean; micReasons: Reason[] } {
  const isMicOut = (r: PortRef): boolean => deviceOf(design, registry, r.instance)?.ports.some((p) => p.portId === r.port && p.dir === 'out' && p.signal === 'mic-level') === true
  const isMicIn = (r: PortRef): boolean => deviceOf(design, registry, r.instance)?.ports.some((p) => p.portId === r.port && (p.flags ?? []).includes('isMicInput')) === true
  const cables = design.rig.connections.flatMap((c) => [
    { mic: c.a, input: c.b },
    { mic: c.b, input: c.a },
  ]).filter(({ mic, input }) => isMicOut(mic) && isMicIn(input))
  if (!cables.length) return { micOk: false, micReasons: [reason('NO_MIC')] }
  const failures: Reason[] = []
  for (const { mic, input } of cables) {
    if (!isPowered(design, registry, input.instance)) failures.push(reason('HOST_UNPOWERED', [ref(input.instance, 'power-in')]))
    else if (errorPorts.has(key(mic)) || errorPorts.has(key(input))) failures.push(reason('RULE_ERROR', [mic, input].filter((p) => errorPorts.has(key(p)))))
    else return { micOk: true, micReasons: [] }
  }
  return { micOk: false, micReasons: merged(failures) }
}
