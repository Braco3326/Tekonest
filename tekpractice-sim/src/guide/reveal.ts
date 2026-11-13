// G14c fix (a): the tutorial rings a Propriétés button (« Connecter à… », « Lecture console », « Débrancher ») that can sit below the panel's fold at 768 px.
// The vendored widget scrolls its target into view only for an element carrying `data-oscar-anchor` (ui/widget.ts); the tutorial's reserved anchors resolve
// to a rect, so nothing scrolled and the ring was hidden off the panel. This brings that button into view inside its own scroll box, once per target: a
// learner who scrolls it away again afterwards is left alone (the 500 ms poll never fights a hand on the wheel). DOM only, no Babylon, no vendored change.

/** The part of an element the revealer reads. */
export interface RevealElement {
  getBoundingClientRect(): { top: number; bottom: number }
  scrollIntoView?(o: { block: 'nearest' | 'center'; inline?: 'nearest' }): void
  readonly parentElement: RevealElement | null
  readonly scrollHeight?: number
  readonly clientHeight?: number
}
export interface RevealDoc {
  querySelector(selector: string): RevealElement | null
}

/** The nearest ancestor that scrolls vertically (its content is taller than its box and its overflow lets it scroll), or null. */
export function scrollBoxOf(el: RevealElement, overflowY: (e: RevealElement) => string): RevealElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const o = overflowY(p)
    if ((o === 'auto' || o === 'scroll') && (p.scrollHeight ?? 0) > (p.clientHeight ?? 0)) return p
  }
  return null
}

/**
 * `reveal(selector, key)`: when the element of `selector` lies (even partly) outside its scroll box, scroll it into view (`block: 'nearest'`), unless this same
 * `key` was already revealed (then the learner moved it: leave it). A key that is shown whole is remembered too. Never throws.
 */
export function createRevealer(doc: RevealDoc | undefined, overflowY: (e: RevealElement) => string): (selector: string, key: string) => boolean {
  const done = new Set<string>()
  return (selector, key) => {
    try {
      if (doc === undefined || done.has(key)) return false
      const el = doc.querySelector(selector)
      if (el === null) return false
      // no scroll box yet (Propriétés folded: its body does not scroll) or no box at all: nothing to do now, and nothing remembered (asked again later)
      const box = scrollBoxOf(el, overflowY)
      if (box === null) return false
      const r = el.getBoundingClientRect()
      if (!(r.bottom > r.top)) return false
      const b = box.getBoundingClientRect()
      done.add(key)
      if (r.top >= b.top && r.bottom <= b.bottom) return false
      if (typeof el.scrollIntoView !== 'function') return false
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return true
    } catch {
      return false
    }
  }
}
