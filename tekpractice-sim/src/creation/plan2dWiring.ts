/**
 * The 2D schema page in Mode Création (mission 2, spec §1 and §2), behind the `plan2d` switch. boot.ts wires it only when `FEATURES.plan2d` is on and the address
 * is a practice one (an exam address has no menu entry and nothing of it runs).
 *
 * - The page's code (src/plan2d/, one lazy chunk) is fetched the first time the learner opens it (Vue › « Schéma 2D »), never at boot.
 * - It opens on the place on screen (its key, name, size and outline) and the project's name (its plan's own storage key); it is never given the 3D store,
 *   the 3D history or the scene, so it cannot change them.
 * - Closing it (« Fermer », Échap) returns the focus to the 3D view; the plan stays saved for the next time.
 * - It re-reads the address at each open: a page pushed to an exam address while it runs opens nothing.
 * - Stage 2 (« Envoyer dans la scène 3D »): the page is lent a send target, read at each open from spawnTarget: closures over the 3D store and history that
 *   boot.ts builds (a copy of the design, the floor, history.doAll, the replace path, select and frame), never the store or the history themselves.
 */
import type { Registry } from '../engine/CatalogLoader'
import { loadPlaceData, type PlaceData } from './placeData'
import { placeFromKey } from './places'
import type { SpawnTarget } from '../plan2d/spawn3d'

export interface Plan2dWiringDeps {
  doc: Document
  registry: Registry
  /** The place on screen (`DesignState.roomId`), or null when none is. */
  placeKey(): string | null
  placeName(key: string): string
  projectName(): string | null
  storage(): Storage | null
  /** The address is a practice one NOW (never in an exam). */
  practiceNow(): boolean
  returnFocus(): void
  /** Stage 2: what « Envoyer dans la scène 3D » may do in the 3D page now; null (or absent) = the page has no such button. */
  spawnTarget?(): SpawnTarget | null
  /** Tests: the place's data and the page module. */
  loadPlace?(key: string): Promise<PlaceData>
  load?(): Promise<typeof import('../plan2d/view')>
}

export interface Plan2dWiring {
  /** Opens the page (resolves when it has closed). */
  open(): Promise<void>
  readonly isOpen: boolean
}

export function wirePlan2d(d: Plan2dWiringDeps): Plan2dWiring {
  let busy = false
  const load = d.load ?? (() => import('../plan2d/view'))
  const loadPlace = d.loadPlace ?? ((key: string) => loadPlaceData(placeFromKey(key)))
  return {
    get isOpen() {
      return busy
    },
    async open() {
      if (busy || !d.practiceNow()) return
      const key = d.placeKey()
      if (key === null) return
      busy = true
      try {
        const [m, place] = await Promise.all([load(), loadPlace(key)])
        if (!d.practiceNow()) return
        const page = m.openPlan2dPage({
          doc: d.doc,
          registry: d.registry,
          room: { key, name: d.placeName(key), width: place.width, length: place.length, outline: m.outlineOf(place) },
          storage: d.storage(),
          projectName: d.projectName(),
          spawn: d.spawnTarget?.() ?? null,
        })
        await page.closed
      } catch (e) {
        console.warn('[creation] Schéma 2D indisponible', e instanceof Error ? e.message : e)
      } finally {
        busy = false
        d.returnFocus()
      }
    },
  }
}
