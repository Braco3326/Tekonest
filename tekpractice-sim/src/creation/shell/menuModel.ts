/**
 * The Mode Création top menus as data (Task 7): Projet · Lieu · Matériel ·
 * Câblage · Écoute · Vue · Aide. Pure: no DOM; `menuBar.ts` renders it.
 * An item is enabled when its action is registered in `ctx.actions` (features
 * land task by task); Annuler / Rétablir follow the history. Shortcut labels
 * come from the key map (`bindingLabel`, Task 8), never hard-coded here.
 */
import type { History } from '../history'
import { COPY } from '../copy'
import { zoneId, zoneLabel, type ZoneSigns } from '../../camera/cubeZones'
import { PICKER_CELLS } from '../../camera/viewPicker'
import { keySlot } from '../listeningPoints'

export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  enabled(): boolean
  run(): void
  /** A submenu (menuBar renders it as a nested role="menu"). */
  children?: MenuItem[]
  /** Heading of the run of consecutive submenu items sharing it (« Faces », « Arêtes », « Coins »). */
  group?: string
  /**
   * false: choosing it does not send focus back to the menubar (APG default); the action
   * takes it (camera items hand it to the 3D view, so the arrows then orbit).
   */
  returnFocus?: false
  /** A checkable item (Task 19): 'checkbox' (Marcher) → menuitemcheckbox, 'radio' (ear height) → menuitemradio. */
  kind?: 'checkbox' | 'radio'
  /** Its checked state, read at each render (with `kind`). */
  checked?(): boolean
  /**
   * Why a disabled item is disabled (Task 39: « Lecture » says the first reason of the signal path). Read at each render; shown under the label and
   * set as the item's accessible DESCRIPTION while it is disabled (the item stays focusable, APG). Never shown on an enabled item.
   */
  description?(): string | undefined
}

/**
 * The 26 views in menu order (Task 18): faces (the horizon clockwise from Face, then
 * Dessus, Dessous), edges (horizon, top, bottom), corners (top, bottom); each run
 * clockwise from Face as in the `V` picker.
 */
export function viewMenuOrder(): { kind: 'faces' | 'edges' | 'corners'; zone: ZoneSigns }[] {
  const at = (el: number, odd: boolean): ZoneSigns[] =>
    PICKER_CELLS.filter((c) => c.el === el && (Math.abs(el) === 2 || c.az % 2 === (odd ? 1 : 0))).map((c) => c.zone)
  return [
    ...[...at(0, false), ...at(2, false), ...at(-2, false)].map((zone) => ({ kind: 'faces' as const, zone })),
    ...[...at(0, true), ...at(1, false), ...at(-1, false)].map((zone) => ({ kind: 'edges' as const, zone })),
    ...[...at(1, true), ...at(-1, true)].map((zone) => ({ kind: 'corners' as const, zone })),
  ]
}

export interface MenuDef {
  id: 'projet' | 'lieu' | 'materiel' | 'cablage' | 'ecoute' | 'vue' | 'aide'
  label: string
  items: MenuItem[]
}

export interface MenuContext {
  history: History
  actions: Record<string, () => void>
  bindingLabel(action: string): string | undefined
  /** Places offered in « Lieu » (each runs the action `place:<key>`). */
  places?: { key: string; label: string }[]
  /** True while Annuler / Rétablir are off (the place picker covers the rig: nothing under it may change). */
  historyLocked?(): boolean
  /** True while no view may change (no place on screen, or the place picker covers it): views, V, F, Alt+H are off. */
  viewLocked?(): boolean
  /** A device is selected (Task 25): Pivoter / Dupliquer / Supprimer act on it, and are off without one. */
  hasSelection?(): boolean
  /** True in the walk view (Task 19): « Marcher » is checked, the V picker is off. */
  walking?(): boolean
  /** The ear height (Task 19): which of the two Écoute radio items is checked. */
  earHeight?(): 1.2 | 1.7
  /** The place's listening points (Task 20), Vue › Aller au point d’écoute; each runs `point:<id>`. */
  points?(): { id: string; label: string }[]
  /** The active listening point's id (its radio item is checked). */
  listenerPoint?(): string
  /** Écoute › Couverture (Task 37): the coverage dots are on (the item is checked). */
  coverage?(): boolean
  /** Écoute (Task 39): a source is playing (« Lecture » reads « Stop »). */
  playing?(): boolean
  /** Écoute (Task 39): the signal path can play (`playbackReady`); the sources are off without it. */
  playbackReady?(): boolean
  /** Écoute (Task 39): the first reason the path cannot play (the disabled items' description). */
  playbackReason?(): string | undefined
  /** Écoute › Morceau (Task 39): the demo songs; the submenu is left out when there are none. */
  songs?(): { id: string; title: string }[]
}

