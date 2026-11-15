/**
 * The keys of a hand-drawn cable (mission 3 B stage 2, spec §2 « Full keyboard »). Pure.
 *
 * While a cable is TRACED (and only then; cableRouteController.ts listens in the capture phase, ahead of the shell's key map and of Babylon's own arrow orbit):
 * arrows = move the cursor one step (Maj: BIG_STEP_FACTOR steps), Entrée = place a point, Maj+Entrée = finish, Retour arrière = remove the last point,
 * Échap = cancel. In the « Points du tracé » zone of a selected cable (its own element, keys stopped there): arrows move the chosen point, Page suiv. / Page préc.
 * change point, Suppr deletes it. No character key (WCAG 2.1.4), no chord with Ctrl / Alt / Meta (Ctrl+Z stays the undo, the whole tracing in one step).
 * tests/creation/traceKeys.test.ts pins that none of them clashes with the key map (creationActions.ts).
 */
export type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
export type TraceKeyAction = { kind: 'arrow'; key: Arrow; big: boolean } | { kind: 'place' } | { kind: 'finish' } | { kind: 'remove' } | { kind: 'cancel' }

const ARROWS: readonly Arrow[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

/** The chords of a tracing (code chords, Shift as `Shift+`), for the no-clash test and the shortcuts list. */
export const TRACE_CHORDS: readonly string[] = [...ARROWS, ...ARROWS.map((a) => `Shift+${a}`), 'Enter', 'NumpadEnter', 'Shift+Enter', 'Backspace', 'Escape']
/** The chords of the « Points du tracé » zone. */
export const POINT_ZONE_CHORDS: readonly string[] = [...ARROWS, ...ARROWS.map((a) => `Shift+${a}`), 'PageUp', 'PageDown', 'Delete']

type KeyLike = { code: string; key: string; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }

export function traceKeyOf(e: KeyLike): TraceKeyAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  const arrow = ARROWS.find((a) => e.code === a || e.key === a)
  if (arrow) return { kind: 'arrow', key: arrow, big: e.shiftKey === true }
  if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Enter') return e.shiftKey ? { kind: 'finish' } : { kind: 'place' }
  if (e.shiftKey) return null
  if (e.code === 'Backspace' || e.key === 'Backspace') return { kind: 'remove' }
  if (e.code === 'Escape' || e.key === 'Escape') return { kind: 'cancel' }
  return null
}

const sign = (v: number): -1 | 0 | 1 => ((Math.sign(v) || 0) as -1 | 0 | 1)

/**
 * An arrow as a step on the floor grid, as seen from the orbit camera (`alpha`, Babylon's ArcRotateCamera: the camera sits at target + r(cos α, ·, sin α)):
 * ↑ = away from the viewer, → = to the viewer's right; held on the nearer room axis (a 45° view goes along x).
 */
export function arrowToGrid(key: Arrow, alpha: number): { dx: -1 | 0 | 1; dz: -1 | 0 | 1 } {
  const f = { x: -Math.cos(alpha), z: -Math.sin(alpha) }
  const r = { x: f.z, z: -f.x }
  const v = key === 'ArrowUp' ? f : key === 'ArrowDown' ? { x: -f.x, z: -f.z } : key === 'ArrowRight' ? r : { x: -r.x, z: -r.z }
  return Math.abs(v.x) >= Math.abs(v.z) - 1e-12 ? { dx: sign(v.x), dz: 0 } : { dx: 0, dz: sign(v.z) }
}
