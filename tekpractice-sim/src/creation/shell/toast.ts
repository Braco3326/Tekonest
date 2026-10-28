/**
 * The missed-click toast (Task 25, CA-12): a short polite message over the 3D view (`role="status"`,
 * `aria-live="polite"`) that lasts 2.5 s. DOM only, no 3D scene and no render request: showing and hiding
 * it costs the renderer nothing, so an idle page stays at 0 renders.
 *
 * - It never takes focus (not focusable, `pointer-events: none`: the next click still reaches the canvas).
 * - The region is always in the page (hidden while empty). A message is set into the region once it is
 *   rendered and empty, ~100 ms later, so screen readers notice the change. While the region is empty the
 *   box is drawn invisible (toast.css `:empty`: it stays rendered, so the change is still noticed). The same
 *   message asked again while it is still up only restarts the 2.5 s: no clear, no flicker, no second announcement
 *   (a miss on every click would otherwise repeat itself); a different message, or the same one after it ended, is announced.
 * - One timer at most besides the 2.5 s one; both are cleared on `dismiss()` and with the bag (page teardown),
 *   so none outlives the page or a place change (the shell dismisses on a place change).
 */
import './toast.css'
import type { DisposableBag } from '../../util/disposable'
import { REANNOUNCE_MS } from './liveText'

/** How long a message stays. */
export const TOAST_MS = 2500

/** What the toast needs of its element (a real HTMLElement; tests fake it). */
export interface ToastEl {
  hidden: boolean
  textContent: string | null
}

export interface Toast {
  /** Show a message for 2.5 s (a message already up is replaced and the 2.5 s start again). */
  show(message: string): void
  /** Hide it now (a place change, teardown). */
  dismiss(): void
  readonly visible: boolean
}

export function createToast(el: ToastEl, bag: DisposableBag): Toast {
  let say: ReturnType<typeof setTimeout> | null = null
  let end: ReturnType<typeof setTimeout> | null = null
  let visible = false
  let disposed = false
  /** The message on screen or about to be set (null when none). */
  let current: string | null = null

  const clear = (): void => {
    if (say !== null) clearTimeout(say)
    if (end !== null) clearTimeout(end)
    say = end = null
  }
  const dismiss = (): void => {
    clear()
    visible = false
    current = null
    el.textContent = ''
    el.hidden = true
  }
  bag.add(() => {
    dismiss()
    disposed = true
  })

  return {
    show(message) {
      if (disposed) return
      if (visible && message === current) {
        // Still up with this very text (or about to be set): keep it, restart the 2.5 s only.
        if (end !== null) clearTimeout(end)
        end = setTimeout(dismiss, TOAST_MS)
        return
      }
      clear()
      visible = true
      current = message
      el.textContent = ''
      el.hidden = false
      say = setTimeout(() => {
        say = null
        el.textContent = message
      }, REANNOUNCE_MS)
      end = setTimeout(dismiss, TOAST_MS)
    },
    dismiss,
    get visible() {
      return visible
    },
  }
}

/** Create the region inside `parent` (the shell's viewport) and wire it to the bag. */
export function mountToast(doc: Document, parent: HTMLElement, bag: DisposableBag): Toast {
  const el = doc.createElement('div')
  el.className = 'cr-toast'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  el.setAttribute('aria-atomic', 'true')
  el.dataset.testid = 'toast'
  el.hidden = true
  parent.appendChild(el)
  bag.add(() => el.remove())
  return createToast(el, bag)
}
