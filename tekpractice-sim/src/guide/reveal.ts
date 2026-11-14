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

/** The part of an element the row revealer reads and moves (a sideways-scrolling row, the inventory drawer's tabs). */
export interface RowElement {
  getBoundingClientRect(): { left: number; right: number }
  readonly parentElement: RowElement | null
  readonly scrollWidth?: number
  readonly clientWidth?: number
  scrollLeft?: number
}
export interface RowDoc {
  querySelector(selector: string): RowElement | null
}

/** The nearest ancestor that scrolls sideways (its content is wider than its box and its overflow lets it scroll), or null. */
export function rowBoxOf(el: RowElement, overflowX: (e: RowElement) => string): RowElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const o = overflowX(p)
    if ((o === 'auto' || o === 'scroll') && (p.scrollWidth ?? 0) > (p.clientWidth ?? 0)) return p
  }
  return null
}

/**
 * Merge fix (2026-11-14): the equipment build has eleven drawer tabs, so at 1366 px « Secteur » sits past the right end of the tab row (the row scrolls sideways,
 * inventoryDrawer.ts). The tutorial rang that hidden tab: its rect lay under « Fermer », and a learner clicking the ring closed the drawer (step 7, a dead end).
 * `revealRow(selector)`: when the element lies (even partly) outside its sideways scroll box, or within `edge` px of a side (the row's edge fade), the box is
 * scrolled so the element is centred (clamped by the browser at the ends of the row, where there is no fade). Only that box moves (no scrollIntoView: the page
 * and the drawer stay put). Once per ELEMENT: the drawer rebuilds its tabs at each open, so a reopened drawer is a new target, while a tab the learner scrolled
 * away again in the same open drawer is left alone. Never throws.
 */
export function createRowRevealer(doc: RowDoc | undefined, overflowX: (e: RowElement) => string, edge = 28): (selector: string) => boolean {
  const done = new WeakSet<RowElement>()
  return (selector) => {
    try {
      if (doc === undefined) return false
      const el = doc.querySelector(selector)
      if (el === null || done.has(el)) return false
      const box = rowBoxOf(el, overflowX)
      if (box === null) return false
      const r = el.getBoundingClientRect()
      if (!(r.right > r.left)) return false
      const b = box.getBoundingClientRect()
      done.add(el)
      if (r.left >= b.left + edge && r.right <= b.right - edge) return false
      if (typeof box.scrollLeft !== 'number') return false
      box.scrollLeft += (r.left + r.right) / 2 - (b.left + b.right) / 2
      return true
    } catch {
      return false
    }
  }
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
