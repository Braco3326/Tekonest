/**
 * Mode Création key map (Task 8, P3, C10). Pure data + pure functions.
 * - Spatial keys bind by KeyboardEvent.code (physical position, AZERTY-safe).
 * - Letter-mnemonic chords (Ctrl+Z / Y / S / D) bind as `key:` chords matched on
 *   KeyboardEvent.key, so they follow the LABELLED key on AZERTY (Ctrl+Z is the
 *   key printed Z, code KeyW).
 * - Shift IS a chord prefix here (Maj+V, Maj+R), unlike the legacy `chordFor`.
 * - Tab, Enter and Escape can never be rebound (`RESERVED_CODES`); CANCEL is Escape.
 * The legacy `ACTIONS` / `DEFAULT_BINDINGS` are untouched.
 */
import { RESERVED_CODES } from '../../input/bindings'
import { COPY } from '../copy'

export const CREATION_ACTIONS = [
  'UNDO', 'REDO', 'SAVE', 'DUPLICATE', 'DELETE', 'NEXT_DEVICE', 'PREV_DEVICE', 'FRAME_SELECTION',
  'TOGGLE_INVENTORY', 'TOGGLE_HELP', 'VIEW_PICKER', 'WALK_TOGGLE', 'ROTATE_CW', 'ROTATE_CCW',
  'CAMERA_HOME', 'CAMERA_PRESET_1', 'CAMERA_PRESET_2', 'CAMERA_PRESET_3', 'VIEW_ROT_LEFT', 'VIEW_ROT_RIGHT', 'CANCEL',
] as const
export type CreationAction = (typeof CREATION_ACTIONS)[number]
export type CreationBindings = Record<CreationAction, string[]>

export const DEFAULT_CREATION_BINDINGS: CreationBindings = {
  UNDO: ['Ctrl+key:z'],
  REDO: ['Ctrl+key:y', 'Ctrl+Shift+key:z'],
  SAVE: ['Ctrl+key:s'],
  DUPLICATE: ['Ctrl+key:d'],
  DELETE: ['Delete'],
  NEXT_DEVICE: ['BracketRight'],
  PREV_DEVICE: ['BracketLeft'],
  FRAME_SELECTION: ['KeyF'],
  TOGGLE_INVENTORY: ['Space'],
  TOGGLE_HELP: ['KeyH'],
  VIEW_PICKER: ['KeyV'],
  WALK_TOGGLE: ['Shift+KeyV'],
  // R turns 15° (Maj+R the other way); Alt is the « free » modifier everywhere: Alt+R / Alt+Maj+R turn 1° (Task 25).
  ROTATE_CW: ['KeyR', 'Alt+KeyR'],
  ROTATE_CCW: ['Shift+KeyR', 'Alt+Shift+KeyR'],
  CAMERA_HOME: ['Alt+KeyH'],
  // Mode Création: the listening points by position (Task 20: 1 = Régie). The legacy's saved
  // views « Vue 1/2/3 » (same action names, legacy key map) do not exist in Mode Création.
  CAMERA_PRESET_1: ['Digit1'],
  CAMERA_PRESET_2: ['Digit2'],
  CAMERA_PRESET_3: ['Digit3'],
  // A quarter turn of the view (Task 21 review): the legacy keypad keys (bindings.ts), 3D view only.
  VIEW_ROT_LEFT: ['Numpad4'],
  VIEW_ROT_RIGHT: ['Numpad6'],
  CANCEL: ['Escape'],
}

export const CREATION_BINDINGS_KEY = 'audio-sim/creation-bindings.v1'

type KeyEventLike = { code: string; key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; shiftKey?: boolean }

const prefix = (e: KeyEventLike): string =>
  `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.metaKey ? 'Meta+' : ''}${e.shiftKey ? 'Shift+' : ''}`

/** Chords produced by one key event: the code chord ('Ctrl+KeyZ') and the key chord ('Ctrl+key:z'). */
export function chordsFor(e: KeyEventLike): string[] {
  const p = prefix(e)
  // A single character is compared case-free (Shift+Z reports 'Z').
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  return [`${p}${e.code}`, `${p}key:${key}`]
}

