// The tutorial « Premiers pas » (onboarding spec 6): the ONE step list as data, the roles it reads from the catalog, the host-event annotations that
// let a step end on the right device or cable, the cable a step asks for, and the reserved anchors it points at. Pure: no DOM, no Babylon; the mount
// (src/guide/mount.ts) is its only caller for the live part, src/guide/flows.creation.ts builds the vendored flow from the data.
//
// What ends a step is the vendored `matchesDone` (core/flow.ts): an event type plus an optional exact `match` on the event's data. The bridge's events
// carry anchors only (`deviceAdded { device }`, `connect { a, b }`, `toggle { anchor, value }`); `annotateTutorialEvent` adds what the steps match on:
//   deviceAdded       role: 'source-console' | 'mic' | 'speaker' | 'mains-strip' | 'other'
//   connect/disconnect pair: 'console-speaker' | 'mic-console' | 'mains-console' | 'mains-speaker' | 'other'
//   toggle            playback: true, for the source console's playback control (the catalog route `from: 'control:...'`)
// Roles are the CATALOG's (verified devices only: a Bêta proposal is 'other', it never powers anything and is never a mic, as in signalPath.ts):
//   source-console  a device with a route from a control (today only the Yamaha QL1, `playback-usb` « Lecture console »)
//   mic             realWorld.category `microphone`
//   speaker         `powered-speaker` or `studio-monitor`
//   mains-strip     a device with an `isMainsSource` port (the generic `multiprise-secteur`)
//
// Reserved anchors (resolved here from the live state and the page; `undefined` = not a tutorial anchor):
//   nav:inventory.item.<deviceId>  its card when shown, else its tab in the open drawer, else the « Matériel » menu button
//   nav:inventory.tab.<tab>        the drawer tab when the drawer is open, else the « Matériel » menu button
//   nav:connect.from.<pair>        the first end of the cable the pair asks for (nextConnectionStepFor) while that device is not selected, then its
//                                  « Connecter à… » button in Propriétés (the dialog route); Propriétés folded = the device
//   nav:unplug.from.<pair>         the console end of a cable of that pair while the console is not selected, then its « Débrancher » button
//   control:suggest.playback       the console's « Lecture console » toggle in Propriétés when the console is selected, else its pad, else the console
// nav:ecoute and nav:checklist-power are plain shell pieces (NAV_SELECTORS in bridge/shared.ts); nav:ecoute goes to the checklist chip while the bench
// cannot play (T3 close review S4), else to the shell as before.
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import { ConnectionGraph } from '../engine/ConnectionGraph'
import { isUnverified } from '../creation/betaDevices'
import { COPY } from '../creation/copy'
import { tabFor } from '../creation/inventory'
import type { StepId } from '../design/packages'
import { MENU_MATERIEL, NAV_SELECTORS, inventoryItemSelector, inventoryTabSelector, propsKeySelector, refKey } from './bridge/shared'
import type { TpBridge, TpPortRef, TpState } from './bridge/types'
import { DEFAULT_STORAGE_KEY } from './vendor/core/controller'
import { matchesDone } from './vendor/core/flow'
import { hintKey } from './vendor/core/hints'
import type { PowerHelperReading } from '../design/powerHelperUse'
import type { ControllerInput, DoneWhen, Flow, HostEvent, Rect, StepAction } from './vendor/core/types'
import { EMPTY_TUTORIAL_RECORD, TUTORIAL_RECORD_KEY, parseTutorialRecord, type TutorialRecord } from '../design/tutorialRecord'

export type DeviceRole = 'source-console' | 'mic' | 'speaker' | 'mains-strip' | 'other'
export type PairKind = 'console-speaker' | 'mic-console' | 'mains-console' | 'mains-speaker' | 'other'

export const INVENTORY_ITEM = 'nav:inventory.item'
export const INVENTORY_TAB = 'nav:inventory.tab'
export const CONNECT_FROM = 'nav:connect.from'
export const UNPLUG_FROM = 'nav:unplug.from'
export const SUGGEST_PLAYBACK = 'control:suggest.playback'
export const NAV_ECOUTE = 'nav:ecoute'
export const NAV_CHECKLIST_POWER = 'nav:checklist-power'
/** The two power steps (8 and 9): the only steps with a proactive hint (`hintAfterMs` from the package pacing) and where Oscar's third tier offers the power helper. */
export const POWER_STEPS: readonly StepId[] = Object.freeze<StepId[]>(['courant-console', 'courant-enceinte'])
/** The checklist chip (Mode Création's status bar): where the helper is reached while the list is closed. */
const CHECKLIST_CHIP = '[data-testid="checklist-chip"]'
/**
 * The Propriétés unfold toggle, only while Propriétés is folded (the shell marks `data-props="collapsed"` on `.cr`; the button is the panel's rail). G8 review S7: steps 4 and 6 say
 * « dans Propriétés »; with Propriétés folded (package 1) and the device selected, the ring goes to this toggle (the row has no box), not back to the device.
 */
export const PROPS_UNFOLD = '.cr[data-props="collapsed"] [data-testid="props-collapse"]'

/** A step's proactive hint delay (plan T3.4): the package pacing on the two power steps, none elsewhere; 0 (package 4) = none. */
export function stepHintAfterMs(id: StepId, pacingMs: number): number | undefined {
  return POWER_STEPS.includes(id) && Number.isFinite(pacingMs) && pacingMs > 0 ? pacingMs : undefined
}

/** The host event of a sound starting in Écoute (the bridge derives it from `audioState()`). */
export const PLAY_STARTED = 'playStarted'
/** The bridge's event when the onboarding request goes up (the mount's, never sent to the controller). */
export const TUTORIAL_REQUEST = 'tutorialRequest'

const MAINS = 'mains-power'
/** The mic the step names (spec 6.3: a dynamic mic, so no hidden phantom prerequisite); the catalog's first mic if it ever goes. */
const NAMED_MIC = 'shure-sm58'

// ── roles ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const verifiedIds = new WeakMap<Registry, ReadonlySet<string>>()
/** A device of the catalog itself (never a Bêta proposal registered beside it). */
function verified(registry: Registry, deviceId: string): DeviceT | null {
  let ids = verifiedIds.get(registry)
  if (ids === undefined) {
    ids = new Set(registry.catalog.devices.map((d) => d.id))
    verifiedIds.set(registry, ids)
  }
  if (!ids.has(deviceId) || isUnverified(registry, deviceId)) return null
  return registry.deviceById.get(deviceId) ?? null
}

const controlRoute = (d: DeviceT): string | null => {
  const r = (d.routing ?? []).find((x) => typeof x.from === 'string' && x.from.startsWith('control:'))
  return r === undefined ? null : r.from.slice('control:'.length)
}

/** The control that makes a source console play (the catalog route `from: 'control:<id>'`), or null. */
export function playbackControlOf(registry: Registry, deviceId: string): string | null {
  const d = verified(registry, deviceId)
  return d === null ? null : controlRoute(d)
}

