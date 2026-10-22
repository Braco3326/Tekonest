/**
 * Inputs → MoveIntent (ADR-0010) — pure. Keyboard actions, the right-drag
 * "joystick" offset and accumulated look deltas become one intent per frame.
 */
import type { Action } from '../input/actions'
import type { MoveIntent } from './movement'

/** Right-drag distance (px) that means full speed. */
export const STICK_RANGE_PX = 80
/** Mouse look: radians per pixel at sensitivity 1. */
export const MOUSE_LOOK_RAD_PER_PX = 0.0025
/** Arrow-key turn rate (rad/s); look up/down runs at 60 % of it. */
export const KEY_TURN_RATE = 1.8

export interface MouseFrame {
  lookDx: number
  lookDy: number
  /** Right-drag offset from the press point (px). */
  stickDx: number
  stickDy: number
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
const axis = (held: (a: Action) => boolean, plus: Action, minus: Action) =>
  (held(plus) ? 1 : 0) - (held(minus) ? 1 : 0)

export function buildIntent(
  held: (a: Action) => boolean,
  mouse: MouseFrame,
  dt: number,
  cfg: { sensitivity: number; invertY: boolean },
): MoveIntent {
  const look = MOUSE_LOOK_RAD_PER_PX * cfg.sensitivity
  return {
    forward: clamp1(axis(held, 'MOVE_FORWARD', 'MOVE_BACK') - mouse.stickDy / STICK_RANGE_PX),
    strafe: clamp1(axis(held, 'STRAFE_RIGHT', 'STRAFE_LEFT') + mouse.stickDx / STICK_RANGE_PX),
    vertical: axis(held, 'MOVE_UP', 'MOVE_DOWN'),
    run: held('RUN'),
    yawDelta: mouse.lookDx * look + axis(held, 'TURN_RIGHT', 'TURN_LEFT') * KEY_TURN_RATE * dt,
    pitchDelta:
      mouse.lookDy * look * (cfg.invertY ? -1 : 1) +
      axis(held, 'LOOK_DOWN', 'LOOK_UP') * KEY_TURN_RATE * 0.6 * dt,
  }
}
