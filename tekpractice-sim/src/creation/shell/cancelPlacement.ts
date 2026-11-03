/**
 * « Annuler la pose » (Task 43b, L21): a visible way to cancel a pose for people with no Échap (touch, pointer only).
 * A real button on the bottom left of the 3D view, shown only while a device follows the pointer; at least 44 px.
 * It is not in the status bar: that bar is 28 px high, a 44 px target does not fit in it. Hidden = out of the tab order
 * and the accessibility tree; when it hides while it has focus, focus goes back to the 3D view.
 * DOM only: it dispatches nothing but the `onCancel` it is given.
 */
import { COPY } from '../copy'

export interface CancelPlacementDeps {
  doc: Document
  /** The element the button sits in (the shell's viewport, `position: relative`). */
  parent: HTMLElement
  /** The button was activated (click, tap, Entrée, Espace). */
  onCancel(): void
  /** Hands focus back to the 3D view when the button hides under the focus. */
  focusView(): void
}

export interface CancelPlacement {
  readonly button: HTMLButtonElement
  setVisible(on: boolean): void
  dispose(): void
}

export function mountCancelPlacement(d: CancelPlacementDeps): CancelPlacement {
  const button = d.doc.createElement('button')
  button.type = 'button'
  button.className = 'cr-cancel-pose'
  button.dataset.testid = 'cancel-placement'
  button.textContent = COPY.placement!.cancelButton!
  button.hidden = true
  const onClick = (): void => d.onCancel()
  button.addEventListener('click', onClick)
  d.parent.appendChild(button)
  let dead = false
  return {
    button,
    setVisible(on) {
      if (dead || button.hidden === !on) return
      const hadFocus = d.doc.activeElement === button
      button.hidden = !on
      if (!on && hadFocus) d.focusView()
    },
    dispose() {
      if (dead) return
      dead = true
      button.removeEventListener('click', onClick)
      button.remove()
    },
  }
}
