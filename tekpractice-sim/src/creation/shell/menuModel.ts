/**
 * The Mode Création top menus as data (Task 7): Projet · Lieu · Matériel ·
 * Câblage · Écoute · Vue · Aide. Pure: no DOM; `menuBar.ts` renders it.
 * An item is enabled when its action is registered in `ctx.actions` (features
 * land task by task); Annuler / Rétablir follow the history. Shortcut labels
 * come from the key map (`bindingLabel`, Task 8), never hard-coded here.
 */
import type { History } from '../history'
import { COPY } from '../copy'

export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  enabled(): boolean
  run(): void
  children?: MenuItem[]
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
  const undo: MenuItem = {
    id: 'undo',
    label: M.undo!,
    shortcut: ctx.bindingLabel('undo'),
    enabled: () => ctx.history.canUndo,
    run: () => void (ctx.history.canUndo && ctx.history.undo()),
  }
  const redo: MenuItem = {
    id: 'redo',
    label: M.redo!,
    shortcut: ctx.bindingLabel('redo'),
    enabled: () => ctx.history.canRedo,
    run: () => void (ctx.history.canRedo && ctx.history.redo()),
  }
  const places = ctx.places ?? []
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
    { id: 'vue', label: M.vue!, items: [act('panel-tree', M.panelTree!), act('panel-props', M.panelProps!)] },
    { id: 'aide', label: M.aide!, items: [act('shortcuts', M.shortcuts!), act('site', M.siteBack!)] },
  ]
}
