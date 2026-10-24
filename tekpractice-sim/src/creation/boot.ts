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
import { attachCanvasHover, attachCanvasPicking, createSelection, pickDevice } from './selection'
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
import {
  AUTOSAVE_KEY,
  PROJECTS_KEY,
  createAutosave,
  designFingerprint,
  exportBundle,
  isDirty,
  isForeignWrite,
  loadAutosave,
  loadProject,
  newStamp,
  readProjectList,
  readQuarantine,
  saveProject,
  setAsideAutosave,
  type ProjectList,
  type QuarantineItem,
  type SaveResult,
} from './persistence'
import { openNameDialog, openProjectList } from './shell/projectDialogs'
import { ProjectSession, type ProjectState } from './projectSession'
import { openChoiceDialog } from './shell/placeDialog'
import { mountStatusBar } from './shell/statusBar'
import {
  autosaveView,
  rejectionOf,
  ruleTextFor,
  statusView,
  type AutosavePause,
  type Rejection,
  type RuleRow,
  type StatusView,
} from './shell/statusModel'
// Self-hosted fonts (P12, OFL), bundled same-origin.
import '@fontsource/tektur/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'

const roomName = (id: string): string =>
  (roomIndexJson as { rooms: { id: string; name_fr: string }[] }).rooms.find((r) => r.id === id)
    ?.name_fr ?? id

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
  const [{ placeCards, templateCards, mountPlacePicker, placeSummary }, allTemplates] =
    await Promise.all([import('./shell/placePicker'), loadTemplates()])
  const summary = placeSummary()
  const cards = placeCards({ rooms: summary.rooms, sets: summary.sets })
  const placeKeys = new Set(cards.map((c) => c.key))
  // A template whose place is not a card is left out (warned), as parseTemplate does with `placeKeys`.
  const templates = allTemplates.filter(
    (t) =>
      placeKeys.has(t.roomId) ||
      (console.warn(`[creation] modèle ${t.id} ignoré : lieu inconnu ${t.roomId}`), false)
  )
  const placeLabel = (key: string | null): string => {
    const k = placeKey(placeFromKey(key))
    const room = /^room:(.+)$/.exec(k)
    // a key that is not a card (an unknown room) still reads as its id
    return (
      cards.find((p) => p.key === k)?.title ?? (room ? roomName(room[1]) : k.replace(/^set:/, ''))
    )
  }
  const notes = mountNotes(document, shell.viewport)

  // ── Status bar (Task 14, CA-15, C17): selection, snapping, autosave state, signal + the persistent error list.
  const ruleText = ruleTextFor(registry.catalog.rules as readonly RuleRow[])
  /** The rule events of the last store change (the count changes on store changes only). */
  let events = store.events()
  /** Cables in the rig at the last store change (0 → « Rien de branché »). */
  let connections = 0
  /** The last refused connection: listed first until a valid connection, a new design, or its device leaves. */
  let lastRejection: Rejection | null = null
  const statusBar = mountStatusBar({
    doc: document,
    bar: shell.status,
    root: shell.root,
    portLabel: (p) => `${deviceLabel(p.instance)} (${p.instance}) · ${p.port}`,
    pick: (e) => {
      const id = e.ports.map((p) => p.instance).find((i) => deviceIds().includes(i))
      if (id) selection.select(id)
    },
    autosaveAction: (a) =>
      a === 'export' ? exportKept() : a === 'checked' ? checkedFile() : resumeHere(),
  })
  const refreshSignal = (): StatusView => {
    const sel = viewState.get().selection
    const v = statusView({
      selectionLabel: sel === null ? null : `${deviceLabel(sel)} (${sel})`,
      // snapFree: omitted until placement snapping exists (no « Aimantation » text meanwhile).
      events,
      lastRejection,
      ruleText,
      connections,
      // playbackReady: false until the signal path feeds it (Task 34): « Signal OK » only for a playable chain (L5).
      playbackReady: false,
    })
    statusBar.render(v)
    return v
  }
  history.onRefused((intent, r) => {
    if (intent.type !== 'CONNECT') return
    lastRejection = rejectionOf(r.error, r.subjects, ruleText)
    refreshSignal()
    shell.setStatus(
      placeNow(),
      COPY.status!.statusRefused!.replace('{title}', lastRejection.title),
      'ready',
      true
    )
  })

  // ── Project (Task 13, C16): per-origin localStorage, name, dirty marker, autosave.
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null // blocked storage: default key map, no autosave, a persistent notice
  }
  const PJ = COPY.project!
  let projectName: string | null = null
  let savedFp: string | null = null
  /** The stamp of `projectName`'s stored row when this tab last read or wrote it (two-tab check); null = not stored. */
  let projectStamp: string | null = null
  /**
   * The project name travels with the rig through undo / redo of « Ouvrir » / « Nouveau » (review CRITICAL);
   * its fingerprint and stamp come from this tab's latest save / open of that name (re-review), never from the entry.
   */
  type ProjectMeta = { name: string | null }
  const session = new ProjectSession()
  const projectMeta = (): ProjectMeta => ({ name: projectName })
  const sync = (): void => {
    ;({ name: projectName, savedFp, stamp: projectStamp } = session.state)
  }
  const setProject = (m: ProjectState): void => {
    session.set(m)
    sync()
  }
  /** Unreadable data that could not be set aside (quarantine full): held here until the learner exports it. */
  const pending: QuarantineItem[] = []
  /** Autosave may write: false when storage is blocked, or while `pending` data would be overwritten. */
  let autosaveOn = true
  /** The autosave is off only until the learner exports `pending`. */
  let pendingStoppedAutosave = false
  /** The unreadable project list this tab exported (a save may then start a new list). */
  let exportedList: string | undefined
  const dirty = (): boolean => isDirty(store.design(), savedFp)
  const refreshTitle = (): void => {
    const d = dirty()
    document.title =
      (d ? '* ' : '') + PJ.docTitle!.replace('{name}', projectName ?? PJ.untitledDoc!)
    shell.title.textContent = (d ? '* ' : '') + (projectName ?? COPY.shell!.untitled!)
    shell.title.dataset.dirty = String(d)
    if (d) {
      const sr = document.createElement('span')
      sr.className = 'cr-sr-only'
      sr.textContent = ` (${PJ.dirty})`
      shell.title.appendChild(sr)
    }
  }
  const blockedNote = (): void =>
    notes.show({ id: 'storage', title: PJ.blockedTitle!, body: PJ.blocked! })
  /** Data that could not be set aside: held for the export, never silently dropped; a note asks for the export. */
  const holdPending = (key: string, reason: string, raw: string, stopsAutosave: boolean): void => {
    if (!pending.some((p) => p.raw === raw))
      pending.push({ at: new Date().toISOString(), key, reason, raw })
    if (stopsAutosave) {
      autosaveOn = false
      pendingStoppedAutosave = true
      keptExported = false
    }
    notes.show({ id: 'kept-full', title: PJ.keptFullTitle!, body: PJ.keptFull! })
    // The note can be closed: the status bar keeps saying the autosave is paused, with « Exporter… » (Task 14).
    refreshAutosave()
  }
  // Autosave state shown in the status bar (Task 14): « Enregistré » / « Modifié » / « En pause ».
  /** A change is waiting for the autosave (scheduled, not yet written). */
  let autosavePending = false
  /** The browser refuses storage: the autosave cannot write at all. */
  let storageBlocked = storage === null
  /** The last autosave hit the quota (cleared by the next successful write). */
  let autosaveFull = false
  /** The held data was exported: the line now waits for « J’ai vérifié le fichier ». */
  let keptExported = false
  const autosavePause = (): AutosavePause => {
    if (pendingStoppedAutosave && !autosaveOn) return keptExported ? 'kept-exported' : 'kept'
    if (storageBlocked) return 'blocked'
    if (rawAutosave.paused) return 'other-tab'
    if (autosaveFull) return 'full'
    return null
  }
  const refreshAutosave = (): void =>
    statusBar.renderAutosave(
      autosaveView({ place: canvasShown, pending: autosavePending, pause: autosavePause() })
    )
  const rawAutosave = createAutosave({
    storage,
    busy: () => history.inTransaction,
    snapshot: () => {
      const design = store.design()
      if (!autosaveOn || design.roomId === null) return null // nothing worth keeping before a place
      return {
        version: 1,
        savedAt: new Date().toISOString(),
        name: projectName,
        design,
        savedFingerprint: savedFp,
        stamp: projectStamp,
      }
    },
    onResult: (r: SaveResult) => {
      if (r === 'ok') {
        autosavePending = false
        autosaveFull = false
        refreshAutosave()
        return notes.dismiss('autosave-full')
      }
      if (r === 'full') {
        autosaveFull = true
        notes.show({ id: 'autosave-full', title: PJ.blockedTitle!, body: PJ.autosaveFull! })
        shell.setStatus(placeNow(), PJ.autosaveFull!, 'ready', true)
      } else {
        storageBlocked = true
        blockedNote()
      }
      refreshAutosave()
    },
  })
  /** The autosave, with its state kept in the status bar. */
  const autosave = {
    schedule: (): void => {
      autosavePending = true
      rawAutosave.schedule()
      refreshAutosave()
    },
    flush: (): void => rawAutosave.flush(),
    cancel: (): void => {
      autosavePending = false
      rawAutosave.cancel()
      refreshAutosave()
    },
    pause: (): void => {
      rawAutosave.pause()
      refreshAutosave()
    },
    resume: (): void => {
      rawAutosave.resume()
      refreshAutosave()
    },
    get paused(): boolean {
      return rawAutosave.paused
    },
  }

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
      shell.setStatus(
        placeNow(),
        id
          ? COPY.shell!.statusSelected!.replace('{device}', deviceLabel(id))
          : COPY.shell!.statusNoSelection!,
        'ready',
        true
      ),
  })

  // ── « Projet » tree (Task 9, C10): rebuilt on store / view-state / place changes, never polled.
  /** A zone or cable row last activated (aria-selected while no device is selected). */
  let treeActive: string | null = null
  const zones = (): { id: string; kind: string }[] =>
    canvasShown ? (host.layout?.zones ?? []).map((z) => ({ id: z.id, kind: z.kind })) : []
  const treeNodes = (): TreeNode[] =>
    buildTree({
      placeLabel: placeNow(),
      zones: zones(),
      design: store.design(),
      deviceLabel: (deviceId) => registry.deviceById.get(deviceId)?.label ?? deviceId,
      points: [],
    })
  const nodeLabel = (key: string): string => {
    const find = (list: TreeNode[]): TreeNode | undefined =>
      list.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => hideKeyOf(n) === key)
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
        shell.setStatus(
          placeNow(),
          COPY.tree!.statusFramed!.replace('{item}', node.label),
          'ready',
          true
        )
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
      shell.setStatus(
        placeNow(),
        (now ? COPY.tree!.statusHidden! : COPY.tree!.statusShown!).replace(
          '{item}',
          nodeLabel(key)
        ),
        'ready',
        true
      )
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
    refreshSignal()
  })
  host.onPlaceShown = () => {
    // Hidden zones of the previous place do not carry over.
    const ids = new Set(zones().map((z) => `zone:${z.id}`))
    const hidden = viewState.get().hidden.filter((k) => !k.startsWith('zone:') || ids.has(k))
    viewState.set({ hidden })
    tree.render()
  }

  store.subscribe((change) => {
    host.apply(store.design())
    scheduler.invalidate()
    showStatus()
    // The error list follows the rig: the rule events now; the refused connection until a valid one (or a new design, or its device leaves).
    const before = events.filter((e) => e.severity === 'error').length
    events = store.events()
    const after = events.filter((e) => e.severity === 'error').length
    connections = store.design().rig.connections.length
    if (lastRejection) {
      const present = new Set(deviceIds())
      const cleared = change.intents.some((i) => i.type === 'CONNECT' || i.type === 'APPLY_DESIGN')
      if (cleared || !lastRejection.ports.every((p) => present.has(p.instance)))
        lastRejection = null
    }
    const sv = refreshSignal()
    // The count is said, not only shown, when a change adds or clears an error (never on a refresh with the same count).
    if (after !== before)
      shell.setStatus(placeNow(), `${COPY.status!.signalAnnounce} ${sv.signal.label}`, 'ready')
    // A selected device that left the rig (REMOVE, undo of its SPAWN) is no longer selected.
    const v = viewState.get()
    const ids = deviceIds()
    const sel = v.selection !== null && !ids.includes(v.selection) ? null : v.selection
    // Hidden devices / cables that left the rig are forgotten (a new one with the same id shows).
    const cables = new Set(store.design().rig.connections.map((c) => `cable:${cableKey(c.a, c.b)}`))
    const hidden = v.hidden.filter((k) =>
      k.startsWith('cable:') ? cables.has(k) : k.startsWith('zone:') || ids.includes(k)
    )
    if (treeActive?.startsWith('cable:') && !cables.has(treeActive)) treeActive = null
    const viewChanged = sel !== v.selection || hidden.length !== v.hidden.length
    if (viewChanged)
      viewState.set({ selection: sel, hidden }) // its subscriber rebuilds the tree and Propriétés
    else {
      tree.render() // one rebuild per store change, never two
      props.render()
    }
  })
  // Every rig change: the « * » marker now, the autosave 1 s later (after any open transaction commits).
  store.subscribe(() => {
    refreshTitle()
    autosave.schedule()
  })
  history.onChange(() => autosave.schedule()) // a burst's commit
  refreshTitle()

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
      refreshAutosave()
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
    shell.setStatus(
      canvasShown ? placeLabel(store.design().roomId) : '',
      COPY.shell!.statusLoading!,
      'busy'
    )
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
      const head = hadGear
        ? COPY.shell!.statusReplaced!.replace('{n}', n).replace('{undo}', undoLabel())
        : COPY.shell!.statusGearLoaded!.replace('{n}', n)
      shell.setStatus(placeNow(), head + more, 'ready', true)
    }
    if (missing.length)
      notes.show({
        id: 'unavailable',
        title: N.unavailableTitle!,
        body: N.unavailableBody!.replace('{n}', String(missing.length)),
        items: missing,
      })
  }
  const picker = mountPlacePicker({
    doc: document,
    parent: shell.root,
    covers: [shell.tree, shell.viewport, shell.props],
    places: cards,
    templates: templateCards(
      templates.map((t) => ({
        id: t.id,
        name_fr: t.name_fr,
        roomId: t.roomId,
        devices: t.instances.length,
      })),
      cards
    ),
    thumbBase: `${import.meta.env.BASE_URL}room-thumbs/`,
    onChoose: (card, mode) => void pick(card, mode),
  })
  /** Boot (C16): reopen the last autosave directly (not undoable, no picker), else the picker; say what happened. */
  const restore = (): boolean => {
    const loaded = loadAutosave(storage)
    if (loaded.status === 'blocked') {
      autosaveOn = false
      storageBlocked = true
      refreshAutosave()
      blockedNote()
      shell.setStatus('', PJ.blocked!, 'idle', true)
      return false
    }
    if (loaded.status === 'reset') {
      // Kept in the quarantine → start fresh. Not kept → held for the export, the autosave waits (never overwrites it).
      if (loaded.kept === 'kept')
        notes.show({ id: 'storage', title: PJ.reset!, body: PJ.resetBody! })
      else if (loaded.kept === 'full') holdPending(AUTOSAVE_KEY, loaded.reason, loaded.raw, true)
      else {
        autosaveOn = false
        storageBlocked = true
        refreshAutosave()
        blockedNote()
      }
      return false
    }
    if (loaded.status === 'empty' || loaded.data.design.roomId === null) return false
    const r = store.dispatch({ type: 'APPLY_DESIGN', design: loaded.data.design })
    // Reopening writes nothing (another tab with this project open must not hear a write).
    autosave.cancel()
    const lost = !r.ok || (r.dropped && Object.values(r.dropped).some((l) => l.length > 0))
    // What the store could not restore is set aside (or held for the export), never overwritten by the next autosave.
    if (lost) {
      const aside = setAsideAutosave(storage, r.ok ? 'dropped' : 'refused')
      if (aside.kept === 'full' && aside.raw !== null)
        holdPending(AUTOSAVE_KEY, r.ok ? 'dropped' : 'refused', aside.raw, true)
      else if (aside.kept === 'blocked') {
        autosaveOn = false
        storageBlocked = true
      }
    }
    if (!r.ok) {
      notes.show({ id: 'storage', title: PJ.reset!, body: PJ.resetBody! })
      return false
    }
    setProject({
      name: loaded.data.name,
      savedFp: loaded.data.savedFingerprint,
      stamp: loaded.data.stamp ?? null,
    })
    refreshTitle()
    showCanvas()
    showStatus()
    shell.setStatus(placeNow(), PJ.restored!, 'ready', true)
    return true
  }
  refreshSignal()
  refreshAutosave()
  if (!restore()) picker.show({ closable: false, focus: false }) // first visit, or nothing to reopen
  // While the picker covers the workspace, « Aller à la vue 3D » lands on its highlighted card.
  document
    .querySelector<HTMLAnchorElement>('[data-testid="skip-link"]')
    ?.addEventListener('click', (e) => {
      if (!picker.isOpen) return
      e.preventDefault()
      e.stopImmediatePropagation()
      picker.focus()
    })

  // ── Keyboard (Task 8, C10, P3): one window listener for the page's lifetime.
  const shellBag = new DisposableBag()
  const keys = mountCreationKeyboard({
    bag: shellBag,
    bindings: loadCreationBindings(storage),
    canvas,
  })
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
  // ── Save / named projects (Task 13, C16).
  const saveFailed: Record<'blocked' | 'full' | 'quarantine-full', string> = {
    full: PJ.saveFull!,
    blocked: PJ.blocked!,
    'quarantine-full': PJ.quarantineFull!,
  }
  const saveDone: Record<'ok' | 'conflict-kept' | 'list-reset', string> = {
    ok: PJ.saved!,
    'conflict-kept': PJ.conflictKept!,
    'list-reset': PJ.listReset!,
  }
  /** The stored project list; an unreadable one that could not be set aside is held for the export. */
  const projectList = (): ProjectList => {
    const list = readProjectList(storage)
    if (list.status === 'unreadable' && list.kept !== 'kept' && list.raw !== exportedList)
      holdPending(PROJECTS_KEY, 'corrupt', list.raw, false)
    return list
  }
  let saving = false
  /** Ctrl+S / Enregistrer (asks a name the first time) / Enregistrer sous… (always asks). */
  const save = async (saveAs: boolean): Promise<void> => {
    if (saving) return
    saving = true
    try {
      props.flush() // a stepper burst still open is part of what is saved
      if (!canvasShown || store.design().roomId === null)
        return shell.setStatus(placeNow(), PJ.saveNoPlace!, 'idle', true)
      let name = projectName
      /** The stored row this save may replace, as this tab knows it (another tab's newer copy is set aside). */
      let expectStamp = projectStamp
      if (saveAs || name === null) {
        name = await openNameDialog({ saveAs, initial: projectName ?? '' })
        if (name === null) return
        const list = projectList()
        const existing =
          list.status === 'ok' ? list.projects.find((p) => p.name === name) : undefined
        if (name !== projectName) expectStamp = existing?.stamp ?? null
        if (name !== projectName && existing) {
          const ok = await openChoiceDialog<'replace' | 'cancel'>({
            title: PJ.overwriteTitle!.replace('{name}', name),
            body: PJ.overwriteBody!,
            choices: [
              { id: 'replace', label: PJ.overwrite! },
              { id: 'cancel', label: PJ.nameCancel! },
            ],
            cancel: 'cancel',
          })
          if (ok !== 'replace') return
        }
      } else projectList() // an unreadable list is held for the export before the save says so
      const design = store.design()
      const stamp = newStamp()
      const r = saveProject(storage, name, design, {
        expectStamp,
        stamp,
        unreadableExported: exportedList,
      })
      if (r === 'blocked' || r === 'full' || r === 'quarantine-full') {
        if (r === 'blocked') blockedNote()
        return shell.setStatus(placeNow(), saveFailed[r], 'ready', true)
      }
      setProject({ name, savedFp: designFingerprint(design), stamp })
      refreshTitle()
      // Ctrl+S here: this tab is the active one again (its autosave resumes).
      notes.dismiss('other-tab')
      autosave.resume()
      autosave.schedule()
      autosave.flush() // the name and the clean state survive a reload at once
      shell.setStatus(placeNow(), saveDone[r].replace('{name}', name), 'ready', true)
    } finally {
      saving = false
    }
  }
  // Always taken (preventDefault): Ctrl+S never opens the browser's « save page » dialog in Mode Création.
  keys.onAction('SAVE', () => {
    void save(false)
    return true
  })
  /** « Nouveau »: asks when there are unsaved changes; an undoable empty rig, then the picker over the place. */
  /** Unsaved changes: ask before replacing them (« Nouveau », « Ouvrir… »); undo still brings them back. */
  const confirmDiscard = async (title: string, confirm: string): Promise<boolean> => {
    if (!dirty()) return true
    const c = await openChoiceDialog<'go' | 'cancel'>({
      title,
      body: PJ.newBody!.replace('{undo}', undoLabel()),
      choices: [
        { id: 'go', label: confirm },
        { id: 'cancel', label: PJ.nameCancel! },
      ],
      cancel: 'cancel',
    })
    return c === 'go'
  }
  // Undo / redo of « Ouvrir » / « Nouveau » brings the project identity back with the rig (review CRITICAL).
  history.onMeta((m) => {
    session.restoreName((m as ProjectMeta).name)
    sync()
    refreshTitle()
    autosave.schedule()
  })
  /** « Nouveau »: asks when there are unsaved changes; an undoable empty rig, then the picker over the place. */
  const newProject = async (): Promise<void> => {
    props.flush()
    if (!(await confirmDiscard(PJ.newTitle!, PJ.newConfirm!))) return
    const roomId = store.design().roomId
    if (roomId !== null)
      history.do(
        {
          type: 'APPLY_DESIGN',
          design: { roomId, rig: { instances: [], connections: [], controls: {} }, placements: [] },
        },
        PJ.newEntry!,
        {
          before: projectMeta(),
          after: { name: null } satisfies ProjectMeta,
        }
      )
    setProject({ name: null, savedFp: null, stamp: null })
    refreshTitle()
    autosave.schedule()
    picker.show({ closable: canvasShown, focus: true })
  }
  /** « Ouvrir… »: the saved list; the chosen project replaces the rig as one undoable snapshot entry (C5), its name with it. */
  const openProject = async (): Promise<void> => {
    props.flush()
    if (!(await confirmDiscard(PJ.openDirtyTitle!, PJ.openDirtyConfirm!))) return
    const list = projectList()
    const projects = list.status === 'ok' ? list.projects : []
    const name = await openProjectList({ projects, unreadable: list.status === 'unreadable' })
    if (name === null) return
    const design = loadProject(storage, name)
    const failed = (): void =>
      shell.setStatus(placeNow(), PJ.openFailed!.replace('{name}', name), 'ready', true)
    if (!design || design.roomId === null) return failed()
    const first = store.design().roomId === null
    // anything the store drops shows as « * » (the fingerprint is the stored design's)
    const after: ProjectState = {
      name,
      savedFp: designFingerprint(design),
      stamp: projects.find((p) => p.name === name)?.stamp ?? null,
    }
    const r = history.do({ type: 'APPLY_DESIGN', design }, PJ.openEntry!.replace('{name}', name), {
      before: projectMeta(),
      after: { name } satisfies ProjectMeta,
    })
    if (!r.ok) return failed()
    if (first) history.clear() // the session starts at its first place (as placeController)
    setProject(after)
    refreshTitle()
    autosave.schedule()
    showCanvas()
    shell.setStatus(
      placeNow(),
      PJ.opened!.replace('{name}', name).replace('{undo}', undoLabel()),
      'ready',
      true
    )
  }
  /** « Exporter les données mises de côté… »: one JSON file; nothing is removed (clearing is Oscar's call, N19). */
  const exportKept = (): void => {
    const kept = readQuarantine(storage)
    if (!kept.length && !pending.length)
      return shell.setStatus(placeNow(), PJ.exportNothing!, 'idle', true)
    const file = `tekpractice-donnees-mises-de-cote-${new Date().toISOString().slice(0, 10)}.json`
    const url = URL.createObjectURL(
      new Blob([exportBundle(storage, pending)], { type: 'application/json' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = file
    a.hidden = true
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    // What was held is in the file: the autosave may write over it once the learner says the file is good.
    if (pending.length) {
      heldExport = [...pending]
      keptExported = true
      notes.show({
        id: 'kept-full',
        title: PJ.keptFullTitle!,
        body: PJ.keptFullExported!,
        actions: [{ label: PJ.checkedFile!, run: checkedFile }],
      })
      refreshAutosave()
    }
    shell.setStatus(placeNow(), PJ.exported!.replace('{file}', file), 'ready', true)
  }
  /** What the last export held (the autosave may overwrite it once the learner checked the file). */
  let heldExport: QuarantineItem[] = []
  /** « J’ai vérifié le fichier » (note or status bar): the autosave resumes. */
  const checkedFile = (): void => {
    exportedList = heldExport.filter((p) => p.key === PROJECTS_KEY).pop()?.raw ?? exportedList
    if (pendingStoppedAutosave && storage) autosaveOn = true
    pendingStoppedAutosave = false
    keptExported = false
    notes.dismiss('kept-full')
    autosave.schedule()
  }
  /** « Reprendre ici » (note or status bar): this tab writes again. */
  const resumeHere = (): void => {
    notes.dismiss('other-tab')
    autosave.resume()
    shell.setStatus(placeNow(), COPY.shell!.statusReady!, 'ready')
  }
  // Another tab writes the autosave or the projects: this tab stops autosaving (said), Ctrl+S here resumes it.
  shellBag.listen(window, 'storage', (e) => {
    if (!isForeignWrite(e as StorageEvent) || autosave.paused) return
    autosave.pause()
    const body = PJ.otherTab!.replace('{save}', bindingLabel(keys.bindings, 'SAVE') || 'Ctrl+S')
    notes.show({
      id: 'other-tab',
      title: PJ.otherTabTitle!,
      body,
      actions: [{ label: PJ.resumeHere!, run: resumeHere }],
    })
    shell.setStatus(placeNow(), body, 'ready', true)
  })
  // Leaving the page: the pending autosave is written now (never mid-transaction).
  const leave = (): void => {
    props.flush()
    autosave.flush()
  }
  shellBag.listen(window, 'beforeunload', leave)
  shellBag.listen(window, 'pagehide', leave)
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
  // Hover (Task 14b): a thin Papier outline on the device under the pointer, never the Ambre selection.
  attachCanvasHover(
    canvas,
    shellBag,
    (x, y) => pickDevice(host.scene, x, y),
    (id) => host.setHovered(id)
  )
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
    new: () => void newProject(),
    open: () => void openProject(),
    save: () => void save(false),
    'save-as': () => void save(true),
    'export-kept': exportKept,
  }
  mountMenuBar(shell.menus, () =>
    buildMenus({
      history,
      actions,
      bindingLabel: menuShortcut,
    })
  )

  const screen = (world: Vector3 | null): { x: number; y: number } | null => {
    const { scene, camera } = host
    return world && scene && camera
      ? projectToScreen(world, scene, camera, host.engine, canvas)
      : null
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
    hovered: () => host.hovered(),
    hidden: () => viewState.get().hidden,
    pickAt: (x, y) => pickDevice(host.scene, x, y),
    treeRenders: () => tree.renders,
    renders: () => scheduler.renders,
    camera: () => {
      const c = host.camera
      return c
        ? {
            alpha: c.alpha,
            beta: c.beta,
            radius: c.radius,
            target: [c.target.x, c.target.y, c.target.z],
          }
        : null
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
    project: () => ({ name: projectName, dirty: dirty() }),
    quarantine: () => readQuarantine(storage),
  }
}
