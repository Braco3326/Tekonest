/**
 * Text setter for a `role="status"` live region. Screen readers announce a
 * CHANGE only, so setting the same text twice (select the same device again,
 * « Aucun appareil à sélectionner » on every missed key) would stay silent:
 * the region is cleared now and the text set again ~100 ms later (one frame is
 * too short for some screen readers to notice the clear) — only when
 * `reannounce` (an answer to the learner's key); a background refresh with the
 * same text (« Prêt » after every edit) stays silent.
 */
export const REANNOUNCE_MS = 100

export function createLiveText(el: { textContent: string | null }, later: (fn: () => void, ms: number) => void): (text: string, reannounce?: boolean) => void {
  let wanted = el.textContent ?? ''
  let seq = 0
  return (text: string, reannounce = false): void => {
    const same = text === wanted && text !== ''
    if (same && !reannounce) return
    const mine = ++seq
    wanted = text
    if (!same) {
      el.textContent = text
      return
    }
    el.textContent = ''
    later(() => {
      if (mine === seq) el.textContent = text
    }, REANNOUNCE_MS)
  }
}