export function buildMenus(ctx: MenuContext): MenuDef[] {
  const M = COPY.menu!
  /** An item backed by a registered action (disabled while none is). */
  const act = (id: string, label: string, action = id): MenuItem => ({
    id,
    label,
    shortcut: ctx.bindingLabel(action),
    enabled: () => typeof ctx.actions[action] === 'function',
    run: () => ctx.actions[action]?.(),
  })
  const free = (): boolean => !ctx.historyLocked?.()
  const canUndo = (): boolean => free() && ctx.history.canUndo
  const canRedo = (): boolean => free() && ctx.history.canRedo
  const undo: MenuItem = {
    id: 'undo',
    label: M.undo!,
    shortcut: ctx.bindingLabel('undo'),
    enabled: canUndo,
    run: () => void (canUndo() && ctx.history.undo()),
  }
  const redo: MenuItem = {
    id: 'redo',
    label: M.redo!,
    shortcut: ctx.bindingLabel('redo'),
    enabled: canRedo,
    run: () => void (canRedo() && ctx.history.redo()),
  }
  const places = ctx.places ?? []
  // ── Vue (Task 18): the 26 named views, F, Alt+H, V; « Marcher » (Maj+V, Task 19).
  const V = COPY.views!
  const W = COPY.walk!
  const viewFree = (): boolean => !ctx.viewLocked?.()
  /** A camera item: live when its action is registered and the view may change. */
  const cam = (id: string, label: string, toView: boolean, group?: string): MenuItem => {
    const base = act(id, label)
    const enabled = (): boolean => viewFree() && base.enabled()
    const item: MenuItem = { ...base, group, enabled, run: () => void (enabled() && base.run()) }
    if (toView) item.returnFocus = false // the action focuses the 3D view
    return item
  }
  const GROUP = { faces: V.faces!, edges: V.edges!, corners: V.corners! }
  const viewItems = viewMenuOrder().map(({ kind, zone }) => {
    const id = `view:${zoneId(zone)}`
    const item = cam(id, zoneLabel(zone), true, GROUP[kind])
    delete item.shortcut
    return item
  })
  const views: MenuItem = {
    id: 'views',
    label: V.menu!,
    enabled: () => viewItems.some((i) => i.enabled()),
    run: () => {},
    children: viewItems,
  }
  // Listening points (Task 20): radio items (the active point), keys 1 / 2 / 3 by fixed slot;
  // like the views they leave the walk first (their action) and hand focus to the 3D view.
  const pointList = ctx.points?.() ?? []
  const pointItems = pointList.map((p): MenuItem => {
    const item: MenuItem = { ...cam(`point:${p.id}`, p.label, true), kind: 'radio', checked: () => ctx.listenerPoint?.() === p.id }
    const slot = keySlot(p.id) // fixed slots: a dropped point never renumbers the keys
    item.shortcut = slot ? ctx.bindingLabel(`point-key-${slot}`) : undefined
    if (item.shortcut === undefined) delete item.shortcut
    return item
  })
  const points: MenuItem = {
    id: 'points',
    label: COPY.points!.menu!,
    enabled: () => pointItems.some((i) => i.enabled()),
    run: () => {},
    children: pointItems,
  }
  // The V picker shows the orbit views around the room: off in the walk view (the views and
  // « Vue d'ensemble » themselves go back to Orbit first, in their actions).
  const pickerBase = cam('view-picker', V.pick!, false) // the picker gives focus to the 3D view when it closes
  const picker: MenuItem = {
    ...pickerBase,
    enabled: () => !ctx.walking?.() && pickerBase.enabled(),
    run: () => void (!ctx.walking?.() && pickerBase.run()),
  }
  // Matériel › Inventaire (Task 23): the drawer takes focus itself (its tab), so the menu does not give it back.
  const inventoryBase = act('inventory', M.inventory!)
  const inventoryOn = (): boolean => viewFree() && inventoryBase.enabled()
  const inventory: MenuItem = { ...inventoryBase, enabled: inventoryOn, run: () => void (inventoryOn() && inventoryBase.run()), returnFocus: false }
  // Matériel › Pivoter / Dupliquer / Supprimer (Task 25): on the selected device only; never under the place picker.
  const edit = (id: string, label: string): MenuItem => {
    const base = act(id, label)
    const on = (): boolean => free() && !!ctx.hasSelection?.() && base.enabled()
    return { ...base, enabled: on, run: () => void (on() && base.run()) }
  }
  const walk: MenuItem = { ...cam('walk', W.menu!, true), kind: 'checkbox', checked: () => !!ctx.walking?.() }
  const ear = (id: string, label: string, h: 1.2 | 1.7): MenuItem => ({
    ...act(id, label),
    kind: 'radio',
    checked: () => (ctx.earHeight?.() ?? 1.2) === h,
  })
  // Écoute › Couverture (Task 37): a checkbox, off by default; live once its action is registered and a place is on screen.
  const coverageBase = act('coverage', M.coverage!)
  const coverageLive = (): boolean => viewFree() && coverageBase.enabled()
  const coverage: MenuItem = { ...coverageBase, enabled: coverageLive, run: () => void (coverageLive() && coverageBase.run()), kind: 'checkbox', checked: () => !!ctx.coverage?.() }
  // Écoute › Lecture / Stop, Morceau, Choisir un fichier audio…, Signal de test (Task 39). The sources need a valid chain (`playbackReady`), the
  // transport does not: Stop is always live. A disabled one stays focusable and says why (the first reason of the signal path).
  const registered = (action: string): boolean => typeof ctx.actions[action] === 'function'
  const canStart = (): boolean => viewFree() && !!ctx.playbackReady?.()
  // The chain's first reason; with a valid chain but the place picker over the view, the picker is the reason (an item must never be off with no word why).
  const why = (): string | undefined => ctx.playbackReason?.() || (viewFree() ? undefined : M.playLocked!)
  /** A source item: runs its action when the chain is valid. */
  const source = (id: string, label: string, action = id): MenuItem => {
    const on = (): boolean => registered(action) && canStart()
    return { id, label, enabled: on, run: () => void (on() && ctx.actions[action]()), description: () => (on() ? undefined : why()) }
  }
  const playing = !!ctx.playing?.()
  const playOn = (): boolean => registered('play') && (playing || canStart())
  const play: MenuItem = {
    id: 'play',
    label: playing ? M.stop! : M.play!,
    enabled: playOn,
    run: () => void (playOn() && ctx.actions.play()),
    description: () => (playOn() ? undefined : why()),
  }
  const songList = ctx.songs?.() ?? []
  const songItems = songList.map((s) => source(`song:${s.id}`, s.title))
  const songs: MenuItem[] = songList.length
    ? [{ id: 'songs', label: M.song!, enabled: () => songItems.some((i) => i.enabled()), run: () => {}, children: songItems, description: () => (songItems.some((i) => i.enabled()) ? undefined : why()) }]
    : []
  return [
    {
      id: 'projet',
      label: M.projet!,
      items: [act('new', M.newProject!), act('open', M.open!), act('save', M.save!), act('save-as', M.saveAs!), act('export-kept', M.exportKept!), undo, redo],
    },
    {
      id: 'lieu',
      label: M.lieu!,
      items: places.length ? places.map((p) => act(`place:${p.key}`, p.label)) : [act('choose-place', M.choosePlace!)],
    },
    { id: 'materiel', label: M.materiel!, items: [inventory, edit('rotate', M.rotate!), edit('duplicate', M.duplicate!), edit('delete', M.delete!)] },
    { id: 'cablage', label: M.cablage!, items: [act('connect-to', M.connectTo!)] },
    {
      id: 'ecoute',
      label: M.ecoute!,
      items: [play, ...songs, source('choose-file', M.chooseFile!), source('test-signal', M.testSignal!), coverage, ear('ear-seated', W.earSeated!, 1.2), ear('ear-standing', W.earStanding!, 1.7)],
    },
    {
      id: 'vue',
      label: M.vue!,
      items: [
        views,
        points,
        cam('frame-selection', V.frame!, true),
        cam('camera-home', V.home!, true),
        cam('view-rotate-left', V.rotateLeftMenu!, true),
        cam('view-rotate-right', V.rotateRightMenu!, true),
        picker,
        walk,
        act('panel-tree', M.panelTree!),
        act('panel-props', M.panelProps!),
      ],
    },
    { id: 'aide', label: M.aide!, items: [act('shortcuts', M.shortcuts!), act('site', M.siteBack!)] },
  ]
}
