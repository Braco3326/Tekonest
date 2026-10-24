/**
 * Mode Création composition root (C1, C3, C5): the store, the history, the
 * view state and the SceneHost (the page's only Babylon Engine). The scene is
 * reconciled from the store on every change; a place change is an undoable
 * APPLY_DESIGN (C5 snapshot entry) and never reloads the page.
 * Legacy tokens are not injected (the shell has its own, Task 7).
 */
import catalogJson from '../../content/catalog.json'
import roomIndexJson from '../../content/rooms/index.json'
import { Vector3 } from '@babylonjs/core'
import { loadCatalog } from '../engine/CatalogLoader'
import { projectToScreen } from '../scene/project'
import { DisposableBag } from '../util/disposable'
import type { DesignState } from '../trials/trial'
import { COPY } from './copy'
import { CreationStore, creationEvaluator } from './store'
import { History } from './history'
import { ViewState } from './viewState'
import { RenderScheduler, renderSceneOnce } from './renderScheduler'
import { SceneHost } from './sceneHost'
import { placeFromKey, placeKey } from './places'
import { loadPlaceData } from './placeData'
import { fitPlacementsToRoom } from './fitToRoom'
import { bodyCentreOf } from './debug'
import { mountPlacePickerStub } from './shell/placePickerStub'
import { openPlaceDialog } from './shell/placeDialog'

const emptyDesign = (roomId: string): DesignState => ({ roomId, rig: { instances: [], connections: [], controls: {} }, placements: [] })

const roomName = (id: string): string => (roomIndexJson as { rooms: { id: string; name_fr: string }[] }).rooms.find((r) => r.id === id)?.name_fr ?? id

export async function bootCreation(): Promise<void> {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
  canvas.style.display = 'none' // shown once a place is chosen

  const registry = loadCatalog(catalogJson)
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  const viewState = new ViewState()
  // `host` is assigned right below; the hooks only run once the render loop does.
  // eslint-disable-next-line prefer-const
  let host: SceneHost
  const scheduler: RenderScheduler = new RenderScheduler({
    render: () => {
      const scene = host.scene
      if (scene) renderSceneOnce(scene, () => scheduler.invalidate())
    },
    camera: () => (host.camera && host.scene?.activeCamera === host.camera ? host.camera : null),
    tweening: () => host.rig?.tweening ?? false,
    activeCamera: () => host.scene?.activeCamera ?? null,
  })
  host = new SceneHost(canvas, registry, scheduler)
  store.subscribe(() => {
    host.apply(store.design())
    scheduler.invalidate()
  })

  let canvasShown = false
  const showCanvas = (): void => {
    if (canvasShown) return
    canvasShown = true
    canvas.style.display = ''
    host.engine.resize()
    picker.compact()
  }

  /** Commit a place: « Garder le matériel » fits the rig into it, « Repartir à vide » empties it. */
  const commitPlace = async (key: string, mode: 'keep' | 'empty'): Promise<void> => {
    const place = placeFromKey(key)
    const k = placeKey(place)
    const current = store.design()
    const same = current.roomId !== null && placeKey(placeFromKey(current.roomId)) === k
    if (same && (mode === 'keep' || current.rig.instances.length === 0)) return
    showCanvas()
    let next: DesignState
    if (mode === 'empty') next = emptyDesign(k)
    else {
      const data = await loadPlaceData(place)
      next = fitPlacementsToRoom({ ...store.design(), roomId: k }, data, data.floorAt)
    }
    const r = history.do({ type: 'APPLY_DESIGN', design: next }, COPY.place!.dialogTitle!)
    if (!r.ok) console.warn('[creation] changement de lieu refusé', r.error)
  }
  const choosePlace = (key: string): Promise<void> => commitPlace(key, 'empty')
  const requestPlace = async (key: string): Promise<void> => {
    const current = store.design()
    if (current.roomId !== null && placeKey(placeFromKey(current.roomId)) === placeKey(placeFromKey(key))) return
    if (current.rig.instances.length === 0) return commitPlace(key, 'empty')
    const choice = await openPlaceDialog()
    if (choice !== 'cancel') await commitPlace(key, choice)
  }

  // Temporary until Task 12: three hard-coded places.
  const picker = mountPlacePickerStub(
    [
      { key: 'room:concert-hall-medium', label: roomName('concert-hall-medium') },
      { key: 'room:bar-club-stage-small', label: roomName('bar-club-stage-small') },
      { key: 'blank', label: COPY.picker!.blank! },
    ],
    (key) => void requestPlace(key).catch((e: unknown) => console.error('[creation] place change failed', e)),
  )

  const screen = (world: Vector3 | null): { x: number; y: number } | null => {
    const { scene, camera } = host
    return world && scene && camera ? projectToScreen(world, scene, camera, host.engine, canvas) : null
  }
  window.__creation = {
    dispatch: (intent) => history.do(intent),
    design: () => store.design(),
    events: () => store.events(),
    undo: () => history.undo(),
    redo: () => history.redo(),
    historySize: () => history.sizes.undo,
    renders: () => scheduler.renders,
    camera: () => {
      const c = host.camera
      return c ? { alpha: c.alpha, beta: c.beta, radius: c.radius, target: [c.target.x, c.target.y, c.target.z] } : null
    },
    scenes: () => host.engine.scenes.length,
    meshCount: () => host.scene?.meshes.length ?? 0,
    liveListeners: () => DisposableBag.liveListeners,
    place: () => (host.place ? placeKey(host.place) : null),
    selection: () => viewState.get().selection,
    deviceScreen: (id) => {
      const inst = host.instance(id)
      return inst ? screen(bodyCentreOf(inst)) : null
    },
    portScreen: (ref) => screen(host.portWorld(ref)),
    worldScreen: (p) => screen(Vector3.FromArray(p)),
    choosePlace,
    requestPlace,
  }
}
