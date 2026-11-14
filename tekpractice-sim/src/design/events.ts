/**
 * Neutral event names shared by the creation shell and the guide (neither may
 * import the other; both may import `src/design`). Spec 6.1.
 */

/** `CustomEvent` on `window` from the guide to creation: `{ step, helperUnlocked }`. */
export const TUTORIAL_EVENT = 'tekpractice:tutorial'

/**
 * `CustomEvent` on `window` from the guide to creation: `{ instance }`, the bench device the tutorial's current step points at (null: none).
 * Mode Création brings it into the 3D view when it is not there (src/creation/onboarding/tutorialFocus.ts); told on each change only.
 */
export const TUTORIAL_FOCUS_EVENT = 'tekpractice:tutorial-focus'
