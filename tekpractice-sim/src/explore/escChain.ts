/**
 * Esc priority chain (ADR-0010 Décision 5) — pure. Esc always undoes the most
 * recent, most local commitment; held-cable and focus steps are delegated to the
 * ADR-0008 focusMachine (same order it already uses).
 *
 * Essais (Task 14): "close compare" is step 3b, right after "close top panel"
 * (safe because compare is read-only: closing it restores the live setup). The
 * Essais side panel itself closes after the cable / focus steps.
 */
export interface EscContext {
  pointerLocked: boolean
  /** ms since the pointer lock was released (the browser eats that Esc). */
  msSinceUnlock: number
  placing: boolean
  openPanels: number
  holdingCable: boolean
  focused: boolean
  view: 'explore' | 'orbit'
  /** An Essais compare (read-only preview) is open. */
  comparing?: boolean
  /** The Essais side panel is open (non-modal). */
  sidePanel?: boolean
}

export type EscAction =
  | 'release-pointer'
  | 'ignore'
  | 'cancel-placement'
  | 'close-panel'
  | 'close-compare'
  | 'drop-cable'
  | 'leave-focus'
  | 'close-side-panel'
  | 'open-pause'
  | 'none'

export const UNLOCK_GRACE_MS = 150

export function resolveEsc(c: EscContext): EscAction {
  if (c.pointerLocked) return 'release-pointer'
  if (c.msSinceUnlock < UNLOCK_GRACE_MS) return 'ignore'
  if (c.placing) return 'cancel-placement'
  if (c.openPanels > 0) return 'close-panel'
  if (c.comparing) return 'close-compare'
  if (c.holdingCable) return 'drop-cable'
  if (c.focused) return 'leave-focus'
  if (c.sidePanel) return 'close-side-panel'
  return c.view === 'explore' ? 'open-pause' : 'none'
}
