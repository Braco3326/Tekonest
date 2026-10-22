import { describe, expect, it } from 'vitest'
import type { Action } from '../../src/input/actions'
import { buildIntent, KEY_TURN_RATE, MOUSE_LOOK_RAD_PER_PX, STICK_RANGE_PX } from '../../src/explore/intent'

const heldOf =
  (...actions: Action[]) =>
  (a: Action): boolean =>
    actions.includes(a)
const none = heldOf()
const cfg = { sensitivity: 1, invertY: false }
const noMouse = { lookDx: 0, lookDy: 0, stickDx: 0, stickDy: 0 }

describe('buildIntent', () => {
  it('maps held movement actions to axes', () => {
    const i = buildIntent(heldOf('MOVE_FORWARD', 'STRAFE_LEFT', 'MOVE_UP', 'RUN'), noMouse, 1 / 60, cfg)
    expect(i).toMatchObject({ forward: 1, strafe: -1, vertical: 1, run: true })
  })

  it('opposite keys cancel out', () => {
    const i = buildIntent(heldOf('MOVE_FORWARD', 'MOVE_BACK'), noMouse, 1 / 60, cfg)
    expect(i.forward).toBe(0)
  })

  it('right-drag acts as a joystick: drag up = forward, right = strafe right, clamped to 1', () => {
    const i = buildIntent(none, { ...noMouse, stickDx: STICK_RANGE_PX / 2, stickDy: -STICK_RANGE_PX * 3 }, 1 / 60, cfg)
    expect(i.forward).toBe(1)
    expect(i.strafe).toBeCloseTo(0.5)
  })

  it('mouse look scales by sensitivity; invert Y flips pitch only', () => {
    const i = buildIntent(none, { ...noMouse, lookDx: 100, lookDy: 50 }, 1 / 60, { sensitivity: 2, invertY: false })
    expect(i.yawDelta).toBeCloseTo(100 * MOUSE_LOOK_RAD_PER_PX * 2)
    expect(i.pitchDelta).toBeCloseTo(50 * MOUSE_LOOK_RAD_PER_PX * 2)
    const inv = buildIntent(none, { ...noMouse, lookDx: 100, lookDy: 50 }, 1 / 60, { sensitivity: 2, invertY: true })
    expect(inv.yawDelta).toBeCloseTo(i.yawDelta)
    expect(inv.pitchDelta).toBeCloseTo(-i.pitchDelta)
  })

  it('arrow keys turn at a fixed rate (keyboard-only access)', () => {
    const i = buildIntent(heldOf('TURN_RIGHT', 'LOOK_UP'), noMouse, 0.5, cfg)
    expect(i.yawDelta).toBeCloseTo(KEY_TURN_RATE * 0.5)
    expect(i.pitchDelta).toBeCloseTo(-KEY_TURN_RATE * 0.5 * 0.6)
  })
})
