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
import { createPlaceController, type PlaceResult } from './placeController'
import { designFromRoomGear, unavailableList } from './templateGear'
import { loadTemplates, templateToDesign } from './templates'
import { mountNotes } from './shell/notes'
import { bodyCentreOf } from './debug'
import { debugBodyCenter } from '../scene/debugBody'
import { cableKey } from './sceneDiff'
import { attachCanvasPicking, createSelection, pickDevice } from './selection'
import { mountProjectTree } from './shell/projectTree'
import { mountPropertiesPanel } from './shell/propertiesPanel'
import { buildTree, hideKeyOf, type TreeNode } from './shell/treeModel'
import { nextDevice } from './deviceCycle'
import { mountCreationKeyboard } from './input/keyboard'
import { bindingLabel, loadCreationBindings, type CreationAction } from './input/creationActions'
import { openPlaceDialog, openReplaceDialog } from './shell/placeDialog'
import type { PlaceCard } from './shell/placePicker'
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
  // « Choisir un lieu » (Task 12): its own lazy chunk (cards, grid keys) and the templates, fetched together.
  const [{ placeCards, templateCards, mountPlacePicker, placeSummary }, allTemplates] = await Promise.all([import('./shell/placePicker'), loadTemplates()])
  const summary = placeSummary()
  const cards = placeCards({ rooms: summary.rooms, sets: summary.sets })
  const placeKeys = new Set(cards.map((c) => c.key))
  // A template whose place is not a card is left out (warned), as parseTemplate does with `placeKeys`.
  const templates = allTemplates.filter((t) => placeKeys.has(t.roomId) || (console.warn(`[creation] modèle ${t.id} ignoré : lieu inconnu ${t.roomId}`), false))
  const placeLabel = (key: string | null): string => {
    const k = placeKey(placeFromKey(key))
    const room = /^room:(.+)$/.exec(k)
    // a key that is not a card (an unknown room) still reads as its id
    return cards.find((p) => p.key === k)?.title ?? (room ? roomName(room[1]) : k.replace(/^set:/, ''))
  }
  const notes = mountNotes(document, shell.viewport)

  let canvasShown = false
  const showStatus = (): void => {
    if (!canvasShown) return shell.setStatus('', COPY.shell!.statusNoPlace!)
    shell.setStatus(placeLabel(store.design().roomId), COPY.shell!.statusReady!, 'ready')
  }
  const placeNow = (): string => (canvasShown ? placeLabel(store.design().roomId) : '')
  const deviceIds = (): string[] => store.design().rig.instances.map((i) => i.instanceId)
  const deviceLabel = (id: string): string => {
    const deviceId = store.design().rig.instances.find((i) => i.instanceId === id)?.deviceId
    return (deviceId && registry.deviceById.get(deviceId)?.label) || id
  }

  // ── Selection (Task 9): one state for the tree, a click in the 3D view and [ / ].
  const selection = createSelection({
    viewState,
    host,
    invalidate: () => scheduler.invalidate(),
    onSelect: (id) =>
      shell.setStatus(placeNow(), id ? COPY.shell!.statusSelected!.replace('{device}', deviceLabel(id)) : COPY.shell!.statusNoSelection!, 'ready', true),
  })

  // ── « Projet » tree (Task 9, C10): rebuilt on store / view-state / place changes, never polled.
  /** A zone or cable row last activated (aria-selected while no device is selected). */
  let treeActive: string | null = null
  const zones = (): { id: string; kind: string }[] => (canvasShown ? (host.layout?.zones ?? []).map((z) => ({ id: z.id, kind: z.kind })) : [])
  const treeNodes = (): TreeNode[] =>
    buildTree({
      placeLabel: placeNow(),
      zones: zones(),
      design: store.design(),
      deviceLabel: (deviceId) => registry.deviceById.get(deviceId)?.label ?? deviceId,
      points: [],
    })
  const nodeLabel = (key: string): string => {
    const find = (list: TreeNode[]): TreeNode | undefined => list.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => hideKeyOf(n) === key)
    return find(treeNodes())?.label ?? key
  }
  const tree = mountProjectTree({
    doc: document,
    container: shell.treeBody,
    nodes: treeNodes,
    selectedId: () => {
      const sel = viewState.get().selection
      return sel ? `device:${sel}` : treeActive
    },
    isHidden: (key) => viewState.get().hidden.includes(key),
    activate: (node) => {
      if (node.kind === 'device') {
        treeActive = null
        selection.select(node.target!.instanceId!)
      } else if (node.kind === 'zone' || node.kind === 'cable') {
        if (!selection.flyToKey(node.id)) return
        treeActive = node.id
        tree.render()
        shell.setStatus(placeNow(), COPY.tree!.statusFramed!.replace('{item}', node.label), 'ready', true)
      } else if (node.kind === 'lieu' && host.rig) {
        // The place row: back to the overview.
        treeActive = null
        selection.select(null)
        host.rig.flyToEnsemble()
        scheduler.invalidate()
      }
    },
    toggleHidden: (_node, key) => {
      const hidden = viewState.get().hidden
      const now = !hidden.includes(key)
      viewState.set({ hidden: now ? [...hidden, key] : hidden.filter((k) => k !== key) })
      shell.setStatus(placeNow(), (now ? COPY.tree!.statusHidden! : COPY.tree!.statusShown!).replace('{item}', nodeLabel(key)), 'ready', true)
    },
  })
  // ── « Propriétés » (Task 10): the selection's pose, controls and cables, edited through history.do only.
  const props = mountPropertiesPanel({
    doc: document,
    container: shell.propsBody,
    registry,
    history,
    design: () => store.design(),
    selection: () => viewState.get().selection,
    floorAt: (x, z) => host.layout?.floorAt(x, z) ?? 0,
    announce: (message) => shell.setStatus(placeNow(), message, 'ready', true),
  })
  viewState.subscribe(() => {
    const v = viewState.get()
    if (v.selection !== null) treeActive = null
    host.setSelected(v.selection)
    host.setHidden(v.hidden)
    tree.render()
    props.render()
  })
  host.onPlaceShown = () => {
    // Hidden zones of the previous place do not carry over.
    const ids = new Set(zones().map((z) => `zone:${z.id}`))
    const hidden = viewState.get().hidden.filter((k) => !k.startsWith('zone:') || ids.has(k))
    viewState.set({ hidden })
    tree.render()
  }

  store.subscribe(() => {
    host.apply(store.design())
    scheduler.invalidate()
    showStatus()
    // A selected device that left the rig (REMOVE, undo of its SPAWN) is no longer selected.
    const v = viewState.get()
    const ids = deviceIds()
    const sel = v.selection !== null && !ids.includes(v.selection) ? null : v.selection
    // Hidden devices / cables that left the rig are forgotten (a new one with the same id shows).
    const cables = new Set(store.design().rig.connections.map((c) => `cable:${cableKey(c.a, c.b)}`))
    const hidden = v.hidden.filter((k) => (k.startsWith('cable:') ? cables.has(k) : k.startsWith('zone:') || ids.includes(k)))
    if (treeActive?.startsWith('cable:') && !cables.has(treeActive)) treeActive = null
    const viewChanged = sel !== v.selection || hidden.length !== v.hidden.length
    if (viewChanged) viewState.set({ selection: sel, hidden }) // its subscriber rebuilds the tree and Propriétés
    else {
      tree.render() // one rebuild per store change, never two
      props.render()
    }
  })

  // Panels fold / unfold and the window resizes: the canvas follows its box.
  const resize = new ResizeObserver(() => {
    host.engine.resize()
    scheduler.invalidate()
  })
  resize.observe(shell.viewport)

  /** A place is committed: the canvas shows, the picker goes (focus follows to the canvas if it was in the picker). */
  const showCanvas = (): void => {
    if (!canvasShown) {
      canvasShown = true
      canvas.style.display = ''
      host.engine.resize()
    }
    if (!picker.isOpen) return
    const fromPicker = picker.root.contains(document.activeElement)
    picker.hide()
    if (fromPicker) canvas.focus() // the focused card just disappeared
  }

  const { choosePlace, requestPlace, loadDesign } = createPlaceController({
    store,
    history,
    bounds: (place) => loadPlaceData(place),
    confirm: () => openPlaceDialog(),
    confirmReplace: () => openReplaceDialog(undoLabel()),
    onCommit: showCanvas,
    label: COPY.place!.dialogTitle!,
  })
  /** The live label of the undo key (« Ctrl+Z »), for the replace dialog and its status line. */
  const undoLabel = (): string => bindingLabel(keys.bindings, 'UNDO') || 'Ctrl+Z'

  // Not only the console (Task 12): a place that fell back to the blank room says so on screen.
  const N = COPY.note!
  const fallbackNote = (key: string): void => {
    const msg = N.fallbackBody!.replace('{place}', placeLabel(key))
    notes.show({ id: 'fallback', title: N.fallbackTitle!, body: msg })
    if (picker.isOpen) picker.showError(msg) // the note sits under the picker while it is open
    shell.setStatus(placeNow(), msg, 'ready', true)
  }
  host.onFallback = fallbackNote

  /** The picker's choice → the place change; the picker stays open on cancel / busy / failure. */
  const pick = async (card: PlaceCard, mode: 'empty' | 'gear'): Promise<void> => {
    shell.setStatus(canvasShown ? placeLabel(store.design().roomId) : '', COPY.shell!.statusLoading!, 'busy')
    picker.setBusy(true)
    let missing: string[] = []
    let result: PlaceResult = 'failed'
    const isTemplate = card.key.startsWith('template:')
    const hadGear = store.design().rig.instances.length > 0
    try {
      const tpl = isTemplate ? templates.find((t) => `template:${t.id}` === card.key) : undefined
      if (tpl) result = await loadDesign(tpl.roomId, async () => templateToDesign(tpl))
      else if (mode === 'gear')
        result = await loadDesign(card.key, async () => {
          const data = await loadPlaceData(placeFromKey(card.key))
          if (data.kind !== 'room') throw new Error('salle indisponible')
          const plan = designFromRoomGear(data.file, registry)
          missing = unavailableList(plan.unavailable, summary.gearNames)
          return plan.design
        })
      else result = await requestPlace(card.key)
    } catch (e) {
      console.error('[creation] place change failed', e)
    } finally {
      picker.setBusy(false)
    }
    if (result === 'busy') return shell.setStatus(placeNow(), COPY.shell!.statusBusy!, 'busy', true)
    if (result === 'failed') {
      // Said where the learner is: the picker stays open over an inert viewport (review fix 2).
      const msg = COPY.picker!.openFailed!.replace('{place}', card.title)
      if (picker.isOpen) picker.showError(msg)
      return shell.setStatus(placeNow(), msg, 'ready', true)
    }
    if (result === 'cancelled') return showStatus()
    showCanvas() // 'done' / 'same'
    showStatus()
    notes.dismiss('unavailable')
    if (result === 'done' && (isTemplate || mode === 'gear')) {
      const n = String(store.design().rig.instances.length)
      // The note is announced too (status bar, role="status"), not only shown.
      const more = missing.length ? ` ${N.unavailableTitle} : ${missing.join(', ')}.` : ''
      const head = hadGear ? COPY.shell!.statusReplaced!.replace('{n}', n).replace('{undo}', undoLabel()) : COPY.shell!.statusGearLoaded!.replace('{n}', n)
      shell.setStatus(placeNow(), head + more, 'ready', true)
    }
    if (missing.length)
      notes.show({ id: 'unavailable', title: N.unavailableTitle!, body: N.unavailableBody!.replace('{n}', String(missing.length)), items: missing })
  }
  const picker = mountPlacePicker({
    doc: document,
    parent: shell.root,
    covers: [shell.tree, shell.viewport, shell.props],
    places: cards,
    templates: templateCards(
      templates.map((t) => ({ id: t.id, name_fr: t.name_fr, roomId: t.roomId, devices: t.instances.length })),
      cards,
    ),
    thumbBase: `${import.meta.env.BASE_URL}room-thumbs/`,
    onChoose: (card, mode) => void pick(card, mode),
  })
  picker.show({ closable: false, focus: false }) // first visit (no autosave yet, C16)
  // While the picker covers the workspace, « Aller à la vue 3D » lands on its highlighted card.
  document.querySelector<HTMLAnchorElement>('[data-testid="skip-link"]')?.addEventListener('click', (e) => {
    if (!picker.isOpen) return
    e.preventDefault()
    e.stopImmediatePropagation()
    picker.focus()
  })

  // ── Keyboard (Task 8, C10, P3): one window listener for the page's lifetime.
  const shellBag = new DisposableBag()
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null // blocked storage: the default key map
  }
  const keys = mountCreationKeyboard({ bag: shellBag, bindings: loadCreationBindings(storage), canvas })
  const cycle = (dir: 1 | -1): boolean => {
    const next = nextDevice(deviceIds(), viewState.get().selection, dir)
    if (next === null) {
      shell.setStatus(placeNow(), COPY.shell!.statusNothingToSelect!, 'idle', true)
      return true
    }
    selection.select(next) // the camera follows (a cut under reduced motion)
    return true
  }
  // A stepper burst still open (600 ms) closes first, so it is the entry undone.
  keys.onAction('UNDO', () => {
    props.flush()
    return history.undo()
  })
  keys.onAction('REDO', () => {
    props.flush()
    return history.redo()
  })
  keys.onAction('NEXT_DEVICE', () => cycle(1))
  keys.onAction('PREV_DEVICE', () => cycle(-1))
  keys.onAction('FRAME_SELECTION', () => selection.frameSelection())
  keys.onAction('CANCEL', (e) => {
    if (e.target !== canvas || viewState.get().selection === null) return false
    selection.select(null)
    return true
  })
  // A click on a device body in the 3D view selects it and flies to it.
  attachCanvasPicking(canvas, shellBag, (x, y) => pickDevice(host.scene, x, y), selection)
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
    // Lieu → « Choisir un lieu… »: the picker over the current place (Fermer / Échap go back).
    'choose-place': () => picker.show({ closable: canvasShown, focus: true }),
  }
  mountMenuBar(shell.menus, () =>
    buildMenus({
      history,
      actions,
      bindingLabel: menuShortcut,
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
    deviceBodyCenter: (id) => {
      const inst = host.instance(id)
      return inst ? debugBodyCenter(inst) : null
    },
    visible: (id) => host.visible(id),
    outlined: () => host.outlined(),
    hidden: () => viewState.get().hidden,
    pickAt: (x, y) => pickDevice(host.scene, x, y),
    treeRenders: () => tree.renders,
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
