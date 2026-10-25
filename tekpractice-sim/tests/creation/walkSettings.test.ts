/**
 * Task 19 (C11): the walker's settings in Mode Création. Movement only (the shell owns
 * every other key: Maj+V, Esc, V, F…); arrows + WASD by code (ZQSD on AZERTY: same
 * physical keys); the ear height is fixed (no Q / E crouch); no pointer lock, so Esc always
 * reaches the shell and a learner without a mouse walks with the keyboard alone.
 */
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import { CREATION_WALK_SETTINGS, walkSpawn } from '../../src/creation/walk'

const B = CREATION_WALK_SETTINGS.bindings

describe('CREATION_WALK_SETTINGS', () => {
  it('binds arrows and WASD (by code) to walking and turning', () => {
    expect(B.MOVE_FORWARD).toEqual(expect.arrayContaining(['KeyW', 'ArrowUp']))
    expect(B.MOVE_BACK).toEqual(expect.arrayContaining(['KeyS', 'ArrowDown']))
    expect(B.STRAFE_LEFT).toEqual(['KeyA'])
    expect(B.STRAFE_RIGHT).toEqual(['KeyD'])
    expect(B.TURN_LEFT).toEqual(['ArrowLeft'])
    expect(B.TURN_RIGHT).toEqual(['ArrowRight'])
    expect(B.LOOK_UP).toEqual(['PageUp'])
    expect(B.LOOK_DOWN).toEqual(['PageDown'])
    expect(B.RUN).toEqual(['ShiftLeft', 'ShiftRight'])
  })
  it('nothing else: no crouch (ear height fixed), no Esc, no V, no Space, no F…', () => {
    const walkKeys = new Set(['MOVE_FORWARD', 'MOVE_BACK', 'STRAFE_LEFT', 'STRAFE_RIGHT', 'TURN_LEFT', 'TURN_RIGHT', 'LOOK_UP', 'LOOK_DOWN', 'RUN'])
    for (const a of ACTIONS) if (!walkKeys.has(a)) expect(B[a], a).toEqual([])
  })
  it('never captures the pointer', () => {
    expect(CREATION_WALK_SETTINGS.pointerLock).toBe('never')
  })
})

describe('walkSpawn', () => {
  it('a room: its layout spawn', () => {
    expect(walkSpawn({ spawn: { x: 1, z: 2, yaw: Math.PI } }, { width: 10, length: 10 }, { x: 0, y: 5, z: 20 }, { x: 0, y: 0, z: 0 })).toEqual({ x: 1, z: 2, yaw: Math.PI })
  })
  it('no layout: where the orbit camera stands, kept 0.6 m inside the floor, facing its target', () => {
    const s = walkSpawn(null, { width: 10, length: 8 }, { x: 0, y: 5, z: 20 }, { x: 0, y: 0, z: 0 })
    expect(s.x).toBeCloseTo(0)
    expect(s.z).toBeCloseTo(4 - 0.6)
    // yaw 0 looks +z: the target (origin) is at −z, so yaw = π
    expect(Math.abs(s.yaw)).toBeCloseTo(Math.PI)
  })
})
