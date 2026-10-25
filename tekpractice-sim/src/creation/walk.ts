/**
 * Walking in Mode Création (Task 19, C11, S6): the walker's settings and spawn. Pure.
 *
 * The legacy ExploreController walks; the shell owns every other key. Its bindings keep
 * movement only:
 * - arrows + WASD by KeyboardEvent.code (the same physical keys are ZQSD on AZERTY);
 * - no Q / E crouch: the ear height (1.2 m seated, 1.7 m standing) stays what the learner chose;
 * - no Esc, V, Space, F, H…: Maj+V and Esc (back to Orbit), V, F, Alt+H are the shell's.
 * No pointer lock: Esc always reaches the shell, the cursor stays visible, and a learner
 * without a mouse walks with the keyboard alone (a left drag looks around).
 */
import { ACTIONS, type Action } from '../input/actions'
import type { Bindings } from '../input/bindings'
import { DEFAULT_SETTINGS, type ExploreSettings } from '../ui/exploreSettings'

const WALK_BINDINGS: Partial<Bindings> = {
  MOVE_FORWARD: ['KeyW', 'ArrowUp'],
  MOVE_BACK: ['KeyS', 'ArrowDown'],
  STRAFE_LEFT: ['KeyA'],
  STRAFE_RIGHT: ['KeyD'],
  TURN_LEFT: ['ArrowLeft'],
  TURN_RIGHT: ['ArrowRight'],
  LOOK_UP: ['PageUp'],
  LOOK_DOWN: ['PageDown'],
  RUN: ['ShiftLeft', 'ShiftRight'],
}

export const CREATION_WALK_SETTINGS: ExploreSettings = {
  ...DEFAULT_SETTINGS,
  pointerLock: 'never',
  levelView: 'orbit',
  bindings: Object.fromEntries(ACTIONS.map((a: Action) => [a, [...(WALK_BINDINGS[a] ?? [])]])) as Bindings,
}

type XYZ = { x: number; y: number; z: number }

/**
 * Where the walk starts: a room's own spawn (its anchor, facing the stage); otherwise
 * (blank room, venue set) where the orbit camera stands, kept 0.6 m inside the floor,
 * facing the orbit target (as the legacy walker does).
 */
export function walkSpawn(
  layout: { spawn: { x: number; z: number; yaw: number } } | null,
  floor: { width: number; length: number },
  eye: XYZ,
  target: XYZ
): { x: number; z: number; yaw: number } {
  if (layout) return { ...layout.spawn }
  const clampIn = (v: number, half: number): number => Math.max(-half + 0.6, Math.min(half - 0.6, v))
  const x = clampIn(eye.x, floor.width / 2)
  const z = clampIn(eye.z, floor.length / 2)
  return { x, z, yaw: Math.atan2(target.x - x, target.z - z) }
}
