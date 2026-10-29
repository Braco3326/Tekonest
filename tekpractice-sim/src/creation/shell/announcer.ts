/**
 * ONE announcer for the status line (Phase 4 final wave). The status line is a single polite live region where the last write wins; the shell's own
 * announcements, the listen controller's and the coverage controller's can all happen in the same store change (the sound stops AND the coverage has no
 * speaker left), and the later writer used to silence the earlier one (WCAG 4.1.3). The FIRST message of a tick is written at once (so the order against the
 * other, direct writers of the status line is unchanged: « Posé : … » still comes after what the same click announced); if more distinct messages arrive in the
 * same tick, the end of the tick writes them all, joined as sentences in the order they arrived.
 *
 * Pure: no DOM; the sink and the scheduler are injected. Each controller keeps its own once-per-change dedupe (Task 37 round 2): this only merges.
 */
export interface Announcer {
  /** `reannounce`: an answer to a learner's action, read again even when the text did not change (default true, like `setStatus`). */
  say(message: string, reannounce?: boolean): void
  /** Drop what is pending and ignore what comes after. */
  dispose(): void
}

const sentence = (m: string): string => (/[.!?…]$/.test(m) ? m : `${m}.`)

export function createAnnouncer(sink: (message: string, reannounce: boolean) => void, later: (fn: () => void) => void = (fn) => queueMicrotask(fn)): Announcer {
  let pending: string[] = []
  let again = false
  let scheduled = false
  let dead = false
  const flush = (): void => {
    scheduled = false
    const messages = pending
    const reannounce = again
    pending = []
    again = false
    // One message was already written when it arrived: only a merge needs the end of the tick.
    if (dead || messages.length < 2) return
    sink(messages.map(sentence).join(' '), reannounce)
  }
  return {
    say(message, reannounce = true) {
      if (dead) return
      const m = message.trim()
      if (m === '') return
      if (pending.includes(m)) return
      pending.push(m)
      again = again || reannounce
      if (pending.length === 1) sink(m, reannounce) // the first of the tick: now
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
