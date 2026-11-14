/**
 * The power helper « Je branche pour vous (dans le simulateur) » (onboarding spec 6.5, plan T3.3). Cabling only: it joins the mains inlets of the
 * playback devices the learner already placed to the free outlets of a strip the learner already placed, as ONE History entry (one undo) and one store change.
 * It never places anything (no SPAWN), never switches anything (no SET_CONTROL: « Lecture console » and « Alimentation » stay the learner's), never unplugs.
 *
 * What it cables (all read from the catalog, nothing guessed):
 *   - the strip: a VERIFIED device whose outlets are mains sources (`isMainsSourceRef`, src/creation/mains.ts: false for a Bêta device whatever its data says;
 *     today only `multiprise-secteur`, out-1 to out-4, iec-c13);
 *   - the devices: verified instances with a free `power-in` (iec-c14, mains-power) that play a part in the playback: the source console (a catalog route from
 *     a control, the QL1's « Lecture console ») first, then the speakers (a catalog route to the transducer), each in the design's order. Console first so the
 *     two connect events reach the guide in the tutorial's order.
 * A `power-in` that already has a cable (to a strip, to a Bêta outlet, anything) is the learner's: not touched. Each pair is checked first with the store's own
 * dry run (`canConnect`, R1 to R3 and busy ports), because a refused `do` still reports a refusal to the status bar.
 *
 * Pure apart from the store and History it is handed: no DOM, no guide import.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { ConnectResult, PortRef } from '../engine/types'
import type { DesignState } from '../trials/trial'
import type { History } from './history'
import type { Intent } from '../ui/intents'
import { isUnverified } from './betaDevices'
import { isMainsSourceRef } from './mains'

export const POWER_IN = 'power-in'

/** What the helper needs of the store (CreationStore has all three). */
export interface HelperStore {
  design(): DesignState
  canConnect(a: PortRef, b: PortRef): ConnectResult
}

export type HelperCable = { a: PortRef; b: PortRef }
/** Why the helper is not offered: no verified strip; nothing left to cable; fewer free outlets than devices; the store's dry run refuses a pair. */
export type NotOffered = 'no-strip' | 'nothing-to-cable' | 'strip-full' | 'refused'
export type HelperPlan = { offered: true; cables: HelperCable[]; instances: string[] } | { offered: false; why: NotOffered }

type Instance = { instanceId: string; deviceId: string }
const key = (r: PortRef): string => `${r.instance}\u0000${r.port}`

/** The playback part a device plays, from its catalog routes: 0 = a source console (route from a control), 1 = a speaker (route to the transducer), null = none. */
function playbackRank(registry: Registry, deviceId: string): 0 | 1 | null {
  const routes = registry.deviceById.get(deviceId)?.routing ?? []
  if (routes.some((r) => typeof r.from === 'string' && r.from.startsWith('control:'))) return 0
  if (routes.some((r) => Array.isArray(r.to) && r.to.includes('transducer'))) return 1
  return null
}

/** What the helper would cable now, or why it is not offered. Never throws (a malformed design is « nothing to cable »). */
export function powerHelperPlan(store: HelperStore, registry: Registry): HelperPlan {
  try {
    const design = store.design()
    const instances: Instance[] = design.rig.instances
    const busy = new Set<string>()
    for (const c of design.rig.connections) {
      busy.add(key(c.a))
      busy.add(key(c.b))
    }
    const outlets: PortRef[] = []
    for (const i of instances) {
      const ports = registry.deviceById.get(i.deviceId)?.ports ?? []
      for (const p of ports) {
        const ref = { instance: i.instanceId, port: p.portId }
        if (isMainsSourceRef(registry, instances, ref) && !busy.has(key(ref))) outlets.push(ref)
      }
    }
    const hasStrip = instances.some((i) => (registry.deviceById.get(i.deviceId)?.ports ?? []).some((p) => isMainsSourceRef(registry, instances, { instance: i.instanceId, port: p.portId })))
    if (!hasStrip) return { offered: false, why: 'no-strip' }
    const targets = instances
      .filter((i) => !isUnverified(registry, i.deviceId) && registry.deviceById.get(i.deviceId)?.ports.some((p) => p.portId === POWER_IN) === true)
      .filter((i) => !busy.has(key({ instance: i.instanceId, port: POWER_IN })))
      .map((i, order) => ({ i, order, rank: playbackRank(registry, i.deviceId) }))
      .filter((t): t is { i: Instance; order: number; rank: 0 | 1 } => t.rank !== null)
      .sort((x, y) => x.rank - y.rank || x.order - y.order)
    if (targets.length === 0) return { offered: false, why: 'nothing-to-cable' }
    if (outlets.length < targets.length) return { offered: false, why: 'strip-full' }
    const cables = targets.map((t, k) => ({ a: outlets[k], b: { instance: t.i.instanceId, port: POWER_IN } }))
    if (!cables.every((c) => store.canConnect(c.a, c.b).ok)) return { offered: false, why: 'refused' }
    return { offered: true, cables, instances: targets.map((t) => t.i.instanceId) }
  } catch {
    return { offered: false, why: 'nothing-to-cable' }
  }
}

