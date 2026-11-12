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
// nav:ecoute and nav:checklist-power are plain shell pieces (NAV_SELECTORS in bridge/shared.ts).
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import { ConnectionGraph } from '../engine/ConnectionGraph'
import { isUnverified } from '../creation/betaDevices'
import { COPY } from '../creation/copy'
import { tabFor } from '../creation/inventory'
import type { StepId } from '../design/packages'
import { MENU_MATERIEL, NAV_SELECTORS, inventoryItemSelector, inventoryTabSelector, propsKeySelector, refKey } from './bridge/shared'
import type { TpBridge, TpPortRef, TpState } from './bridge/types'
import { DEFAULT_STORAGE_KEY } from './vendor/core/controller'
import { hintKey } from './vendor/core/hints'
import { readPowerHelperUse } from '../design/powerHelperUse'
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

/** `connect` / `disconnect`: the pair of the cable whose two port anchors the event carries (`cables` and `state`: after a connect, before a disconnect). */
export function annotateConnect(e: HostEvent, cables: readonly Cable[], state: TpState, bridge: Pick<Anchors, 'anchorOfPort'>, registry: Registry): HostEvent {
  const a = e.data?.a
  const b = e.data?.b
  if ((e.type !== 'connect' && e.type !== 'disconnect') || typeof a !== 'string' || typeof b !== 'string') return e
  const c = cables.find((x) => {
    const pa = bridge.anchorOfPort(x.a)
    const pb = bridge.anchorOfPort(x.b)
    return (pa === a && pb === b) || (pa === b && pb === a)
  })
  return c === undefined ? e : withData(e, { pair: pairOf(c, state, registry) })
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
    const froms = of(ends.from)
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
  { id: 'courant-console', target: { kind: 'connect', pair: 'mains-console' }, action: 'point', sayKeys: ['tutorial.courantConsole'], done: { event: 'connect', match: { pair: 'mains-console' } } },
  { id: 'courant-enceinte', target: { kind: 'connect', pair: 'mains-speaker' }, action: 'point', sayKeys: ['tutorial.courantEnceinte'], done: { event: 'connect', match: { pair: 'mains-speaker' } } },
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
 *   console-enceinte, micro-console, courant-console, courant-enceinte  a cable of the step's pair exists (`pairOf`, strict: playback outputs, mic inputs)
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
        return pair('mains-console')
      case 'courant-enceinte':
        return pair('mains-speaker')
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
}

const rest = (anchor: string, prefix: string): string | null => (anchor.startsWith(`${prefix}.`) ? anchor.slice(prefix.length + 1) : null)

/** True for the reserved anchors this module resolves (a cheap prefix test: the caller builds the page reader only for these). */
export function isTutorialAnchor(anchor: string): boolean {
  return typeof anchor === 'string' && (anchor === SUGGEST_PLAYBACK || [INVENTORY_ITEM, INVENTORY_TAB, CONNECT_FROM, UNPLUG_FROM].some((p) => rest(anchor, p) !== null))
}
const isPair = (s: string): s is Exclude<PairKind, 'other'> => Object.hasOwn(PAIR_ENDS, s)

/** The device itself, or (selected) a button of its Propriétés row; the device when that button has no box (Propriétés folded). */
function deviceThenRow(env: AnchorEnv, instance: string, rowKey: string): Rect | null {
  const device = (): Rect | null => env.rectOfAnchor(env.anchorOfDevice(instance))
  if (env.selection !== instance) return device()
  return env.firstRect([propsKeySelector(rowKey)]) ?? device()
}

/**
 * The rect of a tutorial anchor (see the header), null when it is not on screen, `undefined` when the anchor is not the tutorial's (the caller resolves it
 * as before). Never throws.
 */