export function roleOf(registry: Registry, deviceId: string): DeviceRole {
  const d = verified(registry, deviceId)
  if (d === null) return 'other'
  if (controlRoute(d) !== null) return 'source-console'
  const category = d.realWorld?.category
  if (category === 'microphone') return 'mic'
  if (category === 'powered-speaker' || category === 'studio-monitor') return 'speaker'
  if (d.ports.some((p) => (p.flags ?? []).includes('isMainsSource'))) return 'mains-strip'
  return 'other'
}

/** The catalog's source consoles, in catalog order. */
export function sourceConsoles(registry: Registry): string[] {
  return registry.catalog.devices.filter((d) => roleOf(registry, d.id) === 'source-console').map((d) => d.id)
}

const firstOfRole = (registry: Registry, role: DeviceRole): string | null => registry.catalog.devices.find((d) => roleOf(registry, d.id) === role)?.id ?? null

// ── pairs ───────────────────────────────────────────────────────────────────────────────────────────────────────────

type Cable = { a: TpPortRef; b: TpPortRef }

const deviceIdOf = (state: TpState, instance: string): string | undefined => state.instances.find((i) => i.id === instance)?.deviceId
const portOf = (registry: Registry, state: TpState, ref: TpPortRef) => {
  const id = deviceIdOf(state, ref.instance)
  return id === undefined ? undefined : registry.deviceById.get(id)?.ports.find((p) => p.portId === ref.port)
}
const roleAt = (registry: Registry, state: TpState, ref: TpPortRef): DeviceRole => {
  const id = deviceIdOf(state, ref.instance)
  return id === undefined ? 'other' : roleOf(registry, id)
}

/** The console outputs that carry playback: the `to` of the catalog route from a control (the QL1: out-main-l, out-main-r). */
function playbackOutputs(registry: Registry, deviceId: string | undefined): ReadonlySet<string> {
  const d = deviceId === undefined ? null : verified(registry, deviceId)
  return new Set((d?.routing ?? []).filter((r) => typeof r.from === 'string' && r.from.startsWith('control:')).flatMap((r) => r.to))
}

/**
 * What a cable joins, from the roles of its two ends, their ports and its signal:
 *   console-speaker  a PLAYBACK output of the source console (its control route's `to`) into a speaker input: a cable that can carry the sound (G8 review C1:
 *                    the QL1's out-mix-1 passes R1-R3 but never plays, so it is `other`)
 *   mic-console      a mic output into a console mic input (`isMicInput`)
 *   mains-console / mains-speaker  a strip outlet to the device's mains inlet
 * Anything else is `other`.
 */
export function pairOf(c: Cable, state: TpState, registry: Registry): PairKind {
  try {
    const ends = [c.a, c.b].map((ref) => ({ ref, role: roleAt(registry, state, ref), port: portOf(registry, state, ref) }))
    const mains = ends.every((e) => e.port?.signal === MAINS)
    const has = (role: DeviceRole): boolean => ends.some((e) => e.role === role)
    if (mains) {
      const strip = ends.find((e) => e.role === 'mains-strip' && (e.port?.flags ?? []).includes('isMainsSource'))
      if (strip === undefined) return 'other'
      const other = ends.find((e) => e !== strip)?.role
      return other === 'source-console' ? 'mains-console' : other === 'speaker' ? 'mains-speaker' : 'other'
    }
    if (ends.some((e) => e.port?.signal === MAINS)) return 'other'
    const consoleEnd = ends.find((e) => e.role === 'source-console')
    if (consoleEnd !== undefined && has('speaker')) {
      const speaker = ends.find((e) => e.role === 'speaker')!
      const outs = playbackOutputs(registry, deviceIdOf(state, consoleEnd.ref.instance))
      return outs.has(consoleEnd.ref.port) && speaker.port?.dir === 'in' ? 'console-speaker' : 'other'
    }
    if (consoleEnd !== undefined && has('mic')) {
      const mic = ends.find((e) => e.role === 'mic')!
      return mic.port?.dir === 'out' && (consoleEnd.port?.flags ?? []).includes('isMicInput') ? 'mic-console' : 'other'
    }
    return 'other'
  } catch {
    return 'other'
  }
}

/**
 * The device at the device end of a mains pair is the one the playback needs (T3 close review C1): a speaker that receives a console-to-speaker cable (step 4),
 * a source console that sends one. With two speakers and the audio on the second, powering the first is not step 9 (signalPath would still say
 * SPEAKER_UNPOWERED at step 10). While no device of that role carries such a cable (step 4 passed), every one counts: there is nothing better to aim at, and
 * step 9 never becomes a dead end.
 */
function isFed(state: TpState, registry: Registry, instance: string, role: DeviceRole): boolean {
  const fed = new Set<string>()
  for (const c of state.connections) {
    if (pairOf(c, state, registry) !== 'console-speaker') continue
    for (const end of [c.a, c.b]) if (roleAt(registry, state, end) === role) fed.add(end.instance)
  }
  return fed.size === 0 || fed.has(instance)
}

/** A mains cable (`mains-console` / `mains-speaker`) whose device end is the one the playback needs (`isFed`); false for any other cable. */
function mainsFed(c: Cable, pair: PairKind, state: TpState, registry: Registry): boolean {
  if (pair !== 'mains-console' && pair !== 'mains-speaker') return false
  const role: DeviceRole = pair === 'mains-console' ? 'source-console' : 'speaker'
  const end = roleAt(registry, state, c.a) === role ? c.a : roleAt(registry, state, c.b) === role ? c.b : null
  return end !== null && isFed(state, registry, end.instance, role)
}

// ── annotations ─────────────────────────────────────────────────────────────────────────────────────────────────────

type Anchors = Pick<TpBridge, 'anchorOfDevice' | 'anchorOfPort' | 'anchorOfControl'>
const withData = (e: HostEvent, extra: Record<string, string | boolean>): HostEvent => ({ ...e, data: { ...(e.data ?? {}), ...extra } })

/** `deviceAdded`: the role of the instance whose anchor the event carries; an event naming no known instance is returned as it is. */
export function annotateDevice(e: HostEvent, state: TpState, bridge: Pick<Anchors, 'anchorOfDevice'>, registry: Registry): HostEvent {
  const device = e.data?.device
  if (e.type !== 'deviceAdded' || typeof device !== 'string') return e
  const inst = state.instances.find((i) => bridge.anchorOfDevice(i.id) === device)
  return inst === undefined ? e : withData(e, { role: roleOf(registry, inst.deviceId) })
}

/**
 * `connect` / `disconnect`: the pair of the cable whose two port anchors the event carries (`cables` and `state`: after a connect, before a disconnect); a mains
 * pair also carries `fed` (C1: its device is the speaker or console the step-4 cable uses, or no device of that role has one yet).
 */
