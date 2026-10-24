/**
 * Mode Création composition root (C1, C3, C5): the store, the history, the
 * view state and the SceneHost (the page's only Babylon Engine). The scene is
 * reconciled from the store on every change; a place change is an undoable
 * APPLY_DESIGN (C5 snapshot entry) and never reloads the page.
 * Legacy tokens are not injected: the shell has its own (`--cr-*`, Task 7)
 * and its own layout (menubar, Projet, viewport, Propriétés, status bar).
 */
import catalogJson from '../../content/catalog.json'
import roomIndexJson from '../../content/rooms/index.json'
import { Vector3 } from '@babylonjs/core'
import { loadCatalog } from '../engine/CatalogLoader'
import { projectToScreen } from '../scene/project'
import { DisposableBag } from '../util/disposable'
import { COPY } from './copy'
import { CreationStore, creationEvaluator } from './store'
import { History } from './history'
import { ViewState } from './viewState'
import { RenderScheduler, renderSceneOnce } from './renderScheduler'
import { SceneHost } from './sceneHost'
import { placeFromKey, placeKey } from './places'
import { loadPlaceData } from './placeData'
import { createPlaceController } from './placeController'
import { bodyCentreOf, frameOf } from './debug'
import { nextDevice } from './deviceCycle'
import { mountCreationKeyboard } from './input/keyboard'
import { bindingLabel, loadCreationBindings, type CreationAction } from './input/creationActions'
import { mountPlacePickerStub } from './shell/placePickerStub'
import { openPlaceDialog } from './shell/placeDialog'
import { mountShell } from './shell/layout'
import { mountMenuBar } from './shell/menuBar'
import { buildMenus } from './shell/menuModel'
import { injectCreationTokens } from '../design/creationTokens'
// Self-hosted fonts (P12, OFL), bundled same-origin.
import '@fontsource/tektur/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'

const roomName = (id: string): string => (roomIndexJson as { rooms: { id: string; name_fr: string }[] }).rooms.find((r) => r.id === id)?.name_fr ?? id

