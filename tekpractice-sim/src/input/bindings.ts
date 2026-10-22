/**
 * Key bindings by KeyboardEvent.code (PHYSICAL key position): `KeyW` is the key
 * labelled Z on an AZERTY keyboard, so the same layout works in France without
 * remapping (ADR-0010 Décision 3). Pure data + pure functions; remappable.
 */
import { ACTIONS, type Action } from './actions'

export type Bindings = Record<Action, string[]>

export const DEFAULT_BINDINGS: Bindings = {
  MOVE_FORWARD: ['KeyW'],
  MOVE_BACK: ['KeyS'],
  STRAFE_LEFT: ['KeyA'],
  STRAFE_RIGHT: ['KeyD'],
  MOVE_DOWN: ['KeyQ'],
  MOVE_UP: ['KeyE'],
  RUN: ['ShiftLeft', 'ShiftRight'],
  TURN_LEFT: ['ArrowLeft'],
  TURN_RIGHT: ['ArrowRight'],
  LOOK_UP: ['PageUp'],
  LOOK_DOWN: ['PageDown'],
  TOGGLE_INVENTORY: ['Space'],
  TOGGLE_HELP: ['KeyH'],
  TOGGLE_VIEW: ['KeyV'],
  FOCUS: ['KeyF'],
  PICK_UP: ['KeyX'],
  ROTATE_PLACEMENT: ['KeyR'],
  CANCEL: ['Escape'],
}

export function actionsForCode(b: Bindings, code: string): Action[] {
  return ACTIONS.filter((a) => b[a].includes(code))
}

/**
 * Keys the learner can never take over: Esc runs the Esc chain (ADR-0010 D5)
 * and closes dialogs; Tab / Enter are ADR-0008's keyboard focus path.
 */
export const RESERVED_CODES: readonly string[] = ['Escape', 'Tab', 'Enter', 'NumpadEnter']
/** Every action except CANCEL (Esc is fixed — a dialog must always close with Esc). */
export const REMAPPABLE: readonly Action[] = ACTIONS.filter((a) => a !== 'CANCEL')

/** Bind `action` to exactly `codes`; any other action using one of them loses it. */
export function rebind(b: Bindings, action: Action, codes: readonly string[]): Bindings {
  if (!REMAPPABLE.includes(action) || codes.some((c) => RESERVED_CODES.includes(c))) return b
  const next = {} as Bindings
  for (const a of ACTIONS) next[a] = a === action ? [...codes] : b[a].filter((c) => !codes.includes(c))
  return next
}

export function serializeBindings(b: Bindings): Record<string, string[]> {
  return Object.fromEntries(ACTIONS.map((a) => [a, [...b[a]]]))
}

/**
 * Tolerant parse: unknown actions dropped, missing/invalid ones fall back to
 * defaults. An EMPTY list is kept (its key was given to another action) so a
 * reload never resurrects a duplicate binding. CANCEL is always Escape.
 */
export function parseBindings(raw: unknown): Bindings {
  const out = {} as Bindings
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  for (const a of ACTIONS) {
    const v = obj[a]
    const valid =
      Array.isArray(v) && v.every((c) => typeof c === 'string' && (a === 'CANCEL' || !RESERVED_CODES.includes(c)))
    out[a] = a !== 'CANCEL' && valid ? [...(v as string[])] : [...DEFAULT_BINDINGS[a]]
  }
  return out
}
