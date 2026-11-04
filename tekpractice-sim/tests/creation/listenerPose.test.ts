/**
 * Task 39 (P14): the listener's RIGHT vector is the camera's rendered right, never assumed. Two independent oracles: (1) a real Babylon camera's own view
 * matrix (a FreeCamera looking at the stage), (2) the screen: a speaker the renderer DRAWS on the left half of the picture must pan left.
 */
import { describe, expect, it } from 'vitest'
import { FreeCamera, Matrix, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { listenerFromCamera, listenerAtPoint, renderedRight } from '../../src/creation/listenerPose'
import { listenerMix } from '../../src/audio/listenerMix'
import { projectToScreen } from '../../src/scene/project'

function setup(rightHanded = false) {
  const engine = new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 })
  const scene = new Scene(engine)
  scene.useRightHandedSystem = rightHanded
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } as unknown as HTMLCanvasElement
  return { engine, scene, canvas }
}
const feedAt = (instanceId: string, position: [number, number, number]) => ({ instanceId, position, channels: ['L', 'R'] as ('L' | 'R')[], gainDb: 0, muted: false, dirDb: 0 })

describe('renderedRight', () => {
  it('is the camera +x axis in the world: facing +z → +x, facing −z → −x (Babylon LH), facing +x → +z, facing −x → −z', () => {
    const cases: [number[], number[]][] = [
      [[0, 0, 1], [1, 0, 0]],
      [[0, 0, -1], [-1, 0, 0]],
      [[1, 0, 0], [0, 0, -1]],
      [[-1, 0, 0], [0, 0, 1]],
    ]
    for (const [look, right] of cases) {
      const r = renderedRight(Matrix.LookAtLH(Vector3.Zero(), Vector3.FromArray(look), Vector3.Up()))
      expect(r[0]).toBeCloseTo(right[0], 9)
      expect(r[1]).toBeCloseTo(right[1], 9)
      expect(r[2]).toBeCloseTo(right[2], 9)
    }
  })
  it('is a unit vector, level with the floor, for a camera looking down at the stage', () => {
    const r = renderedRight(Matrix.LookAtLH(new Vector3(0, 1.7, 8), new Vector3(0, 1.2, -6), Vector3.Up()))
    expect(Math.hypot(...r)).toBeCloseTo(1, 9)
    expect(r[1]).toBeCloseTo(0, 9)
  })
})

describe('listenerFromCamera / listenerAtPoint agree with a real camera', () => {
  it('a FreeCamera at the Régie looking at the stage: the helper gives its position and the same right as its own view matrix', () => {
    const { scene } = setup()
    const cam = new FreeCamera('walk', new Vector3(0, 1.2, 8), scene)
    cam.setTarget(new Vector3(0, 1.2, -6))
    scene.activeCamera = cam
    scene.render()
    const l = listenerFromCamera(cam)
    expect(l.position).toEqual([0, 1.2, 8])
    expect(l.right[0]).toBeCloseTo(-1, 9)
    const point = listenerAtPoint([0, 1.2, 8], [0, 1.2, -6])
    expect(point.right[0]).toBeCloseTo(l.right[0], 9)
    expect(point.right[1]).toBeCloseTo(l.right[1], 9)
    expect(point.right[2]).toBeCloseTo(l.right[2], 9)
  })
  it('a listening point that looks straight down (no heading) falls back to facing the stage end (−z), never NaN', () => {
    const l = listenerAtPoint([2, 5, 2], [2, 0, 2])
    expect(l.right.every(Number.isFinite)).toBe(true)
    expect(l.right[0]).toBeCloseTo(-1, 9)
  })
  it('a right-handed scene is looked up with the right-handed matrix (the helper does not assume the handedness)', () => {
    const lh = listenerAtPoint([0, 1.2, 8], [0, 1.2, -6], false)
    const rh = listenerAtPoint([0, 1.2, 8], [0, 1.2, -6], true)
    expect(lh.right[0]).toBeCloseTo(-1, 9)
    expect(rh.right[0]).toBeCloseTo(1, 9) // the same look-at, mirrored world: the oracle for it is the rendering below
    const { scene, engine, canvas } = setup(true)
    const cam = new FreeCamera('rh', new Vector3(0, 1.2, 8), scene)
    cam.setTarget(new Vector3(0, 1.2, -6))
    scene.activeCamera = cam
    scene.render()
    const p = projectToScreen(new Vector3(4, 1.2, -5), scene, cam, engine, canvas)!
    expect(Math.sign(p.x - 400)).toBe(Math.sign(rh.right[0])) // the +x speaker is drawn on the right in an RH scene
  })
})

describe('P14: the pan side is the side the renderer draws the speaker on', () => {
  it('Régie facing the stage: k12-g at world +x is drawn on the LEFT of the picture and pans LEFT; k12-d at −x the opposite', () => {
    const { scene, engine, canvas } = setup()
    const cam = new FreeCamera('walk', new Vector3(0, 1.2, 8), scene)
    cam.setTarget(new Vector3(0, 1.2, -6))
    cam.fov = 1
    scene.activeCamera = cam
    scene.render()
    const listener = listenerFromCamera(cam)
    const g: [number, number, number] = [6, 2.7, -7.5]
    const d: [number, number, number] = [-6, 2.7, -7.5]
    const screenG = projectToScreen(new Vector3(...g), scene, cam, engine, canvas)!
    const screenD = projectToScreen(new Vector3(...d), scene, cam, engine, canvas)!
    expect(screenG.x).toBeLessThan(400) // drawn left of centre
    expect(screenD.x).toBeGreaterThan(400)
    const v = listenerMix({ listener, feeds: [feedAt('k12-g', g), feedAt('k12-d', d)] })
    expect(v.find((x) => x.instanceId === 'k12-g')!.pan).toBeLessThan(0)
    expect(v.find((x) => x.instanceId === 'k12-d')!.pan).toBeGreaterThan(0)
    expect(Math.sign(v[0].pan)).toBe(Math.sign(screenG.x - 400))
    expect(Math.sign(v[1].pan)).toBe(Math.sign(screenD.x - 400))
  })
  it('turn the camera around: the same speaker is now drawn on the right and pans right (the pan follows the rendering, not the world)', () => {
    const { scene, engine, canvas } = setup()
    const cam = new FreeCamera('back', new Vector3(0, 1.2, -12), scene)
    cam.setTarget(new Vector3(0, 1.2, 6)) // facing +z
    scene.activeCamera = cam
    scene.render()
    const g: [number, number, number] = [6, 2.7, -7.5]
    const sx = projectToScreen(new Vector3(...g), scene, cam, engine, canvas)!.x
    const v = listenerMix({ listener: listenerFromCamera(cam), feeds: [feedAt('k12-g', g)] })
    expect(sx).toBeGreaterThan(400)
    expect(v[0].pan).toBeGreaterThan(0)
  })
})