export function resolveTutorialAnchor(anchor: string, env: AnchorEnv): Rect | null | undefined {
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
      // unlocked (plan T3.4): the power steps ring the helper (nav:checklist-power) when the list shows it, else the chip that opens the list
      if (env.helperUnlocked === true && PAIR_ENDS[connect].mains) {
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
    if (env.selection === target.id) return env.firstRect([propsKeySelector(`ctl:${target.ctl}`)]) ?? pad()
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

export type RequestKind = 'start' | 'restart' | 'skip'
/** The onboarding request as the bridge reads it (`window.__creation.onboarding()`): its counter, what the last one asked for, and whether the tutorial may run. */
export interface TutorialRequest {
  n: number
  kind: RequestKind
  allowed: boolean
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
}
export interface TutorialRuntime {
  /** Hand this to the controller (`createController({ storage })`): the tutorial follows the controller's own persisted flow state through it. */
  readonly storage: ObservedStorage
  /** After every change of the bench (and at the first look): the state, the source Écoute plays (or null), the onboarding request (or null). */
  update(input: { state: TpState | null; audio: string | null; request: TutorialRequest | null }): void
  /** The guide's record (tests; what storage holds unless it is blocked). */
  record(): TutorialRecord
}

/**
 * The tutorial while the page lives. The vendored controller runs the flow and persists it (`oscar-guide.state.v1`, restored after a reload: the same step is
 * current and ringed); this module, host side, with no vendored change:
 * - reads the controller's flow state through the storage it hands the controller, and keeps the guide record `oscar-guide.onboarding.v1` (step, k, n,
 *   status, handledRequest, early) on each completion and skip; every storage access in try/catch, a blocked storage keeps it in memory, a corrupt record is replaced;
 * - acts once per onboarding request above `handledRequest`: start (or, while it runs, show the current step again: « Reprendre »), restart, skip
 *   (« Passer le tutoriel »: the run stops, the record says skipped, nothing asks again by itself). Never on its own: no request, no start;
 * - completes the current step once, with that step's own event, when its result is already on the bench (`stepSatisfied`), and says so before the next
 *   step's sentence (« Déjà en place : étape k. »); a step the learner completes clears that note;
 * - (plan T3.4) on a power step, Oscar's third hint tier with a strip on the bench unlocks the power helper: the power steps then end with the offer
 *   (`tutorial.helperOffer`), the step is shown again and Mode Création is told (`emit`); the steps the helper did (Mode Création's use mark,
 *   `tekpractice.power-helper.v1`) are recorded `shown` (« montré »), never early, with no note and no celebration.
 */
export function createTutorialRuntime(d: {
  flow: Flow
  registry: Registry
  storage: StorageLike | null
  now(): number
  send(input: ControllerInput): void
  stateKey?: string
  /** Tells Mode Création where the run is (`tekpractice:tutorial` `{ step, helperUnlocked }`, the power helper's gate, plan T3.3): on every change of either. */
  emit?(detail: TutorialDetail): void
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
  const offer = (): string => COPY.tutorial?.helperOffer ?? ''
  /** A step's own sentence; on a power step once the helper is unlocked, followed by Oscar's offer (plan T3.4). */
  const sayOf = (i: number): string => (rec.helper && isPower(i) && offer() !== '' ? `${base[i]} ${offer()}` : base[i])
  let rec: TutorialRecord = parseTutorialRecord(read(TUTORIAL_RECORD_KEY)) ?? { ...EMPTY_TUTORIAL_RECORD, early: [] }
  let flowIndex = -1
  let running = false
  /** The step index whose early event was sent and not seen through yet. */
  let earlyAt: number | null = null
  /** The numbers (1-based) of the steps found already done since the learner's last own completion. */
  let pending: number[] = []
  let last: { state: TpState | null; audio: string | null } = { state: null, audio: null }
  /** The controller's hint state as it last persisted it (`{ key, tier }`): tier 3 on a power step unlocks the helper. */
  let lastHint: { key: string; tier: number } | null = null
  const readUse = () => readPowerHelperUse({ getItem: (k: string) => read(k) })
  /** The helper's use count when this page started: a use before it is not this run's. */
  let helperSeen = readUse()?.n ?? 0

  let told = ''
  /** The run as Mode Création sees it: the current step while it runs (null otherwise), and the helper's unlock. Sent once per change. */
  const tell = (): void => {
    const detail: TutorialDetail = { step: rec.status === 'running' ? rec.step : null, helperUnlocked: rec.status === 'running' && rec.helper }
    const key = JSON.stringify(detail)
    if (key === told || d.emit === undefined) return
    told = key
    try {
      d.emit(detail)
    } catch {
      // the page's listener failed: the tutorial goes on
    }
  }
  const save = (): void => {
    write(TUTORIAL_RECORD_KEY, JSON.stringify(rec))
    tell()
  }
  const clearNotes = (): void => {
    pending = []
    d.flow.steps.forEach((s, i) => (s.say = sayOf(i)))
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
      return
    }
    const idx = flow.index
    if (flow.status === 'running') {
      if (!(earlyAt !== null && idx === earlyAt + 1) && idx !== flowIndex) clearNotes() // the learner moved on (a completion, « Passer cette étape », back): no old note
      running = true
      rec = { ...rec, status: 'running', step: data[idx]?.id ?? null, k: idx + 1, n: data.length }
    } else {
      running = false
      clearNotes()
      if (flow.status === 'done' || flow.status === 'skipped') rec = { ...rec, status: flow.status === 'done' ? 'done' : 'skipped', step: null, k: 0, n: data.length }
    }
    earlyAt = null
    flowIndex = idx
    save()
    unlock()
  }

  /**
   * Oscar's third tier on a power step (plan T3.4: say, point, then offer), with a verified strip on the bench: the helper is unlocked for the rest of the run.
   * The power steps' sentences then end with the offer, the step's bubble is shown again (so the offer is said, and its anchor now rings the helper), and Mode
   * Création is told (`tekpractice:tutorial`). Tier 3 comes from the vendored escalation (`hintAfterMs`, then its auto-raise) or the learner's « Un indice de
   * plus » / « Montre-moi ». Never before a strip exists, never on another step, never outside a run.
   */
  function unlock(): void {
    if (!running || rec.helper || !isPower(flowIndex) || lastHint === null || lastHint.tier !== 3) return
    const step = d.flow.steps[flowIndex]
    if (lastHint.key !== hintKey(step.anchor, `${d.flow.id}:${step.id}`)) return
    if (!(last.state?.instances.some((i) => roleOf(d.registry, i.deviceId) === 'mains-strip') ?? false)) return
    rec = { ...rec, helper: true }
    d.flow.steps.forEach((s, i) => {
      if (isPower(i) && !s.say.endsWith(offer())) s.say = `${s.say} ${offer()}`
    })
    save()
    void Promise.resolve().then(() => d.send({ type: 'chip', id: 'next' })) // after the controller's own bubble: the step again, with the offer
  }

  /** Mode Création's mark of a helper use (`tekpractice.power-helper.v1`) above the one last seen: the power steps of the devices it cabled are « montré ». */
  function helped(): void {
    const use = readUse()
    if (use === null || use.n <= helperSeen) return
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
    d.flow.steps[i].say = sayOf(i)
    if (i + 1 < d.flow.steps.length) d.flow.steps[i + 1].say = pending.length > 0 ? `${noteFor(pending)} ${sayOf(i + 1)}` : sayOf(i + 1)
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
    update({ state, audio, request }) {
      last = { state, audio }
      if (request !== null && request.allowed && Number.isSafeInteger(request.n) && request.n > rec.handledRequest) {
        rec = { ...rec, handledRequest: request.n }
        if (request.kind === 'skip') {
          rec = { ...rec, status: 'skipped', step: null, k: 0, helper: false }
          clearNotes()
          save()
          if (running) d.send({ type: 'flow', control: { action: 'stop' } })
        } else if (request.kind === 'restart' || !running) {
          rec = { ...rec, early: [], shown: [], helper: false }
          clearNotes()
          save()
          d.send({ type: 'flow', control: { action: 'start', flowId: d.flow.id } })
        } else {
          save()
          d.send({ type: 'chip', id: 'next' }) // « Reprendre »: the current step's bubble again
        }
      }
      helped()
      unlock() // a strip placed after the third tier
      schedule()
    },
    record: () => ({ ...rec, early: [...rec.early], shown: [...rec.shown] }),
  }
}
