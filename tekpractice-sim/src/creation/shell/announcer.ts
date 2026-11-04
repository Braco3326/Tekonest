/**
 * ONE announcer for the status line (Phase 4 final wave). The status line is a single polite live region where the last write wins; the answers to a learner's
 * action (a deletion, a cable, a placement, a view…), the playback / signal announcements of the store change, the listen controller's and the coverage
 * controller's can all happen in the same tick (Suppr on the console: « Supprimé… » AND the sound stops AND the mic is lost), and the later writer used to
 * silence the earlier one (WCAG 4.1.3). The FIRST message of a tick is written at once (so the order against the few writers that do not use the announcer, the
 * « busy » / « Prêt » states, is unchanged); if more distinct messages arrive in the same tick, the end of the tick writes them all, joined as sentences in the
 * order they arrived.
 *
 * Pure: no DOM; the sink and the scheduler are injected. Each controller keeps its own once-per-change dedupe (Task 37 round 2): this only merges.
 */
export type StatusState = 'idle' | 'ready'

export interface Announcer {
  /** `reannounce`: an answer to a learner's action, read again even when the text did not change (default true, like `setStatus`). `state`: the line's state (default ready). */
  say(message: string, reannounce?: boolean, state?: StatusState): void
  /** Drop what is pending and ignore what comes after. */
  dispose(): void
}

const sentence = (m: string): string => (/[.!?…]$/.test(m) ? m : `${m}.`)

export function createAnnouncer(
  sink: (message: string, reannounce: boolean, state: StatusState) => void,
  later: (fn: () => void) => void = (fn) => queueMicrotask(fn)
): Announcer {
  let pending: string[] = []
  let again = false
  let anyReady = false
  let scheduled = false
  let dead = false
  const flush = (): void => {
    scheduled = false
    const messages = pending
    const reannounce = again
    const state: StatusState = anyReady ? 'ready' : 'idle'
    pending = []
    again = false
    anyReady = false
    // One message was already written when it arrived: only a merge needs the end of the tick.
    if (dead || messages.length < 2) return
    sink(messages.map(sentence).join(' '), reannounce, state)
  }
  return {
    say(message, reannounce = true, state = 'ready') {
      if (dead) return
      const m = message.trim()
      if (m === '') return
      if (pending.includes(m)) return
      pending.push(m)
      again = again || reannounce
      anyReady = anyReady || state === 'ready'
      if (pending.length === 1) sink(m, reannounce, state) // the first of the tick: now
      if (!scheduled) {
        scheduled = true
        later(flush)
      }
    },
    dispose() {
      dead = true
      pending = []
    },
  }
}
