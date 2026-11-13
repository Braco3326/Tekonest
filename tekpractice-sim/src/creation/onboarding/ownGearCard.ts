/**
 * The entrepreneur's card, DOM (onboarding packs, plan T6.4; the words and the gate are ownGear.ts). A reserved ROW of the shell grid, like the tutorial's step card
 * (`.cr[data-gear='on']`, ownGear.css), at the foot of the 3D view just above the status bar: it never overlays the 3D view, the drawer, the panels or Oscar, and it
 * takes nothing from the canvas centre but the rows it needs. It is a labelled region: no dialog role, no `aria-modal`, nothing inert, no focus trap, no animation, no
 * timer. Its only control is the dismiss button, which is in the tab order after the status bar (the slot is the LAST child of the shell root); Escape is not read here.
 * The venue cards are informational: a list of three types, no button, no link.
 *
 * Chosen over the status bar (one line of 28 px with its own chips: three cards and a sentence do not fit), over a card in the place picker (it is gone once a room is open,
 * and these are not rooms) and over the checklist (it hides while the bench plays, which is exactly when this card is due).
 */
import { ownGearView } from './ownGear'
import './ownGear.css'

export const GEAR_SLOT_TESTID = 'gear-slot'

export interface OwnGearCardDeps {
  doc: Document
  /** The shell root (`[data-testid="creation-root"]`): the slot is appended to it and it carries `data-gear`. */
  root: HTMLElement
  /** The dismiss button was pressed: the owner remembers it and gives the focus back. */
  onDismiss(): void
  /**
   * The place picker's `covers` array (T6 review N5): while the card shows its slot is in it, so the picker makes it `inert` (« Fermer » is not tabbable under the picker or the start
   * stage) and frees it again when the picker closes. Absent = no such cover (a unit test).
   */
  covers?: HTMLElement[]
  /** The picker is open now: the slot is born inert then (the picker only touches its covers when it opens or closes). */
  covered?(): boolean
}

/**
 * The slot opened or closed: the shell's rows moved, so the page is told what a window resize tells it (Oscar re-rests clear of the row, or back where he was; the render loop and the view
 * cube re-measure), after the current call stack, as the step card does (T6 review N4). Never throws.
 */
function relayout(doc: Document): void {
  try {
    const win = doc.defaultView
    if (win !== null && typeof win.dispatchEvent === 'function' && typeof Event === 'function') queueMicrotask(() => win.dispatchEvent(new Event('resize')))
  } catch {
    // nothing to tell
  }
}

export interface OwnGearCard {
  /** Idempotent. */
  show(): void
  /** Idempotent: the slot leaves the page at once and the row is freed. */
  hide(): void
  readonly shown: boolean
}

export function mountOwnGearCard(d: OwnGearCardDeps): OwnGearCard {
  let slot: HTMLElement | null = null
  const build = (): HTMLElement => {
    const v = ownGearView()
    const el = (tag: string, cls: string, text?: string): HTMLElement => {
      const e = d.doc.createElement(tag)
      e.className = cls
      if (text !== undefined) e.textContent = text
      return e
    }
    const box = el('div', 'cr-gear-slot')
    box.dataset.testid = GEAR_SLOT_TESTID
    const card = el('section', 'tp-gear')
    card.dataset.testid = 'own-gear'
    card.setAttribute('aria-label', v.region)
    const line = el('p', 'tp-gear-line', v.line)
    line.dataset.testid = 'own-gear-line'
    const list = el('ul', 'tp-gear-venues')
    list.dataset.testid = 'own-gear-venues'
    for (const venue of v.venues) {
      const li = el('li', 'tp-gear-venue')
      li.dataset.testid = 'own-gear-venue'
      li.append(el('span', 'tp-gear-venue-title', venue.title), el('span', 'tp-gear-venue-label', venue.label))
      list.append(li)
    }
    const close = el('button', 'tp-gear-dismiss', v.dismiss) as HTMLButtonElement
    close.type = 'button'
    close.dataset.testid = 'own-gear-dismiss'
    close.addEventListener('click', () => d.onDismiss())
    card.append(line, list, close)
    box.append(card)
    return box
  }
  return {
    show() {
      if (slot !== null) return
      slot = build()
      slot.inert = d.covered?.() === true
      d.root.appendChild(slot)
      d.covers?.push(slot)
      d.root.dataset.gear = 'on'
      relayout(d.doc)
    },
    hide() {
      if (slot === null) return
      const gone = slot
      slot.remove()
      slot = null
      delete d.root.dataset.gear
      if (d.covers) {
        const at = d.covers.indexOf(gone)
        if (at >= 0) d.covers.splice(at, 1)
      }
      relayout(d.doc)
    },
    get shown() {
      return slot !== null
    },
  }
}