/**
 * The printed `[` / `]` characters cycle devices too, whatever the modifiers
 * (AZERTY types them with AltGr, which reports Ctrl+Alt), as long as the action
 * still has its default key: the canvas label promises « [ ] ».
 */
const CHAR_FALLBACK: Readonly<Record<string, CreationAction>> = { '[': 'PREV_DEVICE', ']': 'NEXT_DEVICE' }

export function creationActionsFor(b: CreationBindings, e: KeyEventLike): CreationAction[] {
  if (e.code === 'Tab' || e.key === 'Tab') return [] // never ours (C10)
  const chords = chordsFor(e)
  const found = CREATION_ACTIONS.filter((a) => b[a].some((c) => chords.includes(c)))
  if (found.length) return found
  const fb = CHAR_FALLBACK[e.key]
  return fb && DEFAULT_CREATION_BINDINGS[fb].every((c) => b[fb].includes(c)) ? [fb] : []
}

/** A chord ending on Tab / Enter / Escape, as a code or as a key ('Ctrl+Tab', 'key:Enter'). */
const isReserved = (chord: string): boolean => RESERVED_CODES.includes((chord.split('+').pop() ?? '').replace(/^key:/, ''))

/**
 * Tolerant parse (as `parseBindings`): unknown actions dropped; a list that is
 * not an array of strings, or that names a reserved key (Tab, Enter, Escape),
 * falls back to the default; CANCEL is always Escape. A default filled in never
 * takes a key the learner already gave to another action.
 */
export function parseCreationBindings(raw: unknown): CreationBindings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = {} as CreationBindings
  const used = new Set<string>()
  const missing: CreationAction[] = []
  for (const a of CREATION_ACTIONS) {
    const v = obj[a]
    const valid =
      Array.isArray(v) &&
      v.every((c) => typeof c === 'string' && c.length > 0 && !isReserved(c))
    if (a !== 'CANCEL' && valid) {
      out[a] = [...(v as string[])]
      for (const c of out[a]) used.add(c)
    } else missing.push(a)
  }
  for (const a of missing) out[a] = DEFAULT_CREATION_BINDINGS[a].filter((c) => a === 'CANCEL' || !used.has(c))
  return out
}

/** Bindings saved under 'audio-sim/creation-bindings.v1'; defaults when absent, unreadable or invalid. */
export function loadCreationBindings(storage: Storage | null): CreationBindings {
  try {
    const raw = storage?.getItem(CREATION_BINDINGS_KEY)
    return parseCreationBindings(raw ? JSON.parse(raw) : {})
  } catch {
    return parseCreationBindings({})
  }
}

const K = (): Readonly<Record<string, string>> => COPY.keys!

/** French name of one key ('KeyZ' → 'Z', 'Delete' → 'Suppr', 'key:z' → 'Z'). */
function keyName(k: string): string {
  if (k.startsWith('key:')) {
    const c = k.slice(4)
    return c.length === 1 ? c.toUpperCase() : c
  }
  const np = /^Numpad(\d)$/.exec(k)
  if (np) return K().numpad ? `${K().numpad} ${np[1]}` : np[1]
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(k)
  if (m) return m[1]
  const named: Record<string, string | undefined> = {
    Delete: K().delete,
    Space: K().space,
    Escape: K().escape,
    Enter: K().enter,
    BracketLeft: '[',
    BracketRight: ']',
  }
  return named[k] ?? k
}

/** French label of an action's first binding: « Ctrl+Z », « Suppr », « Espace », « [ », « Maj+V ». '' when unbound. */
export function bindingLabel(b: CreationBindings, a: CreationAction): string {
  const chord = b[a][0]
  if (!chord) return ''
  const parts = chord.split('+')
  const key = parts.pop()!
  const mods = parts.map((p) => (p === 'Shift' ? K().shift! : p))
  return [...mods, keyName(key)].join('+')
}
