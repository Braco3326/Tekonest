import { describe, expect, it } from 'vitest'
import {
  EYE,
  initialPlayer,
  PITCH_LIMIT,
  RUN_MULT,
  stepPlayer,
  WALK_SPEED,
  type MoveIntent,
  type PlayerState,
} from '../../src/explore/movement'
import { circleHitsBox, resolveMove, roomWalls, type Box } from '../../src/explore/collision'
import { resolveEsc, type EscContext } from '../../src/explore/escChain'
import { rotateStep, snapToGrid } from '../../src/explore/placement'

const idle: MoveIntent = { forward: 0, strafe: 0, vertical: 0, run: false, yawDelta: 0, pitchDelta: 0 }
const opts = { speedMult: 1, reducedMotion: false }

/** Run the integrator for `seconds` at 60 Hz. */
function run(p: PlayerState, intent: MoveIntent, seconds: number, o = opts): PlayerState {
  let s = p
  for (let t = 0; t < seconds; t += 1 / 60) s = stepPlayer(s, intent, 1 / 60, o)
  return s
}
const speed = (p: PlayerState) => Math.hypot(p.vx, p.vz)

describe('movement', () => {
  it('starts at standing eye height, facing +Z, still', () => {
    const p = initialPlayer(1, 2)
    expect(p).toMatchObject({ x: 1, z: 2, eye: EYE.stand, yaw: 0, pitch: 0, vx: 0, vz: 0 })
  })

  it('accelerates smoothly toward walking speed (no instant jump)', () => {
    const first = stepPlayer(initialPlayer(), { ...idle, forward: 1 }, 1 / 60, opts)
    expect(speed(first)).toBeGreaterThan(0)
    expect(speed(first)).toBeLessThan(WALK_SPEED * 0.5)
    const later = run(initialPlayer(), { ...idle, forward: 1 }, 1)
    expect(speed(later)).toBeCloseTo(WALK_SPEED, 1)
    expect(later.z).toBeGreaterThan(0.8) // walked forward along +Z at yaw 0
    expect(Math.abs(later.x)).toBeLessThan(1e-9)
  })

  it('decelerates to a stop when keys are released', () => {
    const moving = run(initialPlayer(), { ...idle, forward: 1 }, 1)
    const stopped = run(moving, idle, 1)
    expect(speed(stopped)).toBeLessThan(0.01)
  })

  it('never moves faster diagonally than straight', () => {
    const diag = run(initialPlayer(), { ...idle, forward: 1, strafe: 1 }, 2)
    expect(speed(diag)).toBeCloseTo(WALK_SPEED, 1)
  })

  it('Shift runs at RUN_MULT × walk, scaled by the speed setting', () => {
    const r = run(initialPlayer(), { ...idle, forward: 1, run: true }, 2)
    expect(speed(r)).toBeCloseTo(WALK_SPEED * RUN_MULT, 1)
    const slow = run(initialPlayer(), { ...idle, forward: 1 }, 2, { ...opts, speedMult: 0.5 })
    expect(speed(slow)).toBeCloseTo(WALK_SPEED * 0.5, 1)
  })

  it('moves relative to where you look (yaw 90° → forward is +X)', () => {
    const p = { ...initialPlayer(), yaw: Math.PI / 2 }
    const r = run(p, { ...idle, forward: 1 }, 1)
    expect(r.x).toBeGreaterThan(0.8)
    expect(Math.abs(r.z)).toBeLessThan(1e-6)
    const s = run(p, { ...idle, strafe: 1 }, 1) // strafe right at yaw 90° → −Z
    expect(s.z).toBeLessThan(-0.8)
  })

  it('clamps pitch to ±85° and wraps yaw', () => {
    const up = stepPlayer(initialPlayer(), { ...idle, pitchDelta: -10 }, 1 / 60, opts)
    expect(up.pitch).toBeCloseTo(-PITCH_LIMIT)
    const down = stepPlayer(initialPlayer(), { ...idle, pitchDelta: 10 }, 1 / 60, opts)
    expect(down.pitch).toBeCloseTo(PITCH_LIMIT)
    const spun = stepPlayer(initialPlayer(), { ...idle, yawDelta: 7 }, 1 / 60, opts)
    expect(spun.yaw).toBeGreaterThanOrEqual(-Math.PI)
    expect(spun.yaw).toBeLessThanOrEqual(Math.PI)
  })

  it('Q/E change eye height within [min, max]', () => {
    const low = run(initialPlayer(), { ...idle, vertical: -1 }, 5)
    expect(low.eye).toBeCloseTo(EYE.min)
    const high = run(initialPlayer(), { ...idle, vertical: 1 }, 5)
    expect(high.eye).toBeCloseTo(EYE.max)
  })

  it('reduced motion reaches target speed faster (shorter easing)', () => {
    const calm = stepPlayer(initialPlayer(), { ...idle, forward: 1 }, 1 / 60, { ...opts, reducedMotion: true })
    const normal = stepPlayer(initialPlayer(), { ...idle, forward: 1 }, 1 / 60, opts)
    expect(speed(calm)).toBeGreaterThan(speed(normal))
  })

  it('survives a huge frame (tab switch): dt is capped', () => {
    const p = stepPlayer(initialPlayer(), { ...idle, forward: 1, run: true }, 5, opts)
    expect(p.z).toBeLessThan(1)
  })
})

