/**
 * Port labels (Task 26, C18): the DOM bubbles anchored to a port of the 3D scene.
 *
 * - Hover / focus label: ONE small tooltip with the port's name, connector and signal; hidden the moment the
 *   pointer leaves the port (never permanent), `aria-hidden` (the same text is announced by the status bar /
 *   the keyboard path), never takes a click (`pointer-events: none`).
 * - Pinned refusal: `role="alert"` at the second port of a refused connection, until the next patch action,
 *   Échap, or a place change.
 * - « Débrancher » offer on an occupied port: a small group with the button; closes with Échap, a press
 *   elsewhere in the 3D view, or the unplug itself.
 *
 * Nothing here is on screen at rest: every element is `hidden` until used, so the viewport stays clear
 * (layout test). DOM only: no 3D scene, no render request, no timer. The elements follow their port through
 * `move*` (the camera moved) and are removed with the bag.
 */
import './portLabel.css'
import type { DisposableBag } from '../../util/disposable'
import { COPY } from '../copy'
import type { PatchUi } from '../patchController'

type Pt = { x: number; y: number }

/** Gap between the port and its bubble (CSS px). */
const GAP = 14
/** Keep the bubble this far from the viewport's edges. */
const EDGE = 6

/**
 * Where a bubble of `w` x `h` goes for a port at (x, y) in a box of `boxW` x `boxH`: centred above the port,
 * flipped below it when there is no room above, and kept inside the box. Pure (unit tested).
 */
export function placeBubble(at: Pt, size: { w: number; h: number }, box: { w: number; h: number }): { left: number; top: number } {
  const maxLeft = Math.max(EDGE, box.w - size.w - EDGE)
  const left = Math.min(Math.max(at.x - size.w / 2, EDGE), maxLeft)
  const above = at.y - GAP - size.h
  const top = above >= EDGE ? above : Math.min(at.y + GAP, Math.max(EDGE, box.h - size.h - EDGE))
  return { left: Math.round(left), top: Math.round(top) }
}

export interface PortLabelUi extends PatchUi {
  /** The three elements, for tests and layout checks. */
  readonly elements: { hover: HTMLElement; error: HTMLElement; offer: HTMLElement }
}

export function mountPortLabels(doc: Document, parent: HTMLElement, bag: DisposableBag): PortLabelUi {
  const make = (cls: string, testid: string): HTMLElement => {
    const el = doc.createElement('div')
    el.className = `cr-port-label ${cls}`
    el.dataset.testid = testid
    el.hidden = true
    parent.appendChild(el)
    bag.add(() => el.remove())
    return el
  }
  const hover = make('cr-port-hover', 'port-label')
  hover.setAttribute('aria-hidden', 'true')
  const error = make('cr-port-error', 'port-error')
  error.setAttribute('role', 'alert')
  const offer = make('cr-port-offer', 'port-offer')
  offer.setAttribute('role', 'group')
  offer.setAttribute('aria-label', COPY.patch!.offerGroup!)
  const offerText = doc.createElement('span')
  const offerButton = doc.createElement('button')
  offerButton.type = 'button'
  offerButton.className = 'cr-port-unplug'
  offerButton.dataset.testid = 'port-unplug'
  offerButton.textContent = COPY.patch!.offerUnplug!
  offer.append(offerText, offerButton)
  let onUnplug: (() => void) | null = null
  bag.listen(offerButton, 'click', () => onUnplug?.())

  /** Page px -> a point in `parent`, then place the (already unhidden, already filled) bubble. */
  const place = (el: HTMLElement, page: Pt): void => {
    const box = parent.getBoundingClientRect()
    const at = { x: page.x - box.left, y: page.y - box.top }
    const size = { w: el.offsetWidth, h: el.offsetHeight }
    const p = placeBubble(at, size, { w: box.width, h: box.height })
    el.style.left = `${p.left}px`
    el.style.top = `${p.top}px`
  }
  const hide = (el: HTMLElement): void => {
    el.hidden = true
  }

  bag.add(() => {
    onUnplug = null
  })

  return {
    elements: { hover, error, offer },
    showHover(text, at) {
      hover.textContent = text
      hover.hidden = false
      place(hover, at)
    },
    moveHover(at) {
      if (!hover.hidden) place(hover, at)
    },
    hideHover: () => hide(hover),
    pinError(text, at) {
      // Hidden then shown with its text in one go: the alert is announced as it appears.
      error.hidden = false
      error.textContent = text
      place(error, at)
    },
    moveError(at) {
      if (!error.hidden) place(error, at)
    },
    clearError() {
      hide(error)
      error.textContent = ''
    },
    offerUnplug(o) {
      offerText.textContent = o.text
      offerButton.setAttribute('aria-label', o.buttonName)
      onUnplug = o.onUnplug
      offer.hidden = false
      place(offer, o.at)
    },
    moveOffer(at) {
      if (!offer.hidden) place(offer, at)
    },
    clearOffer() {
      onUnplug = null
      hide(offer)
    },
    hasFocus: () => doc.activeElement === offerButton,
  }
}
