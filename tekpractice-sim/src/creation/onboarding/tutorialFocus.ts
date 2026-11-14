/**
 * The device the tutorial's step points at is brought into the 3D view when it is not there. Selecting a device flies the camera to it
 * (selection.ts), so after the mic is cabled at step 5 the console of step 6 was off screen (or, two panels open, under a panel) and the ring had nothing to
 * ring. The guide tells which device (`tekpractice:tutorial-focus`, src/design/events.ts; creation never imports the guide); this flies the camera to that
 * device WITHOUT selecting it (the step still asks the learner to select it), and only when it is not on view: a device the learner can already see is left
 * where it is, and nothing moves while the focus stays the same. No package-number branching: the same rule everywhere a tutorial runs.
 */
import { TUTORIAL_FOCUS_EVENT } from '../../design/events'

export interface TutorialFocusDeps {
  win: Pick<Window, 'addEventListener'> | null
  /** The device's body point is inside the 3D view and nothing of the page covers it (the assistant does not count: it moves). */
  onView(instance: string): boolean
  /** Fly the camera to the device, the selection untouched; false when it cannot (walking, unknown device). */
  show(instance: string): boolean
}

export function wireTutorialFocus(d: TutorialFocusDeps): void {
  let last: string | null = null
  d.win?.addEventListener(TUTORIAL_FOCUS_EVENT, (e: Event) => {
    try {
      const id = (e as CustomEvent<{ instance?: unknown }>).detail?.instance
      const next = typeof id === 'string' && id !== '' ? id : null
      if (next === last) return
      last = next
      if (next !== null && !d.onView(next)) d.show(next)
    } catch {
      // a broken reader never stops the page
    }
  })
}

/**
 * `onView` from the page: the point (page px) is inside the view's box, and the element there is the 3D canvas or one of the assistant's nodes (its bubble glides
 * away; a panel, the drawer or a dialog over the device does not).
 */
export function pointOnView(doc: Pick<Document, 'elementFromPoint'>, canvas: Element, view: { left: number; top: number; right: number; bottom: number }, p: { x: number; y: number } | null): boolean {
  if (p === null || !(p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom)) return false
  const el = doc.elementFromPoint(p.x, p.y)
  return el === canvas || (el !== null && el.closest('[data-oscar-root], .oscar-guide') !== null)
}
