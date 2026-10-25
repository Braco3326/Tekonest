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
  // ── Vue (Task 18): the 26 named views, F, Alt+H, V. « Marcher » (Maj+V) lands with Task 19.
  const V = COPY.views!
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
    { id: 'materiel', label: M.materiel!, items: [act('inventory', M.inventory!)] },
    { id: 'cablage', label: M.cablage!, items: [act('connect-to', M.connectTo!)] },
    { id: 'ecoute', label: M.ecoute!, items: [act('play', M.play!)] },
    {
      id: 'vue',
      label: M.vue!,
      items: [
        views,
        cam('frame-selection', V.frame!, true),
        cam('camera-home', V.home!, true),
        cam('view-picker', V.pick!, false), // the picker gives focus to the 3D view when it closes
        act('panel-tree', M.panelTree!),
        act('panel-props', M.panelProps!),
      ],
    },
    { id: 'aide', label: M.aide!, items: [act('shortcuts', M.shortcuts!), act('site', M.siteBack!)] },
  ]
}
