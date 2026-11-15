/**
 * The plain tutorial « Premiers pas » (mission 1, spec 4): four short steps to a first sound, with no assistant and no guide code (the `guide` switch stays off; this file
 * imports nothing of src/guide). Pure: no DOM, no store, no Babylon. The card that shows it is plainTutorialCard.ts; the wiring (when it starts, the record, Aide) is
 * firstVisit.ts.
 *
 * Each step completes on an observable fact of the page's own state, never on a click on the card:
 *  1. `console`: the checklist's own source row is not blocked (checklistModel.ts `checklistView`: the engine's NO_SOURCE reason is gone), i.e. the console that plays a
 *     test sound is on the bench (today the Yamaha QL1, the only catalog device with a playback route);
 *  2. `enceinte`: a catalog loudspeaker is on the bench (a device of the inventory's « Enceintes » tab, `tabFor`, with a route to its transducer; headphones are not one);
 *  3. `cable`: an output of that console is cabled to an input of that speaker;
 *  4. `ecoute`: a sound started in this session (Écoute: the listen controller's first `playing`, the same signal the entrepreneur's card reads).
 * The steps already true complete at once, in order (`settle`); a step done stays done. « Étape suivante » passes the current step; « Passer le tutoriel » ends it.
 */
import type { DeviceT, Registry } from '../../engine/CatalogLoader'
import type { PathResult } from '../../flow/signalPath'
import type { DesignState } from '../../trials/trial'
import { checklistView } from '../checklistModel'
import { tabFor } from '../inventory'
import { PLAIN_STEP_COUNT, type PlainTutorialRecord } from './state'

export const PLAIN_STEPS = ['console', 'enceinte', 'cable', 'ecoute'] as const
export type PlainStepId = (typeof PLAIN_STEPS)[number]
export type PlainFacts = Record<PlainStepId, boolean>
/** The machine's state is the record's: the current step (1 to 4) and whether it is over. */
export type PlainState = PlainTutorialRecord
export const PLAIN_START: PlainState = { step: 1, done: false }
/** One hint per step, this long after the step became the current one. */
export const PLAIN_HINT_MS = 30_000

if (PLAIN_STEPS.length !== PLAIN_STEP_COUNT) throw new Error('plain tutorial: the step list and the record disagree')

/** A VERIFIED catalog device of an instance (a Bêta proposal is not in `catalog.devices`, as in the signal path). */
function deviceOf(design: DesignState, registry: Registry, instanceId: string): DeviceT | undefined {
  const id = design.rig.instances.find((i) => i.instanceId === instanceId)?.deviceId
  return id !== undefined && registry.catalog.devices.some((d) => d.id === id) ? registry.deviceById.get(id) : undefined
}
const isSourceConsole = (dev: DeviceT | undefined): boolean => !!dev && (dev.routing ?? []).some((r) => r.from.startsWith('control:'))
const isSpeaker = (dev: DeviceT | undefined): boolean =>
  !!dev && tabFor(dev) === 'enceintes' && !dev.realWorld.category.startsWith('headphone') && (dev.routing ?? []).some((r) => r.to.includes('transducer'))
const dirOf = (dev: DeviceT | undefined, port: string): string | undefined => (dev?.ports as { portId: string; dir?: string }[] | undefined)?.find((p) => p.portId === port)?.dir

/** The four facts, from the live design, its signal path (computed by the caller from the same design) and whether a sound started in this session. */
export function benchFacts(design: DesignState, registry: Registry, path: Pick<PathResult, 'playbackReady' | 'reasons' | 'micReasons'>, sounded: boolean): PlainFacts {
  const view = checklistView(path, { placeOpen: design.roomId !== null })
  const consoleOn = view.rows.find((r) => r.id === 'source')?.state !== 'blocked'
  const enceinte = design.rig.instances.some((i) => isSpeaker(deviceOf(design, registry, i.instanceId)))
  const end = (r: { instance: string; port: string }) => {
    const dev = deviceOf(design, registry, r.instance)
    return { source: isSourceConsole(dev), speaker: isSpeaker(dev), dir: dirOf(dev, r.port) }
  }
  const cable = design.rig.connections.some((c) => {
    const a = end(c.a)
    const b = end(c.b)
    return (a.source && a.dir === 'out' && b.speaker && b.dir === 'in') || (b.source && b.dir === 'out' && a.speaker && a.dir === 'in')
  })
  return { console: consoleOn, enceinte, cable, ecoute: sounded }
}

/** The current step and every following one whose fact is true complete, in order; all four done = over. A finished tutorial does not move. */
export function settle(s: PlainState, f: PlainFacts): PlainState {
  if (s.done) return s
  let step = s.step
  while (step <= PLAIN_STEP_COUNT && f[PLAIN_STEPS[step - 1]]) step++
  return step > PLAIN_STEP_COUNT ? { step: PLAIN_STEP_COUNT, done: true } : { step, done: false }
}

/** « Étape suivante »: the current step is passed, then the true ones after it complete. */
export function nextStep(s: PlainState, f: PlainFacts): PlainState {
  if (s.done) return s
  return s.step >= PLAIN_STEP_COUNT ? { step: PLAIN_STEP_COUNT, done: true } : settle({ step: s.step + 1, done: false }, f)
}

/** « Passer le tutoriel »: over, where it is. */
export const skipPlain = (s: PlainState): PlainState => ({ step: s.step, done: true })

/** Aide « Premiers pas » (again) or « Recommencer le tutoriel »: step 1, then the bench as it is. */
export const restartPlain = (f: PlainFacts): PlainState => settle(PLAIN_START, f)

/** For Aide: the step to resume at while it runs, else null. */
export const plainProgress = (s: PlainState | undefined): { k: number; n: number } | null => (s && !s.done ? { k: s.step, n: PLAIN_STEP_COUNT } : null)

/** The hint is due once the step has been the current one for PLAIN_HINT_MS. */
export const hintDue = (stepSince: number, now: number): boolean => now - stepSince >= PLAIN_HINT_MS
