/**
 * Controls help content (ADR-0010 Décision 9) — pure, French first with the
 * English term kept for each action. Key labels follow the user's layout
 * (bindings stay on physical KeyboardEvent.code).
 */
import { ACTIONS, type Action } from '../input/actions'
import type { Bindings } from '../input/bindings'
import { labelFor, type Layout } from '../input/layoutLabels'

export const ACTION_LABELS: Record<Action, { fr: string; en: string }> = {
  MOVE_FORWARD: { fr: 'Avancer', en: 'Move forward' },
  MOVE_BACK: { fr: 'Reculer', en: 'Move back' },
  STRAFE_LEFT: { fr: 'Pas à gauche', en: 'Strafe left' },
  STRAFE_RIGHT: { fr: 'Pas à droite', en: 'Strafe right' },
  MOVE_DOWN: { fr: 'Descendre (s’accroupir)', en: 'Move down (crouch)' },
  MOVE_UP: { fr: 'Monter (se relever)', en: 'Move up (stand)' },
  RUN: { fr: 'Marcher plus vite', en: 'Walk faster' },
  TURN_LEFT: { fr: 'Tourner à gauche', en: 'Turn left' },
  TURN_RIGHT: { fr: 'Tourner à droite', en: 'Turn right' },
  LOOK_UP: { fr: 'Regarder en haut', en: 'Look up' },
  LOOK_DOWN: { fr: 'Regarder en bas', en: 'Look down' },
  TOGGLE_INVENTORY: { fr: 'Ouvrir / fermer l’inventaire', en: 'Toggle inventory' },
  TOGGLE_HELP: { fr: 'Aide des contrôles', en: 'Controls help' },
  TOGGLE_VIEW: { fr: 'Basculer Exploration ⇄ Orbite', en: 'Toggle Explore / Orbit view' },
  FOCUS: { fr: 'Zoomer sur l’appareil visé (focus)', en: 'Focus the aimed device' },
  PICK_UP: { fr: 'Ramasser l’appareil visé (Sandbox)', en: 'Pick up the aimed device (Sandbox)' },
  ROTATE_PLACEMENT: { fr: 'Tourner l’objet à poser', en: 'Rotate the object being placed' },
  // Copy deck docs/copy/designer-nav-essais.md, key help.action.overview.
  CAMERA_HOME: { fr: "Vue d'ensemble", en: 'Overview' },
  CANCEL: { fr: 'Libérer la souris / fermer / revenir', en: 'Release pointer / close / back' },
}

export interface HelpRow {
  action: Action
  label: string
  english: string
  keys: string[]
}

export function controlsHelp(b: Bindings, layout: Layout, layoutMap?: ReadonlyMap<string, string>): HelpRow[] {
  return ACTIONS.map((a) => ({
    action: a,
    label: ACTION_LABELS[a].fr,
    english: ACTION_LABELS[a].en,
    keys: [...new Set(b[a].map((c) => labelFor(c, layout, layoutMap)))],
  }))
}

/** Mouse-only scheme (ADR-0010 Décision 3). */
export const MOUSE_HELP: { gesture: string; action: string }[] = [
  { gesture: 'Clic gauche maintenu + glisser', action: 'Regarder autour de soi' },
  { gesture: 'Clic droit maintenu + glisser vers le haut', action: 'Avancer' },
  { gesture: 'Clic droit maintenu + glisser vers le bas', action: 'Reculer' },
  { gesture: 'Clic droit maintenu + glisser à gauche / à droite', action: 'Pas de côté' },
  { gesture: 'Clic gauche sans glisser', action: 'Interagir : focus sur un appareil, clic sur un port' },
  { gesture: 'Molette', action: 'Zoom (champ de vision)' },
  { gesture: 'En focus : glisser / molette / clic droit', action: 'Tourner autour / zoomer / revenir (ADR-0008)' },
]
