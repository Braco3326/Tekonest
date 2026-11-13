/**
 * The tutorial's reserved slot (onboarding packs, plan T6.1, spec 6.6): one row of the Mode Création shell's grid that exists ONLY while a tutorial runs, so the step card never
 * overlays the 3D view, the drawer, the panels or Oscar. Neutral (the guide and the shell both import `src/design`; neither imports the other): the guide opens and closes it, the
 * shell's stylesheet (`.cr[data-tutorial='on']` in src/creation/shell/creation.css) turns the attribute into a grid row.
 *
 * The slot is the LAST child of the shell root, so its buttons come after the status bar in the tab order (spec 4.3); the grid area puts it under the menu bar. It is a plain
 * container: no role, no focus handling, no animation. Where there is no shell (the level page) nothing is created.
 */

export const TUTORIAL_SLOT_TESTID = 'tutorial-slot'
/**
 * The height (CSS px) the slot takes from the 3D view at desktop width, as an upper bound (the step card measures 49 px, its compact companion look 35 px): the first-sound framing
 * (src/creation/onboarding/framing.ts) reserves it when a tutorial is about to open the slot, so the SM58 keeps its pixels once the row is there. tests/e2e/onboarding-stepcard.spec.ts
 * asserts the slot never exceeds it at 1366 px. These are DESKTOP values (a coarse pointer's 44 px button, a window under 900 px or the closing lines make the row taller): the framing
 * does not reserve those, and does not reserve the CLOSING card at all (the first-sound framing happens at the start of the tutorial, the closing card at its end).
 */
export const TUTORIAL_ROW_PX = 49
const SHELL_ROOT = '[data-testid="creation-root"]'
const SLOT = `[data-testid="${TUTORIAL_SLOT_TESTID}"]`

/** The slot while it exists, else null. */
export function tutorialSlotOf(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SLOT)
}

/** The slot, created at the end of the shell root if it is not there yet (the root says a tutorial row exists); null when the page has no shell. */
export function openTutorialSlot(doc: Document): HTMLElement | null {
  const root = doc.querySelector<HTMLElement>(SHELL_ROOT)
  if (root === null) return null
  const had = tutorialSlotOf(doc)
  if (had !== null) {
    root.dataset.tutorial = 'on'
    return had
  }
  const slot = doc.createElement('div')
  slot.className = 'cr-tutorial-slot'
  slot.dataset.testid = TUTORIAL_SLOT_TESTID
  root.appendChild(slot)
  root.dataset.tutorial = 'on'
  return slot
}

/** The slot leaves the page at once and the row is freed. A page with no slot: nothing happens. */
export function closeTutorialSlot(doc: Document): void {
  tutorialSlotOf(doc)?.remove()
  const root = doc.querySelector<HTMLElement>(SHELL_ROOT)
  if (root !== null) delete root.dataset.tutorial
}