export function annotateConnect(e: HostEvent, cables: readonly Cable[], state: TpState, bridge: Pick<Anchors, 'anchorOfPort'>, registry: Registry): HostEvent {
  const a = e.data?.a
  const b = e.data?.b
  if ((e.type !== 'connect' && e.type !== 'disconnect') || typeof a !== 'string' || typeof b !== 'string') return e
  const c = cables.find((x) => {
    const pa = bridge.anchorOfPort(x.a)
    const pb = bridge.anchorOfPort(x.b)
    return (pa === a && pb === b) || (pa === b && pb === a)
  })
  if (c === undefined) return e
  const pair = pairOf(c, state, registry)
  // C1: a mains pair also says whether its device is the one the playback needs (steps 8 and 9 match `fed: true`)
  return withData(e, pair === 'mains-console' || pair === 'mains-speaker' ? { pair, fed: mainsFed(c, pair, state, registry) } : { pair })
}

/** `toggle`: `playback: true` when the switch is the source console's playback control (any value: the step also matches `value: true`). */
export function annotatePlayback(e: HostEvent, state: TpState, bridge: Pick<Anchors, 'anchorOfControl'>, registry: Registry): HostEvent {
  const anchor = e.data?.anchor
  if (e.type !== 'toggle' || typeof anchor !== 'string') return e
  for (const i of state.instances) {
    const ctl = playbackControlOf(registry, i.deviceId)
    if (ctl !== null && bridge.anchorOfControl(i.id, ctl) === anchor) return withData(e, { playback: true })
  }
  return e
}

/** The mount's one call per host event: the state after the change, and the one before it (a disconnected cable is only there). Never throws. */
export function annotateTutorialEvent(e: HostEvent, ctx: { state: TpState | null; prev: TpState | null; bridge: Anchors; registry: Registry }): HostEvent {
  try {
    const { state, prev, bridge, registry } = ctx
    if (state === null) return e
    switch (e.type) {
      case 'deviceAdded':
        return annotateDevice(e, state, bridge, registry)
      case 'connect':
        return annotateConnect(e, state.connections, state, bridge, registry)
      case 'disconnect':
        return prev === null ? e : annotateConnect(e, prev.connections, prev, bridge, registry)
      case 'toggle':
        return annotatePlayback(e, state, bridge, registry)
      default:
        return e
    }
  } catch {
    return e
  }
}

// ── the cable a step asks for ───────────────────────────────────────────────────────────────────────────────────────

/** Which end the learner starts from (the device the line names first) and what the other end is. */
const PAIR_ENDS: Record<Exclude<PairKind, 'other'>, { from: DeviceRole; to: DeviceRole; mains: boolean }> = {
  'console-speaker': { from: 'source-console', to: 'speaker', mains: false },
  'mic-console': { from: 'mic', to: 'source-console', mains: false },
  'mains-console': { from: 'source-console', to: 'mains-strip', mains: true },
  'mains-speaker': { from: 'speaker', to: 'mains-strip', mains: true },
}

/**
 * The cable a pair step asks for now: a free port of a device of the first role and a free port of a device of the second that the app's OWN rules accept
 * (`ConnectionGraph.canConnect`, R1 to R3, a busy port refused). Audio pairs start at an output (the console's playback outputs first); mains pairs start at the
 * device's mains inlet and end at a strip outlet. Null when there is none, for 'other', and on a malformed state.
 */
export function nextConnectionStepFor(pair: PairKind, state: TpState, registry: Registry): { from: TpPortRef; to: TpPortRef } | null {
  try {
    if (pair === 'other' || !Object.hasOwn(PAIR_ENDS, pair)) return null
    const ends = PAIR_ENDS[pair]
    const devices = state.instances.filter((i) => registry.deviceById.has(i.deviceId))
    const of = (role: DeviceRole) => devices.filter((i) => roleOf(registry, i.deviceId) === role)
    // C1: for a mains pair the device the playback needs comes first (the speaker that carries the audio), then the others, each in design order
    const froms = ends.mains ? [...of(ends.from)].sort((x, y) => Number(isFed(state, registry, y.id, ends.from)) - Number(isFed(state, registry, x.id, ends.from))) : of(ends.from)
    const tos = of(ends.to)
    if (froms.length === 0 || tos.length === 0) return null
    const graph = new ConnectionGraph(registry, devices.map((d) => ({ instanceId: d.id, deviceId: d.deviceId })))
    const taken = new Set<string>()
    for (const c of state.connections) {
      taken.add(refKey(c.a))
      taken.add(refKey(c.b))
      graph.connect(c.a, c.b)
    }
    const ports = (deviceId: string) => registry.deviceById.get(deviceId)?.ports ?? []
    const fromPorts = (deviceId: string) => {
      const all = ports(deviceId).filter((p) => (ends.mains ? p.signal === MAINS && p.dir === 'in' : p.signal !== MAINS && p.dir === 'out'))
      if (ends.mains) return all
      const routed = new Set((registry.deviceById.get(deviceId)?.routing ?? []).filter((r) => r.from.startsWith('control:')).flatMap((r) => r.to))
      return [...all.filter((p) => routed.has(p.portId)), ...all.filter((p) => !routed.has(p.portId))]
    }
    const toPorts = (deviceId: string) =>
      ports(deviceId).filter((p) => (ends.mains ? p.signal === MAINS && (p.flags ?? []).includes('isMainsSource') : p.signal !== MAINS && p.dir !== 'out'))
    for (const a of froms)
      for (const pa of fromPorts(a.deviceId)) {
        const from = { instance: a.id, port: pa.portId }
        if (taken.has(refKey(from))) continue
        for (const b of tos) {
          if (b.id === a.id) continue
          for (const pb of toPorts(b.deviceId)) {
            const to = { instance: b.id, port: pb.portId }
            if (!taken.has(refKey(to)) && pairOf({ a: from, b: to }, state, registry) === pair && graph.canConnect(from, to).ok) return { from, to }
          }
        }
      }
    return null
  } catch {
    return null
  }
}

// ── the step list ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Where a step points: data, turned into an anchor by `stepAnchor` (the catalog says which device and which tab). */
export type StepTarget =
  | { kind: 'inventory-item'; role: DeviceRole; deviceId?: string }
  | { kind: 'inventory-tab'; role: DeviceRole }
  | { kind: 'connect'; pair: Exclude<PairKind, 'other'> }
  | { kind: 'unplug'; pair: Exclude<PairKind, 'other'> }
  | { kind: 'playback' }
  | { kind: 'nav'; anchor: string }

export interface TutorialStep {
  id: StepId
  target: StepTarget
  action: StepAction
  /** COPY keys (`tutorial.*`), said in this order in one bubble. */
  sayKeys: readonly string[]
  done: DoneWhen
}