describe('collision', () => {
  const wall: Box = { minX: -5, maxX: 5, minZ: 2, maxZ: 2.2, height: 3 }
  const cable: Box = { minX: -5, maxX: 5, minZ: 1, maxZ: 1.05, height: 0.02 }
  const crate: Box = { minX: 1, maxX: 2, minZ: -0.5, maxZ: 0.5, height: 1 }

  it('detects circle vs box overlap', () => {
    expect(circleHitsBox(0, 1.8, 0.3, wall)).toBe(true)
    expect(circleHitsBox(0, 1.5, 0.3, wall)).toBe(false)
  })

  it('stops at a wall', () => {
    const r = resolveMove({ x: 0, z: 1.5 }, { x: 0, z: 1.9 }, 0.3, [wall])
    expect(r.z).toBeLessThanOrEqual(1.7 + 1e-9)
  })

  it('slides along a wall when walking diagonally into it', () => {
    const r = resolveMove({ x: 0, z: 1.6 }, { x: 0.4, z: 1.95 }, 0.3, [wall])
    expect(r.x).toBeCloseTo(0.4)
    expect(r.z).toBeLessThanOrEqual(1.7 + 1e-9)
  })

  it('steps over cables and ramps (height ≤ 0.25 m)', () => {
    const r = resolveMove({ x: 0, z: 0.5 }, { x: 0, z: 1.5 }, 0.3, [cable])
    expect(r.z).toBeCloseTo(1.5)
  })

  it('blocks on a crate', () => {
    const r = resolveMove({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.3, [crate])
    expect(r.x).toBeLessThanOrEqual(0.7 + 1e-9)
  })

  it('does not tunnel through a thin wall on a big step', () => {
    const r = resolveMove({ x: 0, z: 0 }, { x: 0, z: 5 }, 0.3, [wall])
    expect(r.z).toBeLessThan(2)
  })

  it('lets you walk out of a box you already overlap (device dropped on you)', () => {
    const r = resolveMove({ x: 1.5, z: 0 }, { x: 1.5, z: -1 }, 0.3, [crate])
    expect(r.z).toBeCloseTo(-1)
  })

  it('builds four walls around a room so you cannot leave it', () => {
    const walls = roomWalls(10, 8, 3)
    expect(walls).toHaveLength(4)
    const r = resolveMove({ x: 0, z: 0 }, { x: 0, z: 10 }, 0.3, walls)
    expect(r.z).toBeLessThan(4)
    const s = resolveMove({ x: 0, z: 0 }, { x: -9, z: 0 }, 0.3, walls)
    expect(s.x).toBeGreaterThan(-5)
  })
})

describe('Esc chain (ADR-0010 Décision 5)', () => {
  const base: EscContext = {
    pointerLocked: false,
    msSinceUnlock: 10_000,
    placing: false,
    openPanels: 0,
    holdingCable: false,
    focused: false,
    view: 'explore',
  }
  it.each([
    [{ pointerLocked: true, placing: true, openPanels: 1 }, 'release-pointer'],
    [{ msSinceUnlock: 50, placing: true }, 'ignore'],
    [{ placing: true, openPanels: 1, holdingCable: true }, 'cancel-placement'],
    [{ openPanels: 2, holdingCable: true, focused: true }, 'close-panel'],
    [{ holdingCable: true, focused: true }, 'drop-cable'],
    [{ focused: true }, 'leave-focus'],
    [{}, 'open-pause'],
    [{ view: 'orbit' }, 'none'],
  ] as [Partial<EscContext>, string][])('%o → %s', (ctx, expected) => {
    expect(resolveEsc({ ...base, ...ctx })).toBe(expected)
  })
})

describe('placement', () => {
  it('snaps to a 0.25 m grid', () => {
    expect(snapToGrid(1.12)).toBeCloseTo(1.0)
    expect(snapToGrid(1.13)).toBeCloseTo(1.25)
    expect(snapToGrid(-0.37)).toBeCloseTo(-0.25)
    expect(snapToGrid(0.6, 0.5)).toBeCloseTo(0.5)
  })

  it('rotates by 90° steps and wraps into [0, 360)', () => {
    expect(rotateStep(0, 1)).toBe(90)
    expect(rotateStep(270, 1)).toBe(0)
    expect(rotateStep(0, -1)).toBe(270)
  })
})
