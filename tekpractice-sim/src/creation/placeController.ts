/**
 * Place changes (C3, C5): the one path shared by the picker and the debug
 * hooks. A change is an undoable APPLY_DESIGN (snapshot entry), except the
 * FIRST place of the session: there is no "no place" state to undo back to,
 * so the history starts after it. One change at a time: a request arriving
 * while another one is still in flight (dialog open, bounds loading) does
 * nothing and resolves 'busy' at once (the shell says so), so a double click
 * never dispatches twice. No DOM, no Babylon.
 */
import type { Intent } from '../ui/intents'
import type { DesignState } from '../trials/trial'
import type { DispatchResult } from './store'
import type { PlaceBounds } from './placeData'
import type { PlaceChoice } from './shell/placeDialog'
import { placeFromKey, placeKey, type PlaceRef } from './places'
import { fitPlacementsToRoom } from './fitToRoom'

/**
 * done: dispatched · same: already this place, nothing to do · cancelled: the
 * learner said « Annuler » · busy: another change is in flight · failed: refused or could not be built.
 */
export type PlaceResult = 'done' | 'same' | 'cancelled' | 'busy' | 'failed'

export interface PlaceControllerDeps {
  store: { design(): DesignState }
  history: { do(intent: Intent, label?: string): DispatchResult; clear(): void }
  /** The new place's footprint and floor (« Garder le matériel » fits the rig into it). */
  bounds(place: PlaceRef): Promise<PlaceBounds>
  /** « Garder le matériel » / « Repartir à vide » / « Annuler ». */
  confirm(): Promise<PlaceChoice>
  /** A model over a rig with gear: « Remplacer le matériel » / « Annuler ». */
  confirmReplace(): Promise<'replace' | 'cancel'>
  /** Called once a change is about to be dispatched (the shell shows the canvas). */
  onCommit?(): void
  /** History entry label. */
  label: string
}

export interface PlaceController {
  /** Commit a place with an empty rig, no dialog. */
  choosePlace(key: string): Promise<PlaceResult>
  /** The user path: asks keep / empty / cancel when the rig has gear. */
  requestPlace(key: string): Promise<PlaceResult>
  /** A whole design for `key` (a template, « Avec le matériel du modèle »): replaces the rig (asked first when it has gear), undoable after the first place. */
  loadDesign(key: string, build: () => Promise<DesignState>): Promise<PlaceResult>
}

const emptyDesign = (roomId: string): DesignState => ({ roomId, rig: { instances: [], connections: [], controls: {} }, placements: [] })
const keyOf = (roomId: string | null): string | null => (roomId === null ? null : placeKey(placeFromKey(roomId)))

export function createPlaceController(d: PlaceControllerDeps): PlaceController {
  let busy = false
  const guarded = async (run: () => Promise<PlaceResult>): Promise<PlaceResult> => {
    if (busy) return 'busy'
    busy = true
    try {
      return await run()
    } finally {
      busy = false
    }
  }

  const dispatch = (next: DesignState, first: boolean): PlaceResult => {
    const r = d.history.do({ type: 'APPLY_DESIGN', design: next }, d.label)
    if (!r.ok) {
      console.warn('[creation] changement de lieu refusé', r.error)
      return 'failed'
    }
    if (first) d.history.clear() // the session starts at its first place
    return 'done'
  }

  const commit = async (key: string, mode: 'keep' | 'empty'): Promise<PlaceResult> => {
    const place = placeFromKey(key)
    const k = placeKey(place)
    const current = d.store.design()
    const first = current.roomId === null
    if (keyOf(current.roomId) === k && (mode === 'keep' || current.rig.instances.length === 0)) return 'same'
    d.onCommit?.()
    let next: DesignState
    if (mode === 'empty') next = emptyDesign(k)
    else {
      const b = await d.bounds(place)
      next = fitPlacementsToRoom({ ...d.store.design(), roomId: k }, b, b.floorAt)
    }
    return dispatch(next, first)
  }

  return {
    choosePlace: (key) => guarded(() => commit(key, 'empty')),
    requestPlace: (key) =>
      guarded(async () => {
        const current = d.store.design()
        if (keyOf(current.roomId) === placeKey(placeFromKey(key))) return 'same'
        if (current.rig.instances.length === 0) return commit(key, 'empty')
        const choice = await d.confirm()
        if (choice === 'cancel') return 'cancelled'
        return commit(key, choice)
      }),
    loadDesign: (key, build) =>
      guarded(async () => {
        const current = d.store.design()
        const first = current.roomId === null
        // Gear on stage: a model replaces it only when the learner says so (undoable afterwards).
        if (current.rig.instances.length > 0 && (await d.confirmReplace()) !== 'replace') return 'cancelled'
        let next: DesignState
        try {
          next = await build()
        } catch (e) {
          console.warn(`[creation] ${key} : modèle impossible à préparer`, e)
          return 'failed'
        }
        d.onCommit?.()
        return dispatch(next, first)
      }),
  }
}