/**
 * The ONE step list (spec 6.3, then the two unplug steps of package 5, spec 7.2). Packages select ids from it (`Pacing.steps`), never their own list.
 * Every step ends on one host event the bridge derives from the bench (or Écoute): nothing ends on a text, a timer or a guess.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = Object.freeze<TutorialStep[]>([
  { id: 'console', target: { kind: 'inventory-item', role: 'source-console' }, action: 'point', sayKeys: ['tutorial.console'], done: { event: 'deviceAdded', match: { role: 'source-console' } } },
  { id: 'micro', target: { kind: 'inventory-item', role: 'mic', deviceId: NAMED_MIC }, action: 'point', sayKeys: ['tutorial.micro'], done: { event: 'deviceAdded', match: { role: 'mic' } } },
  { id: 'enceinte', target: { kind: 'inventory-item', role: 'speaker' }, action: 'point', sayKeys: ['tutorial.enceinte'], done: { event: 'deviceAdded', match: { role: 'speaker' } } },
  { id: 'console-enceinte', target: { kind: 'connect', pair: 'console-speaker' }, action: 'point', sayKeys: ['tutorial.consoleEnceinte'], done: { event: 'connect', match: { pair: 'console-speaker' } } },
  { id: 'micro-console', target: { kind: 'connect', pair: 'mic-console' }, action: 'point', sayKeys: ['tutorial.microConsole'], done: { event: 'connect', match: { pair: 'mic-console' } } },
  { id: 'lecture-console', target: { kind: 'playback' }, action: 'toggle', sayKeys: ['assist.sourceOff'], done: { event: 'toggle', match: { playback: true, value: true } } },
  { id: 'multiprise', target: { kind: 'inventory-item', role: 'mains-strip' }, action: 'point', sayKeys: ['tutorial.multiprise', 'tutorial.powerNote'], done: { event: 'deviceAdded', match: { role: 'mains-strip' } } },
  { id: 'courant-console', target: { kind: 'connect', pair: 'mains-console' }, action: 'point', sayKeys: ['tutorial.courantConsole'], done: { event: 'connect', match: { pair: 'mains-console', fed: true } } },
  { id: 'courant-enceinte', target: { kind: 'connect', pair: 'mains-speaker' }, action: 'point', sayKeys: ['tutorial.courantEnceinte'], done: { event: 'connect', match: { pair: 'mains-speaker', fed: true } } },
  { id: 'ecoute', target: { kind: 'nav', anchor: NAV_ECOUTE }, action: 'point', sayKeys: ['tutorial.ecoute'], done: { event: PLAY_STARTED, match: { source: 'test' } } },
  { id: 'debrancher', target: { kind: 'unplug', pair: 'console-speaker' }, action: 'point', sayKeys: ['tutorial.debrancher'], done: { event: 'disconnect', match: { pair: 'console-speaker' } } },
  { id: 'rebrancher', target: { kind: 'connect', pair: 'console-speaker' }, action: 'point', sayKeys: ['tutorial.rebrancher'], done: { event: 'connect', match: { pair: 'console-speaker' } } },
])

/** The steps of a pacing, in the pacing's order (an id that is not in the list is dropped). */
export function stepsFor(ids: readonly StepId[]): TutorialStep[] {
  return ids.flatMap((id) => TUTORIAL_STEPS.filter((s) => s.id === id))
}

/** The device a step names: its own id when the catalog has it, else the catalog's first device of the role. */
export function stepDevice(target: StepTarget, registry: Registry): string | null {
  if (target.kind !== 'inventory-item' && target.kind !== 'inventory-tab') return null
  if (target.kind === 'inventory-item' && target.deviceId !== undefined && roleOf(registry, target.deviceId) === target.role) return target.deviceId
  return firstOfRole(registry, target.role)
}

/**
 * The bubble of a step: its COPY texts in order, one space apart, with `{console}` = the catalog label of the step's console (the first source console) and
 * `{micro}` = the label of the mic the step names. A key that COPY lacks says nothing (the tests fail on it).
 */
export function stepSay(step: TutorialStep, registry: Registry): string {
  const label = (id: string | null): string => (id === null ? '' : (registry.deviceById.get(id)?.label ?? ''))
  const vars: Record<string, string> = {
    console: label(firstOfRole(registry, 'source-console')),
    micro: label(stepDevice({ kind: 'inventory-item', role: 'mic', deviceId: NAMED_MIC }, registry)),
  }
  return step.sayKeys
    .map((key) => {
      const [section, name] = key.split('.')
      return COPY[section]?.[name] ?? ''
    })
    .filter((s) => s !== '')
    .join(' ')
    .replace(/\{(console|micro)\}/g, (_m, v: string) => vars[v])
}

/** The anchor a step points at. A step whose device the catalog does not have points at the « Matériel » menu (`nav:inventory`). */
export function stepAnchor(step: TutorialStep, registry: Registry): string {
  const t = step.target
  switch (t.kind) {
    case 'inventory-item': {
      const id = stepDevice(t, registry)
      return id === null ? 'nav:inventory' : `${INVENTORY_ITEM}.${id}`
    }
    case 'inventory-tab': {
      const id = stepDevice(t, registry)
      const d = id === null ? undefined : registry.deviceById.get(id)
      return d === undefined ? 'nav:inventory' : `${INVENTORY_TAB}.${tabFor(d)}`
    }
    case 'connect':
      return `${CONNECT_FROM}.${t.pair}`
    case 'unplug':
      return `${UNPLUG_FROM}.${t.pair}`
    case 'playback':
      return SUGGEST_PLAYBACK
    case 'nav':
      return t.anchor
  }
}

// ── a step already done (G8 review C2) ─────────────────────────────────────────────────────────────────────────────

/**
 * The step's result is already on the bench (or, for Écoute, playing now): the learner did it before the step came, or the app led them there (the status bar
 * names « Lecture console » during steps 2 to 5). Then no event of that step will ever come again, so the mount completes it once with `earlyEvent`.
 *   console, micro, enceinte, multiprise  a device of the role is placed
 *   console-enceinte, micro-console  a cable of the step's pair exists (`pairOf`, strict: playback outputs, mic inputs)
 *   courant-console, courant-enceinte  a mains cable of the step's pair on the device the playback needs (`fed`, C1)
 *   lecture-console  « Lecture console » is on, on a source console
 *   ecoute  the test signal is playing now (`audio` = the source Écoute plays, or null)
 *   debrancher, rebrancher  never: they are about an action, not a state
 */
