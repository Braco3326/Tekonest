/**
 * Drawer drag-and-drop decisions (Task 43b, CA-23 rest): pure, no DOM, no Babylon. The drawer (pointer events, so mouse AND
 * touch; HTML5 drag-and-drop does not exist on touch) and the shell glue ask these three questions.
 */

/** A press on a drawer item that travels MORE than this many CSS px starts a placement; less is the click it always was. */
export const DRAG_START_PX = 6

type P = { x: number; y: number }

/** True once the pointer is strictly more than `px` away from where it pressed. */
export function pastDragThreshold(from: P, to: P, px: number = DRAG_START_PX): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > px
}

/** A page (client) point as canvas-relative px, the coordinates the placement controller works in. */
export function toCanvasPx(client: P, rect: { left: number; top: number }): P {
  return { x: client.x - rect.left, y: client.y - rect.top }
}

export type ReleaseAction = 'drop' | 'cancel'

/**
 * What a release does: drop only when the pointer ended over the 3D view and the gesture was not cancelled (Échap, a pointer
 * cancel); over anything else (a panel, a menu, the status bar, a button on the view) it cancels.
 */
export function releaseAction(input: { overView: boolean; cancelled?: boolean }): ReleaseAction {
  return input.overView && !input.cancelled ? 'drop' : 'cancel'
}
