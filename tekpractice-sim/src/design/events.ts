/**
 * Neutral event names shared by the creation shell and the guide (neither may
 * import the other; both may import `src/design`). Spec 6.1.
 */

/** `CustomEvent` on `window` from the guide to creation: `{ step, helperUnlocked }`. */
export const TUTORIAL_EVENT = 'tekpractice:tutorial'