export function stepSatisfied(step: TutorialStep, state: TpState | null, audio: string | null, registry: Registry): boolean {
  try {
    if (state === null) return false
    const t = step.target
    const role = (r: DeviceRole): boolean => state.instances.some((i) => roleOf(registry, i.deviceId) === r)
    const pair = (p: PairKind): boolean => state.connections.some((c) => pairOf(c, state, registry) === p)
    switch (step.id) {
      case 'console':
      case 'micro':
      case 'enceinte':
      case 'multiprise':
        return t.kind === 'inventory-item' || t.kind === 'inventory-tab' ? role(t.role) : false
      case 'console-enceinte':
        return pair('console-speaker')
      case 'micro-console':
        return pair('mic-console')
      case 'courant-console':
      case 'courant-enceinte': {
        // C1: the cable must be on the device the playback needs (`fed`), not on any speaker or console
        const p: PairKind = step.id === 'courant-console' ? 'mains-console' : 'mains-speaker'
        return state.connections.some((c) => pairOf(c, state, registry) === p && mainsFed(c, p, state, registry))
      }
      case 'lecture-console':
        return state.instances.some((i) => {
          const ctl = playbackControlOf(registry, i.deviceId)
          return ctl !== null && state.controls[i.id]?.[ctl] === true
        })
      case 'ecoute':
        return audio === 'test'
      default:
        return false
    }
  } catch {
    return false
  }
}

/** The host event that completes a satisfied step: its own `done` (event and match), marked `early` so the record can say « déjà en place ». */
export function earlyEvent(step: TutorialStep, at: number): HostEvent {
  return { type: step.done.event, at, data: { ...(step.done.match ?? {}), early: true } }
}

// ── anchor resolvers ────────────────────────────────────────────────────────────────────────────────────────────────

/** What a resolver may read: the bench, the selection, the page (first selector with a real box) and the bridge's own anchors and rects. */
export interface AnchorEnv extends Anchors {
  state: TpState | null
  /** The selected instance (Propriétés lists it), or null. */
  selection: string | null
  registry: Registry
  firstRect(selectors: readonly string[]): Rect | null
  rectOfAnchor(anchor: string): Rect | null
  /** The guide unlocked the power helper in this run (Oscar's third tier, plan T3.4): the power steps then point at it. */
  helperUnlocked?: boolean
  /** Mode Création says the helper is offered now (T3 close review S3): without it the power steps never point at a button that is not there. */
  helperOffered?: boolean
}

const rest = (anchor: string, prefix: string): string | null => (anchor.startsWith(`${prefix}.`) ? anchor.slice(prefix.length + 1) : null)

/** True for the reserved anchors this module resolves (a cheap prefix test: the caller builds the page reader only for these). */
export function isTutorialAnchor(anchor: string): boolean {
  return typeof anchor === 'string' && (anchor === SUGGEST_PLAYBACK || anchor === NAV_ECOUTE || [INVENTORY_ITEM, INVENTORY_TAB, CONNECT_FROM, UNPLUG_FROM].some((p) => rest(anchor, p) !== null))
}
const isPair = (s: string): s is Exclude<PairKind, 'other'> => Object.hasOwn(PAIR_ENDS, s)

/** The device itself, or (selected) a button of its Propriétés row; with Propriétés folded (that button has no box) the unfold toggle, else the device. */
function deviceThenRow(env: AnchorEnv, instance: string, rowKey: string): Rect | null {
  const device = (): Rect | null => env.rectOfAnchor(env.anchorOfDevice(instance))
  if (env.selection !== instance) return device()
  return env.firstRect([propsKeySelector(rowKey), PROPS_UNFOLD]) ?? device()
}

/**
 * The rect of a tutorial anchor (see the header), null when it is not on screen, `undefined` when the anchor is not the tutorial's (the caller resolves it
 * as before). Never throws.
 */
export function resolveTutorialAnchor(anchor: string, env: AnchorEnv): Rect | null | undefined {
  if (anchor === NAV_ECOUTE) {
    // S4: « Écoute » while the bench cannot play (its items are greyed): the checklist chip that says why; otherwise the shell's own Écoute (undefined)
    try {
      return env.state !== null && env.state.playbackReady === false ? (env.firstRect([CHECKLIST_CHIP]) ?? undefined) : undefined
    } catch {
      return undefined
    }
  }
  const item = rest(anchor, INVENTORY_ITEM)
  const tab = rest(anchor, INVENTORY_TAB)
  const connect = rest(anchor, CONNECT_FROM)
  const unplug = rest(anchor, UNPLUG_FROM)
  if (item === null && tab === null && connect === null && unplug === null && anchor !== SUGGEST_PLAYBACK) return undefined
  try {
    const { registry } = env
    if (item !== null) {
      const d = registry.deviceById.get(item)
      if (d === undefined) return env.firstRect([MENU_MATERIEL])
      return env.firstRect([inventoryItemSelector(item), inventoryTabSelector(tabFor(d)), MENU_MATERIEL])
    }
    if (tab !== null) return env.firstRect([inventoryTabSelector(tab), MENU_MATERIEL])
    const state = env.state
    if (state === null) return null
    if (connect !== null) {
      if (!isPair(connect)) return null
      // unlocked (plan T3.4) and offered now (S3): the power steps ring the helper (nav:checklist-power) when the list shows it, else the chip that opens the list
      if (env.helperUnlocked === true && env.helperOffered === true && PAIR_ENDS[connect].mains) {
        const helper = env.firstRect([...(NAV_SELECTORS[NAV_CHECKLIST_POWER] ?? []), CHECKLIST_CHIP])
        if (helper !== null) return helper
      }
      const step = nextConnectionStepFor(connect, state, registry)
      return step === null ? null : deviceThenRow(env, step.from.instance, `connect:${step.from.port}`)
    }
    if (unplug !== null) {
      if (!isPair(unplug)) return null
      const from = PAIR_ENDS[unplug].from
      for (const c of state.connections) {
        if (pairOf(c, state, registry) !== unplug) continue
        const end = roleAt(registry, state, c.a) === from ? c.a : c.b
        return deviceThenRow(env, end.instance, `unplug:${end.port}`)
      }
      return null
    }
    // control:suggest.playback: the first source console whose playback is off (else the first one)
    const consoles = state.instances.flatMap((i) => {
      const ctl = playbackControlOf(registry, i.deviceId)
      return ctl === null ? [] : [{ id: i.id, ctl, on: state.controls[i.id]?.[ctl] === true }]
    })
    const target = consoles.find((c) => !c.on) ?? consoles[0]
    if (target === undefined) return null
    const pad = (): Rect | null => env.rectOfAnchor(env.anchorOfControl(target.id, target.ctl)) ?? env.rectOfAnchor(env.anchorOfDevice(target.id))
    if (env.selection === target.id) return env.firstRect([propsKeySelector(`ctl:${target.ctl}`), PROPS_UNFOLD]) ?? pad()
    return pad()
  } catch {
    return null
  }
}

// ── after the last step ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What is said once the test signal plays (spec 6.3): `listen.simple` by key (the pinned sentence), then the mic line: the checklist's own
 * `checklist.micCabled` when a mic is cabled to a console mic input (`micOk`, or a mic reason that is not NO_MIC), else the engine's NO_MIC text verbatim.
 * Both are true while a sound plays: Écoute plays a song, a file or the test signal, never the mic.
 */
