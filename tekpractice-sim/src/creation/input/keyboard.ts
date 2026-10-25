/**
 * Mode Création keyboard (Task 8, C10, P3): ONE keydown listener on `window`,
 * owned by the shell's DisposableBag. Key events become `CreationAction`s via
 * the key map; features register handlers with `onAction` as they land.
 *
 * - The focus key is never ours: the browser always moves focus (CA-01).
 * - Nothing fires while a text field has focus, except CANCEL and SAVE.
 * - Nothing fires inside a modal dialog (it handles its own keys).
 * - `[` / `]`, F and Entrée act only while the 3D canvas has focus (as its label says).
 * - Space on a focused button / link / menu item stays that control's activation key.
 * - preventDefault() only when a handler took the action (returned anything but false).
 */
import { isTextTarget } from '../../scene/cameraTween'
import type { DisposableBag, ListenTarget } from '../../util/disposable'
import { creationActionsFor, type CreationAction, type CreationBindings } from './creationActions'

/** Return `false` when the action did not apply (the event then stays the browser's). */
export type ActionHandler = (e: KeyboardEvent) => boolean | void

export interface CreationKeyboard {
  readonly bindings: CreationBindings
  /** Register the handler of an action (one per action); returns its removal. */
  onAction(action: CreationAction, fn: ActionHandler): () => void
}

export interface KeyboardDeps {
  bag: DisposableBag
  bindings: CreationBindings
  /** The 3D canvas (`[`, `]`, Entrée act only when it has focus). */
  canvas: HTMLElement
  /** Defaults to `window`. */
  target?: ListenTarget
  /**
   * True for an action that is off right now (the place picker covers the workspace:
   * Ctrl+Z must not edit the rig under it). The key then stays the browser's.
   */
  suspended?: (action: CreationAction) => boolean
}

const IN_TEXT_OK: ReadonlySet<CreationAction> = new Set<CreationAction>(['CANCEL', 'SAVE'])
/**
 * Single-character keys that act only while the 3D canvas has focus (WCAG 2.1.4:
 * no remapping UI yet, so a stray F / [ / ] typed elsewhere must do nothing).
 * Tasks that register other single-character actions extend this set or ship a remap UI
 * (guarded by tests/creation/characterKeys.test.ts).
 */
export const CANVAS_ONLY: ReadonlySet<CreationAction> = new Set<CreationAction>(['NEXT_DEVICE', 'PREV_DEVICE', 'FRAME_SELECTION', 'VIEW_PICKER', 'WALK_TOGGLE'])

const CHARACTER_CODE = /^(Key[A-Z]|Digit\d|Numpad\d|BracketLeft|BracketRight|Minus|Equal|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote|IntlBackslash)$/

/**
 * A chord that is one letter / digit / punctuation key with no modifier, or with
 * Shift only (it still types a character: « V », « ? »): a WCAG 2.1.4 « character key shortcut ».
 */
export function isPlainCharacterChord(chord: string): boolean {
  const parts = chord.split('+')
  const key = parts.pop()!
  if (parts.some((m) => m !== 'Shift')) return false
  if (key.startsWith('key:')) return key.length === 5
  return CHARACTER_CODE.test(key)
}
const CONTROL_ROLES = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'checkbox', 'radio', 'switch', 'tab', 'option', 'treeitem'])

type ElementLike = { tagName?: string; getAttribute?(n: string): string | null; closest?(s: string): unknown }

/** A focused control whose own activation key is Space (button, link, menu item…). */
function isControl(t: ElementLike | null): boolean {
  if (!t || typeof t !== 'object') return false
  const tag = (t.tagName ?? '').toUpperCase()
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true
  return CONTROL_ROLES.has(t.getAttribute?.('role') ?? '')
}

const inDialog = (t: ElementLike | null): boolean =>
  !!t && typeof t.closest === 'function' && !!t.closest('[role="dialog"], [role="alertdialog"], dialog')

const plain = (e: KeyboardEvent): boolean => !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey

export function mountCreationKeyboard(d: KeyboardDeps): CreationKeyboard {
  const handlers = new Map<CreationAction, ActionHandler>()

  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.isComposing) return
    const t = e.target as ElementLike | null
    if (inDialog(t)) return
    const onCanvas = e.target === d.canvas
    let actions = creationActionsFor(d.bindings, e)
    // Entrée frames the selection from the 3D view (fixed: Enter is never rebindable).
    if (!actions.length && onCanvas && plain(e) && (e.code === 'Enter' || e.code === 'NumpadEnter')) actions = ['FRAME_SELECTION']
    const text = isTextTarget(e.target)
    for (const a of actions) {
      if (d.suspended?.(a)) continue
      if (text && !IN_TEXT_OK.has(a)) continue
      if (CANVAS_ONLY.has(a) && !onCanvas) continue
      if (e.code === 'Space' && plain(e) && isControl(t)) continue
      const fn = handlers.get(a)
      if (!fn || fn(e) === false) continue
      e.preventDefault()
      return
    }
  }
  d.bag.listen(d.target ?? window, 'keydown', onKey)

  return {
    bindings: d.bindings,
    onAction(action, fn) {
      handlers.set(action, fn)
      return () => {
        if (handlers.get(action) === fn) handlers.delete(action)
      }
    },
  }
}
