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
import { showBootFailure, type BootFailureKind } from './bootFailure'
import { CreationStore, creationEvaluator } from './store'
import { History } from './history'
import { loadViewPrefs, saveViewPrefs, ViewState } from './viewState'
import {
  activePoint,
  DEFAULT_LISTENER_POINT,
  defaultPoints,
  POINT_IDS,
  pointForKey,
  pointLookAt,
  pointPose,
  type ListeningPoint,
  type PointPose,
} from './listeningPoints'
import { hasInertia, RenderScheduler, renderSceneOnce } from './renderScheduler'
import { SceneHost } from './sceneHost'
import { placeFromKey, placeKey } from './places'
import { loadPlaceData } from './placeData'
import { createPlaceController, type PlaceResult } from './placeController'
import { PlacementController } from './placementController'
import { EditController } from './editController'
import { PatchController } from './patchController'
import { CableHoverController } from './cableHover'
import { cableText, connectionSignal, legendEntries, portInfoOf, presentSignals } from './cableStyle'
import { mountCableLegend } from './shell/cableLegend'
import { mountPortLabels } from './shell/portLabel'
import { mountToast } from './shell/toast'
import { designFromRoomGear, unavailableList } from './templateGear'
import { loadTemplates, templateToDesign } from './templates'
import { mountNotes } from './shell/notes'
import { bodyCentreOf } from './debug'
import { debugBodyCenter } from '../scene/debugBody'
import { cableKey } from './sceneDiff'
import { attachCanvasHover, attachCanvasPicking, createSelection, pickDevice, portAt } from './selection'
import { floorPointAt } from '../scene/pivotPick'
import { rotate90 } from '../camera/viewCube'
import { mountProjectTree } from './shell/projectTree'
import { mountPropertiesPanel } from './shell/propertiesPanel'
import { createConnectDialog } from './shell/connectDialog'
import { buildTree, hideKeyOf, type TreeNode } from './shell/treeModel'
import { nextDevice } from './deviceCycle'
import { mountCreationKeyboard } from './input/keyboard'
import { bindingLabel, creationActionsFor, loadCreationBindings, type CreationAction } from './input/creationActions'
import type { InventoryDrawer } from './shell/inventoryDrawer'
import type { BetaPrep } from './betaDevices'
import { isUnverified, parseProposals, prepareBeta, proposalEntries, registerProposals, within, type BetaLoad } from './betaDevices'
import type { DeviceT } from '../engine/CatalogLoader'
import type { DesignState } from '../trials/trial'
import { openPlaceDialog, openReplaceDialog } from './shell/placeDialog'
import type { PlaceCard } from './shell/placePicker'
import { mountShell } from './shell/layout'
import { mountMenuBar } from './shell/menuBar'
import { openViewPicker } from './shell/viewPickerOverlay'
import { buildMenus } from './shell/menuModel'
import { CREATION_TOKENS, injectCreationTokens } from '../design/creationTokens'
import { nearestZone, ZONES, zoneAngles, zoneId, zoneLabel, type ZoneSigns } from '../camera/cubeZones'
import { cubeSizePx } from './viewCubeGeometry'
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
// The view cube's face labels (Task 17): fetched only when the cube draws them.
import '@fontsource/ibm-plex-sans/600.css'

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
  /** The shell cannot work: it goes inert behind a persistent alert with the way out (Phase 1 review). */
  const fail = (kind: BootFailureKind, e: unknown): void => {
    console.error(`[creation] boot failed (${kind})`, e)
    shell.root.inert = true
    showBootFailure(document, kind)
  }
  try {
    host = new SceneHost(canvas, registry, scheduler) // throws without WebGL (no context)
  } catch (e) {
    return fail('no-webgl', e)
  }
  // « Choisir un lieu » (Task 12): its own lazy chunk (cards, grid keys) and the templates, fetched together.
  let loaded: [typeof import('./shell/placePicker'), Awaited<ReturnType<typeof loadTemplates>>]
  try {
    loaded = await Promise.all([import('./shell/placePicker'), loadTemplates()])
  } catch (e) {
    host.dispose()
    return fail('load', e)
  }
  const [{ placeCards, templateCards, mountPlacePicker, placeSummary }, allTemplates] = loaded
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

  // ── « Bêta » sheets (Task 30, S5): catalog proposals, never verified gear. The data is a lazy chunk (proposalsSource),
  // fetched when the inventory drawer first opens or when a reopened project holds a device the catalog does not know.
  // A proposal is registered (betaDevices.ts) only when it is chosen or reopened: the catalog list is never touched.
  let betaDevices: readonly DeviceT[] = []
  let betaLoad: Promise<BetaLoad> | null = null
  /** How long a fetch of the Bêta sheets may take before it counts as failed (5 s; `window.__creationBetaTimeoutMs` is a test-only seam). */
  const betaTimeoutMs = (): number => {
    const t = (window as unknown as { __creationBetaTimeoutMs?: unknown }).__creationBetaTimeoutMs
    return typeof t === 'number' && t > 0 ? t : 5000
  }
  /**
   * Never rejects. `failed` (offline, a rejected import, no answer within the delay) is told apart from a file that loaded
   * and does not hold a sheet: a failure leaves the tab hidden and drops nothing, and a later call retries.
   */
  const loadBeta = (): Promise<BetaLoad> =>
    (betaLoad ??= within(import('./proposalsSource'), betaTimeoutMs()).then((r): BetaLoad => {
      if (!r.ok) {
        console.warn('[creation] Bêta sheets unavailable: the tab stays hidden')
        betaLoad = null
        return { devices: betaDevices, failed: true }
      }
      const parsed = parseProposals(r.value.default, registry)
      if (parsed.skipped.length) console.warn('[creation] Bêta sheets left out', parsed.skipped)
      return { devices: (betaDevices = parsed.devices), failed: false }
    }))
  /** Make these proposals placeable (a no-op for a catalog device or an unloaded id). */
  const registerBeta = (ids: readonly string[]): void => {
    registerProposals(
      registry,
      betaDevices.filter((d) => ids.includes(d.id))
    )
  }
  /**
   * Before a saved design opens: fetch the Bêta sheets it needs (only when it holds a device the catalog does not know)
   * and register them. `ready.missing` = ids whose sheet is genuinely gone from a loaded file: the store drops those and the
   * learner is told (`noteMissing`). `unavailable` = the fetch failed: the design must NOT be applied (`holdForBeta`).
   */
  const ensureBetaFor = async (design: DesignState): Promise<BetaPrep> => {
    const needs = prepareBeta(registry, design, async () => {
      shell.setStatus('', COPY.inventory!.loadingBeta!, 'busy')
      return loadBeta()
    })
    const prep = await needs
    showStatus() // the loading line is over (the caller says what happened next)
    return prep
  }
  /** The stored autosave is held (not applied, not overwritten) because the Bêta sheets could not be fetched. */
  let betaHold = false
  /** The fetch failed: say so, honestly, everywhere the learner looks (note, status line; the picker line is set by the caller). */
  /** The first change after a held reopen: set the stored project aside (recoverable by the export) so the autosave never loses it. */
  const releaseBetaHold = (): void => {
    betaHold = false
    notes.dismiss('beta-unavailable')
    const aside = setAsideAutosave(storage, 'beta-unavailable')
    if (aside.kept === 'full' && aside.raw !== null) holdPending(AUTOSAVE_KEY, 'beta-unavailable', aside.raw, true)
    else if (aside.kept === 'blocked') {
      autosaveOn = false
      storageBlocked = true
    }
  }
  const noteBetaUnavailable = (): void => {
    const I = COPY.inventory!
    notes.show({ id: 'beta-unavailable', title: I.unavailableTitle!, body: I.unavailable! })
    shell.setStatus('', I.unavailable!, 'ready', true)
  }
  const noteMissing = (ids: readonly string[]): void => {
    if (!ids.length) return
    const I = COPY.inventory!
    notes.show({ id: 'missing-sheets', title: I.missingTitle!, body: I.missingBody!, items: [...ids] })
  }

  // ── Status bar (Task 14, CA-15, C17): selection, snapping, autosave state, signal + the persistent error list.
  const ruleText = ruleTextFor(registry.catalog.rules as readonly RuleRow[])
  /** The rule events of the last store change (the count changes on store changes only). */
  let events = store.events()
  /** Cables in the rig at the last store change (0 → « Rien de branché »). */
  let connections = 0
  /** Bêta (proposed) devices in the rig at the last store change: « Aucune erreur détectée » says so (Task 30). */
  let unverified = 0
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
  /** Snapping while a device is placed or dragged (false = grid, true = free with Alt); undefined = no snapping text. */
  let snapFree: boolean | undefined
  const refreshSignal = (): StatusView => {
    const sel = viewState.get().selection
    const v = statusView({
      selectionLabel: sel === null ? null : `${deviceLabel(sel)} (${sel})`,
      snapFree,
      events,
      lastRejection,
      ruleText,
      connections,
      unverified,
      // playbackReady: false until the signal path feeds it (Task 34): « Signal OK » only for a playable chain (L5).
      // A Bêta device (isUnverified, betaDevices.ts) must never make a chain playable: that path stops at it. R1–R8 read its declared ports only.
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
  // View settings kept across visits (Task 19: the ear height), never in the rig.
  viewState.set(loadViewPrefs(storage))
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
      if (!autosaveOn || betaHold || design.roomId === null) return null // nothing worth keeping before a place; or the held project (betaHold)
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
    // While walking a selection (click, [ ], the tree) never flies the hidden orbit camera.
    host: {
      instance: (id) => host.instance(id),
      frameOfKey: (key) => host.frameOfKey(key),
      get rig() {
        return host.walking ? null : host.rig
      },
    },
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
  /** The place's listening points (Task 20) at the current ear height; none before a place is shown. */
  const listeningPoints = (): ListeningPoint[] =>
    canvasShown && host.place ? defaultPoints(host.layout, viewState.get().earHeight) : []
  /** The point the camera was last sent to and the pose it got (the ear height re-flies it while it is still there). */
  let atPoint: { id: string; pose: PointPose } | null = null
  /** True while goToPoint asks the rig for the point's own flight. */
  let pointFlight = false
  const treeNodes = (): TreeNode[] =>
    buildTree({
      placeLabel: placeNow(),
      zones: zones(),
      design: store.design(),
      deviceLabel: (deviceId) => registry.deviceById.get(deviceId)?.label ?? deviceId,
      isUnverified: (deviceId) => isUnverified(registry, deviceId),
      points: listeningPoints().map((p) => ({ id: p.id, label: p.label })),
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
        leaveWalk() // framing a row is an orbit view
        if (!selection.flyToKey(node.id)) return
        treeActive = node.id
        tree.render()
        shell.setStatus(
          placeNow(),
          COPY.tree!.statusFramed!.replace('{item}', node.label),
          'ready',
          true
        )
      } else if (node.kind === 'point') {
        // A listening point (Task 20): leaves the walk, the camera stands there looking at the stage.
        treeActive = node.id // before the view-state change re-renders the tree
        if (!goToPoint(node.target!.pointId!)) treeActive = null
        tree.render()
      } else if (node.kind === 'lieu' && host.rig) {
        // The place row: back to the overview.
        leaveWalk()
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
    // « Connecter à… » (Task 28, CA-02): the keyboard / screen-reader way to cable, defined with the patch controller below.
    connect: (from, opener) => connectDialog.open(from, opener),
  })
  let earHeight = viewState.get().earHeight
  viewState.subscribe(() => {
    const v = viewState.get()
    if (v.earHeight !== earHeight) {
      earHeight = v.earHeight
      saveViewPrefs(storage, { earHeight })
      host.setEarHeight(earHeight) // a live walker moves at once
      // The listening points follow the ear height: a camera still standing on one moves with it.
      if (atPoint && !host.walking && cameraOn(atPoint.pose)) goToPoint(atPoint.id, { refly: true })
    }
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
    atPoint = null // a new camera: it stands on no point
    cableHover.reset() // a hovered cable belongs to the old scene
    patch.reset() // a cable in hand, a pinned refusal or an offer belong to the old scene's ports
    connectDialog.close() // a list of the old rig's ports
    toast.dismiss() // a message about the previous place's view does not carry over
    // Any other camera request (cube, menu, V, home, a quarter turn, re-pivot, device focus) leaves
    // the point, even while the point's own flight still runs (Task 21 review minor).
    if (host.rig)
      host.rig.onFlight = () => {
        if (!pointFlight) atPoint = null
      }
    // Keypad 4 / 6 are the quarter turns. With Num Lock off the browser reports them as arrows
    // (key « ArrowLeft », keyCode 37), and Babylon's keyboard orbit reads keyCodes: it would orbit
    // on top of the turn. Those keys never reach the camera's own input.
    host.scene?.onPreKeyboardObservable.add((info) => {
      const code = info.event.code
      if (keys.bindings.VIEW_ROT_LEFT.includes(code) || keys.bindings.VIEW_ROT_RIGHT.includes(code))
        info.skipOnKeyboardObservable = true
    })
    if (treeActive?.startsWith('point:')) treeActive = null
    // A new place listens from its Régie (Centre without a layout) until a point is chosen (review Fix 1).
    viewState.set({ hidden, listenerPoint: DEFAULT_LISTENER_POINT })
    tree.render()
  }

  store.subscribe((change) => {
    if (betaHold) releaseBetaHold() // the learner started something else: the held project is set aside first, then the autosave may write
    host.apply(store.design())
    scheduler.invalidate()
    showStatus()
    // The error list follows the rig: the rule events now; the refused connection until a valid one (or a new design, or its device leaves).
    const before = events.filter((e) => e.severity === 'error').length
    events = store.events()
    const after = events.filter((e) => e.severity === 'error').length
    connections = store.design().rig.connections.length
    unverified = store.design().rig.instances.filter((i) => isUnverified(registry, i.deviceId)).length
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
    host.viewResized() // the projection changed with no camera move: port proxies are re-sized, labels follow their port
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
    notes.dismiss('missing-sheets')
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
  const restore = async (): Promise<boolean> => {
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
    // A Bêta device of the last session needs its sheet first (fetched only then); a sheet that is gone is reported below.
    const prep = await ensureBetaFor(loaded.data.design)
    if (prep.kind === 'unavailable') {
      // The fetch FAILED (not « the sheet is gone »): applying the design would drop the Bêta devices and the next autosave would
      // overwrite the stored project. So nothing is applied, nothing is set aside, and the autosave holds until the learner starts something else.
      betaHold = true
      autosave.cancel()
      noteBetaUnavailable()
      return false
    }
    const missing = prep.missing
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
    noteMissing(missing)
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
  if (!(await restore())) {
    picker.show({ closable: false, focus: false }) // first visit, or nothing to reopen
    if (betaHold) picker.showError(COPY.inventory!.unavailable!) // the picker covers the notes: it says it too
  }
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
    // « Choisir un lieu » covers the workspace: no shortcut acts on the rig or the view under it
    // (Phase 1 review: Ctrl+Z after « Nouveau » undid the rig under the open picker).
    // Ctrl+S stays taken (« Choisissez un lieu avant d’enregistrer. »), help stays reachable.
    suspended: (a) => picker.isOpen && a !== 'SAVE' && a !== 'TOGGLE_HELP',
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
  // Not while a drag is open (Task 25): the drag's entry is still open, and Ctrl+Z / Ctrl+Y must not touch the rig under it.
  keys.onAction('UNDO', () => {
    if (placement.dragging) return true
    props.flush()
    return history.undo()
  })
  keys.onAction('REDO', () => {
    if (placement.dragging) return true
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
        // quarantine-full: the unreadable list (export it first) vs another tab's copy (a new name works).
        const msg =
          r === 'quarantine-full' && readProjectList(storage).status === 'unreadable' ? PJ.quarantineFullList! : saveFailed[r]
        return shell.setStatus(placeNow(), msg, 'ready', true)
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
    setInventory(false, { returnFocus: false })
    notes.dismiss('missing-sheets')
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
    const prep = await ensureBetaFor(design)
    if (prep.kind === 'unavailable') {
      // Nothing is opened and nothing changes: the stored project stays as it is (open it again once the network is back).
      notes.show({ id: 'beta-unavailable', title: COPY.inventory!.unavailableTitle!, body: COPY.inventory!.unavailable! })
      return shell.setStatus(placeNow(), COPY.inventory!.unavailable!, 'ready', true)
    }
    const missing = prep.missing
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
    noteMissing(missing)
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

  // ── Named views (Task 18, C11, CA-05): Vue › Vues, V, Alt+H, F. The cube's small edge / corner
  // targets meet WCAG 2.5.8 through these. Off while no place is on screen or the place picker covers it.
  const VW = COPY.views!
  const viewLocked = (): boolean => !canvasShown || picker.isOpen || !host.rig || !host.camera

  // ── Walk view (Task 19, C11, S6): Vue › Marcher / Maj+V; Échap or Maj+V back to Orbit.
  const WK = COPY.walk!
  const walkKey = (): string => bindingLabel(keys.bindings, 'WALK_TOGGLE') || 'Maj+V'
  const canvasLabel = canvas.getAttribute('aria-label')
  host.onWalkChange = (on) => {
    if (on) canvas.setAttribute('aria-label', WK.canvas!.replace('{walk}', walkKey()))
    else if (canvasLabel !== null) canvas.setAttribute('aria-label', canvasLabel)
    shell.setStatus(
      placeNow(),
      on ? WK.statusOn!.replace('{walk}', walkKey()) : WK.statusOff!,
      'ready',
      true
    )
  }
  const enterWalk = (): boolean =>
    !viewLocked() &&
    host.enterWalk({
      eyeHeight: viewState.get().earHeight,
      // Movement keys only while the 3D view has focus (WCAG 2.1.4), never with Ctrl / Alt / Meta.
      acceptKey: (e) => {
        if (e.target !== canvas || e.ctrlKey || e.altKey || e.metaKey) return false
        if (!e.repeat) return true
        // An auto-repeat adds nothing for a key the walker saw go down; for a key held since
        // before the walk (an arrow orbiting) it must not start the walk moving (review minor 6).
        // The page still never scrolls under the walk.
        if (host.walking && /^(Arrow|Page)/.test(e.code)) e.preventDefault()
        return false
      },
      covered: () => picker.isOpen,
    })
  /** Back to Orbit (no-op when not walking). */
  function leaveWalk(): void {
    host.exitWalk()
  }
  const toggleWalk = (): void => {
    if (host.walking) leaveWalk()
    else enterWalk()
  }
  const setEar = (h: 1.2 | 1.7): void => {
    viewState.set({ earHeight: h }) // its subscriber saves it and moves a live walker
    shell.setStatus(placeNow(), h === 1.2 ? WK.earSeated! : WK.earStanding!, 'ready', true)
  }
  const announceView = (label: string): void =>
    shell.setStatus(placeNow(), VW.status!.replace('{view}', label), 'ready', true)
  const goToView = (z: ZoneSigns): void => {
    if (viewLocked()) return
    leaveWalk() // a named view is an orbit view
    const a = zoneAngles(z)
    host.rig!.flyToView(a.alpha, a.beta) // reduced motion: a cut
    scheduler.invalidate()
    announceView(zoneLabel(z))
  }
  let viewPickerOpen = false
  const openViews = async (): Promise<void> => {
    if (viewPickerOpen || viewLocked() || host.walking) return
    viewPickerOpen = true
    try {
      // Static import (small): the dialog is up in the same task as the V key, so the next arrow lands in it.
      const cam = host.camera!
      const z = await openViewPicker({ alpha: cam.alpha, beta: cam.beta })
      canvas.focus() // Entrée and Échap both give the 3D view back
      if (z) goToView(z)
    } finally {
      viewPickerOpen = false
    }
  }
  const cameraHome = (): void => {
    if (viewLocked()) return
    leaveWalk() // « Vue d’ensemble » is an orbit view
    host.rig!.flyToEnsemble()
    scheduler.invalidate()
    announceView(VW.home!)
  }
  /**
   * A quarter turn around the current pivot (↺ ↻ beside the cube, Vue › Tourner la vue…, keypad
   * 4 / 6; Task 21 review, brief §3): to the next multiple of 90° from Face, beta kept. +1 (↻)
   * turns the view clockwise seen from above (Face → Droite, the cube's OCTANTS order), as the
   * legacy ↻. A cut under reduced motion. Off under the place picker and the V picker.
   */
  const turnView = (dir: 1 | -1): void => {
    if (viewLocked() || viewPickerOpen) return
    leaveWalk() // a turn is an orbit view
    const cam = host.camera!
    const alpha = rotate90(cam.alpha, dir)
    host.rig!.flyToView(alpha, cam.beta)
    scheduler.invalidate()
    announceView(zoneLabel(nearestZone(alpha, cam.beta)))
  }
  host.cubeHooks = {
    rotate: (dir) => turnView(dir),
    home: () => {
      if (!viewPickerOpen) cameraHome()
    },
    onView: (z) => announceView(zoneLabel(z)),
  }
  keys.onAction('VIEW_ROT_LEFT', () => {
    if (viewLocked()) return false
    turnView(-1)
    return true
  })
  keys.onAction('VIEW_ROT_RIGHT', () => {
    if (viewLocked()) return false
    turnView(1)
    return true
  })
  // Double-click on the floor re-pivots there (Task 21 review, brief §3, council T2.5): angle and
  // distance kept, the target moves (a cut under reduced motion). Never on a device or a port (their
  // click is theirs), never on the cube (its own layer gets those events), never while walking.
  shellBag.listen(canvas, 'dblclick', (e: MouseEvent) => {
    const scene = host.scene
    if (e.button !== 0 || !scene || viewLocked() || host.walking) return
    const x = e.offsetX
    const y = e.offsetY
    if (pickDevice(scene, x, y) || portAt(scene, x, y)) return
    const p = floorPointAt(scene, x, y, host.camera!)
    if (!p) return
    host.rig!.repivot(Vector3.FromArray(p))
    scheduler.invalidate()
  })
  // ── Listening points (Task 20): tree « Points d’écoute », Vue › Aller au point d’écoute, 1 / 2 / 3.
  const PT = COPY.points!
  /**
   * Stand the orbit camera on a listening point, looking at the stage (a cut under reduced
   * motion); it becomes the active listening point (`viewState.listenerPoint`). Like the named
   * views it leaves the walk first. False when the view is locked or the place has no such point.
   * `refly`: the silent re-fly when the ear height changes under a camera still on the point; it
   * neither announces nor touches the device selection (the learner chose no new view).
   */
  function goToPoint(id: string, opts: { refly?: boolean } = {}): boolean {
    if (viewLocked()) return false
    const p = listeningPoints().find((q) => q.id === id)
    if (!p) return false
    leaveWalk()
    // A room-level view, like the « Lieu » row (overview): it ends the device focus, so the tree's
    // one selected row is the point's (review Fix 1, minor). Selection is never undoable.
    if (!opts.refly && viewState.get().selection !== null) selection.select(null)
    const pose = pointPose(p.position, pointLookAt(host.layout, p), host.camera!.upperRadiusLimit ?? 60)
    pointFlight = true
    try {
      host.rig!.flyToPreset({
        alpha: pose.alpha,
        beta: pose.beta,
        radius: pose.radius,
        target: Vector3.FromArray(pose.target),
      })
    } finally {
      pointFlight = false
    }
    atPoint = { id, pose }
    viewState.set({ listenerPoint: id })
    scheduler.invalidate()
    if (!opts.refly) shell.setStatus(placeNow(), PT.status!.replace('{point}', p.label), 'ready', true)
    return true
  }
  /** The orbit camera is (or is flying to) this pose: nobody moved it since (any other flight clears `atPoint`). */
  function cameraOn(pose: PointPose): boolean {
    const c = host.camera
    if (!c || !host.rig) return false
    if (host.rig.tweening) return true
    const da = Math.abs(Math.atan2(Math.sin(c.alpha - pose.alpha), Math.cos(c.alpha - pose.alpha)))
    const [tx, ty, tz] = pose.target
    return (
      da < 1e-3 &&
      Math.abs(c.beta - pose.beta) < 1e-3 &&
      Math.abs(c.radius - pose.radius) < 1e-3 &&
      Math.hypot(c.target.x - tx, c.target.y - ty, c.target.z - tz) < 1e-3
    )
  }
  /** Key 1 / 2 / 3 (3D view focused): a fixed slot (1 Régie / Centre, 2 Premier rang, 3 Fond de salle). */
  const pointKey = (n: number): boolean => {
    if (viewLocked()) return false
    const p = pointForKey(listeningPoints(), n)
    if (!p) {
      shell.setStatus(placeNow(), PT.none!.replace('{n}', String(n)), 'idle', true)
      return true
    }
    return goToPoint(p.id)
  }
  keys.onAction('CAMERA_PRESET_1', () => pointKey(1))
  keys.onAction('CAMERA_PRESET_2', () => pointKey(2))
  keys.onAction('CAMERA_PRESET_3', () => pointKey(3))

  const frameFromMenu = (): void => {
    if (viewState.get().selection !== null) leaveWalk()
    if (!selection.frameSelection())
      shell.setStatus(placeNow(), COPY.shell!.statusNoSelection!, 'idle', true)
  }
  keys.onAction('VIEW_PICKER', () => {
    if (viewLocked() || host.walking) return false // the orbit views' picker: off while walking
    void openViews()
    return true
  })
  keys.onAction('CAMERA_HOME', () => {
    if (viewLocked()) return false
    cameraHome()
    return true
  })
  keys.onAction('FRAME_SELECTION', (e) => {
    // Entrée while a device follows the pointer drops it where it stands (the keyboard path). Only a fresh
    // press: the Entrée that chose the device from the drawer may still be held, and its auto-repeats land
    // here once the canvas has focus. While placing, Entrée never falls through to « frame the selection ».
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && placement.placing) {
      if (!e.repeat) placement.confirm()
      return true
    }
    if (viewState.get().selection !== null) leaveWalk() // framing is an orbit view
    return selection.frameSelection()
  })
  // Échap: the walk goes first (back to Orbit), then the selection. Menus, dialogs and the cube
  // caption see the key before (they take it, or it is passive for the caption).
  keys.onAction('CANCEL', (e) => {
    // The drawer is a dialog: its own Échap closes it from inside; this is Échap pressed while the 3D view has focus.
    if (drawerOpen()) {
      setInventory(false)
      return true
    }
    if (host.walking && (e.target === canvas || e.target === document.body)) {
      leaveWalk()
      return true
    }
    if (placement.cancel()) return true // a placement or a drag goes first; the selection stays
    // A held Échap is one press: its auto-repeats must not fall through to the next level (the cable, then the selection).
    if (e.repeat) return true
    if (patch.cancel()) return true // then a cable in hand, a pinned refusal or the « Débrancher » offer; the selection stays
    if (e.target !== canvas || viewState.get().selection === null) return false
    selection.select(null)
    return true
  })
  keys.onAction('WALK_TOGGLE', () => {
    if (viewLocked()) return false
    toggleWalk()
    return true
  })
  // ── Inventory drawer (Task 23, CA-09): Matériel › Inventaire, Espace (3D view focused). A lazy chunk,
  // requested on the first open only. Esc / Espace / « Fermer » close it and give the 3D view back.
  const INV = COPY.inventory!
  let drawer: InventoryDrawer | null = null
  let drawerLoad: Promise<InventoryDrawer> | null = null
  /** The learner's last wish while the chunk loads (a second Espace before it arrives cancels the open). */
  let drawerWanted = false
  const drawerOpen = (): boolean => (drawer ? drawer.isOpen : drawerWanted)
  /** Entrée / click on a device in the drawer: it follows the pointer until a click drops it (Task 24). */
  const chooseDevice = (deviceId: string): void => {
    registerBeta([deviceId]) // a Bêta sheet becomes placeable only now (a catalog id is never touched)
    placement.startPlacement(deviceId)
  }
  const loadDrawer = (): Promise<InventoryDrawer> =>
    (drawerLoad ??= Promise.all([import('./shell/inventoryDrawer'), loadBeta()]).then(([{ mountInventoryDrawer }]) => {
      drawer = mountInventoryDrawer({
        doc: document,
        parent: shell.viewport,
        registry,
        proposals: () => proposalEntries(betaDevices), // « Bêta » shows only if there are any
        onChoose: chooseDevice,
        returnFocus: () => canvas.focus(),
        isToggleKey: (e) => creationActionsFor(keys.bindings, e).includes('TOGGLE_INVENTORY'),
        keyLabel: () => bindingLabel(keys.bindings, 'TOGGLE_INVENTORY') || COPY.keys!.space!,
      })
      return drawer
    }))
  const setInventory = (open: boolean, opts: { returnFocus?: boolean } = {}): void => {
    drawerWanted = open
    if (drawer) {
      if (open) drawer.open()
      else drawer.close(opts)
      return
    }
    if (!open) return
    shell.setStatus(placeNow(), INV.loading!, 'busy')
    loadDrawer().then(
      (d) => {
        showStatus()
        if (drawerWanted && !viewLocked()) d.open()
        else drawerWanted = false
      },
      (e) => {
        console.error('[creation] inventory failed to load', e)
        drawerLoad = null // a retry may fetch again
        drawerWanted = false
        shell.setStatus(placeNow(), INV.loadFailed!, 'ready', true)
      }
    )
  }
  keys.onAction('TOGGLE_INVENTORY', (e) => {
    if (viewLocked()) return false
    if (e.repeat) return true // a held key toggles once (keyboard.ts claims repeats too)
    setInventory(!drawerOpen())
    return true
  })

  // A click on a device body in the 3D view selects it and flies to it.
  // Not while a device follows the pointer: the click that drops it is not a selection.
  attachCanvasPicking(
    canvas,
    shellBag,
    // A port is the cabling's (Task 26): a click on one is neither a selection nor a miss.
    // An open drag (a press on the selected device) owns its release: `onClickSelected` below decides port or select.
    (x, y) => (placement.placing || placement.dragging || patch.wouldTake(x, y) ? null : pickDevice(host.scene, x, y)),
    selection,
    (x, y) => missedClick(x, y)
  )
  // Hover (Task 14b): a thin Papier outline on the device under the pointer, never the Ambre selection.
  attachCanvasHover(
    canvas,
    shellBag,
    (x, y) => (placement.placing ? null : pickDevice(host.scene, x, y)),
    (id) => host.setHovered(id)
  )
  // ── Click-to-patch (Task 26, CA-19, CA-20): enlarged port proxies, hover labels, click port A then port B.
  // Created AFTER the picking (whose pick / miss handlers ask `patch.wouldTake` before this controller's own release
  // handler changes its state) and BEFORE the placement (its capture-phase press must see every press first); inert
  // while a ghost or a drag owns the pointer.
  const portLabels = mountPortLabels(document, shell.viewport, shellBag)
  const portName = (r: { instance: string; port: string }): string => `${deviceLabel(r.instance)} (${r.instance}) · ${r.port}`
  /** « in-mic-1 · XLR3 femelle · Niveau micro » (the names are the catalog's, in French through COPY). */
  const describePort = (r: { instance: string; port: string }): string => {
    const deviceId = store.design().rig.instances.find((i) => i.instanceId === r.instance)?.deviceId
    const p = (deviceId ? registry.deviceById.get(deviceId) : undefined)?.ports.find((q) => q.portId === r.port)
    if (!p) return r.port
    return COPY.patch!.hoverLabel!
      .replace('{port}', p.portId)
      .replace('{connector}', COPY.connector?.[p.connector] ?? registry.connectorById.get(p.connector)?.label ?? p.connector)
      .replace('{signal}', COPY.signal?.[p.signal] ?? registry.signalById.get(p.signal)?.label ?? p.signal)
  }
  const patch = new PatchController(host, history, store, scheduler, shellBag, {
    ui: portLabels,
    busy: () => placement.placing || placement.dragging || connectDialog.isOpen,
    describe: describePort,
    portName,
    allPorts: () =>
      store.design().rig.instances.flatMap((i) =>
        (registry.deviceById.get(i.deviceId)?.ports ?? []).map((p) => ({ instance: i.instanceId, port: p.portId }))
      ),
    rejectionTitle: (error, subjects) => rejectionOf(error, subjects, ruleText).title,
    announce: (message) => shell.setStatus(placeNow(), message, 'ready', true),
    undoLabel,
    beforeDispatch: () => props.flush(),
  })

  // ── « Connecter à… » (Task 28, CA-02, C10): the same CONNECT intent as the mouse, picked from a list. A refusal reads through
  // the one function the status list and the mouse path use (`rejectionOf`); a place change or teardown closes it.
  const connectDialog = createConnectDialog({
    registry,
    store,
    history,
    portName,
    rejectionText: (error, subjects) => rejectionOf(error, subjects, ruleText),
    announce: (message) => shell.setStatus(placeNow(), message, 'ready', true),
    undoLabel,
    beforeDispatch: () => props.flush(),
    focus: {
      panelDevice: () => props.device(),
      row: (from) => props.focusPort(from.instance, from.port),
      title: () => props.focusTitle(),
      canvas: () => {
        canvas.focus()
        return document.activeElement === canvas
      },
    },
  })
  shellBag.add(() => connectDialog.close())

  // ── Cables by signal type (Task 27, C18): the colour is the scene host's (the catalog's signal of each connection);
  // the legend (bottom of Propriétés) lists the types present; hovering a cable highlights it and says what it joins.
  // After the patch controller: a port under the pointer wins, and its label is never hidden from here.
  const cableLegend = mountCableLegend(document, shell.props, shellBag)
  const portInfoNow = () => portInfoOf(registry, store.design().rig.instances)
  const refreshLegend = (): void => {
    const portOf = portInfoNow()
    cableLegend.set(legendEntries(presentSignals(store.design().rig.connections.map((c) => connectionSignal(portOf, c.a, c.b)))))
  }
  shellBag.add(store.subscribe(refreshLegend))
  refreshLegend()
  const cableHover = new CableHoverController(host, shellBag, {
    ui: portLabels,
    busy: () => placement.placing || placement.dragging,
    deviceAt: (x, y) => pickDevice(host.scene, x, y) !== null,
    describe: (key) => {
      const c = store.design().rig.connections.find((k) => cableKey(k.a, k.b) === key)
      return c ? cableText(portInfoNow(), c.a, c.b) : null
    },
    subscribe: (fn) => store.subscribe(fn),
  })

  // Placing and moving devices (Task 24, CA-10, P20): after the picking above, so a drop is not also a click-to-select.
  const placement = new PlacementController(host, history, store, viewState, scheduler, shellBag, {
    deviceLabel: (deviceId) => registry.deviceById.get(deviceId)?.label ?? deviceId,
    announce: (message) => shell.setStatus(placeNow(), message, 'ready', true),
    undoLabel,
    onPlaced: (id) => selection.select(id, { fly: false }),
    // A click on a port of the selected device is the cabling's; any other click on it selects and frames it.
    onClickSelected: (id, x, y) => void (patch.clickAt(x, y) || selection.select(id)),
    onSnap: (free) => {
      snapFree = free === null ? undefined : free
      refreshSignal()
    },
    beforeDrag: () => props.flush(),
  })

  // ── Edit the selected device (Task 25, CA-11): R / Maj+R (Alt = 1°), Ctrl+D, Suppr and Matériel › Pivoter /
  // Dupliquer / Supprimer. Each is ONE history entry. While a drag is open every edit key is ignored: a delete
  // would otherwise merge into the open « Déplacer » entry (Task 24 review).
  const dragOpen = (): boolean => placement.dragging
  const edits = new EditController({
    history,
    store,
    selection: () => viewState.get().selection,
    // A drag holds an open entry; a placement hides the selection behind the ghost (R goes to the ghost, see rotateKey).
    blocked: () => dragOpen() || placement.placing,
    roomBounds: () => host.roomBounds(),
    deviceLabel: (deviceId) => registry.deviceById.get(deviceId)?.label ?? deviceId,
    announce: (message) => shell.setStatus(placeNow(), message, 'ready', true),
    undoLabel,
    onDuplicated: (id) => selection.select(id, { fly: false }), // the copy is the selection; no camera flight
  })
  /** R / Maj+R: the ghost while a device follows the pointer, else the selected device. Alt = 1° (free). */
  const rotateKey = (dir: 1 | -1, e: KeyboardEvent): boolean => {
    if (dragOpen() || e.repeat) return true // claimed, ignored
    if (placement.rotateGhost(dir, e.altKey)) return true
    edits.rotate(dir, e.altKey)
    return true
  }
  keys.onAction('ROTATE_CW', (e) => rotateKey(1, e))
  keys.onAction('ROTATE_CCW', (e) => rotateKey(-1, e))
  /** Suppr / Ctrl+D while a device follows the pointer: the selected device is not what the learner is looking at, so it is left alone and the placement goes on (said, announced). */
  const placingBlocksEdit = (): boolean => {
    if (!placement.placing) return false
    shell.setStatus(placeNow(), COPY.edit!.statusWhilePlacing!, 'ready', true)
    return true
  }
  keys.onAction('DUPLICATE', (e) => {
    if (dragOpen() || e.repeat || placingBlocksEdit()) return true // Ctrl+D is never the browser's bookmark in Mode Création
    edits.duplicate()
    return true
  })
  keys.onAction('DELETE', (e) => {
    if (dragOpen() || e.repeat || placingBlocksEdit()) return true
    edits.remove()
    return true
  })

  // ── Missed clicks (Task 25, CA-12): a click on the empty floor, the sky or a hidden device says so and clears
  // the selection. Not while a device follows the pointer (that click drops it), in the walk view, under the
  // place picker, nor on a port (its click is the cabling's).
  const toast = mountToast(document, shell.viewport, shellBag)
  const missedClick = (x: number, y: number): void => {
    if (placement.placing || placement.dragging || host.walking || viewLocked() || patch.wouldTake(x, y)) return
    if (viewState.get().selection !== null) viewState.set({ selection: null }) // not undoable; the toast speaks, not the status bar
    toast.show(COPY.feedback!.missed!.replace('{key}', bindingLabel(keys.bindings, 'TOGGLE_INVENTORY') || COPY.keys!.space!))
  }
  /** Menu item ids → the key map (the menus show the live labels). */
  const MENU_KEYS: Record<string, CreationAction | undefined> = {
    undo: 'UNDO',
    redo: 'REDO',
    save: 'SAVE',
    inventory: 'TOGGLE_INVENTORY',
    rotate: 'ROTATE_CW',
    duplicate: 'DUPLICATE',
    delete: 'DELETE',
    shortcuts: 'TOGGLE_HELP',
    'frame-selection': 'FRAME_SELECTION',
    'camera-home': 'CAMERA_HOME',
    'view-rotate-left': 'VIEW_ROT_LEFT',
    'view-rotate-right': 'VIEW_ROT_RIGHT',
    'view-picker': 'VIEW_PICKER',
    walk: 'WALK_TOGGLE',
    'point-key-1': 'CAMERA_PRESET_1',
    'point-key-2': 'CAMERA_PRESET_2',
    'point-key-3': 'CAMERA_PRESET_3',
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
    'choose-place': () => {
      setInventory(false, { returnFocus: false }) // the picker covers the drawer and takes focus
      picker.show({ closable: canvasShown, focus: true })
    },
    inventory: () => setInventory(!drawerOpen()),
    // The menu items are off while placing (hasSelection below); the guards are for a menu that was open when the placement began.
    rotate: () => void (!dragOpen() && !placingBlocksEdit() && edits.rotate(1, false)),
    duplicate: () => void (!dragOpen() && !placingBlocksEdit() && edits.duplicate()),
    delete: () => void (!dragOpen() && !placingBlocksEdit() && edits.remove()),
    new: () => void newProject(),
    open: () => void openProject(),
    save: () => void save(false),
    'save-as': () => void save(true),
    'export-kept': exportKept,
    // Camera items hand focus to the 3D view (returnFocus: false), so the arrows then orbit, as after the V picker.
    'frame-selection': () => {
      canvas.focus()
      frameFromMenu()
    },
    'camera-home': () => {
      canvas.focus()
      cameraHome()
    },
    'view-rotate-left': () => {
      canvas.focus()
      turnView(-1)
    },
    'view-rotate-right': () => {
      canvas.focus()
      turnView(1)
    },
    'view-picker': () => void openViews(),
    walk: () => {
      canvas.focus() // the arrows then walk (or orbit, back from the walk)
      toggleWalk()
    },
    'ear-seated': () => setEar(1.2),
    'ear-standing': () => setEar(1.7),
    ...Object.fromEntries(
      POINT_IDS.map((id) => [
        `point:${id}`,
        () => {
          canvas.focus() // the arrows then orbit around the stage from the point
          goToPoint(id)
        },
      ])
    ),
    ...Object.fromEntries(
      ZONES.map((z) => [
        `view:${zoneId(z)}`,
        () => {
          canvas.focus()
          goToView(z)
        },
      ])
    ),
  }
  mountMenuBar(shell.menus, () =>
    buildMenus({
      history,
      actions,
      bindingLabel: menuShortcut,
      historyLocked: () => picker.isOpen, // Phase 1 review: « Annuler » never edits the rig under the picker
      hasSelection: () => viewState.get().selection !== null && !placement.placing && !dragOpen(),
      viewLocked,
      walking: () => host.walking,
      earHeight: () => viewState.get().earHeight,
      points: () => listeningPoints().map((p) => ({ id: p.id, label: p.label })),
      listenerPoint: () =>
        activePoint(listeningPoints(), viewState.get().listenerPoint)?.id ?? '',
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
    portHitRadiusPx: (ref) => host.portHitRadiusPx(ref),
    portAtPoint: (x, y) => host.portAtPoint(x, y),
    patchPending: () => patch.pending,
    bodyPointAway: (id, minPx) => {
      const inst = host.instance(id)
      const centre = inst ? screen(bodyCentreOf(inst)) : null
      if (!centre) return null
      const rect = canvas.getBoundingClientRect()
      // Outside every port's REAL hit area (its proxy radius, bigger than minPx when the camera is close) plus a 2 px margin.
      const ports = store.design().rig.instances.flatMap((i) =>
        [...(host.instance(i.instanceId)?.portMarkers.keys() ?? [])].flatMap((port) => {
          const ref = { instance: i.instanceId, port }
          const at = screen(host.portWorld(ref))
          return at ? [{ ...at, r: Math.max(minPx, host.portHitRadiusPx(ref) + 2) }] : []
        })
      )
      let best: { x: number; y: number } | null = null
      let bestD = Infinity
      for (let dx = -120; dx <= 120; dx += 2)
        for (let dy = -80; dy <= 80; dy += 2) {
          const x = centre.x + dx
          const y = centre.y + dy
          const d = Math.hypot(dx, dy)
          if (d >= bestD || pickDevice(host.scene, x - rect.left, y - rect.top) !== id) continue
          if (ports.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r)) {
            best = { x, y }
            bestD = d
          }
        }
      return best
    },
    devicePorts: (id) => [...(host.instance(id)?.portMarkers.keys() ?? [])],
    visiblePortLabels: () => host.scene?.meshes.filter((m) => m.name.startsWith('portlabel:') && m.isEnabled() && m.isVisible).length ?? 0,
    setCameraRadius: (r) => {
      if (host.camera) host.camera.radius = r
      scheduler.invalidate()
    },
    turnCamera: (d) => {
      if (host.camera) host.camera.alpha += d
      scheduler.invalidate()
    },
    worldScreen: (p) => screen(Vector3.FromArray(p)),
    choosePlace,
    requestPlace,
    project: () => ({ name: projectName, dirty: dirty() }),
    quarantine: () => readQuarantine(storage),
    cubeRect: () => {
      const hit = host.cube?.hitElement.getBoundingClientRect()
      if (hit && hit.width > 0) return { x: hit.x, y: hit.y, width: hit.width, height: hit.height }
      // No place on screen yet: where the cube will sit (same size rule and margin as the widget).
      const v = shell.viewport.getBoundingClientRect()
      const size = cubeSizePx(window.innerWidth)
      const m = CREATION_TOKENS.cube.marginPx
      return { x: v.x + m, y: v.y + m, width: size, height: size }
    },
    cubeZoneAt: (x, y) => {
      const z = host.cube?.zoneAtPage(x, y)
      return z ? zoneId(z) : null
    },
    cubeHover: () => host.cube?.hoveredZone() ?? null,
    cubeZoneScreenPoint: async (id) => {
      // A place being committed shows its scene (and cube) a few frames later: wait up to 10 s.
      for (let i = 0; i < 500 && !(host.cube && host.place); i++)
        await new Promise((r) => setTimeout(r, 20))
      return host.cube ? host.cube.zoneScreenPoint(id) : null
    },
    activeCameraIsMain: () => !!host.scene && host.scene.activeCamera === host.camera,
    cameraMoving: () => (host.rig?.tweening ?? false) || hasInertia(host.camera),
    view: () => (host.walking ? 'explore' : 'orbit'),
    walkCamera: () => host.walkSnapshot(),
    leases: () => scheduler.leaseNames,
    earHeight: () => viewState.get().earHeight,
    listeningPoints: () => listeningPoints(),
    listenerPoint: () => viewState.get().listenerPoint,
    cableCenters: () =>
      store.design().rig.connections.map((c) => {
        const f = host.frameOfKey(`cable:${cableKey(c.a, c.b)}`)
        return f ? ([f.center.x, f.center.y, f.center.z] as [number, number, number]) : null
      }),
    cableColor: (key) => host.cableColorOf(key),
    legendPreview: (ids) => cableLegend.set(legendEntries(ids)),
    cableAtPage: (x, y) => {
      const r = canvas.getBoundingClientRect()
      return host.cableAtPoint(x - r.left, y - r.top)
    },
    cableHovered: () => cableHover.hovered,
    cableFreePoint: (key) => {
      // A page point on this cable where nothing else is under the pointer (no port, no device) and the cable is hit.
      const r = canvas.getBoundingClientRect()
      for (const p of host.cableSamples(key) ?? [])
        if (host.cableAtPoint(p.x, p.y) === key && !host.portAtPoint(p.x, p.y) && pickDevice(host.scene, p.x, p.y) === null) return { x: r.left + p.x, y: r.top + p.y }
      return null
    },
    placing: () => placement.placing,
    transformNodeCount: () => host.scene?.transformNodes.length ?? 0,
    modelsPending: () => host.pendingModels,
    floorPoint: (x, y) => {
      const { scene, camera } = host
      const r = canvas.getBoundingClientRect()
      return scene && camera ? floorPointAt(scene, x - r.left, y - r.top, camera) : null
    },
  }
}
