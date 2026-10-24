import { afterEach, describe, expect, it } from 'vitest'
import { CameraTween, type TweenCamera, type TweenScene } from '../../src/scene/cameraTween'
import { setMotionOverride } from '../../src/design/tokens'
import type { PoseValues } from '../../src/camera/tween'

class FakeScene implements TweenScene {
  observers: Array<() => void> = []
  adds = 0
  removes = 0
  onBeforeRenderObservable = {
    add: (cb: () => void) => {
      this.adds++
      this.observers.push(cb)
      return cb
    },
    remove: (o: unknown) => {
      const i = this.observers.indexOf(o as () => void)
      if (i < 0) return false
      this.removes++
      this.observers.splice(i, 1)
      return true
    },
  }
  frame(): void {
    for (const o of [...this.observers]) o()
  }
}

function fakeCamera(): TweenCamera & { setTargetCalls: number } {
  const cam = {
    alpha: 0,
    beta: 1,
    radius: 10,
    target: { x: 0, y: 0, z: 0 },
    setTargetCalls: 0,
    setTarget(t: { x: number; y: number; z: number }) {
      cam.setTargetCalls++
      cam.target = { x: t.x, y: t.y, z: t.z }
    },
  }
  return cam
}

const goal: PoseValues = { alpha: 1, beta: 0.5, radius: 4, target: [2, 4, 6] }

function setup() {
  let t = 0
  const scene = new FakeScene()
  const cam = fakeCamera()
  const tween = new CameraTween(cam, scene, () => t)
  return { scene, cam, tween, advance: (ms: number) => (t += ms) }
}

afterEach(() => setMotionOverride(null))

describe('CameraTween', () => {
  it('registers no observer while idle', () => {
    const { scene, tween } = setup()
    expect(scene.observers).toHaveLength(0)
    expect(tween.active).toBe(false)
  })

  it('registers one observer during a tween and removes it on done', async () => {
    setMotionOverride(true)
    const { scene, cam, tween, advance } = setup()
    const p = tween.to(goal, 400)
    expect(tween.active).toBe(true)
    expect(scene.observers).toHaveLength(1)
    advance(200)
    scene.frame()
    expect(cam.alpha).toBeCloseTo(0.5, 9) // eased midpoint
    expect(scene.observers).toHaveLength(1)
    advance(200)
    scene.frame()
    await expect(p).resolves.toBe('done')
    expect(scene.observers).toHaveLength(0)
    expect(tween.active).toBe(false)
    expect(cam.alpha).toBe(1)
    expect(cam.beta).toBe(0.5)
    expect(cam.radius).toBe(4)
    expect(cam.target).toEqual({ x: 2, y: 4, z: 6 })
  })

  it('removes the observer on cancel and resolves cancelled', async () => {
    setMotionOverride(true)
    const { scene, cam, tween, advance } = setup()
    const p = tween.to(goal, 400)
    advance(100)
    scene.frame()
    const mid = cam.alpha
    tween.cancel()
    await expect(p).resolves.toBe('cancelled')
    expect(scene.observers).toHaveLength(0)
    expect(tween.active).toBe(false)
    advance(400)
    scene.frame() // no observers left; camera stays where the user took over
    expect(cam.alpha).toBe(mid)
  })

  it('cancel() when idle is a no-op', () => {
    const { scene, tween } = setup()
    tween.cancel()
    expect(scene.removes).toBe(0)
  })

  it('reduced motion applies the pose instantly, resolves done, registers nothing', async () => {
    setMotionOverride(false)
    const { scene, cam, tween } = setup()
    const p = tween.to(goal)
    expect(scene.adds).toBe(0)
    expect(tween.active).toBe(false)
    expect(cam.alpha).toBe(1)
    expect(cam.radius).toBe(4)
    expect(cam.target).toEqual({ x: 2, y: 4, z: 6 })
    await expect(p).resolves.toBe('done')
  })

  it('a second to() cancels the first and keeps a single observer', async () => {
    setMotionOverride(true)
    const { scene, cam, tween, advance } = setup()
    const first = tween.to(goal, 400)
    advance(100)
    scene.frame()
    const second = tween.to({ ...goal, alpha: -1 }, 400)
    await expect(first).resolves.toBe('cancelled')
    expect(scene.observers).toHaveLength(1)
    advance(400)
    scene.frame()
    await expect(second).resolves.toBe('done')
    expect(cam.alpha).toBeCloseTo(-1, 9)
    expect(scene.observers).toHaveLength(0)
  })

  it('takes the short way round in alpha', async () => {
    setMotionOverride(true)
    const { scene, cam, tween, advance } = setup()
    cam.alpha = 3.0
    const p = tween.to({ ...goal, alpha: -3.0 }, 400)
    advance(400)
    scene.frame()
    await p
    expect(cam.alpha).toBeCloseTo(3.0 + 0.283, 3) // not −3.0, no spin back through 0
  })

  it('respects camera radius/beta limits', async () => {
    setMotionOverride(true)
    const { scene, cam, tween, advance } = setup()
    Object.assign(cam, { lowerRadiusLimit: 5, upperBetaLimit: 0.4 })
    const p = tween.to(goal, 100)
    advance(100)
    scene.frame()
    await p
    expect(cam.radius).toBe(5)
    expect(cam.beta).toBe(0.4)
  })

  describe('cancelOnUserInput', () => {
    function listeners() {
      const map = new Map<string, Set<() => void>>()
      return {
        addEventListener: (type: string, cb: () => void) => {
          if (!map.has(type)) map.set(type, new Set())
          map.get(type)!.add(cb)
        },
        removeEventListener: (type: string, cb: () => void) => map.get(type)?.delete(cb),
        fire: (type: string) => map.get(type)?.forEach((cb) => cb()),
        count: (type: string) => map.get(type)?.size ?? 0,
      }
    }

    it('pointerdown and wheel on the canvas, keydown on the window, cancel an active tween', async () => {
      setMotionOverride(true)
      for (const [target, type] of [
        ['canvas', 'pointerdown'],
        ['canvas', 'wheel'],
        ['win', 'keydown'],
      ] as const) {
        const { scene, tween } = setup()
        const canvas = listeners()
        const win = listeners()
        tween.cancelOnUserInput(canvas, win)
        const p = tween.to(goal, 400)
        ;(target === 'canvas' ? canvas : win).fire(type)
        await expect(p).resolves.toBe('cancelled')
        expect(scene.observers).toHaveLength(0)
      }
    })

    it('does nothing when no tween is active', () => {
      const { scene, tween } = setup()
      const canvas = listeners()
      const win = listeners()
      tween.cancelOnUserInput(canvas, win)
      canvas.fire('pointerdown')
      win.fire('keydown')
      expect(scene.removes).toBe(0)
    })

    it('returns a disposer that detaches everything, and attaches once', () => {
      const { tween } = setup()
      const canvas = listeners()
      const win = listeners()
      const dispose = tween.cancelOnUserInput(canvas, win)
      tween.cancelOnUserInput(canvas, win)
      expect(canvas.count('pointerdown')).toBe(1)
      expect(canvas.count('wheel')).toBe(1)
      expect(win.count('keydown')).toBe(1)
      dispose()
      expect(canvas.count('pointerdown')).toBe(0)
      expect(canvas.count('wheel')).toBe(0)
      expect(win.count('keydown')).toBe(0)
    })
  })
})
