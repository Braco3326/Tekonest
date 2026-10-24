/**
 * Place changes (C3, C5): the one path shared by the picker and the debug
 * hooks. A change is an undoable APPLY_DESIGN (snapshot entry), except the
 * FIRST place of the session: there is no "no place" state to undo back to,
 * so the history starts after it. One change at a time: a request arriving
 * while another one is still in flight (dialog open, bounds loading) is
 * ignored, so a double click never dispatches twice. No DOM, no Babylon.
 */
import type { Intent } from '../ui/intents'
import type { DesignState } from '../trials/trial'
import type { DispatchResult } from './store'
import type { PlaceBounds } from './placeData'
import type { PlaceChoice } from './shell/placeDialog'
import { placeFromKey, placeKey, type PlaceRef } from './places'
import { fitPlacementsToRoom } from './fitToRoom'

export interface PlaceControllerDeps {
  store: { design(): DesignState }
  history: { do(intent: Intent, label?: string): DispatchResult; clear(): void }
  /** The new place's footprint and floor (« Garder le matériel » fits the rig into it). */
  bounds(place: PlaceRef): Promise<PlaceBounds>
  /** « Garder le matériel » / « Repartir à vide » / « Annuler ». */
  confirm(): Promise<PlaceChoice>
  /** Called once a change is about to be dispatched (the shell shows the canvas). */
  onCommit?(): void
  /** History entry label. */
  label: string
}

const emptyDesign = (roomId: string): DesignState => ({ roomId, rig: { instances: [], connections: [], controls: {} }, placements: [] })
const keyOf = (roomId: string | null): string | null => (roomId === null ? null : placeKey(placeFromKey(roomId)))

export function createPlaceController(d: PlaceControllerDeps): { choosePlace(key: string): Promise<void>; requestPlace(key: string): Promise<void> } {
  let busy: Promise<void> | null = null
  const guarded = (run: () => Promise<void>): Promise<void> => {
    if (busy) return busy
    const p = run().finally(() => {
      busy = null
    })
    busy = p
    return p
  }

  const commit = async (key: string, mode: 'keep' | 'empty'): Promise<void> => {
    const place = placeFromKey(key)
    const k = placeKey(place)
    const current = d.store.design()
    const first = current.roomId === null
    if (keyOf(current.roomId) === k && (mode === 'keep' || current.rig.instances.length === 0)) return
    d.onCommit?.()
    let next: DesignState
    if (mode === 'empty') next = emptyDesign(k)
    else {
      const b = await d.bounds(place)
      next = fitPlacementsToRoom({ ...d.store.design(), roomId: k }, b, b.floorAt)
    }
    const r = d.history.do({ type: 'APPLY_DESIGN', design: next }, d.label)
    if (!r.ok) {
      console.warn('[creation] changement de lieu refusé', r.error)
      return
    }
    if (first) d.history.clear() // the session starts at its first place
  }

  return {
    /** Commit a place with an empty rig, no dialog. */
    choosePlace: (key) => guarded(() => commit(key, 'empty')),
    /** The user path: asks keep / empty / cancel when the rig has gear. */
    requestPlace: (key) =>
      guarded(async () => {
        const current = d.store.design()
        if (keyOf(current.roomId) === placeKey(placeFromKey(key))) return
        if (current.rig.instances.length === 0) return commit(key, 'empty')
        const choice = await d.confirm()
        if (choice !== 'cancel') await commit(key, choice)
      }),
  }
}
