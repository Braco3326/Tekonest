// A keyboard way to the guide's icon from anywhere in the page.
//
// On the 3D canvas the page keeps Tab for itself (Focus and Patch cycles the devices with it, and Mode Création leaves it to the browser only from its own
// controls), so Tab does not always lead to the icon, which comes last in the page. This adds one chord, Alt+Shift+O, that puts the focus on the icon.
//
// - Two modifiers and a letter, read by the physical key (`code`), so a layout that types another character with Alt still matches. Never a single character.
// - It takes no other key: Escape, Tab, the letters and the page's own chords go on as before. The chord itself is consumed only when the icon took the focus.
// - Not from a text field (a learner typing), and only in practice mode: the address is read at every press with the same gate as the mount.
// - Installed once, right after the guide has mounted (src/guide/index.ts), so an exam address, `?oscar=0` or a page where the guide stays off never gets it.
//   When the icon is gone (the guide was destroyed) the listener removes itself at the next press.
// - The sentence that announces it is added to the icon's own screen reader hint (the element its `aria-describedby` names).
import { guideMode, guideRouteAllowed, type GuideRoute } from './mode'
import { TP_STRINGS } from './strings'

export const FOCUS_ICON_CHORD = 'Alt+Shift+O'

export interface KeyLike {
  code?: string
  key?: string
  altKey?: boolean
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  repeat?: boolean
  isComposing?: boolean
}

/** Alt + Shift + the O key, with no other modifier, not a held key and not part of a composition. */
export function isFocusChord(e: KeyLike): boolean {
  return e.code === 'KeyO' && e.altKey === true && e.shiftKey === true && e.ctrlKey !== true && e.metaKey !== true && e.repeat !== true && e.isComposing !== true
}

/** A target the learner types in: an input, a text area, a select or an editable element. */
export function isTextTarget(t: unknown): boolean {
  if (t === null || typeof t !== 'object') return false
  const el = t as { tagName?: unknown; isContentEditable?: unknown }
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}

const ICON = '[data-oscar-root] .oscar-icon'

/** Adds the shortcut's sentence to the icon's hint, once. */
function announce(doc: Document): void {
  const icon = doc.querySelector(ICON)
  const id = icon === null ? null : icon.getAttribute('aria-describedby')
  const hint = id === null ? null : doc.getElementById(id)
  if (hint === null) return
  const text = hint.textContent ?? ''
  if (!text.includes(TP_STRINGS.focusKey.hint)) hint.textContent = text === '' ? TP_STRINGS.focusKey.hint : `${text} ${TP_STRINGS.focusKey.hint}`
}

/** Installs the shortcut for a mounted guide. Never throws; the page is untouched when anything is missing. */
export function installFocusKey(win: Window, route: GuideRoute): void {
  try {
    const doc = win.document
    if (typeof doc.addEventListener !== 'function' || typeof doc.removeEventListener !== 'function') return
    const onKey = (e: KeyboardEvent): void => {
      try {
        if (!isFocusChord(e) || isTextTarget(e.target)) return
        if (!guideRouteAllowed(win.location.search, route) || guideMode(win.location.search, route) !== 'practice') return
        const icon = doc.querySelector<HTMLElement>(ICON)
        if (icon === null) {
          doc.removeEventListener('keydown', onKey)
          return
        }
        icon.focus({ preventScroll: true })
        if (doc.activeElement === icon) e.preventDefault()
      } catch {
        // a shortcut never breaks the page
      }
    }
    doc.addEventListener('keydown', onKey)
    announce(doc)
  } catch {
    // no usable document: no shortcut
  }
}