export type HelperRun = { ok: true; instances: string[] } | { ok: false; why: NotOffered | 'busy' | 'refused-late' }

/**
 * Cable the plan as ONE History entry labelled `label` and ONE store change (`History.doAll` over `store.dispatchAll`): console first, then the speakers.
 * One store change, not one per cable, so the status line's playback announcement and the guide's poll see the end state only (with one `do` per cable the
 * line said « an enclosure gets the signal but is not powered » between the two). All or nothing: a refused cable leaves the store as it was and records
 * nothing. A Propriétés stepper burst still open is closed first (`settle`: the before-command hooks), so the helper's cables never join it; a drag still in progress
 * (a transaction no hook closes) is « busy » and nothing is done.
 */
export function runPowerHelper(store: HelperStore, history: Pick<History, 'doAll' | 'settle' | 'inTransaction'>, registry: Registry, label: string): HelperRun {
  history.settle()
  if (history.inTransaction) return { ok: false, why: 'busy' }
  const plan = powerHelperPlan(store, registry)
  if (!plan.offered) return { ok: false, why: plan.why }
  const intents: Intent[] = plan.cables.map((c) => ({ type: 'CONNECT', a: { ...c.a }, b: { ...c.b } }))
  if (!history.doAll(intents, label).ok) return { ok: false, why: 'refused-late' }
  return { ok: true, instances: plan.instances }
}

// ── the button (pure view) ──────────────────────────────────────────────────────────────────────────────────────────

/** Where the tutorial is, as the guide tells it (`tekpractice:tutorial` `{ step, helperUnlocked }`) or as its record says at load. */
export interface TutorialGate {
  /** A tutorial run is going on (its current step id, or null when none runs). */
  step: string | null
  helperUnlocked: boolean
  /** The run's step list has a power step. Unknown (a record read before the guide spoke) = assumed true: the lock holds. */
  hasPowerSteps?: boolean
  /** A power step is the current step or still ahead: only then can Oscar's third tier unlock the helper in this run. Unknown = no promise is made. */
  powerAhead?: boolean
}

/** Why the button is disabled: `tutorial` (a power step is current or ahead: the offer will come) or `tutorial-run` (none can unlock it: no promise). */
export type HelperLock = 'tutorial' | 'tutorial-run'
export type HelperButton = { shown: false } | { shown: true; enabled: true; instances: string[] } | { shown: true; enabled: false; reason: HelperLock }

/**
 * The checklist's helper button. Shown only when the helper is offered (a verified strip the learner placed, something left to cable, enough free outlets).
 * During a tutorial run it stays disabled, with its visible reason, until the guide unlocks it (Oscar's third tier: point, say, offer): the learner tries first.
 * The lock covers the whole run (founder rule « never before the learner tried », recorded in the spec erratum), except a run whose step list has no power step
 * there nothing could unlock it, so the button follows the bench. The reason promises the offer only while a power step is current or ahead.
 * Outside a run it follows the plan alone (with `?oscar=0` there is no run: the checklist works the same).
 */
export function helperButton(plan: HelperPlan, gate: TutorialGate | null): HelperButton {
  if (!plan.offered) return { shown: false }
  if (gate !== null && gate.step !== null && !gate.helperUnlocked && gate.hasPowerSteps !== false)
    return { shown: true, enabled: false, reason: gate.powerAhead === true ? 'tutorial' : 'tutorial-run' }
  return { shown: true, enabled: true, instances: [...plan.instances] }
}
