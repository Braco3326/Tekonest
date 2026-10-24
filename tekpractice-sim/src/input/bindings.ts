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
  CAMERA_HOME: ['Alt+KeyH'],
  CAMERA_PRESET_1: ['Digit1'],
  CAMERA_PRESET_2: ['Digit2'],
  CAMERA_PRESET_3: ['Digit3'],
  // View cube (Task 8): numpad codes stay the same with Num Lock off.
  VIEW_FACE: ['Numpad1'],
  VIEW_ARRIERE: ['Ctrl+Numpad1'],
  VIEW_DROITE: ['Numpad3'],
  VIEW_GAUCHE: ['Ctrl+Numpad3'],
  VIEW_DESSUS: ['Numpad7'],
  VIEW_ROT_LEFT: ['Numpad4'],
  VIEW_ROT_RIGHT: ['Numpad6'],
  // Essais (Task 14): same physical keys on AZERTY and QWERTY.
  FREEZE_ESSAI: ['KeyG'],
  COMPARE_FLIP: ['KeyB'],
  CANCEL: ['Escape'],
}

/** `code` may be a plain KeyboardEvent.code or a chord such as 'Alt+KeyH' (see chordFor). */
export function actionsForCode(b: Bindings, code: string): Action[] {
  return ACTIONS.filter((a) => b[a].includes(code))
}

const MODIFIER_CODES = new Set([
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'ShiftLeft',
  'ShiftRight',
])

/** The key IS a modifier (pressing Alt alone, Shift for RUN…). */
export const isModifierCode = (code: string): boolean => MODIFIER_CODES.has(code)

/**
 * Binding string for a key event: the physical code, prefixed by the held
 * Ctrl / Alt / Meta modifiers ('Alt+KeyH'). Shift is never a chord prefix
 * (it is a key of its own: RUN). A modifier key itself stays its plain code.
 */
export function chordFor(e: { code: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): string {
  if (isModifierCode(e.code)) return e.code
  return `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.metaKey ? 'Meta+' : ''}${e.code}`
}

/** Actions whose binding may be a modifier chord (the remap capture waits past a lone modifier). */
export const CHORD_ACTIONS: readonly Action[] = ['CAMERA_HOME', 'VIEW_ARRIERE', 'VIEW_GAUCHE']

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
