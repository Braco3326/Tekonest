/**
 * The app's one coarse-pointer detector: `(pointer: coarse)`, the query boot.ts (the hand-drawn cable's 16 px finger hit test and 44 px targets) and the 2D page
 * (a phone opens on the plan, not in the search field) already asked inline; mission 3 fixes item 3 (the undo wording on a phone) reads it too, so it lives
 * here once. Read at the moment it is needed (a tablet with a mouse plugged in changes it). No window or no matchMedia (a test, a worker): false.
 */
export function coarsePointer(win: Pick<Window, 'matchMedia'> | null | undefined = typeof window === 'undefined' ? null : window): boolean {
  return win?.matchMedia?.('(pointer: coarse)').matches ?? false
}