export async function bootCreation(): Promise<void> {
  injectCreationTokens()
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
  const shell = mountShell(document, canvas)
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
  // Temporary until Task 12: three hard-coded places.
  const places = [
    { key: 'room:concert-hall-medium', label: roomName('concert-hall-medium') },
    { key: 'room:bar-club-stage-small', label: roomName('bar-club-stage-small') },
    { key: 'blank', label: COPY.picker!.blank! },
  ]
  const placeLabel = (key: string | null): string => {
    const k = placeKey(placeFromKey(key))
    const room = /^room:(.+)$/.exec(k)
    return places.find((p) => p.key === k)?.label ?? (room ? roomName(room[1]) : k.replace(/^set:/, ''))
  }

  let canvasShown = false
  const showStatus = (): void => {
    if (!canvasShown) return shell.setStatus('', COPY.shell!.statusNoPlace!)
    const label = placeLabel(store.design().roomId)
    shell.setStatus(label, COPY.shell!.statusReady!, 'ready')
    shell.setTreePlace(label)
  }
  const deviceIds = (): string[] => store.design().rig.instances.map((i) => i.instanceId)
  store.subscribe(() => {
    host.apply(store.design())
    scheduler.invalidate()
    showStatus()
    // A selected device that left the rig (REMOVE, undo of its SPAWN) is no longer selected.
    const sel = viewState.get().selection
    if (sel !== null && !deviceIds().includes(sel)) viewState.set({ selection: null })
  })

  // Panels fold / unfold and the window resizes: the canvas follows its box.
  const resize = new ResizeObserver(() => {
    host.engine.resize()
    scheduler.invalidate()
  })
  resize.observe(shell.viewport)

  const showCanvas = (): void => {
    if (canvasShown) return
    canvasShown = true
    canvas.style.display = ''
    host.engine.resize()
    const fromPicker = shell.viewport.contains(document.activeElement)
    picker.hide()
    if (fromPicker) canvas.focus() // the focused picker button just disappeared
  }

  const { choosePlace, requestPlace } = createPlaceController({
    store,
    history,
    bounds: (place) => loadPlaceData(place),
    confirm: () => openPlaceDialog(),
    onCommit: showCanvas,
    label: COPY.place!.dialogTitle!,
  })

  const pick = (key: string): void => {
    shell.setStatus(canvasShown ? placeLabel(store.design().roomId) : '', COPY.shell!.statusLoading!, 'busy')
    requestPlace(key).then(showStatus, (e: unknown) => {
      console.error('[creation] place change failed', e)
      showStatus()
    })
  }
  const picker = mountPlacePickerStub(places, pick, shell.viewport)

  // ── Keyboard (Task 8, C10, P3): one window listener for the page's lifetime.
  const shellBag = new DisposableBag()
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null // blocked storage: the default key map
  }
  const keys = mountCreationKeyboard({ bag: shellBag, bindings: loadCreationBindings(storage), canvas })
  const placeNow = (): string => (canvasShown ? placeLabel(store.design().roomId) : '')
  const deviceLabel = (id: string): string => {
    const deviceId = store.design().rig.instances.find((i) => i.instanceId === id)?.deviceId
    return (deviceId && registry.deviceById.get(deviceId)?.label) || id
  }
  const cycle = (dir: 1 | -1): boolean => {
    const next = nextDevice(deviceIds(), viewState.get().selection, dir)
    if (next === null) {
      shell.setStatus(placeNow(), COPY.shell!.statusNothingToSelect!, 'idle')
      return true
    }
    viewState.set({ selection: next })
    shell.setStatus(placeNow(), COPY.shell!.statusSelected!.replace('{device}', deviceLabel(next)), 'ready')
    return true // the camera follows in Task 9 (focus flight)
  }
  const frameSelection = (): boolean => {
    const sel = viewState.get().selection
    const inst = sel ? host.instance(sel) : undefined
    if (!inst || !host.rig) return false
    host.rig.flyToDevice(frameOf(inst))
    scheduler.invalidate()
    return true
  }
  keys.onAction('UNDO', () => history.undo())
  keys.onAction('REDO', () => history.redo())
  keys.onAction('NEXT_DEVICE', () => cycle(1))
  keys.onAction('PREV_DEVICE', () => cycle(-1))
  keys.onAction('FRAME_SELECTION', frameSelection)
  keys.onAction('CANCEL', (e) => {
    if (e.target !== canvas || viewState.get().selection === null) return false
    viewState.set({ selection: null })
    shell.setStatus(placeNow(), COPY.shell!.statusNoSelection!, 'ready')
    return true
  })
  /** Menu item ids → the key map (the menus show the live labels). */
  const MENU_KEYS: Record<string, CreationAction | undefined> = {
    undo: 'UNDO',
    redo: 'REDO',
    save: 'SAVE',
    inventory: 'TOGGLE_INVENTORY',
    shortcuts: 'TOGGLE_HELP',
  }
  const menuShortcut = (id: string): string | undefined => {
    const a = MENU_KEYS[id]
    return (a && bindingLabel(keys.bindings, a)) || undefined
  }

  // Menus: an item is live once its action is registered (features land task by task).
  const siteHref = (document.getElementById('site-link') as HTMLAnchorElement | null)?.href ?? '/'
  const actions: Record<string, () => void> = {
    'panel-tree': () => shell.setPanel('tree'),
    'panel-props': () => shell.setPanel('props'),
    site: () => location.assign(siteHref),
  }
  for (const p of places) actions[`place:${p.key}`] = () => pick(p.key)
  mountMenuBar(shell.menus, () =>
    buildMenus({
      history,
      actions,
      bindingLabel: menuShortcut,
      places,
    }),
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
