// The guided flows of Mode Création, and the two pieces of live data they need that a static flow cannot hold.
//
// A flow is static data (anchors and texts), but the bench is not: the cable to draw and the phantom switch to find depend on what the
// learner placed. Those steps name RESERVED anchors, resolved at the time the widget asks for a rect (see mount.ts), from the live state:
//   port:suggest.from      a free output port that the app's own rules accept a cable from (`nextConnectionStep`)
//   port:suggest.to        the free input port of another device that the same rules accept
//   control:suggest.phantom the phantom-power switch of the first device that has one
// The shell anchors (nav:place, nav:inventory, nav:status) are resolved by the bridge (NAV_SELECTORS).
//
// How a flow step ends: the vendored controller finishes a step only on a host event (or the learner's « Passer cette étape »). The bridge derives
// placeChosen, deviceAdded, connect and toggle from the bench itself; a `read` step has no change of the bench to wait for, so the mount sends
// `acknowledge` when the learner clicks inside the status bar (the step is about reading it).
import { ConnectionGraph } from '../engine/ConnectionGraph'
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import type { TpPortRef, TpState } from './bridge/types'
import { TP_STRINGS } from './strings'
import { strings as defaultStrings } from './vendor/content/strings.fr'
import { DEFAULT_FLOW_KEYWORDS } from './vendor/core/router'
import type { FlowKeywords } from './vendor/core/router'
import type { Flow } from './vendor/core/types'

export const SUGGEST_FROM = 'port:suggest.from'
export const SUGGEST_TO = 'port:suggest.to'
export const SUGGEST_PHANTOM = 'control:suggest.phantom'
export const NAV_PLACE = 'nav:place'
export const NAV_INVENTORY = 'nav:inventory'
export const NAV_STATUS = 'nav:status'
/** The event a `read` step ends on (sent by the mount when the status bar is clicked). */
export const ACKNOWLEDGE = 'acknowledge'
/** The control id of the phantom-power switch in the catalog. */
export const PHANTOM_CONTROL = 'phantom-48v'

const F = TP_STRINGS.flows

export const CREATION_FLOWS: Flow[] = [
  {
    id: 'premier-montage',
    titleKey: 'flows.premier-montage',
    steps: [
      { id: 'place', anchor: NAV_PLACE, action: 'point', say: F['premier-montage'].steps.place, done: { event: 'placeChosen' } },
      { id: 'add-first', anchor: NAV_INVENTORY, action: 'point', say: F['premier-montage'].steps.addFirst, done: { event: 'deviceAdded' } },
      { id: 'add-second', anchor: NAV_INVENTORY, action: 'point', say: F['premier-montage'].steps.addSecond, done: { event: 'deviceAdded' } },
      { id: 'connect', anchor: SUGGEST_FROM, to: SUGGEST_TO, action: 'drag', say: F['premier-montage'].steps.connect, done: { event: 'connect' } },
      { id: 'status', anchor: NAV_STATUS, action: 'read', say: F['premier-montage'].steps.status, done: { event: ACKNOWLEDGE } },
    ],
  },
  {
    id: 'alimentation-fantome',
    titleKey: 'flows.alimentation-fantome',
    steps: [{ id: 'toggle', anchor: SUGGEST_PHANTOM, action: 'toggle', say: F['alimentation-fantome'].steps.toggle, done: { event: 'toggle', match: { value: true } } }],
  },
  {
    id: 'lire-le-statut',
    titleKey: 'flows.lire-le-statut',
    steps: [{ id: 'signal', anchor: NAV_STATUS, action: 'read', say: F['lire-le-statut'].steps.signal, done: { event: ACKNOWLEDGE } }],
  },
]

/**
 * The controller's string table: the vendored default one (chips, planner, where-am-i...) with the flow titles of this app. A step text is passed
 * to the controller as the sentence itself (a text with no key behaves as its own text), so only the titles need a table entry.
 */
export const CREATION_STRINGS = {
  ...defaultStrings,
  flows: {
    'premier-montage': F['premier-montage'].title,
    'alimentation-fantome': F['alimentation-fantome'].title,
    'lire-le-statut': F['lire-le-statut'].title,
  },
}

/** What a learner can type to reach a flow: the vendored words for the two it knows, and words for the status bar. Folded (no accent, no apostrophe). */
export const CREATION_FLOW_KEYWORDS: readonly FlowKeywords[] = [
  ...DEFAULT_FLOW_KEYWORDS.filter((k) => k.flowId === 'premier-montage' || k.flowId === 'alimentation-fantome'),
  { flowId: 'lire-le-statut', keywords: ['lire le statut', 'lire la barre', 'barre d etat'] },
]

// ── the live suggestions ────────────────────────────────────────────────────────────────────────────────────────────

const refKey = (r: TpPortRef): string => `${r.instance}\u0000${r.port}`
const MAINS = 'mains-power'

/**
 * A cable the learner can draw now: a free output port of one device and a free input port of another that the app's OWN rules accept
 * (`ConnectionGraph.canConnect`: connector mate R1, signal R2, direction R3, and a port with a cable is busy), read from `state` and the catalog only.
 * An audio cable is preferred; a mains cable is suggested only when no audio pair exists. Null when there is none (an empty bench, one device,
 * every compatible port taken). `say` is the app-independent sentence of the flow step.
 */
export function nextConnectionStep(state: TpState, registry: Registry): { from: TpPortRef; to: TpPortRef; say: string } | null {
  try {
    const seen = new Set<string>()
    const devices: { id: string; deviceId: string }[] = []
    for (const i of state.instances) {
      if (seen.has(i.id) || !registry.deviceById.has(i.deviceId)) continue
      seen.add(i.id)
      devices.push({ id: i.id, deviceId: i.deviceId })
    }
    if (devices.length < 2) return null
    const graph = new ConnectionGraph(
      registry,
      devices.map((d) => ({ instanceId: d.id, deviceId: d.deviceId })),
    )
    const taken = new Set<string>()
    for (const c of state.connections) {
      taken.add(refKey(c.a))
      taken.add(refKey(c.b))
      graph.connect({ instance: c.a.instance, port: c.a.port }, { instance: c.b.instance, port: c.b.port }) // a cable the graph would refuse is still a busy port (`taken`)
    }
    const portsOf = (d: { deviceId: string }): DeviceT['ports'] => registry.deviceById.get(d.deviceId)?.ports ?? []
    for (const audioOnly of [true, false]) {
      for (const a of devices) {
        for (const pa of portsOf(a)) {
          if (pa.dir !== 'out' || taken.has(refKey({ instance: a.id, port: pa.portId })) || (audioOnly && pa.signal === MAINS)) continue
          for (const b of devices) {
            if (b.id === a.id) continue
            for (const pb of portsOf(b)) {
              if (pb.dir !== 'in' || taken.has(refKey({ instance: b.id, port: pb.portId }))) continue
              const from = { instance: a.id, port: pa.portId }
              const to = { instance: b.id, port: pb.portId }
              if (graph.canConnect(from, to).ok) return { from, to, say: F['premier-montage'].steps.connect }
            }
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** The first device that has a phantom-power switch (the bridge lists a control for every control the design holds), or null. */
export function firstPhantom(state: TpState): { instance: string; control: string } | null {
  for (const i of state.instances) {
    const own = state.controls[i.id]
    if (own && Object.prototype.hasOwnProperty.call(own, PHANTOM_CONTROL)) return { instance: i.id, control: PHANTOM_CONTROL }
  }
  return null
}
