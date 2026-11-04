/**
 * « Choisir un fichier audio… » keeps an AudioContext (made in the menu click) until the file arrives. A dialog closed with no file normally sends the input's
 * `cancel` event, but not every browser does: as a fallback, when the window gets the focus back and nothing arrived within a moment, the unused context is
 * dropped. Pure: the focus source and the timer are injected.
 */
export interface DialogGuardDeps {
  /** The window got the focus back (the native dialog closed); returns the remover. */
  onFocusBack(fn: () => void): () => void
  later(fn: () => void, ms: number): number
  clear(id: number): void
}

/** After the focus comes back, `change` follows at once when a file was chosen; this is the margin before we conclude that none was. */
export const CANCEL_FALLBACK_MS = 1500

/** Arms the fallback; `isStillWaiting()` is true while the context is unused; returns `disarm` (idempotent). */
export function armCancelFallback(deps: DialogGuardDeps, isStillWaiting: () => boolean, drop: () => void): () => void {
  let timer: number | null = null
  let off: (() => void) | null = null
  const disarm = (): void => {
    off?.()
    off = null
    if (timer !== null) deps.clear(timer)
    timer = null
  }
  off = deps.onFocusBack(() => {
    if (timer !== null) return
    timer = deps.later(() => {
      timer = null
      const waiting = isStillWaiting()
      disarm()
      if (waiting) drop()
    }, CANCEL_FALLBACK_MS)
  })
  return disarm
}
