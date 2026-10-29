/**
 * The page's AudioContext, made where the browser wants it (Task 39 review): SYNCHRONOUSLY inside the user's click, before any `await`. Safari and iOS
 * start a context made later suspended, and `resume()` outside a gesture may never settle. This file is tiny and static (the start chunk holds it); the
 * engine (the lazy chunk) takes the context it is handed.
 *
 * It also owns the leak counters the e2e reads (`__creation.audioStats()`): every context opened must be closed, every object URL revoked, every <audio>
 * element removed. Browser globals are read at call time, never at import.
 */

/** Counters over the page's life. */
export const audioStats = { contexts: { opened: 0, closed: 0 }, urls: { created: 0, revoked: 0 }, elements: { created: 0, removed: 0 } }

/** A new context (not counted): the one the engine makes itself when it is not handed one. */
export function newAudioContext(): AudioContext {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctor({ latencyHint: 'playback' })
}

/**
 * A context made inside a click handler. Counted as opened; whoever ends up not using it must `closeAudioContext` it. Null when the browser has none
 * or refuses to make one: the engine then makes its own (and fails with a message if it cannot either).
 */
export function openAudioContext(): AudioContext | null {
  try {
    const ctx = newAudioContext()
    audioStats.contexts.opened++
    return ctx
  } catch (e) {
    console.warn('[audio] no AudioContext', e)
    return null
  }
}

/** Close a context that was opened but never handed to an engine (a Stop during the chunk load, a cancelled file dialog). Never throws. */
export function closeAudioContext(ctx: AudioContext | null): void {
  if (!ctx) return
  audioStats.contexts.closed++
  try {
    ctx.close().catch(() => undefined)
  } catch {
    /* already closed */
  }
}