export function closingLines(mic: { micOk: boolean; micReasons: readonly { code: string; text_fr: string }[] }): string[] {
  const simple = COPY.listen?.simple ?? ''
  const noMic = mic.micReasons.find((r) => r.code === 'NO_MIC')
  const line = mic.micOk || noMic === undefined ? (COPY.checklist?.micCabled ?? '') : noMic.text_fr
  return [simple, line].filter((s) => s !== '')
}

// ── at run time: start, persist, resume, skip, « déjà en place » (plan T3.2, G8 review C2) ────────────────────────────

/** How long a host event stays « just sent » for `settle`: the size of a burst (the events of one poll reach the controller within milliseconds), not of a human pause. */
const EVENT_MS = 400

export type RequestKind = 'start' | 'restart' | 'skip'
/** The onboarding request as the bridge reads it (`window.__creation.onboarding()`): its counter, what the last one asked for, and whether the tutorial may run. */
export interface TutorialRequest {
  n: number
  kind: RequestKind
  allowed: boolean
  /** The counter when the page loaded (T3 close review N4): with no guide record (lost or corrupt), only a request above it is acted on. Absent = 0. */
  atLoad?: number
}
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }
/** What the controller is given as its storage: every key goes through, the flow state it writes is also read here. */
export interface ObservedStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
/** The detail of `tekpractice:tutorial` (src/design/events.ts): the current step of a running tutorial (null when none runs) and whether the power helper is unlocked. */
export interface TutorialDetail {
  step: StepId | null
  helperUnlocked: boolean
  /** The run's step list has a power step (T3 close review S5): without one, nothing can unlock the helper, so Mode Création lets it follow the bench. */
  hasPowerSteps: boolean
  /** A power step is the current step or still ahead in this run: only then may the locked button promise the offer. */
  powerAhead: boolean
}
export interface TutorialRuntime {
  /** Hand this to the controller (`createController({ storage })`): the tutorial follows the controller's own persisted flow state through it. */
  readonly storage: ObservedStorage
  /**
   * After every change of the bench (and at the first look): the state, the source Écoute plays (or null), the onboarding request (or null), and the power helper as
   * Mode Création says it (offered now, uses on this page; null without it: then it is never offered and no use is seen).
   */
  update(input: { state: TpState | null; audio: string | null; request: TutorialRequest | null; helper?: PowerHelperReading | null }): void
  /**
   * A host event as the mount is about to send it to the controller (T6.1): the runtime remembers it for a moment, so that when the controller moves on from a step it can tell a step
   * ENDED BY ITS EVENT from a step PASSED (« Passer cette étape »): the card shows a tick for the first and « passée » for the second. An event counts for a step only if it was sent while that step, or a chain of steps leading to it, was current (`settle`).
   */
  sawEvent(event: HostEvent): void
  /** The card's « Passer le tutoriel » (T6.1): the run stops and the record says skipped, as Aide's item does; nothing when no tutorial runs. */
  skip(): void
  /** The guide's record (tests; what storage holds unless it is blocked). */
  record(): TutorialRecord
}

/**
 * The tutorial while the page lives. The vendored controller runs the flow and persists it (`oscar-guide.state.v1`, restored after a reload: the same step is
 * current and ringed); this module, host side, with no vendored change:
 * - reads the controller's flow state through the storage it hands the controller, and keeps the guide record `oscar-guide.onboarding.v1` (step, k, n,
 *   status, handledRequest, early) on each completion and skip; every storage access in try/catch, a blocked storage keeps it in memory, a corrupt record is replaced;
 *   when the controller runs another flow (a question typed to Oscar starts one), a running record becomes `idle` (T3 close review C2: Aide then offers
 *   « Premiers pas » again, and the helper's gate opens); `early`, `shown` and `helper` are cleared only by a genuine (re)start;
 * - acts once per onboarding request above `handledRequest`: start (or, while it runs, show the current step again: « Reprendre »), restart, skip
 *   (« Passer le tutoriel »: the run stops, the record says skipped, nothing asks again by itself). Never on its own: no request, no start; with no guide record
 *   at load (lost or corrupt), a request raised before the page loaded is never acted on (N4);
 * - completes the current step once, with that step's own event, when its result is already on the bench (`stepSatisfied`), and says so before the next
 *   step's sentence (« Déjà en place : étape k. »); a step the learner completes clears that note;
 * - (plan T3.4) on a power step, Oscar's third hint tier, while Mode Création says the helper is offered (S3), unlocks the power helper: the power steps then end
 *   with the offer (`tutorial.helperOffer`), the step is shown again and Mode Création is told (`emit`); the steps the helper did (Mode Création's use count on
 *   this page, read through the bridge, never through storage: S2) are recorded `shown` (« montré »), never early, with no note and no celebration;
 * - (S4) while « Écoute » is the current step and the bench cannot play, its sentence adds `checklist.menuHint` (the checklist chip says why; the mount rings it).
 */
