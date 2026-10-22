/**
 * Esc priority chain (ADR-0010 Décision 5) — pure. Esc always undoes the most
 * recent, most local commitment; held-cable and focus steps are delegated to the
 * ADR-0008 focusMachine (same order it already uses).
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
}

export type EscAction =
  | 'release-pointer'
  | 'ignore'
  | 'cancel-placement'
  | 'close-panel'
  | 'drop-cable'
  | 'leave-focus'
  | 'open-pause'
  | 'none'

export const UNLOCK_GRACE_MS = 150

export function resolveEsc(c: EscContext): EscAction {
  if (c.pointerLocked) return 'release-pointer'
  if (c.msSinceUnlock < UNLOCK_GRACE_MS) return 'ignore'
  if (c.placing) return 'cancel-placement'
  if (c.openPanels > 0) return 'close-panel'
  if (c.holdingCable) return 'drop-cable'
  if (c.focused) return 'leave-focus'
  return c.view === 'explore' ? 'open-pause' : 'none'
}