export function createTutorialRuntime(d: {
  flow: Flow
  registry: Registry
  storage: StorageLike | null
  now(): number
  send(input: ControllerInput): void
  stateKey?: string
  /** Tells Mode Création where the run is (`tekpractice:tutorial`, `TutorialDetail`, the power helper's gate, plan T3.3): on every change of it. */
  emit?(detail: TutorialDetail): void
  /** Tells the step card (T6.1) the record after every write: a copy, called in try / catch (a failing card never stops the tutorial). */
  onRecord?(record: TutorialRecord): void
}): TutorialRuntime {
  const stateKey = d.stateKey ?? DEFAULT_STORAGE_KEY
  const memory = new Map<string, string>()
  let blocked = d.storage === null
  const read = (k: string): string | null => {
    if (!blocked && d.storage !== null) {
      try {
        return d.storage.getItem(k)
      } catch {
        blocked = true
      }
    }
    return memory.has(k) ? memory.get(k)! : null
  }
  const write = (k: string, v: string): void => {
    memory.set(k, v)
    if (!blocked && d.storage !== null) {
      try {
        d.storage.setItem(k, v)
      } catch {
        blocked = true
      }
    }
  }

  const data = d.flow.steps.map((s) => TUTORIAL_STEPS.find((t) => t.id === s.id) ?? null)
  const base = d.flow.steps.map((s) => s.say)
  const isPower = (i: number): boolean => data[i] !== null && data[i] !== undefined && POWER_STEPS.includes(data[i]!.id)
  const hasPowerSteps = data.some((_, i) => isPower(i))
  const offer = (): string => COPY.tutorial?.helperOffer ?? ''
  const listenHint = (): string => COPY.checklist?.menuHint ?? ''
  /** S4: the bench as last seen cannot play (a step-10 regression: the helper's entry undone, a device deleted, « Alimentation » off). Unknown = no. */
  const cannotPlay = (): boolean => last.state !== null && last.state.playbackReady === false
  /**
   * A step's own sentence; on a power step once the helper is unlocked, followed by Oscar's offer (plan T3.4); on « Écoute » while the bench cannot play,
   * followed by `checklist.menuHint` (S4).
   */
  const sayOf = (i: number): string => {
    const extra = [rec.helper && isPower(i) ? offer() : '', data[i]?.id === 'ecoute' && cannotPlay() ? listenHint() : ''].filter((s) => s !== '')
    return [base[i], ...extra].join(' ')
  }
  /** The « déjà en place » note before a step's sentence, by step index. */
  const notes = new Map<number, string>()
  const render = (i: number): void => {
    const step = d.flow.steps[i]
    if (step === undefined) return
    const note = notes.get(i)
    step.say = note === undefined ? sayOf(i) : `${note} ${sayOf(i)}`
  }
  const renderAll = (): void => d.flow.steps.forEach((_, i) => render(i))


  const parsed = parseTutorialRecord(read(TUTORIAL_RECORD_KEY))
  let rec: TutorialRecord = parsed ?? { ...EMPTY_TUTORIAL_RECORD, early: [] }
  /** N4: no guide record at load (never written, lost or corrupt): `handledRequest` is unknown, so the first request read is held to the page's own requests. */
  let unknownHandled = parsed === null
  let flowIndex = -1
  let running = false
  /** The step index whose early event was sent and not seen through yet. */
  let earlyAt: number | null = null
  /** The numbers (1-based) of the steps found already done since the learner's last own completion. */
  let pending: number[] = []
  let last: { state: TpState | null; audio: string | null; helper: PowerHelperReading | null } = { state: null, audio: null, helper: null }
  /** The controller's hint state as it last persisted it (`{ key, tier }`): tier 3 on a power step unlocks the helper. */
  let lastHint: { key: string; tier: number } | null = null
  /** The helper's use count at the first look (S2: a use before the guide looked is not this run's); null until then. */
  let helperSeen: number | null = null

  let told = ''
  /** The host events sent a moment ago, newest last: what tells a step ended by its event from a step passed (T6.1). */
  let seenEvents: { e: HostEvent; t: number; at: number }[] = []
  /** The run as Mode Création sees it: the current step while it runs (null otherwise), the helper's unlock, and whether a power step exists / is ahead (S5). */
  const tell = (): void => {
    const live = rec.status === 'running'
    const detail: TutorialDetail = {
      step: live ? rec.step : null,
      helperUnlocked: live && rec.helper,
      hasPowerSteps,
      powerAhead: live && data.some((_, i) => isPower(i) && i >= rec.k - 1),
    }
    const key = JSON.stringify(detail)
    if (key === told || d.emit === undefined) return
    told = key
    try {
      d.emit(detail)
    } catch {
      // the page's listener failed: the tutorial goes on
    }
  }
  const snapshot = (): TutorialRecord => ({ ...rec, early: [...rec.early], shown: [...rec.shown], passed: [...rec.passed] })
  const save = (): void => {
    write(TUTORIAL_RECORD_KEY, JSON.stringify(rec))
    tell()
    try {
      d.onRecord?.(snapshot())
    } catch {
      // the page's card failed: the tutorial goes on
    }
  }
  /**
   * The controller moved from step `from` to `to` (exclusive): each step it left is DONE when an event just sent ends it (the vendored `matchesDone`) AND that event was sent while
   * the step, or a chain of steps leading to it, was current (`at` = the step index when it was sent, and every step from `at` up to this one also has a matching event buffered: the
   * burst of one poll, the speaker's mains cable then the console's), when its result was already on the bench (`early`) or when the power helper did it (`shown`); otherwise the
   * learner passed it. An event for a LATER step sent and undone while an earlier step was current (a device placed then removed) never turns a skip into a tick. Events older than
   * `EVENT_MS` are forgotten; none is consumed (a burst's later steps still need its earlier events). A step done again (back, then its event) is no longer passed.
   */
  /** Some buffered event ends step `k` and was sent at step `k` or before. */
  const matched = (k: number): boolean => {
    const step = d.flow.steps[k]
    return step !== undefined && seenEvents.some((x) => x.at <= k && matchesDone(step, x.e))
  }
  /** Step `i` ended by an event sent while it, or a chain of steps leading to it, was current. */
  const byEvent = (i: number): boolean => {
    const step = d.flow.steps[i]
    if (step === undefined) return false
    return seenEvents.some((x) => {
      if (x.at > i || !matchesDone(step, x.e)) return false
      for (let k = x.at; k < i; k++) if (!matched(k)) return false
      return true
    })
  }
  const settle = (from: number, to: number): void => {
    const t = d.now()
    seenEvents = seenEvents.filter((x) => t - x.t <= EVENT_MS)
    let passed = rec.passed
    for (let i = from; i < to; i++) {
      const id = data[i]?.id
      const step = d.flow.steps[i]
      if (id === undefined || step === undefined) continue
      const done = byEvent(i) || earlyAt === i || rec.shown.includes(id)
      passed = done ? passed.filter((x) => x !== id) : passed.includes(id) ? passed : [...passed, id]
    }
    rec = { ...rec, passed }
  }
  const clearNotes = (): void => {
    pending = []
    notes.clear()
    renderAll()
  }
  const noteFor = (ks: readonly number[]): string =>
    (COPY.tutorial?.alreadyInPlace ?? '').replace('{steps}', ks.map((k) => (COPY.tutorial?.alreadyStep ?? '').replace('{k}', String(k))).join(', '))

  /** The controller's persisted state, as it writes it (`{ v, flow: { flowId, index, status }, hint }`). */
  function observe(blob: string | null): void {
    type Persisted = { flowId?: unknown; index?: unknown; status?: unknown }
    let flow: Persisted | null = null
    try {
      const o = blob === null ? null : (JSON.parse(blob) as { flow?: unknown; hint?: unknown })
      flow = o !== null && typeof o === 'object' && o.flow !== null && typeof o.flow === 'object' ? (o.flow as Persisted) : null
      const h = o !== null && typeof o === 'object' ? (o.hint as { key?: unknown; tier?: unknown } | null | undefined) : null
      lastHint = h !== null && typeof h === 'object' && typeof h.key === 'string' && typeof h.tier === 'number' ? { key: h.key, tier: h.tier } : null
    } catch {
      flow = null
      lastHint = null
    }
    if (flow === null || flow.flowId !== d.flow.id || typeof flow.index !== 'number') {
      running = false
      flowIndex = -1
      // C2: the controller runs another flow (or none): a record still saying « running » would keep Aide on « Reprendre » and the helper locked. It is
      // interrupted: idle, with its early / shown / helper kept (only a genuine start clears them).
      if (rec.status === 'running') {
        rec = { ...rec, status: 'idle', step: null, k: 0 }
        clearNotes()
        save()
      }
      return
    }
    const idx = flow.index
    if (flow.status === 'running') {
      if (!(earlyAt !== null && idx === earlyAt + 1) && idx !== flowIndex) clearNotes() // the learner moved on (a completion, « Passer cette étape », back): no old note
      if (flowIndex >= 0 && idx > flowIndex) settle(flowIndex, idx) // T6.1: the steps it left are done or passed
      // N3: the controller went back to step 1 by itself (a restart that did not come through `update`): the marks of the old run go with it, as with a genuine restart
      if (idx === 0 && flowIndex > 0) rec = { ...rec, early: [], shown: [], passed: [], helper: false }
      running = true
      rec = { ...rec, status: 'running', step: data[idx]?.id ?? null, k: idx + 1, n: data.length }
    } else {
      if (flow.status === 'done' && flowIndex >= 0 && running) settle(flowIndex, data.length) // the last step ended on its event
      running = false
      clearNotes()
      if (flow.status === 'done' || flow.status === 'skipped') rec = { ...rec, status: flow.status === 'done' ? 'done' : 'skipped', step: null, k: 0, n: data.length }
    }
    earlyAt = null
    flowIndex = idx
    save()
    unlock()
  }

  /** « Passer le tutoriel » (Aide's item and the card's button): the run stops, the record says skipped, nothing asks again by itself. */
  function stopRun(): void {
    if (!running && rec.status !== 'running') return
    rec = { ...rec, status: 'skipped', step: null, k: 0, helper: false }
    clearNotes()
    save()
    if (running) d.send({ type: 'flow', control: { action: 'stop' } })
  }

  /**
   * Oscar's third tier on a power step (plan T3.4: say, point, then offer), while Mode Création says the helper is offered (S3: its button would be there; a full
   * strip, a speaker already on a Bêta outlet or no strip at all = no offer): the helper is unlocked for the rest of the run. The power steps' sentences then
   * end with the offer, the step's bubble is shown again (so the offer is said, and its anchor now rings the helper), and Mode Création is told
   * (`tekpractice:tutorial`). Tier 3 comes from the vendored escalation (`hintAfterMs`, then its auto-raise) or the learner's « Un indice de plus » /
   * « Montre-moi ». Never while it is not offered, never on another step, never outside a run.
   */
  function unlock(): void {
    if (!running || rec.helper || !isPower(flowIndex) || lastHint === null || lastHint.tier !== 3) return
    const step = d.flow.steps[flowIndex]
    if (lastHint.key !== hintKey(step.anchor, `${d.flow.id}:${step.id}`)) return
    if (last.helper?.offered !== true) return
    rec = { ...rec, helper: true }
    renderAll()
    save()
    void Promise.resolve().then(() => d.send({ type: 'chip', id: 'next' })) // after the controller's own bubble: the step again, with the offer
  }

  /** Mode Création's helper use count above the one last seen (S2: through the bridge, not storage): the power steps of the devices it cabled are « montré ». */
  function helped(): void {
    const use = last.helper
    if (use === null) return
    if (helperSeen === null) {
      helperSeen = use.n
      return
    }
    if (use.n <= helperSeen) return
    helperSeen = use.n
    if (!running) return
    const roles = new Set(use.instances.map((id) => {
      const deviceId = last.state?.instances.find((i) => i.id === id)?.deviceId
      return deviceId === undefined ? 'other' : roleOf(d.registry, deviceId)
    }))
    const steps: StepId[] = [...(roles.has('source-console') ? ['courant-console' as const] : []), ...(roles.has('speaker') ? ['courant-enceinte' as const] : [])].filter((id) => data.some((t) => t?.id === id))
    if (steps.length === 0) return
    rec = { ...rec, shown: [...rec.shown, ...steps.filter((id) => !rec.shown.includes(id))], early: rec.early.filter((id) => !steps.includes(id)) }
    save()
  }

  let queued = false
  const schedule = (): void => {
    if (queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      check()
    })
  }
  /** The current step done already: complete it once, with its own event, the next step's sentence led by the note. */
  function check(): void {
    if (!running || earlyAt !== null) return
    const i = flowIndex
    const s = data[i]
    if (s === null || s === undefined || !stepSatisfied(s, last.state, last.audio, d.registry)) return
    earlyAt = i
    // a step the power helper did is « montré » (record `shown`): completed with no « déjà en place » note and not counted early
    const shown = rec.shown.includes(s.id)
    if (!shown) pending = [...pending, i + 1]
    notes.delete(i)
    if (pending.length > 0) notes.set(i + 1, noteFor(pending))
    else notes.delete(i + 1)
    render(i)
    render(i + 1)
    if (!shown && !rec.early.includes(s.id)) rec = { ...rec, early: [...rec.early, s.id] }
    save()
    d.send({ type: 'hostEvent', event: earlyEvent(s, d.now()) })
  }

  observe(read(stateKey)) // a reload: the controller restores the same state from the same key

  const storage: ObservedStorage = {
    getItem: (k) => read(k),
    setItem: (k, v) => {
      write(k, v)
      if (k === stateKey) {
        observe(v)
        schedule()
      }
    },
    removeItem: (k) => {
      memory.delete(k)
      try {
        if (!blocked && d.storage !== null && 'removeItem' in d.storage) (d.storage as Storage).removeItem(k)
      } catch {
        blocked = true
      }
    },
  }

  return {
    storage,
    update({ state, audio, request, helper }) {
      last = { state, audio, helper: helper ?? null }
      renderAll() // S4: « Écoute » follows whether the bench can play
      if (request !== null && unknownHandled) {
        // N4: with no guide record at load, a request raised before this page loaded may be one the guide already handled: never acted on by itself
        unknownHandled = false
        const atLoad = typeof request.atLoad === 'number' && Number.isSafeInteger(request.atLoad) ? request.atLoad : 0
        if (atLoad > rec.handledRequest) rec = { ...rec, handledRequest: atLoad }
      }
      if (request !== null && request.allowed && Number.isSafeInteger(request.n) && request.n > rec.handledRequest) {
        rec = { ...rec, handledRequest: request.n }
        if (request.kind === 'skip') {
          stopRun()
        } else if (request.kind === 'restart' || !running) {
          rec = { ...rec, early: [], shown: [], passed: [], helper: false }
          clearNotes()
          save()
          d.send({ type: 'flow', control: { action: 'start', flowId: d.flow.id } })
        } else {
          save()
          d.send({ type: 'chip', id: 'next' }) // « Reprendre »: the current step's bubble again
        }
      }
      helped()
      unlock() // a strip placed (or the helper offered again) after the third tier
      schedule()
    },
    sawEvent(event) {
      seenEvents = [...seenEvents, { e: event, t: d.now(), at: Math.max(0, flowIndex) }].slice(-32)
    },
    skip: stopRun,
    record: snapshot,
  }
}
